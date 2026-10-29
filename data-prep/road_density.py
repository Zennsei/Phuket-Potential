"""Road density per tambon: total length of main roads (motorway, trunk, primary, secondary and their links)
plus tertiary roads inside each tambon, in km, and that length divided by the tambon area (km per km²).
Replaces "distance from buildings to the nearest main road" as the road factor (29 Oct 2026).

Usage: python road_density.py
Reads:  public/data/roads_all/14/{x}/{y}.pbf  (made by roads_tiles.py from OpenStreetMap D6; class "major" and
        "tertiary" are the roads counted here) and public/data/tambons.geojson (tambon boundaries)
Writes: new columns in public/data/tambons.geojson and public/data/phuket_tambon_factors.csv:
          road_km        main + tertiary road length inside the tambon (km)
          road_major_km  main roads only (km)          road_tert_km  tertiary roads only (km)
          road_km_per_km2  road_km ÷ area_km2
        and prints a check against road_main_km (main roads measured by data_prep.py from the raw OSM file).

Why the tiles and not the raw OSM file: the tiles are in the repo, so anyone can re-run this. Every road is written
whole into each tile it touches (mvt.py does not clip), so each tile's roads are cut to the tile's own square
before adding up; a road crossing 3 tiles is then counted once, in 3 pieces. Coordinates in a tile are rounded
to 1/4096 of the tile (about 0.6 m at zoom 14), which changes the island total by well under 0.1%.
Lengths are measured in UTM zone 47N (metres).
"""
import csv, glob, json, os, sys
import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, box, shape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TILES = os.path.join(ROOT, "public", "data", "roads_all", "14")
TAMBONS = os.path.join(ROOT, "public", "data", "tambons.geojson")
CSV = os.path.join(ROOT, "public", "data", "phuket_tambon_factors.csv")
Z, EXTENT = 14, 4096
COUNT = {"major", "tertiary"}


# ---- minimal Mapbox Vector Tile reader (the writer is mvt.py) ----
def _varint(b, i):
    v = s = 0
    while True:
        c = b[i]; i += 1
        v |= (c & 0x7F) << s; s += 7
        if c < 0x80:
            return v, i


def _fields(b):
    i = 0
    while i < len(b):
        k, i = _varint(b, i)
        f, w = k >> 3, k & 7
        if w == 0:
            v, i = _varint(b, i)
        elif w == 2:
            n, i = _varint(b, i)
            v = b[i:i + n]; i += n
        elif w == 1:
            v = b[i:i + 8]; i += 8
        elif w == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError("wire type %d" % w)
        yield f, w, v


def _packed(b):
    out, i = [], 0
    while i < len(b):
        v, i = _varint(b, i)
        out.append(v)
    return out


def _unzz(n):
    return (n >> 1) ^ -(n & 1)


def read_tile(data):
    """-> [(class, [[(px, py), ...], ...])] for layer 'roads' (pixel coords 0..4096)."""
    out = []
    for f, _, layer in _fields(data):
        if f != 3:
            continue
        keys, vals, feats = [], [], []
        for lf, _, v in _fields(layer):
            if lf == 3: keys.append(v.decode())
            elif lf == 4:
                val = None
                for vf, vw, vv in _fields(v):
                    if vf == 1: val = vv.decode()
                    elif vw == 0: val = vv
                vals.append(val)
            elif lf == 2: feats.append(v)
        for ft in feats:
            tags, geom = [], []
            for ff, _, fv in _fields(ft):
                if ff == 2: tags = _packed(fv)
                elif ff == 4: geom = _packed(fv)
            props = {keys[tags[j]]: vals[tags[j + 1]] for j in range(0, len(tags), 2)}
            lines, cur, x, y, i = [], None, 0, 0, 0
            while i < len(geom):
                cmd, cnt = geom[i] & 7, geom[i] >> 3; i += 1
                for _ in range(cnt):
                    if cmd in (1, 2):
                        x += _unzz(geom[i]); y += _unzz(geom[i + 1]); i += 2
                        if cmd == 1:
                            cur = [(x, y)]; lines.append(cur)
                        else:
                            cur.append((x, y))
            out.append((props.get("c"), [l for l in lines if len(l) > 1]))
    return out


