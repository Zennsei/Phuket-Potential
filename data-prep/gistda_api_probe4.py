"""Fourth round of GISTDA API tests: find the path that returns the records of a "land feature collection".

Round 3 got the list (/features/land/collections, 117,613 collections) but /features/land/collections/{id}/items
answered 404 for the three collections that matter to Phuket. This round finds out why, with about 25 requests:

  A. the list itself: what links each collection carries, and whether the list can be filtered (bbox, title, q, search)
  B. one collection ("slop", the slope layer whose box is exactly Phuket) tried every likely way:
     its own page /collections/{id}, items with and without parameters, shorter paths, and the "items" link that
     GISTDA's own answer points to (followed only when it is on api-gateway.gistda.or.th, so the key never goes elsewhere)
  C. the other four collections (tambon boundaries x2, population x2): their page and items
  D. for comparison, the buildings service that already works (/features/thailand-buildings-footprint)

Every answer is written in full (first 1,500 characters) with the server headers, so a 404 from the gateway itself
("no route") can be told apart from a 404 from the data system ("collection not found / no permission").

Run on your own computer:   python data-prep/gistda_api_probe4.py
Output: data-prep/out/probe4/report.txt   (text only, keys removed; send it back)
Reads GISTDA_API_KEY from the environment or from .env, and sends it only as the API-Key header to the gateway.
GISTDA_API_BASE can point the script at a test server; leave it unset for the real gateway.
"""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request

BASE = os.environ.get("GISTDA_API_BASE", "https://api-gateway.gistda.or.th/api/2.0/resources").rstrip("/")
GATEWAY_HOST = urllib.parse.urlsplit(BASE).netloc
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "probe4")
W, S, E, N = 98.25, 7.75, 98.49, 8.21
KEY_RE = re.compile(r"((?:api[_-]?key|key|token|access_token)=)[^&\"'\s<>]+", re.I)
HEADERS_TO_KEEP = ("server", "via", "x-powered-by", "x-kong-upstream-latency", "x-kong-proxy-latency", "x-request-id", "www-authenticate")

# collections from the round-2 list that cover Phuket or all of Thailand
SLOPE = "6476c9cb43421eefdca5a8b9"
OTHERS = [("649417b8c952dd2618f7d6e7", "Administrator Tambon (Thailand box)"),
          ("649419299a3e3714ad90b3e7", "Administrator Tambon (described: province/district/tambon boundaries)"),
          ("64507a16746e03b104e437c3", "Population (Thailand box)"),
          ("64508c06289f2e54247f7e6d", "population (world box)")]


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
count = 0
os.makedirs(OUT, exist_ok=True)


def clean(t):
    return KEY_RE.sub(r"\1<removed>", str(t).replace(KEY, "<key>"))


def log(title, text):
    text = clean(text)
    report.append(f"## {title}\n{text}\n")
    print(f"## {title}\n{text[:400]}\n", flush=True)


