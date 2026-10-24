"""Independent re-computation of the compare page ("same data, two methods").

Reads public/data/tambons.geojson and scores the 17 tambons with method A (what the site uses) and
method B (the alternative) under the three preset rules, using its own copy of the formula
(Min-Max or rank scaling, weighted average, Logic Matrix cut 50 / 20 %). The web page must show the
same scores, ranks and decision groups; the summary is written to data-prep/checks/compare_methods.txt.

Python standard library only:  python data-prep/check_compare.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = [f["properties"] for f in json.load(open(os.path.join(ROOT, "public/data/tambons.geojson"), encoding="utf-8"))["features"]]


def rule(b, r, s, p, l, land_dir=1, d=0, g=0, t=0, dest="oldtown"):
    mk = lambda w, dirn=1: {"weight": w, "direction": dirn if w else 0}
    return {"buildings": mk(b), "road": mk(r), "services": mk(s), "population": mk(p), "land": mk(l, land_dir),
            "developable": mk(d), "growth": mk(g), "travel": {**mk(t), "dest": dest}}


# same weights as PRESETS in src/factors.ts
RULES = {"equal": rule(20, 20, 20, 20, 20), "emerging": rule(5, 25, 20, 10, 20, -1, 20, 15),
         "people": rule(15, 25, 35, 25, 0, 1, 0, 0, 20, "hospital")}

# method A = {} (site default); method B changes one column, the land basis, or the scaling
PAIRS = {
    "developable": ({}, {"land_basis": "all"}),
    "land-place": ({}, {"land_col": "land_median_sheetcentre"}),
    "land-stat": ({}, {"land_col": "land_mean"}),
    "buildings": ({}, {"bldg_col": "roof_cover_pct"}),
    "scaling": ({}, {"scale": "rank"}),
}


def factor_values(p, w, opt):
    dev = p["developable_pct"] if opt.get("land_basis") == "all" else p["developable_flat_pct"]
    return {"buildings": (p[opt.get("bldg_col", "bldg_per_km2")], True), "road": (p["road_dist_m"], False),
            "services": (p["services_per_km2"], True), "population": (p["pop_per_km2"], True),
            "land": (p.get(opt.get("land_col", "land_median")), True), "developable": (dev, True),
            "growth": (p["house_growth_pct"], True), "travel": (p[f"tt_{w['travel']['dest']}_min"], False)}


def minmax(vals):
    xs = [v for v in vals if v is not None]
    lo, hi = min(xs), max(xs)
    return [50.0 if v is None or hi == lo else (v - lo) / (hi - lo) * 100 for v in vals]


def rank(vals):
    xs = [v for v in vals if v is not None]
    n = len(xs)
    out = []
    for v in vals:
        if v is None or n < 2:
            out.append(50.0)
            continue
        below = sum(1 for x in xs if x < v)
        same = sum(1 for x in xs if x == v)
        out.append((below + (same - 1) / 2) / (n - 1) * 100)
    return out


def score(w, opt):
    fv = [factor_values(p, w, opt) for p in rows]
    scale = rank if opt.get("scale") == "rank" else minmax
    parts = {}
    for k in w:
        n = scale([f[k][0] for f in fv])
        if not fv[0][k][1]:
            n = [100 - x for x in n]
        if w[k]["direction"] == -1:
            n = [100 - x for x in n]
        parts[k] = n
    total = sum(w[k]["weight"] for k in w if w[k]["direction"] != 0)
    res = {}
    for i, p in enumerate(rows):
        s = sum(parts[k][i] * w[k]["weight"] for k in w if w[k]["direction"] != 0) / total
        dev = fv[i]["developable"][0]
        cat = ("promote" if dev >= 20 else "upgrade") if s >= 50 else ("prepare" if dev >= 20 else "maintain")
        res[p["id"]] = {"name": p["tambon_th"], "score": s, "cat": cat}
    # stable sort in file order, like Array.prototype.sort in the browser
    for i, pid in enumerate(sorted(res, key=lambda pid: -res[pid]["score"])):
        res[pid]["rank"] = i + 1
    return res


if __name__ == "__main__":
    lines = ["# compare page check: method A (site) vs method B, 17 tambons, Logic Matrix cut 50 / 20 %", ""]
    for pair, (oa, ob) in PAIRS.items():
        for rname, w in RULES.items():
            a, b = score(w, oa), score(w, ob)
            moved = [i for i in a if a[i]["rank"] != b[i]["rank"]]
            changed = [i for i in a if a[i]["cat"] != b[i]["cat"]]
            top5 = sum(1 for i in a if a[i]["rank"] <= 5 and b[i]["rank"] <= 5)
            max_move = max(abs(a[i]["rank"] - b[i]["rank"]) for i in a)
            lines.append(f"{pair:12s} {rname:9s} rank changed {len(moved):2d}/17 (max {max_move}) · top 5 kept {top5} · group changed {len(changed)}")
            for i in sorted(changed, key=lambda i: a[i]["rank"]):
                lines.append(f"    {a[i]['name']}: {a[i]['cat']} -> {b[i]['cat']} (score {a[i]['score']:.1f} -> {b[i]['score']:.1f})")
        lines.append("")
    text = "\n".join(lines)
    print(text)
    with open(os.path.join(ROOT, "data-prep/checks/compare_methods.txt"), "w", encoding="utf-8") as f:
        f.write(text)
