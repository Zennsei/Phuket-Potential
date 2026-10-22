"""Summarise GISTDA 2567 buildings with height (from gistda_buildings_api.py) per tambon and per 500 m cell.

Usage: python gistda_height_prep.py <gistda_buildings_2567_phuket.csv.gz>
Needs : pandas, shapely  (same as data_prep.py)
Output: public/data/height_tambon.csv
        new columns in public/data/tambons.geojson + phuket_tambon_factors.csv:
          bldg_2567, mean_height_m, midrise_pct, highrise, floor_to_land_pct
        public/data/height_grid500.geojson   (same cells as buildings_grid500.geojson)

Floor area = footprint area × storeys. Heights and storeys are modelled by GISTDA (sources_H = GEE_Height),
so floor area is an estimate of how much space is built, not a surveyed figure.
"""
import json, math, os, sys
import numpy as np, pandas as pd
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

SRC = sys.argv[1]
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
CELL = 500.0
MID_RISE = 4    # storeys: 4+ counts as mid/high rise
HIGH_RISE = 8   # storeys: 8+ counts as high rise

b = pd.read_csv(SRC, dtype={"id": str})
n_raw = len(b)
b = b.drop_duplicates("id")          # a resumed download can repeat a few rows
b = b[(b.area_m2 > 0) & b.storeys.notna() & b.height_m.notna()].copy()
b["floor_m2"] = b.area_m2 * b.storeys
print(f"rows {n_raw}, after removing duplicates/empty {len(b)}")

# --- tambon: point in polygon, coastal buildings outside every polygon go to the nearest tambon (≤ 3 km) ---
tb = json.load(open(os.path.join(DATA, "tambons.geojson"), encoding="utf-8"))["features"]
polys = [shape(f["geometry"]) for f in tb]
ids = [f["properties"]["id"] for f in tb]
tree = STRtree(polys)
pts = [Point(x, y) for x, y in zip(b.lon, b.lat)]
hit = tree.query(pts, predicate="within")          # (point index, polygon index)
tid = np.full(len(pts), -1)
tid[hit[0]] = hit[1]
miss = np.where(tid < 0)[0]
for i in miss:
    j = tree.nearest(pts[i])
    lat = b.lat.iloc[i]
    d_m = polys[j].distance(pts[i]) * 111320 * math.cos(math.radians(lat))
    if d_m <= 3000:
        tid[i] = j
b["tambon_id"] = [ids[j] if j >= 0 else None for j in tid]
print(f"outside all tambons: {len(miss)}, of which kept as coastal: {len(miss) - (tid < 0).sum()}, dropped: {(tid < 0).sum()}")
b = b[b.tambon_id.notna()]

area_km2 = {f["properties"]["id"]: f["properties"]["area_km2"] for f in tb}
name = {f["properties"]["id"]: f["properties"]["tambon_th"] for f in tb}
g = b.groupby("tambon_id")
t = pd.DataFrame({
    "tambon_th": pd.Series(name),
    "bldg_2567": g.size(),
    "mean_height_m": g.height_m.mean().round(1),
    "p90_height_m": g.height_m.quantile(0.9).round(1),
    "max_height_m": g.height_m.max(),
    "mean_storeys": g.storeys.mean().round(2),
    "midrise_pct": (g.storeys.apply(lambda s: (s >= MID_RISE).mean()) * 100).round(1),
    "highrise": g.storeys.apply(lambda s: int((s >= HIGH_RISE).sum())),
    "floor_area_m2": g.floor_m2.sum().round(0),
    "footprint_m2": g.area_m2.sum().round(0),
})
t["floor_area_per_km2"] = (t.floor_area_m2 / pd.Series(area_km2)).round(0)
t["floor_to_land_pct"] = (t.floor_area_m2 / (pd.Series(area_km2) * 1e6) * 100).round(2)
t.index.name = "id"
t = t.fillna(0)
t.to_csv(os.path.join(DATA, "height_tambon.csv"), encoding="utf-8-sig")
print(t.sort_values("floor_area_per_km2", ascending=False)[["tambon_th", "bldg_2567", "mean_height_m", "midrise_pct", "highrise", "floor_to_land_pct"]].to_string())

