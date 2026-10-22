"""Travel time by road from every building to five kinds of destination (OpenStreetMap network).

Usage: python travel_prep.py <osm_roads.geojson> <osm_pois.geojson> <GISTDA building shapefile>
       (osm_*.geojson come from osm_extract.py; the building file is 83_ภูเก็ต.shp copied to an ASCII name)
Needs : geopandas, numpy, scipy
Output: new columns in public/data/tambons.geojson and phuket_tambon_factors.csv:
          tt_airport_min, tt_oldtown_min, tt_hospital_min, tt_school_min, tt_pier_min
          (median minutes over the buildings of the sub-district)
        public/data/travel_grid500.geojson  (same cells as buildings_grid500.geojson; a, o, h, s, p = median minutes)

Model (kept simple and stated on the method page):
  * road speeds by OSM class (SPEED below), both directions, no traffic, no turn costs
  * from the building to the nearest road node at ACCESS_KMH; buildings more than MAX_SNAP_M from the
    main road network (small islands without a bridge) are left out
  * destinations: airport terminals, Thalang Road (old town), hospitals (OSM hospital named
    "โรงพยาบาล"/"Hospital", clinics excluded), schools/colleges/universities, piers (ferry terminals)
"""
import json, math, os, sys
import numpy as np, geopandas as gpd
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components, dijkstra
from scipy.spatial import cKDTree

ROADS, POIS, BLDG = sys.argv[1:4]
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
UTM = "EPSG:32647"
SPEED = {  # km/h
    "motorway": 80, "trunk": 70, "primary": 60, "primary_link": 40, "secondary": 50, "secondary_link": 35,
    "tertiary": 40, "tertiary_link": 30, "unclassified": 30, "residential": 25, "living_street": 15,
    "service": 15, "track": 10,
}
ACCESS_KMH = 10
MAX_SNAP_M = 1000
DESTS = {"airport": "a", "oldtown": "o", "hospital": "h", "school": "s", "pier": "p"}

# ---- road graph (metres, UTM) ----
roads = gpd.read_file(ROADS).to_crs(UTM)
roads = roads[roads.hw.isin(SPEED.keys())]
node_id, xs, ys, rows, cols, cost = {}, [], [], [], [], []


def nid(x, y):
    k = (round(x, 1), round(y, 1))
    if k not in node_id:
        node_id[k] = len(xs)
        xs.append(k[0]); ys.append(k[1])
    return node_id[k]


for geom, hw in zip(roads.geometry, roads.hw):
    lines = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
    v = SPEED[hw] / 3.6  # m/s
    for line in lines:
        c = list(line.coords)
        for (x1, y1), (x2, y2) in zip(c, c[1:]):
            a, b = nid(x1, y1), nid(x2, y2)
            if a == b:
                continue
            t = math.hypot(x2 - x1, y2 - y1) / v / 60  # minutes
            rows += [a, b]; cols += [b, a]; cost += [t, t]
n = len(xs)
G = coo_matrix((cost, (rows, cols)), shape=(n, n)).tocsr()
ncomp, lab = connected_components(G, directed=False)
main = np.bincount(lab).argmax()
keep = np.where(lab == main)[0]
print(f"road nodes {n}, components {ncomp}, main network {len(keep)} nodes")
tree = cKDTree(np.c_[np.array(xs)[keep], np.array(ys)[keep]])


def snap(px, py):
    d, i = tree.query(np.c_[px, py])
    return d, keep[i]


# ---- destinations ----
pois = gpd.read_file(POIS).to_crs(UTM)
name = (pois.name.fillna("") + " " + pois.name_en.fillna("")).str.lower()
sel = {
    "airport": pois[pois.kind == "terminal"],
    "hospital": pois[(pois.kind == "hospital") & (name.str.contains("โรงพยาบาล") | name.str.contains("hospital"))],
    "school": pois[pois.kind.isin(["school", "college", "university"])],
    "pier": pois[pois.kind == "ferry_terminal"],
}
thalang = roads[roads.name.fillna("").str.contains("ถนนถลาง|Thalang Road", regex=True)]
oldtown = thalang.geometry.union_all().centroid
dest_nodes = {}
for k, g in sel.items():
    pts = g.geometry.centroid
    _, nodes = snap(pts.x.values, pts.y.values)
    dest_nodes[k] = np.unique(nodes)
    print(f"{k}: {len(g)} places")
