"""Download GISTDA buildings (with height) for Phuket from the GISTDA API Gateway (D13 in DATA.md).

Run this on your own computer: the API key stays there and never goes into the repo or the chat.
Only the Python standard library is used (works with the Python that comes with QGIS too).

  1. Put the key in .env at the project root:   GISTDA_API_KEY=xxxxxxxx
  2. Test with one page first:                   python data-prep/gistda_buildings_api.py --pages 1
  3. Download everything:                        python data-prep/gistda_buildings_api.py
     If it stops half way, run again with --resume and it continues from where it stopped.

Output: data-prep/out/gistda_buildings_2567_phuket.csv.gz
  One row per building: centroid, footprint area, height, storeys, year, tambon, sources.
  No geometry and no API links are saved (the API puts the key inside its "links").
"""
import argparse, csv, gzip, json, math, os, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get("GISTDA_API_URL") or "https://api-gateway.gistda.or.th/api/2.0/resources/features/thailand-buildings-footprint/items"
BBOX = "98.25,7.75,98.49,8.21"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "out")
OUT = os.path.join(OUT_DIR, "gistda_buildings_2567_phuket.csv.gz")
STATE = os.path.join(OUT_DIR, "gistda_buildings_progress.json")
FIELDS = ["id", "lon", "lat", "area_m2", "height_m", "storeys", "year", "tambon", "amphoe", "province", "source", "source_height", "update_date"]


def read_key():
    if os.environ.get("GISTDA_API_KEY"):
        return os.environ["GISTDA_API_KEY"].strip()
    env = os.path.join(HERE, "..", ".env")
    if os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            if line.strip().startswith("GISTDA_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("GISTDA_API_KEY not found: add it to .env (see .env.example)")


def ring_area_centroid(ring):
    """Area (m²) and centroid (lon, lat) of a lon/lat ring, using a local flat projection (fine for buildings)."""
    lon0, lat0 = ring[0]
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), 110540.0
    pts = [((x - lon0) * kx, (y - lat0) * ky) for x, y in ring]  # metres from the first vertex (avoids rounding loss)
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        c = x1 * y2 - x2 * y1
        a += c
        cx += (x1 + x2) * c
        cy += (y1 + y2) * c
    if abs(a) < 1e-9:
        return 0.0, lon0, lat0
    return abs(a) / 2, lon0 + cx / (3 * a) / kx, lat0 + cy / (3 * a) / ky


def to_row(feat):
    g, p = feat.get("geometry") or {}, feat.get("properties") or {}
    polys = g.get("coordinates", [])
    if g.get("type") == "Polygon":
        polys = [polys]
    area, sx, sy = 0.0, 0.0, 0.0
    for poly in polys:
        if not poly:
            continue
        ring = [tuple(pt[:2]) for pt in poly[0]]
        if len(ring) > 1 and ring[0] == ring[-1]:
            ring = ring[:-1]
        if len(ring) < 3:
            continue
        a, x, y = ring_area_centroid(ring)
        for hole in poly[1:]:
            h = [tuple(pt[:2]) for pt in hole][:-1]
            if len(h) >= 3:
                a -= ring_area_centroid(h)[0]
        area, sx, sy = area + a, sx + x * a, sy + y * a
    if area <= 0:
        return None
    return {
        "id": p.get("globalId") or feat.get("id"),
        "lon": round(sx / area, 6), "lat": round(sy / area, 6), "area_m2": round(area, 1),
        "height_m": p.get("BL_HEIGHT"), "storeys": p.get("BL_NSTOREY"), "year": p.get("BL_YEAR"),
        "tambon": p.get("BL_SUB_DIS"), "amphoe": p.get("BL_DISTRIC"), "province": p.get("BL_CHANGWA"),
        "source": p.get("sources"), "source_height": p.get("sources_H"), "update_date": p.get("Update_date"),
    }


def get(url, key, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"API-Key": key, "Accept": "application/geo+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read()[:300].decode("utf-8", "replace")
            if e.code in (401, 403, 407):
                sys.exit(f"HTTP {e.code}: key rejected or out of credit -> {body}")
            if e.code == 429 or e.code >= 500:
                wait = 10 * (i + 1)
                print(f"HTTP {e.code}, waiting {wait}s and trying again", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"HTTP {e.code}: {body}")
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"network error {e}, trying again", flush=True)
            time.sleep(10 * (i + 1))
    sys.exit("gave up after several tries; run again with --resume")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=1000, help="buildings per request")
    ap.add_argument("--pages", type=int, default=0, help="stop after this many requests (0 = all)")
    ap.add_argument("--resume", action="store_true", help="continue a stopped download")
    ap.add_argument("--pause", type=float, default=0.5, help="seconds between requests")
    a = ap.parse_args()
    key = read_key()
    os.makedirs(OUT_DIR, exist_ok=True)

    offset, kept = 0, 0
    if a.resume and os.path.exists(STATE):
        st = json.load(open(STATE))
        offset, kept = st["offset"], st["kept"]
        print(f"resuming at offset {offset} ({kept} buildings already saved)")
    mode = "at" if a.resume and offset else "wt"
    with gzip.open(OUT, mode, newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        if mode == "wt":
            w.writeheader()
        pages, total, t0 = 0, None, time.time()
        while True:
            q = urllib.parse.urlencode({"bbox": BBOX, "limit": a.limit, "offset": offset})
            data = get(f"{API}?{q}", key)
            feats = data.get("features") or []
            total = data.get("numberMatched", total)
            for f in feats:
                row = to_row(f)
                if row and row["province"] == "ภูเก็ต":
                    w.writerow(row)
                    kept += 1
            offset += len(feats)
            pages += 1
            json.dump({"offset": offset, "kept": kept, "total": total}, open(STATE, "w"))
            rate = offset / max(time.time() - t0, 1e-6) if not a.resume else 0
            print(f"request {pages}: got {len(feats)} (asked {a.limit}) | {offset}/{total} read | {kept} in Phuket saved"
                  + (f" | ~{(total - offset) / rate / 60:.0f} min left" if rate and total else ""), flush=True)
            if not feats or (total and offset >= total) or (a.pages and pages >= a.pages):
                break
            time.sleep(a.pause)
    print("saved", OUT)
    if a.pages and total and offset < total:
        print(f"test run only. Full download needs about {math.ceil((total - offset) / max(len(feats), 1))} more requests.")


if __name__ == "__main__":
    main()
