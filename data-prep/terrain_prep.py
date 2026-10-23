"""Land height and slope for Phuket from the Copernicus DEM (GLO-30), summarised per sub-district.

Usage: python terrain_prep.py <Copernicus_DSM_COG_10_N07_00_E098_00_DEM.tif> <Copernicus_DSM_COG_10_N08_00_E098_00_DEM.tif>
       tiles: https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N0{7,8}_00_E098_00_DEM/...
Needs : numpy, rasterio, Pillow (rasterio is only used here)
Output: new columns in public/data/tambons.geojson + phuket_tambon_factors.csv:
          elev_mean_m, elev_40_80_pct, elev_80_pct (land at 80 m or higher), slope_20_35_pct, slope_35_pct (land steeper than 35%),
          developable_flat_pct (agriculture + misc. land that is also below 80 m and flatter than 20%)
        public/data/terrain.png + terrain.json (map overlay of the restricted terrain classes and its corners)

Thresholds come from Phuket's environmental protection announcement (MNRE, Royal Gazette 13 Dec 2567, in force
14 Dec 2567 for 5 years):
  * zone 5 = 40–80 m above mean sea level: buildings up to 8 m
  * zone 6 = above 80 m: no building, except public utilities/security/conservation; on private land held before
    the 2560 announcement, at 80–140 m only, one single house up to 6 m and 90 m² footprint
  * hillside land (ลาดเชิงเขา): single houses only (6 or 12 m by zone, footprint 70–90 m²); the announcement leaves
    the slope definition to the Department of Public Works and Town & Country Planning standard, so 20 % is used
    here (the threshold of the 2560 version)
  * slope over 35 % and land above 80 m: no commercial digging of soil, rock or sand
They describe the terrain; the legal text decides what is actually allowed on a plot.

Notes: GLO-30 is a surface model (it includes trees and buildings). A 3 × 3 mean is applied before the slope is
computed to damp edges of tree crowns and roofs. Areas are counted on land pixels inside each sub-district.
"""
import json, math, os, sys, csv
import numpy as np, rasterio
from rasterio.merge import merge
from rasterio.features import rasterize
from PIL import Image

T1, T2 = sys.argv[1:3]
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
W, S, E, N = 98.24, 7.73, 98.50, 8.22
SLOPE_A, SLOPE_B, ELEV_HIGH = 20.0, 35.0, 80.0

srcs = [rasterio.open(T1), rasterio.open(T2)]
dem, tr = merge(srcs, bounds=(W, S, E, N))
dem = dem[0].astype("float64")
h, w = dem.shape
res = tr.a
lat_c = (S + N) / 2
dx = res * 111320 * math.cos(math.radians(lat_c))
dy = -tr.e * 110540
print(f"DEM {w}×{h} pixels, {dx:.1f} × {dy:.1f} m")

# 3×3 mean, then slope in percent
pad = np.pad(dem, 1, mode="edge")
sm = sum(pad[i:i + h, j:j + w] for i in range(3) for j in range(3)) / 9
gy, gx = np.gradient(sm, dy, dx)
slope = np.hypot(gx, gy) * 100

# masks: sub-districts and LDD land use (agriculture A, miscellaneous M)
tb = json.load(open(os.path.join(DATA, "tambons.geojson"), encoding="utf-8"))
ids = [f["properties"]["id"] for f in tb["features"]]
tid = rasterize(((f["geometry"], i + 1) for i, f in enumerate(tb["features"])), out_shape=(h, w), transform=tr, fill=0, dtype="int16")
lu = json.load(open(os.path.join(DATA, "landuse_2563.geojson"), encoding="utf-8"))
dev_shapes = [(f["geometry"], 1) for f in lu["features"] if str(f["properties"].get("cls", ""))[:1] in ("A", "M")]
water_shapes = [(f["geometry"], 1) for f in lu["features"] if str(f["properties"].get("cls", ""))[:1] == "W"]
dev = rasterize(dev_shapes, out_shape=(h, w), transform=tr, fill=0, dtype="uint8").astype(bool)
water = rasterize(water_shapes, out_shape=(h, w), transform=tr, fill=0, dtype="uint8").astype(bool) if water_shapes else np.zeros((h, w), bool)
land = (dem > 0.5) & ~water

