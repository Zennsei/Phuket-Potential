"""Fifth round of GISTDA API tests: the vector tiles of two "land" collections (about 8 requests).

Round 4 showed that the GeoJSON path GISTDA itself advertises (/features/land/collections/{id}/items) is the right
one but answers 404 "Not Found" from the data system for these private collections ("public": false), while wrong
paths answer "Service not found". Two of the collections are of type "Tile" and advertise vector tiles instead:

  649419299a3e3714ad90b3e7  Administrator Tambon  "ข้อมูลขอบเขตปกครอง จังหวัด อำเภอ ตำบล"
  64508c06289f2e54247f7e6d  population

This round asks for their TileJSON and a few tiles over Phuket (both link forms GISTDA uses: /tiles/{id}/{z}/{x}/{y}
and /tiles/{id}/{id}/{z}/{x}/{y}) and decodes any tile it gets: layer names, number of features, property names and
the first values. If tiles come back, the tambon boundaries could be rebuilt from them to check our own boundary file.

Run on your own computer:   python data-prep/gistda_api_probe5.py
Output: data-prep/out/probe5/report.txt   (text, keys removed; send it back)
        data-prep/out/probe5/*.pbf          (raw tiles: GISTDA data for our evaluation only, do not commit or publish)
Reads GISTDA_API_KEY from the environment or from .env and sends it only as the API-Key header to the gateway.
GISTDA_API_BASE can point the script at a test server; leave it unset for the real gateway.
"""
import gzip, json, math, os, re, struct, sys, urllib.error, urllib.parse, urllib.request

