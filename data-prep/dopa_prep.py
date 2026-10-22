"""Registered population and houses per Phuket tambon (D15 in DATA.md).

Input : stat_tYY.txt from https://stat.bora.dopa.go.th/new_stat/webPage/statByYear.php (tambon level),
        pipe-separated, UTF-8:
        YYMM|CC|province|RCODE|registry office|CCAATT|tambon|CCAATTMM|village|MALE|FEMALE|TOTAL|HOUSE|
Output: public/data/dopa_tambon.csv

A tambon can be split across several registry offices (district office + municipality),
so rows are summed by tambon code. Office summary rows (CCAATT = 0) are skipped.
The script checks that the 17 tambons add up to the province row of each file.

Usage: python dopa_prep.py <folder with stat_t*.txt> [output csv]
"""
import csv, glob, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "public", "data", "dopa_tambon.csv")


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
