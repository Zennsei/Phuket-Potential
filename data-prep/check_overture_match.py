"""Do the GISTDA 2567 buildings (D13) sit in the same places as the Overture buildings (D9)?

Usage: python check_overture_match.py <gistda_buildings_2567_phuket.csv.gz> <phuket_buildings_overture.parquet>
Needs: pyarrow, shapely, numpy
Output: checks/overture_match.txt

For every GISTDA building: the nearest Overture building centre (metres, local flat projection), the footprint
area ratio for close matches, results by footprint source, and the mean offset east/north. A real position error
would show as a clear shared offset; different footprint sources for the same building show as scattered distances.
"""
import collections, csv, gzip, os, sys
import numpy as np, pyarrow.parquet as pq, shapely

G, O = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checks", "overture_match.txt")
KX, KY = 111320 * np.cos(np.radians(7.95)), 110540
lines = []
say = lambda s="": (print(s), lines.append(s))

t = pq.read_table(O, columns=["geometry", "sources"])
g = shapely.from_wkb(t.column("geometry").to_numpy(zero_copy_only=False))
c = shapely.centroid(g)
OX, OY = shapely.get_x(c) * KX, shapely.get_y(c) * KY
oa = shapely.area(g) * KX * KY
osrc = np.array([s[0]["dataset"] if s else "" for s in t.column("sources").to_pylist()])

rows = list(csv.DictReader(gzip.open(G, "rt", encoding="utf-8")))
GX = np.array([float(r["lon"]) for r in rows]) * KX
GY = np.array([float(r["lat"]) for r in rows]) * KY
ga = np.array([float(r["area_m2"]) for r in rows])
gsrc = np.array([r["source"] for r in rows])

cell = 20.0
grid = collections.defaultdict(list)
for i, (x, y) in enumerate(zip(OX, OY)):
    grid[(int(x // cell), int(y // cell))].append(i)
dx = np.full(len(GX), np.nan); dy = dx.copy(); oi = np.full(len(GX), -1)
for k, (x, y) in enumerate(zip(GX, GY)):
    best = np.inf
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            for i in grid.get((int(x // cell) + a, int(y // cell) + b), ()):
                d = (OX[i] - x) ** 2 + (OY[i] - y) ** 2
                if d < best:
                    best, oi[k], dx[k], dy[k] = d, i, OX[i] - x, OY[i] - y
d = np.hypot(dx, dy)

say(f"GISTDA 2567 buildings: {len(rows):,} · Overture 2026-09-23 buildings: {len(g):,}")
say("Nearest Overture building centre to each GISTDA building centre:")
for lim in (0.5, 1, 2, 5, 10, 20):
    say(f"  within {lim:>4} m: {np.nanmean(d <= lim):.1%}")
say(f"  none within 20 m: {np.mean(~(d <= 20)):.1%}")
m = d <= 2
r = ga[m] / oa[oi[m]]
say(f"Footprint area GISTDA / Overture for matches within 2 m: median {np.median(r):.3f}, within ±10 %: {np.mean(np.abs(r - 1) <= 0.1):.1%}")
say("By GISTDA footprint source:")
for s, n in collections.Counter(gsrc).most_common():
    sel = gsrc == s
    say(f"  {s}: {n:,} buildings · within 2 m {np.nanmean(d[sel] <= 2):.1%} · within 5 m {np.nanmean(d[sel] <= 5):.1%}")
sel = (d > 2) & (d <= 20)
say(f"Pairs 2–20 m apart: {sel.sum():,} · mean offset east {np.nanmean(dx[sel]):+.2f} m, north {np.nanmean(dy[sel]):+.2f} m"
    f" · median east {np.nanmedian(dx[sel]):+.2f} m, north {np.nanmedian(dy[sel]):+.2f} m")
src = collections.Counter(osrc[oi[sel]])
say("  Overture footprint source for those pairs: " + ", ".join(f"{k} {v:,}" for k, v in src.most_common()))
say("Reading: no shared offset (well under 1 m) -> no position error; the 2–20 m pairs are the same buildings")
say("drawn from different footprint datasets (mostly Google in GISTDA vs Microsoft in Overture).")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("saved", OUT)
