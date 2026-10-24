"""Work out which years the Landtrendr colours mean, from the files of data-prep/gistda_api_probe6.py.

Usage: python landtrendr_legend.py <folder with lt_landtrendr-all_13_*.png and imagery_*.jpg>
Needs: numpy, Pillow, scipy
Output: checks/landtrendr_legend.txt (text only: numbers worked out from the pictures, no pictures)

LandTrendr marks the year a 30 m pixel's Landsat time series breaks (usually vegetation lost). The GISTDA layer paints
35 colours with no legend. This compares each colour with GISTDA's yearly satellite pictures of the same box:
  1. put the 2 x 2 Landtrendr tiles together (512 x 512 px, the same box as the yearly pictures)
  2. every picture: hide water and clouds, blur a little (pictures after about 2014 are much sharper than the
     older ones), work out how green each pixel is (2G - R - B) / (R + G + B), and turn that into a rank among the
     land pixels of that picture (0 = least green, 1 = greenest). Ranks do not care how bright or hazy a picture is.
  3. every pixel: the first "clearing", i.e. green in two pictures (rank > 0.5) and then bare in two pictures
     (rank < 0.2, then < 0.3). The clearing year is the year of the first bare picture.
  4. the same test fires by chance on land that has no colour (clouds, haze, seasons): that is the noise level.
     For each colour: clearings per 100 px in each year minus the noise level in that year = "excess".
     The year with the most excess is the colour's best guess; "share" = that year's part of all the excess.
  5. a colour gets a year only when the evidence is strong: excess >= 4 per 100 px, share >= 40 % and the runner-up
     year at most half as strong. Colours are also put in groups by hue; a group's years run over the best years of
     its colours (excess >= 1.5), leaving out a colour more than 6 years from the group's median.
Limits: one 10 x 10 km box (Phuket town, Ratsada, Ko Sire); no picture for 2012 (a 2012 change shows up in 2013);
cloudy or hazy pictures can push a clearing a year or two later. Read the result as "about", not exact.
"""
import colorsys, glob, os, re, sys, warnings
from collections import Counter
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
warnings.filterwarnings("ignore")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checks", "landtrendr_legend.txt")
FIRST_YEAR = 1987        # 1972-1979 pictures are cloudy and striped, and before Landsat 5
BLUR = 1.0               # px (one px is about 19 m)
GREEN, BARE, BARE2 = 0.5, 0.2, 0.3
STRONG_EXCESS, STRONG_SHARE, RUNNER_UP = 4.0, 0.40, 0.5
GROUP_EXCESS, GROUP_FAR = 1.5, 6
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

# 2. yearly pictures -> greenness rank
pics = {}
for f in glob.glob(os.path.join(SRC, "imagery_*.jpg")):
    yv = int(re.findall(r"imagery_(\d{4})\.jpg$", f)[0])
    if yv >= FIRST_YEAR:
        im = Image.open(f).convert("RGB")
        if im.size != (lt.shape[1], lt.shape[0]):
            im = im.resize((lt.shape[1], lt.shape[0]), Image.BILINEAR)
        pics[yv] = np.asarray(im).astype(float)
years = sorted(pics)
Y = np.array(years)
missing = [y for y in range(years[0], years[-1] + 1) if y not in pics]
say(f"Landtrendr mosaic {lt.shape[1]} x {lt.shape[0]} px · pictures {years[0]}-{years[-1]} ({len(years)} years; none for {', '.join(map(str, missing)) or '-'})")
blue = np.median(np.stack([p[..., 2] / (p.sum(axis=2) + 1e-6) for p in pics.values()]), axis=0)
water = (blue > 0.36) | (np.median(np.stack([p.sum(axis=2) for p in pics.values()]), axis=0) < 120)
land = ~ndimage.binary_dilation(water, iterations=2)
R = []
for yv in years:
    a = pics[yv]
    sat = a.max(axis=2) - a.min(axis=2)
    cloud = ndimage.binary_dilation((a.sum(axis=2) > np.percentile(a.sum(axis=2)[land], 95)) & (sat < 50), iterations=3)
    b = np.stack([ndimage.gaussian_filter(a[..., k], BLUR) for k in range(3)], axis=-1)
    g = (2 * b[..., 1] - b[..., 0] - b[..., 2]) / (b.sum(axis=2) + 1e-6)
    ok = land & ~cloud
    r = np.full(g.shape, np.nan)
    r[ok] = (np.argsort(np.argsort(g[ok])) + 0.5) / ok.sum()
    R.append(r)
R = np.stack(R)                                                      # years x h x w


# 3. first clearing of each pixel
def first_clearing(s):
    ok = ~np.isnan(s)
    yy, v = Y[ok], s[ok]
    for k in range(2, len(v) - 1):
        if v[k - 2] > GREEN and v[k - 1] > GREEN and v[k] < BARE and v[k + 1] < BARE2:
            return int(yy[k])
    return None


def clearing_rate(mask):
    pts = np.argwhere(mask)
    c = Counter(e for e in (first_clearing(R[:, r, q]) for r, q in pts) if e)
    return {y: c.get(y, 0) / max(1, len(pts)) * 100 for y in years}, len(pts)


