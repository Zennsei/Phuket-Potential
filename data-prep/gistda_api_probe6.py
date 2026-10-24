"""Sixth round of GISTDA API tests: what the colours of the Landtrendr layer mean (about 60 requests).

The Landtrendr tiles (/maps/coverage/landtrendr-all/{z}/{x}/{y}) paint changed land in 35 distinct colours with no
legend in the API. LandTrendr is a Landsat time-series method that finds the year land changed, so the 35 colours
are most likely 35 years. This round collects what is needed to work out the legend:

  1. the TileJSON of landtrendr-all and of landtrendr (full text), and three likely legend/style addresses
  2. Landtrendr tiles (zoom 13, 2 x 2 tiles, about 10 x 10 km over the old town, Ratsada and Wichit),
     for both landtrendr-all and landtrendr
  3. the yearly satellite pictures 1972-2025 of exactly the same box (one 512 x 512 picture per year, 43 years:
     every yearly layer except the two 2 m mosaics)

Claude then compares, for each colour, how green those pixels look year by year against land that never changed,
and finds the year the greenness drops (data-prep/landtrendr_legend.py). The pictures are GISTDA's copyright:
they stay on the team's computer for this check and must not be committed or published.

Run on your own computer:   python data-prep/gistda_api_probe6.py
Output: data-prep/out/probe6/report.txt  (text, keys removed)
        data-prep/out/probe6/lt_*.png, imagery_*.jpg  (for the legend check; do not commit)
Reads GISTDA_API_KEY from the environment or from .env and sends it only as the API-Key header to the gateway.
GISTDA_API_BASE can point the script at a test server; leave it unset for the real gateway.
"""
import json, math, os, re, sys, urllib.error, urllib.parse, urllib.request

BASE = os.environ.get("GISTDA_API_BASE", "https://api-gateway.gistda.or.th/api/2.0/resources").rstrip("/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "probe6")
KEY_RE = re.compile(r"((?:api[_-]?key|key|token|access_token)=)[^&\"'\s<>]+", re.I)
Z = 13
TOP_LEFT = (98.36, 7.95)          # the 2 x 2 tiles start at the tile holding this point (old town, Wichit, Ratsada)
PICTURE = 512                     # pixels per side for each yearly picture of the box


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
    print(f"## {title}\n{text[:300]}\n", flush=True)


def get(path, q=None):
    url = BASE + path
    if q:
        url += "?" + urllib.parse.urlencode(q, safe=",:")
    try:
        req = urllib.request.Request(url, headers={"API-Key": KEY})
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, dict(r.headers), r.read(20_000_000)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read(3000)
    except Exception as e:
        return 0, {}, str(e).encode()


def note(label, st, ok):
    summary.append(f"{'OK ' if ok else '   '}{st:>4}  {label}")


def tile_xy(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


def tile_merc(z, x, y):
    size = 2 * 20037508.342789244 / 2 ** z
    return -20037508.342789244 + x * size, 20037508.342789244 - (y + 1) * size, -20037508.342789244 + (x + 1) * size, 20037508.342789244 - y * size


# 1. descriptions and likely legend addresses
lt_ok = {}
for name in ("landtrendr-all", "landtrendr"):
    st, hd, body = get(f"/maps/coverage/{name}")
    lt_ok[name] = st == 200
    log(f"1 TileJSON {name}", f"HTTP {st} | {hd.get('Content-Type', '')}\n{body[:4000].decode('utf-8', 'replace')}")
    note(f"TileJSON {name}", st, st == 200)
for extra in ("legend", "style", "metadata"):
    st, hd, body = get(f"/maps/coverage/landtrendr-all/{extra}")
    log(f"1 landtrendr-all/{extra}", f"HTTP {st} | {hd.get('Content-Type', '')}\n{body[:2000].decode('utf-8', 'replace')}")
    note(f"landtrendr-all/{extra}", st, st == 200 and "image" not in hd.get("Content-Type", ""))

# 2. Landtrendr tiles, 2 x 2 at zoom 13
x0, y0 = tile_xy(*TOP_LEFT, Z)
tiles = [(x0 + dx, y0 + dy) for dy in (0, 1) for dx in (0, 1)]
for name in ("landtrendr-all", "landtrendr"):
    if not lt_ok[name]:
        continue
    for x, y in tiles:
        st, hd, body = get(f"/maps/coverage/{name}/{Z}/{x}/{y}")
        ct = hd.get("Content-Type", "")
        ok = st == 200 and ct.startswith("image/")
        if ok:
            open(os.path.join(OUT, f"lt_{name}_{Z}_{x}_{y}.png"), "wb").write(body)
        log(f"2 {name} tile {Z}/{x}/{y}", f"HTTP {st} | {ct} | {len(body)} bytes" + ("" if ok else "\n" + body[:300].decode("utf-8", "replace")))
        note(f"{name} tile {Z}/{x}/{y}", st, ok)

# 3. yearly pictures of the same box
w, s, _, n_ = tile_merc(Z, x0, y0)
_, _, e, _ = tile_merc(Z, x0 + 1, y0)
_, s, _, _ = tile_merc(Z, x0, y0 + 1)
bbox = f"{w:.2f},{s:.2f},{e:.2f},{n_:.2f}"
log("3 box of the pictures (EPSG:3857)", f"{bbox}  = tiles {Z}/{x0}..{x0 + 1}/{y0}..{y0 + 1}")
years = [1972, 1973, 1975, 1976, 1979] + list(range(1987, 2012)) + list(range(2013, 2026))
for yv in years:
    st, hd, body = get("/gfms/service/", {"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": f"thailand_sat_{yv}",
                                          "STYLES": "", "CRS": "EPSG:3857", "BBOX": bbox, "WIDTH": PICTURE, "HEIGHT": PICTURE, "FORMAT": "image/jpeg"})
    ct = hd.get("Content-Type", "")
    ok = st == 200 and ct.startswith("image/")
    if ok:
        open(os.path.join(OUT, f"imagery_{yv}.jpg"), "wb").write(body)
    note(f"imagery {yv}", st, ok)
    if not ok:
        log(f"3 imagery {yv}", f"HTTP {st} | {ct}\n{body[:300].decode('utf-8', 'replace')}")

head = f"Requests sent: {len(summary)}\nOK = HTTP 200 with the expected content\n" + "\n".join(summary)
report.insert(0, f"## summary\n{clean(head)}\n")
open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8").write("\n".join(report))
print(clean(head))
print("saved", OUT, "- tell Claude when it is done (the pictures stay on this computer; do not commit them)")
