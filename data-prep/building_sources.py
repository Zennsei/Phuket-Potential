"""Buildings per tambon from three sources, counted the same way, for the compare page ("measure the same thing").

Usage: python data-prep/building_sources.py <ภูเก็ต.shp> <gistda_buildings_2567_phuket.csv.gz> <phuket_buildings_overture.parquet> <THA_Tambon.shp>
         D1  GISTDA footprints 2565 (raw-data/03_…zip; copy the Thai-named files to an English name first if GDAL complains)
         D13 GISTDA API Gateway buildings 2567 (raw-data/01_…zip, gistda_api/)
         D9  Overture buildings, release 2026-09-23.1 (raw-data/06_…zip)
         D4  the country-wide tambon file (raw-data/10_Tambon.zip), used only for the Phang Nga and Krabi
             tambons next to Phuket, so buildings on the mainland are not counted as Phuket
Needs : geopandas, shapely, pyarrow, pandas  (same as data_prep.py)
Output: public/data/building_sources.csv   one row per tambon: count and footprint area of each source
        data-prep/checks/building_sources.txt   totals, buildings dropped, and a cross-check with the existing columns

Same rules for every source, so the three can be compared fairly:
  1. keep a building only if its centre lies inside the box all three sources cover
     (lon 98.255–98.485, lat 7.75–8.205: the main island; the Overture extract stops at 7.745 °N and the
     GISTDA 2567 download at 7.75 °N, so Ko Racha and the other southern islands are left out of all three)
  2. centre inside a Phuket tambon polygon (public/data/tambons.geojson) → that tambon; inside a Phang Nga or
     Krabi tambon → dropped; otherwise the nearest tambon within 3 km (coastal and over-water buildings, the
     same rule as data_prep.py), dropped when that nearest tambon is in Phang Nga or Krabi. The GISTDA files
     only hold Phuket; the Overture extract is a box that reaches the mainland across the Pak Phra strait
  3. footprint area in UTM 47N (D1, D9); D13 already carries area_m2 worked out in metres by gistda_buildings_api.py
"""
import json
import os
import sys

import geopandas as gpd
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import shapely

D1, D13, D9, D4 = sys.argv[1:5]
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "public", "data")
UTM = "EPSG:32647"
W, S, E, N = 98.255, 7.75, 98.485, 8.205
MAX_GAP_M = 3000

lines = []


def say(s=""):
    print(s)
    lines.append(s)


tam = gpd.read_file(os.path.join(DATA, "tambons.geojson"))[["id", "tambon_th", "buildings", "geometry"]].to_crs(UTM)
# neighbouring provinces (one row per tambon, id None) so a building is given to whichever side it is nearest
box_utm = gpd.GeoSeries([shapely.box(W, S, E, N)], crs="EPSG:4326").to_crs(UTM).buffer(5000).iloc[0]
nb = gpd.read_file(D4, encoding="utf-8", columns=["P_NAME_E"]).to_crs(UTM)
nb = nb[nb.P_NAME_E.str.upper().isin(["PHANGNGA", "PHANG NGA", "KRABI"]) & nb.intersects(box_utm)]
zones = pd.concat([tam[["id", "geometry"]], gpd.GeoDataFrame({"id": [None] * len(nb)}, geometry=nb.geometry.values, crs=UTM)], ignore_index=True)
zones = gpd.GeoDataFrame(zones, geometry="geometry", crs=UTM)


def assign(name, lon, lat, x, y, area):
    """Return a per-tambon table (count, footprint m²) and print what was dropped."""
    lon, lat, area = np.asarray(lon, float), np.asarray(lat, float), np.asarray(area, float)
    n0 = len(lon)
    inbox = (lon >= W) & (lon <= E) & (lat >= S) & (lat <= N)
    pts = gpd.GeoDataFrame({"fp": area[inbox]}, geometry=gpd.points_from_xy(np.asarray(x)[inbox], np.asarray(y)[inbox]), crs=UTM)
    j = gpd.sjoin(pts, zones[["geometry"]], how="left", predicate="within")
    j = j[~j.index.duplicated()]
    miss = j.index_right.isna()
    near = gpd.sjoin_nearest(pts[miss], zones[["geometry"]], how="left", max_distance=MAX_GAP_M)
    near = near[~near.index.duplicated()]
    j.loc[miss, "index_right"] = near.index_right
    j["id"] = [zones.id.values[int(i)] if i == i else None for i in j.index_right]
    nb_hit = j.index_right.notna() & j.id.isna()
    kept = j[j.id.notna()]
    coastal = int((miss & j.id.notna()).sum())
    say(f"{name}: {n0:,} buildings · outside the shared box {int((~inbox).sum()):,} · in or nearest to Phang Nga/Krabi {int(nb_hit.sum()):,} · "
        f"over 3 km from any tambon {int(j.index_right.isna().sum()):,} · coastal kept {coastal:,} · "
        f"counted {len(kept):,} · footprint {kept.fp.sum() / 1e6:,.2f} km²")
    g = kept.groupby("id")
    return pd.DataFrame({"count": g.size(), "footprint_m2": g.fp.sum()})


