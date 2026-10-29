"""Independent re-computation of the compare page ("same data, two methods").

Reads public/data/tambons.geojson and scores the 17 tambons with method A (what the site uses) and
method B (the alternative) under the three preset rules, using its own copy of the formula
(Min-Max or rank scaling, weighted average, Logic Matrix cut 50 / 20 %). The web page must show the
same scores, ranks and decision groups; the summary is written to data-prep/checks/compare_methods.txt.
It also works out the data-against-data comparisons (same thing, different definitions, different years) from
building_sources.csv and tambons.geojson, written to data-prep/checks/compare_sources.txt.

Python standard library only:  python data-prep/check_compare.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = [f["properties"] for f in json.load(open(os.path.join(ROOT, "public/data/tambons.geojson"), encoding="utf-8"))["features"]]


def rule(b, r, s, p, d=0, g=0):
    mk = lambda w: {"weight": w, "direction": 1 if w else 0}
    return {"buildings": mk(b), "road": mk(r), "services": mk(s), "population": mk(p), "developable": mk(d), "growth": mk(g)}


# same weights as PRESETS in src/factors.ts (land price and travel time left the score on 27 Oct 2569;
# the road factor is road density, km of main + secondary roads per km², since 29 Oct 2569)
RULES = {"equal": rule(25, 25, 25, 25), "emerging": rule(5, 25, 20, 10, 20, 15), "people": rule(15, 25, 35, 25)}

# method A = {} (site default); method B changes one column, the land basis, or the scaling
PAIRS = {
    "developable": ({}, {"land_basis": "all"}),
    "buildings": ({}, {"bldg_col": "roof_cover_pct"}),
    "scaling": ({}, {"scale": "rank"}),
}


def factor_values(p, w, opt):
    dev = p["developable_pct"] if opt.get("land_basis") == "all" else p["developable_flat_pct"]
    return {"buildings": (p[opt.get("bldg_col", "bldg_per_km2")], True), "road": (p["road_km_per_km2"], True),
            "services": (p["services_per_km2"], True), "population": (p["pop_per_km2"], True),
            "developable": (dev, True), "growth": (p["house_growth_pct"], True)}


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


# ---------- data against data: same thing / different definitions / different years ----------
def load_buildings():
    import csv
    with open(os.path.join(ROOT, "public/data/building_sources.csv"), encoding="utf-8-sig") as f:
        return {r["id"]: {k: float(v) for k, v in r.items() if k not in ("id", "tambon_th")} for r in csv.DictReader(f)}


def source_values(bldg):
    """(topic, option) -> (A per tambon id, B per tambon id, kind, years)"""
    out = {}
    for m, col, scale in (("footprint", "footprint_m2", 1e6), ("count", "count", 1)):
        g = lambda key: {i: bldg[i][f"{key}_{col}"] / scale for i in bldg}
        out[("bldg-gistda-overture", m)] = (g("gistda2565"), g("overture"), "same", None)
        out[("bldg-gistda-years", m)] = (g("gistda2565"), g("gistda2567"), "same", None)
        out[("bldg-2567-overture", m)] = (g("gistda2567"), g("overture"), "same", None)
    by = {p["id"]: p for p in rows}
    out[("kontur-releases", "")] = ({i: p["population_2022"] for i, p in by.items()}, {i: p["population"] for i, p in by.items()}, "same", None)
    out[("people-kontur-registry", "")] = ({i: p["reg_pop_2565"] for i, p in by.items()}, {i: p["population"] for i, p in by.items()}, "definition", None)
    for y0, y1 in ((2559, 2568), (2552, 2559), (2552, 2568), (2563, 2565)):
        out[("reg-pop", f"{y0}-{y1}")] = ({i: p[f"reg_pop_{y0}"] for i, p in by.items()}, {i: p[f"reg_pop_{y1}"] for i, p in by.items()}, "time", y1 - y0)
        out[("reg-house", f"{y0}-{y1}")] = ({i: p[f"reg_house_{y0}"] for i, p in by.items()}, {i: p[f"reg_house_{y1}"] for i, p in by.items()}, "time", y1 - y0)
    return out


def source_metrics(a, b, kind, years):
    """same: % of the midpoint · definition: B / A · time: % of the first year and compound % a year"""
    if kind == "same":
        mid = (a + b) / 2
        return {"diff": b - a, "mid": mid, "pct": (b - a) / mid * 100}
    if kind == "definition":
        return {"ratio": b / a}
    return {"diff": b - a, "pct": (b / a - 1) * 100, "per_year": ((b / a) ** (1 / years) - 1) * 100}


if __name__ == "__main__":
    bldg = load_buildings()
    names = {p["id"]: p["tambon_th"] for p in rows}
    src_lines = ["# compare page check: data against data (same / definition / time), island = sum first, then compare", ""]
    for (topic, opt), (A, B, kind, years) in source_values(bldg).items():
        isl = source_metrics(sum(A.values()), sum(B.values()), kind, years)
        src_lines.append(f"{topic} {opt} [{kind}] island A {sum(A.values()):,.2f} B {sum(B.values()):,.2f} " + " ".join(f"{k} {v:,.2f}" for k, v in isl.items()))
        for i in sorted(A, key=lambda i: names[i]):
            m = source_metrics(A[i], B[i], kind, years)
            src_lines.append(f"    {names[i]}: A {A[i]:,.2f} B {B[i]:,.2f} " + " ".join(f"{k} {v:,.2f}" for k, v in m.items()))
    with open(os.path.join(ROOT, "data-prep/checks/compare_sources.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(src_lines) + "\n")
    print("\n".join(l for l in src_lines if not l.startswith("    ")))
    print()

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
