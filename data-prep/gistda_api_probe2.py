"""Second round of GISTDA API tests: follow up what round 1 (gistda_api_probe.py) found.

Run on your own computer:   python data-prep/gistda_api_probe2.py
Output: data-prep/out/gistda_api_probe2.txt  (keys are removed from everything that is printed; safe to send)
About 25 requests.

What it looks at
  * recurring floods: the answer at several low-lying points (round 1 only tried a hill)
  * THEOS-1 / PLEIADES: these are STAC *catalogues* (no search), so it follows their child links a few levels
  * satellite imagery 2515–2568 (/gfms/service/): an OGC service, so it asks for its capabilities (layer list)
  * Landtrendr, hillshade: the TileJSON (tile address, area covered, fields)
  * land feature collections: what the first collections are
  * urban heat island: a coarser tile over Phuket
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request

BASE = "https://api-gateway.gistda.or.th/api/2.0/resources"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "gistda_api_probe2.txt")
KEY_RE = re.compile(r"((?:api[_-]?key|key|token|access_token)=)[^&\"'\s<>]+", re.I)

# low-lying or flood-prone points (lat, lon)
POINTS = {
    "Phuket old town / Bang Yai canal": (7.8846, 98.3902),
    "Kathu (valley)": (7.9130, 98.3330),
    "Chalong (lowland)": (7.8430, 98.3420),
    "Sakhu near airport": (8.0950, 98.3080),
    "Thep Krasattri (Thalang)": (8.0300, 98.3380),
    "Ko Kaeo": (7.9530, 98.3830),
}


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


def clean(text):
    return KEY_RE.sub(r"\1<removed>", str(text).replace(KEY, "<key>"))


def get(path_or_url, q=None, limit=2_000_000):
    url = path_or_url if path_or_url.startswith("http") else BASE + path_or_url
    if q:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(q)
    try:
        req = urllib.request.Request(url, headers={"API-Key": KEY})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.headers.get("Content-Type") or "", r.read(limit), url
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type") or "", e.read(2000), url
    except Exception as e:
        return 0, "", str(e).encode(), url


def log(title, text):
    text = clean(text)
    report.append(f"## {title}\n{text}\n")
    print(f"## {title}\n{text[:400]}\n", flush=True)


def show(title, path, q=None, chars=1500):
    st, ct, body, url = get(path, q)
    short = clean(url.replace(BASE, ""))
    try:
        text = json.dumps(json.loads(body), ensure_ascii=False)[:chars]
    except ValueError:
        text = body[:chars].decode("utf-8", "replace")
    log(title, f"{short}\nHTTP {st} | {ct} | {len(body)} bytes\n{text}")
    return st, body


def links_of(body):
    try:
        d = json.loads(body)
    except ValueError:
        return []
    return [(l.get("rel"), l.get("href"), l.get("title")) for l in d.get("links", []) if isinstance(l, dict)]


def walk_stac(name, root, depth=3, per_level=4):
    st, body = show(f"{name}: root", root, chars=600)
    seen, frontier = set(), [(root, body)]
    for level in range(depth):
        nxt = []
        for _, b in frontier:
            ls = links_of(b)
            log(f"{name}: links at level {level}", "\n".join(f"{r} | {clean(h)} | {t}" for r, h, t in ls[:30]) or "(no links)")
            for rel, href, _ in [l for l in ls if l[0] in ("child", "item", "items", "data")][:per_level]:
                if not href or href in seen:
                    continue
                seen.add(href)
                st2, b2 = show(f"{name}: {rel} {clean(href)[-80:]}", href, chars=900)
                nxt.append((href, b2))
        frontier = nxt
        if not frontier:
            break


# 1. recurring floods at low points
for name, (lat, lon) in POINTS.items():
    show(f"flood-recurrence at {name}", "/gi-service/v1.1/disasters/flood-recurrence", {"lat": lat, "lon": lon}, chars=600)
show("flood-recurrence, bbox as polygon-like query", "/gi-service/v1.1/disasters/flood-recurrence", {"bbox": "98.37,7.87,98.41,7.90"}, chars=600)

# 2. THEOS-1 and PLEIADES catalogues
walk_stac("THEOS-1", "/stac/theos1")
walk_stac("PLEIADES", "/stac/PLEIADES", depth=2)

# 3. satellite imagery 2515–2568: OGC capabilities
for svc in ("WMS", "WMTS"):
    show(f"imagery service GetCapabilities {svc}", "/gfms/service/", {"SERVICE": svc, "REQUEST": "GetCapabilities"}, chars=4000)

# 4. TileJSON services
for title, path in [("Landtrendr-all TileJSON", "/maps/coverage/landtrendr-all"), ("Hillshade TileJSON", "/tiles/public/hillshade")]:
    show(title, path, chars=3000)

# 5. land feature collections (first page, titles)
st, _, body, _ = get("/features/land/collections", {"limit": 20})
try:
    cols = json.loads(body).get("collections", [])
    log("land collections (first 20)", "\n".join(f"{c.get('id')} | {c.get('title')} | {str(c.get('description'))[:120]} | extent {json.dumps(c.get('extent'))[:150]}" for c in cols))
except ValueError:
    log("land collections", f"HTTP {st}: {body[:300]!r}")

# 6. urban heat island at coarser zooms over Phuket
for z, x, y in [(10, 791, 489), (8, 197, 122)]:
    st, ct, body, url = get(f"/tiles/vector/uhi/{z}/{x}/{y}")
    log(f"UHI vector tile z{z}", f"HTTP {st} | {ct} | {len(body)} bytes")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(report))
print("saved", OUT, "(keys removed, safe to send)")
