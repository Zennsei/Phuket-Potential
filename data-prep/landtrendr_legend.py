"""Work out which year each Landtrendr colour means, from the files of data-prep/gistda_api_probe6.py.

Usage: python landtrendr_legend.py <folder with lt_landtrendr-all_13_*.png and imagery_*.jpg>
Needs: numpy, Pillow
Output: checks/landtrendr_legend.txt (and a line of Python/TypeScript to copy into src/landtrendr.ts)

Idea: LandTrendr marks the year a 30 m pixel's Landsat time series breaks (usually vegetation lost). If a colour means
year Y, its pixels should look green before Y and less green from Y on, while land with no colour stays the same.
  1. put the 2 x 2 Landtrendr tiles together (512 x 512, the same box as the yearly pictures)
  2. greenness of every pixel in every year: g = G / (R + G + B), which ignores how bright a picture is
  3. take away the median greenness of unchanged land in that year (removes colour differences between pictures)
  4. per colour: the year that best splits its series into "greener before" and "less green after"
     (largest drop between the two means, measured against the spread), done on the colour's median series
     and again pixel by pixel (the most common break year among its pixels); both should agree
Years 1972-1979 are left out (clouds and stripes, and before Landsat 5); the method needs a few years on each side.
Tested on made-up pictures with known years: 33 of 35 colours exact, 2 off by one year (a year with no picture,
2012, and a year at the very start cannot be pinned exactly).
"""
import glob, os, re, sys, warnings
from collections import Counter
import numpy as np
from PIL import Image

SRC = sys.argv[1]
warnings.filterwarnings("ignore", "All-NaN slice")  # a colour fully under a cloud in one picture
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checks", "landtrendr_legend.txt")
FIRST_YEAR = 1984
MIN_SIDE = 2          # at least this many pictures before and after a break
lines = []
say = lambda s="": (print(s), lines.append(s))

# 1. Landtrendr mosaic
tiles = {}
for f in glob.glob(os.path.join(SRC, "lt_landtrendr-all_13_*_*.png")):
    x, y = map(int, re.findall(r"_(\d+)_(\d+)\.png$", f)[0])
    tiles[(x, y)] = np.asarray(Image.open(f).convert("RGBA"))
if len(tiles) != 4:
    sys.exit(f"need 4 Landtrendr tiles, found {len(tiles)}")
xs, ys = sorted({k[0] for k in tiles}), sorted({k[1] for k in tiles})
lt = np.vstack([np.hstack([tiles[(x, y)] for x in xs]) for y in ys])

# 2. yearly pictures
pics = {}
for f in glob.glob(os.path.join(SRC, "imagery_*.jpg")):
    yv = int(re.findall(r"imagery_(\d{4})\.jpg$", f)[0])
    if yv >= FIRST_YEAR:
        im = Image.open(f).convert("RGB")
        if im.size != (lt.shape[1], lt.shape[0]):
            im = im.resize((lt.shape[1], lt.shape[0]), Image.BILINEAR)
        pics[yv] = np.asarray(im).astype(float)
years = sorted(pics)
say(f"Landtrendr mosaic {lt.shape[1]} x {lt.shape[0]} px · pictures {years[0]}-{years[-1]} ({len(years)} years)")
G = np.stack([p[..., 1] / (p.sum(axis=2) + 1e-6) for p in (pics[y] for y in years)])      # years x h x w
bright = np.stack([p.sum(axis=2) for p in (pics[y] for y in years)])

# unchanged land: no Landtrendr colour, not water (water: dark and bluish in most pictures), not cloud
blue = np.median(np.stack([p[..., 2] / (p.sum(axis=2) + 1e-6) for p in (pics[y] for y in years)]), axis=0)
nocolour = lt[..., 3] == 0
water = (blue > 0.36) | (np.median(bright, axis=0) < 120)
stable = nocolour & ~water
say(f"pixels: coloured {int((~nocolour).sum()):,} · unchanged land {int(stable.sum()):,} · water/dark {int((nocolour & water).sum()):,}")
cloud = bright > np.percentile(bright, 99.5, axis=(1, 2), keepdims=True)
Gm = np.where(cloud, np.nan, G)
ref = np.array([np.nanmedian(Gm[i][stable]) for i in range(len(years))])
D = Gm - ref[:, None, None]                                                            # greenness against unchanged land


def best_break(series):
    """year index k (series[:k] before, series[k:] after) with the largest drop, and its strength (drop / spread)"""
    best, bk = -np.inf, None
    for k in range(MIN_SIDE, len(series) - MIN_SIDE + 1):
        a, b = series[:k], series[k:]
        a, b = a[~np.isnan(a)], b[~np.isnan(b)]
        if len(a) < MIN_SIDE or len(b) < MIN_SIDE:
            continue
        spread = np.sqrt((a.var() * len(a) + b.var() * len(b)) / (len(a) + len(b))) + 1e-4
        score = (a.mean() - b.mean()) / spread
        if score > best:
            best, bk = score, k
    return bk, best


# 3-4. per colour
rgb = lt[..., :3].reshape(-1, 3)
alpha = lt[..., 3].reshape(-1)
colours = Counter(tuple(int(v) for v in px) for px in rgb[alpha > 0])
rows = []
for c, n in colours.most_common():
    mask = np.all(lt[..., :3] == c, axis=2) & (lt[..., 3] > 0)
    series = np.array([np.nanmedian(D[i][mask]) for i in range(len(years))])
    k, strength = best_break(series)
    # pixel by pixel (at most 400 pixels per colour, spread evenly)
    idx = np.argwhere(mask)
    if len(idx) > 400:
        idx = idx[np.linspace(0, len(idx) - 1, 400).astype(int)]
    votes = Counter()
    for r, q in idx:
        kk, s = best_break(D[:, r, q])
        if kk is not None and s > 1.0:
            votes[years[kk]] += 1
    mode, mv = votes.most_common(1)[0] if votes else (None, 0)
    rows.append((c, n, years[k] if k is not None else None, round(float(strength), 2), mode, mv / max(1, sum(votes.values()))))

say()
say("colour (R,G,B)     pixels  year(median series)  strength  year(pixel vote)  share")
for c, n, y1, s, y2, share in sorted(rows, key=lambda r: (r[2] or 0)):
    say(f"{str(c):18} {n:6,}  {y1!s:>19}  {s:8.2f}  {y2!s:>16}  {share:5.0%}")
agree = sum(1 for r in rows if r[2] is not None and r[4] is not None and abs(r[2] - r[4]) <= 1)
distinct = len({r[2] for r in rows if r[2] is not None})
say()
say(f"colours where both ways agree within 1 year: {agree} of {len(rows)} · distinct years found: {distinct}")
say("Read: if most colours agree and the years spread over the Landsat period one colour per year, the colours are")
say("years and the table is the legend. If many colours land on the same year or disagree, the colours mean something else.")
say()
say("for src/landtrendr.ts (year from the median series; check the table first):")
say("  " + ", ".join(f"[{c[0]}, {c[1]}, {c[2]}]: {y1}" for c, _, y1, _, _, _ in rows))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("saved", OUT)
