"""Check GISTDA 2567 modelled heights/storeys (D13) against an independent source, and make a spot-check list.

Usage: python check_heights.py <gistda_buildings_2567_phuket.csv.gz> <phuket_buildings_overture.parquet>
Needs : pandas, numpy, scipy, shapely, pyarrow
Output: printed comparison + data-prep/checks/height_spotcheck.csv (buildings for the team to check by eye)

The comparison uses Overture buildings that carry a height or number of floors (mostly mapped by
OpenStreetMap volunteers). Those are not survey data either, but they were recorded independently,
so agreement or disagreement tells us how far to trust the model.
"""
import os, sys
import numpy as np, pandas as pd, pyarrow.parquet as pq, shapely
from scipy.spatial import cKDTree

G, OV = sys.argv[1:3]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checks", "height_spotcheck.csv")
d = pd.read_csv(G)
t = pq.read_table(OV, columns=["geometry", "height", "num_floors"]).to_pandas()
h = t[t.height.notna() | t.num_floors.notna()].copy()
c = shapely.centroid(shapely.from_wkb(h.geometry.values))
h["lon"], h["lat"] = shapely.get_x(c), shapely.get_y(c)
kx, ky = np.cos(np.radians(7.95)) * 111320, 110540
dist, idx = cKDTree(np.c_[d.lon * kx, d.lat * ky]).query(np.c_[h.lon * kx, h.lat * ky])
h["dist"], h["g_h"], h["g_st"] = dist, d.height_m.values[idx], d.storeys.values[idx]
m = h[h.dist < 15]
print(f"Overture buildings with height or floors: {len(h)}, matched to a GISTDA centroid within 15 m: {len(m)}")
mh = m[m.height.notna()]
e = mh.g_h - mh.height
print(f"height  n={len(mh)}  median difference {e.median():+.1f} m  median |difference| {e.abs().median():.1f} m  r={np.corrcoef(mh.g_h, mh.height)[0, 1]:.2f}")
mf = m[m.num_floors.notna()]
e = mf.g_st - mf.num_floors
print(f"storeys n={len(mf)}  exact {(e == 0).mean():.1%}  within ±1 {(e.abs() <= 1).mean():.1%}  median difference {e.median():+.0f}  r={np.corrcoef(mf.g_st, mf.num_floors)[0, 1]:.2f}")
one = mf[mf.num_floors == 1]
print(f"single-storey in Overture (n={len(one)}): GISTDA says 1 storey for {(one.g_st == 1).mean():.1%}, 2+ for {(one.g_st >= 2).mean():.1%}")

# spot-check list: the 15 tallest + 2 random buildings of 4+ storeys per sub-district + 1 random low building per sub-district
tall = d.nlargest(15, "height_m").assign(why="tallest")
rng = np.random.default_rng(2569)
mid = d[d.storeys >= 4].groupby("tambon", group_keys=False).apply(lambda g: g.sample(min(2, len(g)), random_state=rng.integers(1e9))).assign(why="4+ storeys sample")
low = d[d.storeys <= 2].groupby("tambon", group_keys=False).apply(lambda g: g.sample(1, random_state=rng.integers(1e9))).assign(why="1-2 storeys sample")
s = pd.concat([tall, mid, low]).drop_duplicates("id")
s["google_maps"] = "https://www.google.com/maps?q=" + s.lat.round(6).astype(str) + "," + s.lon.round(6).astype(str)
s["storeys_seen"] = ""
s["note"] = ""
s[["why", "tambon", "height_m", "storeys", "area_m2", "lat", "lon", "google_maps", "storeys_seen", "note"]].to_csv(OUT, index=False, encoding="utf-8-sig")
print("spot-check list:", len(s), "buildings ->", OUT)
