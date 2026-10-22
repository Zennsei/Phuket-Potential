"""Try the GISTDA API Gateway services that might help this project, over Phuket, and write a short report.

Run on your own computer (the key stays there):   python data-prep/gistda_api_probe.py
Output: data-prep/out/gistda_api_probe.txt  — safe to share: no key, no links, no full data, only
        the HTTP status, content type, size, top-level keys and the property names of the first feature.

Each request asks for one small page, so the whole run uses about 20 requests.
"""
import json, os, sys, urllib.error, urllib.parse, urllib.request

BASE = "https://api-gateway.gistda.or.th/api/2.0/resources"
BBOX = "98.25,7.75,98.49,8.21"           # Phuket island
POINT = {"lat": "7.95", "lon": "98.34"}  # middle of the island
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "gistda_api_probe.txt")

TESTS = [
    # (why it matters, path, query)
    ("recurring floods: risk factor / stress test", "/gi-service/v1.1/disasters/flood-recurrence", {"bbox": BBOX, "limit": 3}),
    ("recurring floods (point form)", "/gi-service/v1.1/disasters/flood-recurrence", {**POINT}),
    ("flood extent, last day", "/gi-service/v1.1/disasters/flood-extent-1day", {"bbox": BBOX, "limit": 3}),
    ("THEOS-1 imagery catalogue (STAC root)", "/stac/theos1", {}),
    ("THEOS-1 collections", "/stac/theos1/collections", {}),
    ("THEOS-1 search over Phuket", "/stac/theos1/search", {"bbox": BBOX, "limit": 3}),
    ("PLEIADES imagery catalogue", "/stac/PLEIADES", {}),
    ("satellite imagery 2515–2568 service", "/gfms/service/", {}),
    ("Landtrendr change coverage", "/maps/coverage/landtrendr", {}),
    ("Landtrendr (all)", "/maps/coverage/landtrendr-all", {}),
    ("hillshade tiles (metadata)", "/tiles/public/hillshade", {}),
    ("GI basemap tile z12 over Phuket", "/tiles/basemap_latest/12/3166/1957.png", {}),
    ("land feature collections", "/features/land/collections", {}),
    ("urban heat island vector tile z12", "/tiles/vector/uhi/12/3166/1957", {}),
    ("LOD1 3D tiles (index)", "/3d-tiles/thailand-lod/tileset.json", {}),
]


def read_key():
    if os.environ.get("GISTDA_API_KEY"):
        return os.environ["GISTDA_API_KEY"].strip()
    env = os.path.join(HERE, "..", ".env")
    if os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            if line.strip().startswith("GISTDA_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("GISTDA_API_KEY not found: add it to .env")


def describe(body, ctype):
    if "json" not in ctype and not body[:1] in (b"{", b"["):
        return f"(not JSON, {len(body)} bytes)"
    try:
        d = json.loads(body)
    except ValueError:
        return f"(could not read JSON, {len(body)} bytes)"
    if isinstance(d, list):
        return f"list of {len(d)}; first item keys: {sorted(d[0].keys()) if d and isinstance(d[0], dict) else '-'}"
    lines = [f"keys: {sorted(k for k in d.keys() if k != 'links')}"]
    for k in ("numberMatched", "numberReturned", "type", "title", "description", "stac_version"):
        if k in d:
            lines.append(f"{k}: {str(d[k])[:200]}")
    feats = d.get("features")
    if isinstance(feats, list) and feats:
        f0 = feats[0]
        lines.append(f"first feature geometry: {(f0.get('geometry') or {}).get('type')}")
        props = f0.get("properties") or {}
        lines.append("first feature properties: " + json.dumps({k: (v if not isinstance(v, (dict, list)) else '…') for k, v in props.items()}, ensure_ascii=False)[:900])
        if "assets" in f0:
            lines.append(f"assets: {sorted(f0['assets'].keys())}")
    for k in ("collections", "children"):
        if isinstance(d.get(k), list):
            lines.append(f"{k}: " + ", ".join(str(c.get('id') or c.get('title')) for c in d[k][:15]))
    return "\n    ".join(lines)


def main():
    key = read_key()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    report = []
    for why, path, q in TESTS:
        url = BASE + path + (("?" + urllib.parse.urlencode(q)) if q else "")
        shown = path + (("?" + urllib.parse.urlencode(q)) if q else "")
        try:
            req = urllib.request.Request(url, headers={"API-Key": key})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read(2_000_000)
                text = f"HTTP {r.status} | {r.headers.get('Content-Type')} | {len(body)} bytes\n    {describe(body, r.headers.get('Content-Type') or '')}"
        except urllib.error.HTTPError as e:
            text = f"HTTP {e.code} | {e.read()[:200].decode('utf-8', 'replace')}"
        except Exception as e:  # network problems
            text = f"error: {e}"
        text = text.replace(key, "<key>")
        report.append(f"## {why}\n{shown}\n    {text}\n")
        print(f"{why}: {text.splitlines()[0]}", flush=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(report))
    print("\nsaved", OUT, "(no key inside, safe to send)")


if __name__ == "__main__":
    main()