flat = (slope < SLOPE_A) & (dem < ELEV_HIGH)
res_rows = {}
for i, tid_ in enumerate(ids, start=1):
    m = (tid == i) & land
    n = m.sum()
    res_rows[tid_] = {
        "elev_mean_m": round(float(dem[m].mean()), 1),
        "elev_40_80_pct": round(float(((dem[m] >= 40) & (dem[m] < ELEV_HIGH)).mean() * 100), 1),
        "elev_80_pct": round(float((dem[m] >= ELEV_HIGH).mean() * 100), 1),
        "slope_20_35_pct": round(float(((slope[m] >= SLOPE_A) & (slope <= SLOPE_B)[m]).mean() * 100), 1),
        "slope_35_pct": round(float((slope[m] > SLOPE_B).mean() * 100), 1),
        "developable_flat_pct": round(float((dev & flat)[m].sum() / n * 100), 1),
    }

# merge into the site files
for f in tb["features"]:
    f["properties"].update(res_rows[f["properties"]["id"]])
gj_path = os.path.join(DATA, "tambons.geojson")
with open(gj_path, "w", encoding="utf-8") as fh:
    head = {k: v for k, v in tb.items() if k != "features"}
    fh.write(json.dumps(head, ensure_ascii=False)[:-1] + ',\n"features": [\n')
    fh.write(",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in tb["features"]))
    fh.write("\n]\n}\n")
csv_path = os.path.join(DATA, "phuket_tambon_factors.csv")
rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
new = list(next(iter(res_rows.values())).keys())
fields = [c for c in rows[0].keys() if c not in new] + new
with open(csv_path, "w", newline="", encoding="utf-8-sig") as fh:
    wr = csv.DictWriter(fh, fieldnames=fields)
    wr.writeheader()
    for r in rows:
        r.update(res_rows[r["id"]])
        wr.writerow({c: r.get(c, "") for c in fields})

# overlay image: only the restricted classes, transparent elsewhere (inside Phuket's sub-districts)
cls = np.zeros((h, w), "uint8")
inside = (tid > 0) & land
cls[inside & (slope >= SLOPE_A) & (slope <= SLOPE_B)] = 1
cls[inside & (dem >= ELEV_HIGH)] = 2
cls[inside & (slope > SLOPE_B)] = 3
pal = {0: (0, 0, 0, 0), 1: (233, 178, 92, 170), 2: (150, 98, 60, 190), 3: (122, 36, 24, 210)}
rgba = np.zeros((h, w, 4), "uint8")
for k, c in pal.items():
    rgba[cls == k] = c
Image.fromarray(rgba, "RGBA").save(os.path.join(DATA, "terrain.png"), optimize=True)
west, north = tr.c, tr.f
east, south = west + w * res, north + h * tr.e
json.dump({"coordinates": [[west, north], [east, north], [east, south], [west, south]],
           "classes": {"1": "slope 20-35 %", "2": "80 m or higher", "3": "slope over 35 %"},
           "source": "Copernicus DEM GLO-30 (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA)"},
          open(os.path.join(DATA, "terrain.json"), "w"), indent=1)

print(f"{'tambon':16}{'elev':>6}{'≥80m':>7}{'20-35%':>8}{'>35%':>7}{'dev':>7}{'dev_flat':>9}")
for f in tb["features"]:
    p = f["properties"]
    print(f"{p['id']:16}{p['elev_mean_m']:6.0f}{p['elev_80_pct']:7.1f}{p['slope_20_35_pct']:8.1f}{p['slope_35_pct']:7.1f}{p['developable_pct']:7.1f}{p['developable_flat_pct']:9.1f}")
print("island: ≥80 m", round(float((dem[inside] >= ELEV_HIGH).mean() * 100), 1), "% · slope >35 %", round(float((slope[inside] > SLOPE_B).mean() * 100), 1), "% · max", round(float(dem[inside].max())), "m")