def get(path, q=None):
    """GET from the gateway only; returns (status, headers dict, body bytes)."""
    global count
    url = path if path.startswith("http") else BASE + path
    if urllib.parse.urlsplit(url).netloc != GATEWAY_HOST:
        return -1, {}, b"not requested: other host, the key is only sent to the gateway"
    if q:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(q, safe=",:")
    count += 1
    try:
        req = urllib.request.Request(url, headers={"API-Key": KEY, "Accept": "application/geo+json, application/json"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, dict(r.headers), r.read(3_000_000)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read(5000)
    except Exception as e:
        return 0, {}, str(e).encode()


def describe(st, hd, body):
    keep = {k: v for k, v in hd.items() if k.lower() in HEADERS_TO_KEEP}
    text = body[:1500].decode("utf-8", "replace")
    info = ""
    try:
        d = json.loads(body)
        if isinstance(d, dict):
            info = f"keys {sorted(d)}"
            if "numberMatched" in d or "features" in d:
                f0 = (d.get("features") or [{}])[0]
                info += (f" | matched {d.get('numberMatched')} | returned {d.get('numberReturned', len(d.get('features') or []))}"
                         f" | geometry {(f0.get('geometry') or {}).get('type')}"
                         f" | properties {json.dumps(f0.get('properties'), ensure_ascii=False)[:500]}")
    except ValueError:
        pass
    return f"HTTP {st} | {hd.get('Content-Type', '')} | {len(body)} bytes | headers {keep}\n{info}\n{text}"


def try_path(title, path, q=None):
    st, hd, body = get(path, q)
    log(title, f"{path} {q or ''}\n" + describe(st, hd, body))
    ok = st == 200 and b'"features"' in body
    summary.append(f"{'OK ' if ok else '   '}{st:>4}  {title}")
    return st, body


def links_of(obj):
    return [l for l in (obj.get("links") or []) if isinstance(l, dict)]


# A. the list: links per collection, and filters
st, body = try_path("A1 list, 2 collections", "/features/land/collections", {"limit": 2})
try:
    d = json.loads(body)
    log("A1 top-level links", json.dumps(links_of(d), ensure_ascii=False, indent=1))
    for c in d.get("collections", [])[:2]:
        log(f"A1 collection {c.get('id')} in full", json.dumps(c, ensure_ascii=False, indent=1)[:4000])
except ValueError:
    pass
try_path("A2 list filtered by bbox = Phuket (does numberMatched drop below 117,613?)", "/features/land/collections", {"limit": 5, "bbox": f"{W},{S},{E},{N}"})
for p in ("title", "q", "search"):
    try_path(f"A3 list filtered by {p}=slop", "/features/land/collections", {"limit": 5, p: "slop"})

# B. the slope collection, every likely way
items_hrefs = []
st, body = try_path("B1 slop collection page", f"/features/land/collections/{SLOPE}")
try:
    for l in links_of(json.loads(body)):
        log("B1 link", json.dumps(l, ensure_ascii=False))
        if l.get("rel") in ("items", "item", "data") or "items" in str(l.get("href", "")):
            items_hrefs.append(l["href"])
except ValueError:
    pass
try_path("B2 slop items, no parameters", f"/features/land/collections/{SLOPE}/items")
try_path("B3 slop items, limit=1", f"/features/land/collections/{SLOPE}/items", {"limit": 1})
try_path("B4 slop items, limit=1 + f=json", f"/features/land/collections/{SLOPE}/items", {"limit": 1, "f": "json"})
try_path("B5 /features/land/{id}/items", f"/features/land/{SLOPE}/items", {"limit": 1})
try_path("B6 /features/land/{id}", f"/features/land/{SLOPE}", {"limit": 1})
try_path("B7 /features/{id}/items", f"/features/{SLOPE}/items", {"limit": 1})
try_path("B8 /features/land/items?collection=", "/features/land/items", {"collection": SLOPE, "limit": 1})
for i, href in enumerate(items_hrefs[:2]):
    log(f"B9 items link given by GISTDA ({i + 1})", href)
    try_path(f"B9 follow items link ({i + 1})", href, {"limit": 1})

# C. the other collections
for cid, label in OTHERS:
    try_path(f"C collection page: {label}", f"/features/land/collections/{cid}")
    try_path(f"C items limit=1: {label}", f"/features/land/collections/{cid}/items", {"limit": 1})

# D. the buildings service that works, for comparison of paths and links
st, body = try_path("D1 buildings: service page without /items", "/features/thailand-buildings-footprint")
st, body = try_path("D2 buildings: items limit=1 (links show the path pattern)", "/features/thailand-buildings-footprint/items", {"limit": 1})
try:
    log("D2 buildings links", json.dumps(links_of(json.loads(body)), ensure_ascii=False, indent=1))
except ValueError:
    pass

head = f"Requests sent: {count}\nOK = HTTP 200 with features\n" + "\n".join(summary)
report.insert(0, f"## summary\n{clean(head)}\n")
open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8").write("\n".join(report))
print(clean(head))
print("saved", os.path.join(OUT, "report.txt"), "- send this file back (keys are removed)")