_, on = snap([oldtown.x], [oldtown.y])
dest_nodes["oldtown"] = on
print("old town point (Thalang Road):", gpd.GeoSeries([oldtown], crs=UTM).to_crs(4326).iloc[0])

# ---- buildings ----
b = gpd.read_file(BLDG).to_crs(UTM)
c = b.geometry.centroid
bx, by = c.x.values, c.y.values
sd, sn = snap(bx, by)
ok = sd <= MAX_SNAP_M
print(f"buildings {len(b)}, left out (far from roads / islands) {int((~ok).sum())}")
minutes = {}
for k, nodes in dest_nodes.items():
    dist = dijkstra(G, directed=False, indices=nodes, min_only=True)
    m = dist[sn] + sd / (ACCESS_KMH / 3.6) / 60
    m[~ok] = np.nan
    minutes[k] = m

# ---- per tambon (median over buildings) ----
gj_path = os.path.join(DATA, "tambons.geojson")
gj = json.load(open(gj_path, encoding="utf-8"))
tb = gpd.GeoDataFrame.from_features(gj["features"], crs=4326).to_crs(UTM)
pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy(bx, by), crs=UTM)
j = gpd.sjoin(pts, tb[["id", "geometry"]], how="left", predicate="within")
j = j[~j.index.duplicated()]
miss = j.id.isna()
near = gpd.sjoin_nearest(pts[miss.values], tb[["id", "geometry"]], how="left", max_distance=3000)
near = near[~near.index.duplicated()]
j.loc[miss, "id"] = near.id
tid = j.id.values
cols_out = {}
for f in gj["features"]:
    i = f["properties"]["id"]
    mask = tid == i
    vals = {f"tt_{k}_min": round(float(np.nanmedian(minutes[k][mask])), 1) for k in DESTS}
    f["properties"].update(vals)
    cols_out[i] = vals
    print(f"{f['properties']['tambon_th']:12}", vals)
with open(gj_path, "w", encoding="utf-8") as fh:
    head = {k: v for k, v in gj.items() if k != "features"}
    fh.write(json.dumps(head, ensure_ascii=False)[:-1] + ',\n"features": [\n')
    fh.write(",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in gj["features"]))
    fh.write("\n]\n}\n")

import csv
csv_path = os.path.join(DATA, "phuket_tambon_factors.csv")
rows_csv = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
new = list(next(iter(cols_out.values())).keys())
fields = [c for c in rows_csv[0].keys() if c not in new] + new
with open(csv_path, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, fieldnames=fields)
    w.writeheader()
    for r in rows_csv:
        r.update(cols_out[r["id"]])
        w.writerow({c: r.get(c, "") for c in fields})

# ---- 500 m cells aligned with buildings_grid500.geojson ----
grid = json.load(open(os.path.join(DATA, "buildings_grid500.geojson"), encoding="utf-8"))
lon0 = min(f["geometry"]["coordinates"][0][0][0] for f in grid["features"])
lat0 = min(f["geometry"]["coordinates"][0][0][1] for f in grid["features"])
dlat = 500 / 111320.0
dlon = 500 / (111320.0 * math.cos(math.radians(8.0)))
ll = gpd.GeoSeries(gpd.points_from_xy(bx, by), crs=UTM).to_crs(4326)
ix = np.floor((ll.x.values - lon0) / dlon).astype(int)
iy = np.floor((ll.y.values - lat0) / dlat).astype(int)
cells = {}
for i in np.where(ok)[0]:
    cells.setdefault((ix[i], iy[i]), []).append(i)
feats = []
for (i, jy), idx in cells.items():
    x0, y0 = lon0 + i * dlon, lat0 + jy * dlat
    props = {s: round(float(np.median(minutes[k][idx])), 1) for k, s in DESTS.items()}
    feats.append({"type": "Feature", "properties": props,
                  "geometry": {"type": "Polygon", "coordinates": [[[round(x0, 5), round(y0, 5)], [round(x0 + dlon, 5), round(y0, 5)],
                                                                   [round(x0 + dlon, 5), round(y0 + dlat, 5)], [round(x0, 5), round(y0 + dlat, 5)],
                                                                   [round(x0, 5), round(y0, 5)]]]}})
json.dump({"type": "FeatureCollection",
           "properties": {"source": "OpenStreetMap road network (Geofabrik 2026-10-20), GISTDA building centroids 2565; minutes, median per 500 m cell",
                          "keys": {s: k for k, s in DESTS.items()}},
           "features": feats},
          open(os.path.join(DATA, "travel_grid500.geojson"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("cells", len(feats))
