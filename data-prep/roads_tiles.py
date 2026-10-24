"""Every OpenStreetMap road in Phuket (D6) -> vector tiles for the map's "all roads and alleys" layer, which
shows village roads, sois and driveways when zoomed in (the Sphere street map leaves some of them out, and some
of its close-up tiles come back empty).

Usage: python roads_tiles.py <osm_roads.geojson>      (made by osm_extract.py: 22,756 roads, 20 Oct 2026)
Needs: shapely, numpy
Output: public/data/roads_all/14/{x}/{y}.pbf  (Mapbox Vector Tile v2, layer "roads"; one zoom level, MapLibre
        enlarges it for closer zooms)
Properties: c = class (major / tertiary / minor / service / track), n = name if OSM has one
Not included: footpaths, steps and cycleways (osm_extract.py does not keep them).
"""
import json, os, sys
import numpy as np, shapely
from shapely.geometry import box, shape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mvt import encode_tile, lat2y, lon2x  # noqa: E402

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "roads_all")
Z = 14
CLASS = {
    "motorway": "major", "trunk": "major", "primary": "major", "secondary": "major",
    "motorway_link": "major", "trunk_link": "major", "primary_link": "major", "secondary_link": "major",
    "tertiary": "tertiary", "tertiary_link": "tertiary",
    "residential": "minor", "unclassified": "minor", "living_street": "minor",
    "service": "service", "track": "track",
}


def tile_box(x, y, z):
    n = 2 ** z
    lon = lambda i: i / n * 360 - 180
    lat = lambda j: np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * j / n))))
    return box(lon(x), lat(y + 1), lon(x + 1), lat(y))


feats = json.load(open(SRC, encoding="utf-8"))["features"]
geoms, props = [], []
for f in feats:
    c = CLASS.get(f["properties"].get("hw"))
    if not c:
        continue
    geoms.append(shape(f["geometry"]))
    name = f["properties"].get("name") or f["properties"].get("ref")
    props.append({"c": c, "n": name or None})
geoms = np.array(geoms, dtype=object)
tree = shapely.STRtree(geoms)
b = shapely.bounds(geoms)
x0, x1 = lon2x(b[:, 0].min(), Z), lon2x(b[:, 2].max(), Z)
y0, y1 = lat2y(b[:, 3].max(), Z), lat2y(b[:, 1].min(), Z)
files = size = 0
for tx in range(int(x0), int(x1) + 1):
    for ty in range(int(y0), int(y1) + 1):
        hits = tree.query(tile_box(tx, ty, Z), predicate="intersects")
        if not len(hits):
            continue
        data = encode_tile([(geoms[i], props[i]) for i in sorted(hits)], Z, tx, ty, "roads")
        if not data:
            continue
        d = os.path.join(OUT, str(Z), str(tx))
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, f"{ty}.pbf"), "wb").write(data)
        files += 1; size += len(data)
print(f"{len(geoms)} roads -> {files} tiles at zoom {Z}, {size / 1e6:.1f} MB -> {OUT}")