def px_to_lonlat(pts, tx, ty):
    a = np.asarray(pts, dtype=float)
    n = 2 ** Z
    lon = (tx + a[:, 0] / EXTENT) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (ty + a[:, 1] / EXTENT) / n))))
    return np.column_stack([lon, lat])


_tr = Transformer.from_crs(4326, 32647, always_xy=True)


def utm(g):
    return shapely.transform(g, lambda c: np.column_stack(_tr.transform(c[:, 0], c[:, 1])))

pieces = {"major": [], "tertiary": []}
files = sorted(glob.glob(os.path.join(TILES, "*", "*.pbf")))
for fp in files:
    tx = int(os.path.basename(os.path.dirname(fp))); ty = int(os.path.splitext(os.path.basename(fp))[0])
    tb = box(0, 0, EXTENT, EXTENT)
    for c, lines in read_tile(open(fp, "rb").read()):
        if c not in COUNT:
            continue
        for l in lines:
            part = LineString(l).intersection(tb)  # keep only the part inside this tile
            if part.is_empty:
                continue
            for g in getattr(part, "geoms", [part]):
                if g.geom_type == "LineString" and g.length > 0:
                    pieces[c].append(utm(LineString(px_to_lonlat(g.coords, tx, ty))))

fc = json.load(open(TAMBONS, encoding="utf-8"))
polys = [utm(shape(f["geometry"])) for f in fc["features"]]
res = {}
for c, segs in pieces.items():
    arr = np.array(segs, dtype=object)
    tree = shapely.STRtree(arr)
    km = []
    for p in polys:
        hit = tree.query(p, predicate="intersects")
        km.append(float(shapely.length(shapely.intersection(arr[hit], p)).sum()) / 1000)
    res[c] = km
    print(f"{c}: {len(segs)} pieces from {len(files)} tiles, island total {sum(shapely.length(arr)) / 1000:.1f} km, inside tambons {sum(km):.1f} km")

print("\ntambon            main(tiles)  main(raw OSM)  tertiary   total   km/km²")
for f, maj, ter in zip(fc["features"], res["major"], res["tertiary"]):
    p = f["properties"]
    p["road_major_km"] = round(maj, 1)
    p["road_tert_km"] = round(ter, 1)
    p["road_km"] = round(maj + ter, 1)
    p["road_km_per_km2"] = round((maj + ter) / p["area_km2"], 2)
    print(f"{p['tambon_th']:<14}{maj:10.1f}{p.get('road_main_km', 0):13.1f}{ter:12.1f}{maj + ter:9.1f}{p['road_km_per_km2']:9.2f}")

with open(TAMBONS, "w", encoding="utf-8") as fh:  # one feature per line, same layout as dopa_prep.py
    head = {k: v for k, v in fc.items() if k != "features"}
    fh.write(json.dumps(head, ensure_ascii=False)[:-1] + ',\n"features": [\n')
    fh.write(",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in fc["features"]))
    fh.write("\n]\n}\n")

if os.path.exists(CSV):
    rows = list(csv.DictReader(open(CSV, encoding="utf-8-sig")))
    by_id = {f["properties"]["id"]: f["properties"] for f in fc["features"]}
    by_th = {f["properties"]["tambon_th"]: f["properties"] for f in fc["features"]}
    cols = list(rows[0].keys())
    new = ["road_km", "road_km_per_km2", "road_major_km", "road_tert_km"]
    cols += [c for c in new if c not in cols]
    for r in rows:
        p = by_id.get(r.get("id")) or by_th.get(r.get("tambon_th"))
        for c in new:
            r[c] = p[c] if p else ""
    with open(CSV, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows)
    print(f"\nupdated {CSV}")
