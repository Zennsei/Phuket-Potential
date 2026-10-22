"""Registered population and houses per Phuket tambon (D15 in DATA.md).

Input : stat_tYY.txt from https://stat.bora.dopa.go.th/new_stat/webPage/statByYear.php (tambon level),
        pipe-separated, UTF-8:
        YYMM|CC|province|RCODE|registry office|CCAATT|tambon|CCAATTMM|village|MALE|FEMALE|TOTAL|HOUSE|
Output: public/data/dopa_tambon.csv
        and new columns in public/data/tambons.geojson + phuket_tambon_factors.csv (matched by tambon name):
          reg_pop_2565, reg_pop_2568, reg_house_2568, reg_pop_per_km2 (2568),
          reg_pop_growth_pct, house_growth_pct (2559 -> 2568),
          unreg_ratio = Kontur 2566 estimate / registered 2565 (how many people live there per registered person)
          reg_pop_<year>, reg_house_<year> for every year found

A tambon can be split across several registry offices (district office + municipality),
so rows are summed by tambon code. Office summary rows (CCAATT = 0) are skipped.
The script checks that the 17 tambons add up to the province row of each file.

Usage: python dopa_prep.py <folder with stat_t*.txt> [output csv]
"""
import csv, glob, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(DATA, "dopa_tambon.csv")
GROWTH_FROM, GROWTH_TO = 2559, 2568


def num(s):
    return int(s.replace(",", "").strip() or 0)


years, table, names = [], {}, {}
for path in sorted(glob.glob(os.path.join(SRC, "*stat_t*.txt"))):
    yy = int(re.search(r"stat_t(\d+)", path).group(1))
    year = 2500 + yy
    pop, house, province = {}, {}, None
    with open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            f = line.rstrip("\r\n").split("|")
            if len(f) < 13 or f[1] != "83":
                continue
            if f[3] == "0":
                province = (num(f[11]), num(f[12]))
                continue
            if f[5] == "0":
                continue
            code = f[5]
            names[code] = f[6].strip().removeprefix("ตำบล")
            pop[code] = pop.get(code, 0) + num(f[11])
            house[code] = house.get(code, 0) + num(f[12])
    assert len(pop) == 17, (year, len(pop))
    assert (sum(pop.values()), sum(house.values())) == province, (year, province)
    years.append(year)
    table[year] = (pop, house)
    print(year, "population", province[0], "houses", province[1])

with open(OUT, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh)
    w.writerow(["tambon_code", "tambon_th"] + [f"pop_{y}" for y in years] + [f"house_{y}" for y in years])
    for code in sorted(names):
        w.writerow([code, names[code]]
                   + [table[y][0][code] for y in years]
                   + [table[y][1][code] for y in years])
print("wrote", OUT)


# ---- merge into the per-tambon files used by the site ----
import json

by_name = {names[c]: c for c in names}


def extra(p):
    c = by_name[p["tambon_th"]]
    pop, house = (lambda y: table[y][0][c]), (lambda y: table[y][1][c])
    return {
        "reg_pop_2565": pop(2565),
        "reg_pop_2568": pop(2568),
        "reg_house_2568": house(2568),
        "reg_pop_per_km2": round(pop(2568) / p["area_km2"], 1),
        "reg_pop_growth_pct": round((pop(GROWTH_TO) / pop(GROWTH_FROM) - 1) * 100, 1),
        "house_growth_pct": round((house(GROWTH_TO) / house(GROWTH_FROM) - 1) * 100, 1),
        "unreg_ratio": round(p["population"] / pop(2565), 2),
        # every year, for the year picker on the map and the chart in the sub-district panel
        **{f"reg_pop_{y}": pop(y) for y in years},
        **{f"reg_house_{y}": house(y) for y in years},
    }


gj_path = os.path.join(DATA, "tambons.geojson")
gj = json.load(open(gj_path, encoding="utf-8"))
for f in gj["features"]:
    f["properties"].update(extra(f["properties"]))
with open(gj_path, "w", encoding="utf-8") as fh:  # one feature per line keeps git diffs readable
    head = {k: v for k, v in gj.items() if k != "features"}
    fh.write(json.dumps(head, ensure_ascii=False)[:-1] + ',\n"features": [\n')
    fh.write(",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in gj["features"]))
    fh.write("\n]\n}\n")

csv_path = os.path.join(DATA, "phuket_tambon_factors.csv")
rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
area = {f["properties"]["tambon_th"]: f["properties"] for f in gj["features"]}
new_cols = list(extra(gj["features"][0]["properties"]).keys())
cols = [c for c in rows[0].keys() if c not in new_cols] + new_cols
with open(csv_path, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, fieldnames=cols)
    w.writeheader()
    for r in rows:
        r.update({k: area[r["tambon_th"]][k] for k in new_cols})
        w.writerow({c: r.get(c, "") for c in cols})
print("merged", new_cols, "into tambons.geojson and phuket_tambon_factors.csv")
