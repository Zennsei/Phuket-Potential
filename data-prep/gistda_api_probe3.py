"""Third round of GISTDA API tests: look at the actual pictures and records over Phuket.

Run on your own computer:   python data-prep/gistda_api_probe3.py
Output: data-prep/out/probe3/report.txt   (text, keys removed)
        data-prep/out/probe3/*.jpg / *.png / *.webp   (small images over Phuket, for us to judge quality)
About 60–100 requests (most are the PLEIADES list and the 33-point flood grid). The images are GISTDA's copyright: they are for our evaluation only and must not be
committed to the repository or published.
"""
import json, math, os, re, sys, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

BASE = "https://api-gateway.gistda.or.th/api/2.0/resources"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "probe3")
W, S, E, N = 98.25, 7.75, 98.49, 8.21
KEY_RE = re.compile(r"((?:api[_-]?key|key|token|access_token)=)[^&\"'\s<>]+", re.I)


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
report = []
os.makedirs(OUT, exist_ok=True)


def clean(t):
    return KEY_RE.sub(r"\1<removed>", str(t).replace(KEY, "<key>"))


def log(title, text):
    text = clean(text)
    report.append(f"## {title}\n{text}\n")
    print(f"## {title}\n{text[:300]}\n", flush=True)


def get(path, q=None, limit=8_000_000):
    url = path if path.startswith("http") else BASE + path
    if q:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(q, safe=",:")
    try:
        req = urllib.request.Request(url, headers={"API-Key": KEY})
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, r.headers.get("Content-Type") or "", r.read(limit)
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type") or "", e.read(2000)
    except Exception as e:
        return 0, "", str(e).encode()


def save(name, body, ct):
    ext = ".jpg" if "jpeg" in ct else ".png" if "png" in ct else ".webp" if "webp" in ct else ".bin"
    p = os.path.join(OUT, name + ext)
    open(p, "wb").write(body)
    return os.path.basename(p)