# --- 500 m cells aligned with buildings_grid500.geojson ---
grid = json.load(open(os.path.join(DATA, "buildings_grid500.geojson"), encoding="utf-8"))
ring0 = [f["geometry"]["coordinates"][0] for f in grid["features"]]
lon0 = min(r[0][0] for r in ring0)
lat0 = min(r[0][1] for r in ring0)
dlat = CELL / 111320.0
dlon = CELL / (111320.0 * math.cos(math.radians(8.0)))
b["ix"] = np.floor((b.lon - lon0) / dlon).astype(int)
b["iy"] = np.floor((b.lat - lat0) / dlat).astype(int)
cells = b.groupby(["ix", "iy"]).agg(n=("id", "size"), floor=("floor_m2", "sum"), h_mean=("height_m", "mean"),
                                    h_max=("height_m", "max"), mid=("storeys", lambda s: int((s >= MID_RISE).sum())))
feats = []
for (i, j), r in cells.iterrows():
    x0, y0 = lon0 + i * dlon, lat0 + j * dlat
    feats.append({"type": "Feature",
                  "properties": {"n": int(r.n), "floor_m2": int(round(r.floor)), "far_pct": round(r.floor / (CELL * CELL) * 100, 1),
                                 "h_mean": round(float(r.h_mean), 1), "h_max": round(float(r.h_max), 1), "mid": int(r.mid)},
                  "geometry": {"type": "Polygon", "coordinates": [[[round(x0, 5), round(y0, 5)], [round(x0 + dlon, 5), round(y0, 5)],
                                                                   [round(x0 + dlon, 5), round(y0 + dlat, 5)], [round(x0, 5), round(y0 + dlat, 5)],
                                                                   [round(x0, 5), round(y0, 5)]]]}})
json.dump({"type": "FeatureCollection",
           "properties": {"source": "GISTDA API Gateway thailand-buildings-footprint, BL_YEAR 2567 (heights modelled: GEE_Height; footprints: sources GBA_osm / GBA_google)",
                          "cell_m": CELL, "buildings": int(len(b))},
           "features": feats},
          open(os.path.join(DATA, "height_grid500.geojson"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"cells {len(feats)}, max floor-to-land {max(f['properties']['far_pct'] for f in feats)}%")
print("sources:", b.source.value_counts().to_dict())

# ---- merge the tambon summary into the files used by the site ----
import csv
add = t[["bldg_2567", "mean_height_m", "midrise_pct", "highrise", "floor_to_land_pct"]].copy()
add["bldg_2567"] = add.bldg_2567.astype(int)
add["highrise"] = add.highrise.astype(int)
gj_path = os.path.join(DATA, "tambons.geojson")
gj = json.load(open(gj_path, encoding="utf-8"))
for f in gj["features"]:
    f["properties"].update({k: (int(v) if k in ("bldg_2567", "highrise") else float(v)) for k, v in add.loc[f["properties"]["id"]].items()})
with open(gj_path, "w", encoding="utf-8") as fh:
    head = {k: v for k, v in gj.items() if k != "features"}
    fh.write(json.dumps(head, ensure_ascii=False)[:-1] + ',\n"features": [\n')
    fh.write(",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in gj["features"]))
    fh.write("\n]\n}\n")
csv_path = os.path.join(DATA, "phuket_tambon_factors.csv")
rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
new = list(add.columns)
fields = [c for c in rows[0].keys() if c not in new] + new
with open(csv_path, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, fieldnames=fields)
    w.writeheader()
    for r in rows:
        r.update({k: add.loc[r["id"], k] for k in new})
        w.writerow({c: r.get(c, "") for c in fields})
print("merged", new, "into tambons.geojson and phuket_tambon_factors.csv")
