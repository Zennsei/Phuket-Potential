"""District (amphoe) and province outlines for the map's "province / district / sub-district" switch.

Usage: python admin_levels.py
Reads:  public/data/tambons.geojson (17 tambons, each with amphoe_th / amphoe_en)
Writes: public/data/amphoe.geojson   3 districts = the tambons of each district merged into one shape
        public/data/province.geojson 1 shape = all 17 tambons merged
Only the outlines are stored. The numbers shown for a district or the province (buildings per km², road km,
people, average score ...) are added up in the browser from the tambon rows (src/levels.ts), so they always follow
the weights the user picks.
"""
import json, os
import shapely
from shapely.geometry import mapping, shape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
fc = json.load(open(os.path.join(ROOT, "tambons.geojson"), encoding="utf-8"))

groups = {}
for f in fc["features"]:
    p = f["properties"]
    g = groups.setdefault(p["amphoe_th"], {"en": p["amphoe_en"], "geoms": [], "ids": []})
    g["geoms"].append(shape(f["geometry"]))
    g["ids"].append(p["id"])


def merged(geoms):
    # the tambon shapes are simplified separately, so their shared edges do not match exactly; a 0.00002° (≈2 m)
    # grow-then-shrink closes those slivers without moving the outer coast
    g = shapely.union_all([x.buffer(0.00002) for x in geoms]).buffer(-0.00002)
    # gaps left between neighbouring tambons become small holes; no tambon has a hole of its own, so drop them all
    parts = [shapely.Polygon(q.exterior) for q in getattr(g, "geoms", [g])]
    return shapely.set_precision(shapely.MultiPolygon(parts) if len(parts) > 1 else parts[0], 0.00001)


def write(path, feats):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write('{"type":"FeatureCollection","features":[\n')
        fh.write(",\n".join(json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in feats))
        fh.write("\n]}\n")


SLUG = {"Mueang Phuket": "mueang-phuket", "Kathu": "kathu", "Thalang": "thalang"}
amphoe = []
for th, g in groups.items():
    amphoe.append({"type": "Feature", "properties": {"id": SLUG.get(g["en"], g["en"].lower().replace(" ", "-")),
                   "amphoe_th": th, "amphoe_en": g["en"], "tambons": g["ids"]},
                   "geometry": mapping(merged(g["geoms"]))})
write(os.path.join(ROOT, "amphoe.geojson"), amphoe)

prov = merged([shape(f["geometry"]) for f in fc["features"]])
write(os.path.join(ROOT, "province.geojson"), [{"type": "Feature", "properties": {"id": "phuket", "province_th": "ภูเก็ต",
      "province_en": "Phuket", "tambons": [f["properties"]["id"] for f in fc["features"]]}, "geometry": mapping(prov)}])

for f in amphoe:
    print(f["properties"]["amphoe_th"], len(f["properties"]["tambons"]), "tambons", shape(f["geometry"]).geom_type)
print("province", prov.geom_type, len(getattr(prov, "geoms", [prov])), "parts")