def tile(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def merc(lon, lat):
    return lon * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 6378137


# 1. satellite imagery 1972–2025 (WMS): which years exist, and one picture of Phuket per period
st, ct, body = get("/gfms/service/", {"SERVICE": "WMS", "REQUEST": "GetCapabilities"})
names = []
try:
    root = ET.fromstring(body)
    ns = {"w": "http://www.opengis.net/wms"}
    names = [n.text for n in root.findall(".//w:Layer/w:Layer/w:Name", ns)]
except ET.ParseError as e:
    log("imagery capabilities", f"HTTP {st}: could not read XML ({e})")
log("imagery layers (all)", f"{len(names)} layers: " + ", ".join(names))
years = sorted({int(m.group(1)) for n in names for m in [re.search(r"(\d{4})", n)] if m})
pick = sorted({y for y in years if y in (1972, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020)} | set(years[-3:]))
x0, y0 = merc(W, S)
x1, y1 = merc(E, N)
for yv in pick:
    layer = next(n for n in names if str(yv) in n)
    st, ct, body = get("/gfms/service/", {"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": layer, "STYLES": "",
                                         "CRS": "EPSG:3857", "BBOX": f"{x0},{y0},{x1},{y1}", "WIDTH": 520, "HEIGHT": 1000, "FORMAT": "image/jpeg"})
    log(f"imagery {yv} over Phuket", f"HTTP {st} | {ct} | {len(body)} bytes" + (f" -> {save(f'imagery_{yv}', body, ct)}" if st == 200 and "image" in ct else f" | {body[:200]!r}"))
# a close-up of the old town in the latest and an older year
for yv in [y for y in (2000, 2010) if y in years] + years[-1:]:
    layer = next(n for n in names if str(yv) in n)
    a, b = merc(98.375, 7.875)
    c, d = merc(98.405, 7.895)
    st, ct, body = get("/gfms/service/", {"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": layer, "STYLES": "",
                                         "CRS": "EPSG:3857", "BBOX": f"{a},{b},{c},{d}", "WIDTH": 900, "HEIGHT": 600, "FORMAT": "image/jpeg"})
    log(f"imagery {yv} old-town close-up", f"HTTP {st} | {len(body)} bytes" + (f" -> {save(f'oldtown_{yv}', body, ct)}" if st == 200 and "image" in ct else f" | {body[:200]!r}"))

# 2. PLEIADES: which collections touch Phuket (collections are per acquisition, with a bbox)
hits, offset, total_seen = [], 0, 0
while offset < 3000:
    st, ct, body = get("/stac/PLEIADES/collections", {"limit": 100, "offset": offset})
    try:
        cols = json.loads(body).get("collections", [])
    except ValueError:
        log("PLEIADES collections", f"HTTP {st}: {body[:200]!r}")
        break
    if not cols:
        break
    total_seen += len(cols)
    for c in cols:
        for bb in (c.get("extent", {}).get("spatial", {}).get("bbox") or []):
            if bb[0] < E and bb[2] > W and bb[1] < N and bb[3] > S:
                hits.append((c["id"], (c.get("extent", {}).get("temporal", {}).get("interval") or [[None]])[0][0], [round(v, 3) for v in bb]))
    offset += len(cols)
log("PLEIADES collections over Phuket", f"looked at {total_seen} collections, {len(hits)} touch Phuket:\n" + "\n".join(map(str, hits)))
for cid, _, _ in hits[:2]:
    st, ct, body = get(f"/stac/PLEIADES/collections/{cid}/items", {"limit": 2})
    try:
        d = json.loads(body)
        f0 = (d.get("features") or [{}])[0]
        assets = {k: {"type": v.get("type"), "roles": v.get("roles"), "href_end": clean(v.get("href", ""))[-70:]} for k, v in (f0.get("assets") or {}).items()}
        log(f"PLEIADES items of {cid}", f"HTTP {st} | {len(d.get('features') or [])} items | properties: {json.dumps(f0.get('properties'), ensure_ascii=False)[:600]}\nassets: {json.dumps(assets, ensure_ascii=False)[:1500]}")
    except ValueError:
        log(f"PLEIADES items of {cid}", f"HTTP {st}: {body[:300]!r}")

# 3. THEOS-1: other ways in through the gateway
for p in ("/stac/theos1/children", "/stac/theos1/collections/THEOS1_L1C", "/stac/theos1/collections/THEOS1_L1C/items",
          "/stac/theos1/search?collections=THEOS1_L1C&bbox=98.25,7.75,98.49,8.21&limit=2"):
    st, ct, body = get(p)
    log(f"THEOS-1 {p}", f"HTTP {st} | {len(body)} bytes | {clean(body[:500].decode('utf-8', 'replace'))}")

# 4. tiles over Phuket: Landtrendr, hillshade, GI basemap (same tile for comparison)
for z in (12, 13):
    tx, ty = tile(98.36, 7.92, z)
    for name, path in [("landtrendr", f"/maps/coverage/landtrendr-all/{z}/{tx}/{ty}"), ("hillshade", f"/tiles/public/hillshade/{min(z, 12)}/{tile(98.36, 7.92, min(z, 12))[0]}/{tile(98.36, 7.92, min(z, 12))[1]}"),
                       ("gi_basemap", f"/tiles/basemap_latest/{z}/{tx}/{ty}.png")]:
        st, ct, body = get(path)
        log(f"{name} tile z{z}", f"HTTP {st} | {ct} | {len(body)} bytes" + (f" -> {save(f'{name}_z{z}', body, ct)}" if st == 200 and len(body) > 0 else ""))

# 5. land feature collections that may matter: slope over Phuket, tambon boundaries, population
for cid, label in [("6476c9cb43421eefdca5a8b9", "slop (bbox = Phuket)"), ("649417b8c952dd2618f7d6e7", "Administrator Tambon"), ("64507a16746e03b104e437c3", "Population")]:
    st, ct, body = get(f"/features/land/collections/{cid}/items", {"bbox": f"{W},{S},{E},{N}", "limit": 3})
    try:
        d = json.loads(body)
        f0 = (d.get("features") or [{}])[0]
        log(f"land collection {label}", f"HTTP {st} | matched {d.get('numberMatched')} | geometry {(f0.get('geometry') or {}).get('type')} | properties: {json.dumps(f0.get('properties'), ensure_ascii=False)[:700]}")
    except ValueError:
        log(f"land collection {label}", f"HTTP {st}: {body[:300]!r}")

# 6. recurring floods on a coarse grid over the island (a 'not found' everywhere means no recurring-flood areas recorded)
found = []
for lat in [7.78 + i * 0.04 for i in range(11)]:
    for lon in (98.30, 98.34, 98.38):
        st, ct, body = get("/gi-service/v1.1/disasters/flood-recurrence", {"lat": round(lat, 3), "lon": lon})
        if st != 200 or b"not found" not in body:
            found.append(((round(lat, 3), lon), f"HTTP {st}: " + body[:200].decode("utf-8", "replace")))
log("recurring floods, 33-point grid", f"{len(found)} points with data:\n" + "\n".join(map(str, found)))

open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8").write("\n".join(report))
print("saved", OUT, "- send report.txt and the images (keys are removed; do not publish the images)")