# 4. noise level from land with no colour
noise, n_noise = clearing_rate((lt[..., 3] == 0) & land)
say(f"land with no colour: {n_noise:,} px, chance clearings {sum(noise.values()):.1f} per 100 px (most in "
    + ", ".join(f"{y}" for y, _ in sorted(noise.items(), key=lambda kv: -kv[1])[:3]) + ")")


def group(c):
    h = colorsys.rgb_to_hls(*(v / 255 for v in c))[0] * 360
    return "red" if h < 15 else "orange" if h < 40 else "yellow" if h < 70 else "green" if h < 170 else "blue" if h < 240 else "pink-purple"


GROUPS = ["red", "orange", "blue", "pink-purple", "green", "yellow"]
cnt = Counter(tuple(int(v) for v in px[:3]) for px in lt.reshape(-1, 4) if px[3] > 0)
rows = []
for c in cnt:
    rate, n = clearing_rate(np.all(lt[..., :3] == c, axis=2) & (lt[..., 3] > 0) & land)
    ex = {y: rate[y] - noise[y] for y in years}
    pos = sum(v for v in ex.values() if v > 0)
    top = sorted(ex.items(), key=lambda kv: -kv[1])[:3]
    share = top[0][1] / pos if pos > 0 else 0
    strong = top[0][1] >= STRONG_EXCESS and share >= STRONG_SHARE and top[1][1] <= RUNNER_UP * top[0][1]
    light = colorsys.rgb_to_hls(*(v / 255 for v in c))[1]
    rows.append(dict(c=c, n=cnt[c], land=n, group=group(c), light=light, top=top, share=share, year=top[0][0] if strong else None))

# 5. table and groups
say()
say("group        colour (R,G,B)     pixels  best years (excess clearings per 100 px)       share  year")
for r in sorted(rows, key=lambda r: (GROUPS.index(r["group"]), -r["light"])):
    tops = "  ".join(f"{y}:{v:5.1f}" for y, v in r["top"])
    say(f"{r['group']:12} {str(r['c']):18} {r['n']:6,}  {tops:44}  {r['share']:4.0%}  {r['year'] or '-'}")
say()
say(f"colours with a strong year (excess >= {STRONG_EXCESS:g}, share >= {STRONG_SHARE:.0%}, runner-up <= {RUNNER_UP:g} x best): "
    f"{sum(1 for r in rows if r['year'])} of {len(rows)}")
say(f"groups (hue): best years of the group's colours with excess >= {GROUP_EXCESS:g}; years more than {GROUP_FAR} from the median left out")
ranges = {}
for g in GROUPS:
    rs = [r for r in rows if r["group"] == g]
    best = sorted(r["top"][0][0] for r in rs if r["top"][0][1] >= GROUP_EXCESS)
    med = float(np.median(best)) if best else None
    keep = [y for y in best if abs(y - med) <= GROUP_FAR]
    out = [y for y in best if abs(y - med) > GROUP_FAR]
    ranges[g] = (min(keep), max(keep)) if keep else (None, None)
    say(f"  {g:12} {len(rs):2} colours · best years {best or '-'}" + (f" (left out {out})" if out else "")
        + f" -> about {ranges[g][0]}" + (f"-{ranges[g][1]}" if ranges[g][1] != ranges[g][0] else ""))

# are the hue groups really stretches of years? shuffle the group names over the colours and compare
use = [r for r in rows if r["top"][0][1] >= GROUP_EXCESS]
yrs = np.array([r["top"][0][0] for r in use], float)
lab = np.array([r["group"] for r in use])
spread = lambda L: sum(((yrs[L == g] - yrs[L == g].mean()) ** 2).sum() for g in set(L))
rng = np.random.default_rng(0)
shuffled = np.array([spread(rng.permutation(lab)) for _ in range(20000)])
order = np.array([GROUPS.index(g) for g in lab], float)
rank = lambda v: np.argsort(np.argsort(v)).astype(float)
rho = np.corrcoef(rank(order + rng.random(len(order)) * 1e-3), rank(yrs + rng.random(len(yrs)) * 1e-3))[0, 1]
say()
say(f"check: spread of best years inside the groups {spread(lab):.0f} (sum of squares); with the group names shuffled "
    f"over the colours, median {np.median(shuffled):.0f}, as small as ours {int((shuffled <= spread(lab)).sum())} of 20,000 times")
say(f"       group order (red, orange, blue, pink-purple, green, yellow) against best year: rank correlation {rho:.2f} (1 = perfect order)")
say()
say("Read: if the colours were not years, best years would scatter at random. Instead each hue group sits in its own")
say("stretch of years, from red (oldest) through orange, blue, pink-purple and green to yellow (newest). Colours of the")
say("same group sometimes share a best year, so a single colour's year is a guess (+/- 1-2 years).")
say()
say("for src/landtrendr.ts (group: years; rgb: group, year or null):")
say("  " + ", ".join(f"{g}: {a}-{b}" for g, (a, b) in ranges.items()))
say("  " + ", ".join(f"[{r['c'][0]}, {r['c'][1]}, {r['c'][2]}]: {r['group']} {r['year'] or 'null'}" for r in sorted(rows, key=lambda r: -r["n"])))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("saved", OUT)