# D1 GISTDA 2565 footprints
d1 = gpd.read_file(D1).to_crs(UTM)
c1 = d1.geometry.centroid
ll1 = gpd.GeoSeries(c1, crs=UTM).to_crs("EPSG:4326")
t1 = assign("GISTDA 2565 (D1)", ll1.x, ll1.y, c1.x, c1.y, d1.geometry.area)

# D13 GISTDA 2567 buildings with height (points + area already in metres)
d13 = pd.read_csv(D13, dtype={"id": str}).drop_duplicates("id")
d13 = d13[d13.area_m2 > 0]
xy13 = gpd.GeoSeries(gpd.points_from_xy(d13.lon, d13.lat), crs="EPSG:4326").to_crs(UTM)
t13 = assign("GISTDA 2567 (D13)", d13.lon, d13.lat, xy13.x, xy13.y, d13.area_m2)

# D9 Overture
tb = pq.read_table(D9, columns=["geometry"])
g9 = gpd.GeoSeries(shapely.from_wkb(tb.column("geometry").to_numpy(zero_copy_only=False)), crs="EPSG:4326")
u9 = g9.to_crs(UTM)
c9 = u9.centroid
ll9 = gpd.GeoSeries(c9, crs=UTM).to_crs("EPSG:4326")
t9 = assign("Overture 2026-09-23.1 (D9)", ll9.x, ll9.y, c9.x, c9.y, u9.area)

out = tam[["id", "tambon_th"]].set_index("id")
for key, t in (("gistda2565", t1), ("gistda2567", t13), ("overture", t9)):
    out[f"{key}_count"] = t["count"].reindex(out.index).fillna(0).astype(int)
    out[f"{key}_footprint_m2"] = t["footprint_m2"].reindex(out.index).fillna(0).round(0).astype(int)
out = out.reset_index()
out.to_csv(os.path.join(DATA, "building_sources.csv"), index=False, encoding="utf-8-sig")

say()
say("cross-check with the existing columns (they used the whole province / download, not the shared box):")
ex = tam.set_index("id").buildings
d = out.set_index("id").gistda2565_count - ex
say(f"  D1 count vs tambons.geojson `buildings` ({int(ex.sum()):,}): differs in {int((d != 0).sum())} tambons, "
    f"total {int(d.sum()):+,} · largest " + ", ".join(f"{out.set_index('id').tambon_th[i]} {int(v):+,}" for i, v in d[d != 0].sort_values().items()))
h = pd.read_csv(os.path.join(DATA, "height_tambon.csv"), encoding="utf-8-sig").set_index("id")
d2 = out.set_index("id").gistda2567_count - h.bldg_2567.reindex(out.id).values
say(f"  D13 count vs height_tambon.csv `bldg_2567` ({int(h.bldg_2567.sum()):,}): differs in {int((d2 != 0).sum())} tambons, total {int(d2.sum()):+,}")
say()
say("per tambon (count / footprint km²):  GISTDA 2565 | GISTDA 2567 | Overture")
for r in out.itertuples():
    say(f"  {r.tambon_th:12s} {r.gistda2565_count:7,} {r.gistda2565_footprint_m2 / 1e6:6.2f} | "
        f"{r.gistda2567_count:7,} {r.gistda2567_footprint_m2 / 1e6:6.2f} | {r.overture_count:7,} {r.overture_footprint_m2 / 1e6:6.2f}")
with open(os.path.join(HERE, "checks", "building_sources.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