BASE = os.environ.get("GISTDA_API_BASE", "https://api-gateway.gistda.or.th/api/2.0/resources").rstrip("/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "probe5")
KEY_RE = re.compile(r"((?:api[_-]?key|key|token|access_token)=)[^&\"'\s<>]+", re.I)
TAMBON, POPULATION = "649419299a3e3714ad90b3e7", "64508c06289f2e54247f7e6d"
OLD_TOWN = (98.39, 7.885)


def read_key():
    if os.environ.get("GISTDA_API_KEY"):
        return os.environ["GISTDA_API_KEY"].strip()
    env = os.path.join(HERE, "..", ".env")
    if os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            if line.strip().startswith("GISTDA_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("GISTDA_API_KEY not found: add it to .env")


KEY = read_key()
if not KEY:
    sys.exit("GISTDA_API_KEY is empty: add it to .env")
report, summary = [], []
os.makedirs(OUT, exist_ok=True)


def clean(t):
    return KEY_RE.sub(r"\1<removed>", str(t).replace(KEY, "<key>"))


def log(title, text):
    text = clean(text)
    report.append(f"## {title}\n{text}\n")
    print(f"## {title}\n{text[:400]}\n", flush=True)


def get(path):
    try:
        req = urllib.request.Request(BASE + path, headers={"API-Key": KEY})
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, dict(r.headers), r.read(20_000_000)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read(3000)
    except Exception as e:
        return 0, {}, str(e).encode()


def tile_xy(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


# --- a small Mapbox Vector Tile reader (no package needed) ---
def varint(b, i):
    s = v = 0
    while True:
        c = b[i]; i += 1; v |= (c & 0x7F) << s; s += 7
        if c < 0x80:
            return v, i


def fields(b):
    i = 0
    while i < len(b):
        k, i = varint(b, i)
        f, w = k >> 3, k & 7
        if w == 0:
            v, i = varint(b, i)
        elif w == 1:
            v = b[i:i + 8]; i += 8
        elif w == 5:
            v = b[i:i + 4]; i += 4
        elif w == 2:
            n, i = varint(b, i); v = b[i:i + n]; i += n
        else:
            raise ValueError(f"wire type {w}")
        yield f, w, v


def value(b):
    for f, w, v in fields(b):
        if f == 1: return bytes(v).decode("utf-8", "replace")
        if f == 2: return round(struct.unpack("<f", v)[0], 4)
        if f == 3: return round(struct.unpack("<d", v)[0], 6)
        if f in (4, 5): return v
        if f == 6: return (v >> 1) ^ -(v & 1)
        if f == 7: return bool(v)
    return None


def read_tile(data):
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    out = []
    for f, w, v in fields(data):
        if f != 3:
            continue
        name, keys, vals, feats = "", [], [], []
        for f2, w2, v2 in fields(v):
            if f2 == 1: name = bytes(v2).decode("utf-8", "replace")
            elif f2 == 3: keys.append(bytes(v2).decode("utf-8", "replace"))
            elif f2 == 4: vals.append(value(v2))
            elif f2 == 2:
                tags, gtype = [], None
                for f3, w3, v3 in fields(v2):
                    if f3 == 2:
                        j = 0
                        while j < len(v3):
                            t, j = varint(v3, j); tags.append(t)
                    elif f3 == 3:
                        gtype = v3
                feats.append((gtype, tags))
        types = {1: "point", 2: "line", 3: "polygon"}
        sample = [{keys[t[k]]: vals[t[k + 1]] for k in range(0, len(t) - 1, 2)} for _, t in feats[:3]]
        out.append(f"layer '{name}': {len(feats)} features, geometry {sorted({types.get(g, g) for g, _ in feats})}, "
                   f"properties {keys}\n  first: {json.dumps(sample, ensure_ascii=False)[:1200]}")
    return "\n".join(out) or "no layers"


def try_tile(label, path, fname):
    st, hd, body = get(path)
    info = f"{path}\nHTTP {st} | {hd.get('Content-Type', '')} | {len(body)} bytes | via {hd.get('Via', '')}"
    ok = False
    if st == 200 and body:
        try:
            info += "\n" + read_tile(body)
            open(os.path.join(OUT, fname), "wb").write(body)
            ok = True
        except Exception as e:
            info += f"\nnot a vector tile ({e}): {body[:300]!r}"
    elif st == 204 or (st == 200 and not body):
        info += "\nempty tile (nothing there at this place)"
    else:
        info += "\n" + body[:600].decode("utf-8", "replace")
    log(label, info)
    summary.append(f"{'OK ' if ok else '   '}{st:>4}  {label}")


def try_json(label, path):
    st, hd, body = get(path)
    log(label, f"{path}\nHTTP {st} | {hd.get('Content-Type', '')} | {len(body)} bytes | via {hd.get('Via', '')}\n"
               + body[:2500].decode("utf-8", "replace"))
    summary.append(f"{'OK ' if st == 200 else '   '}{st:>4}  {label}")


try_json("1 tambon TileJSON", f"/features/land/tiles/{TAMBON}")
for z in (10, 12, 14):
    x, y = tile_xy(*OLD_TOWN, z)
    try_tile(f"2 tambon tile z{z}, form /tiles/id/id/z/x/y", f"/features/land/tiles/{TAMBON}/{TAMBON}/{z}/{x}/{y}", f"tambon_{z}_{x}_{y}.pbf")
x, y = tile_xy(*OLD_TOWN, 12)
try_tile("3 tambon tile z12, form /tiles/id/z/x/y", f"/features/land/tiles/{TAMBON}/12/{x}/{y}", f"tambon_short_12_{x}_{y}.pbf")
try_json("4 population TileJSON", f"/features/land/tiles/{POPULATION}")
try_tile("5 population tile z12, form /tiles/id/id/z/x/y", f"/features/land/tiles/{POPULATION}/{POPULATION}/12/{x}/{y}", f"population_12_{x}_{y}.pbf")
try_tile("6 population tile z12, form /tiles/id/z/x/y", f"/features/land/tiles/{POPULATION}/12/{x}/{y}", f"population_short_12_{x}_{y}.pbf")

head = f"Requests sent: {len(summary)}\nOK = HTTP 200 with a readable tile / JSON\n" + "\n".join(summary)
report.insert(0, f"## summary\n{clean(head)}\n")
open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8").write("\n".join(report))
print(clean(head))
print("saved", os.path.join(OUT, "report.txt"), "- send report.txt back (keys are removed; keep the .pbf files on your computer)")
