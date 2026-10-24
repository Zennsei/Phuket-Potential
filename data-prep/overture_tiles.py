"""Overture buildings (D9) -> vector tiles for the map's "3D buildings" layer, so the GISTDA buildings can be
compared with an independent open dataset (and the public site has 3D buildings without the GISTDA key).

Usage: python overture_tiles.py <phuket_buildings_overture.parquet>     (made by overture_buildings.py)
Needs: pyarrow, shapely, numpy
Output: public/data/bldg_overture/{z}/{x}/{y}.pbf  for z = 15 and 16  (Mapbox Vector Tile v2, layer "buildings")

Same tiles and rules as the GISTDA proxy (netlify/gistda-proxy.mjs + netlify/mvt.mjs):
  z16 = every building, z15 = only buildings with a footprint >= 100 m2 or >= 12 m tall (fewer boxes when zoomed out)
  properties: h = height (m; Overture "height", else num_floors x 3), s = storeys, o = 1 if the building's centre is in
  this tile (3D boxes are drawn from these only, so an edge building is drawn once), d = footprint source
Overture has a height for only 0.2 % and storeys for 1.8 % of Phuket buildings (24 Oct 2026): the map draws the
others as 1-storey grey boxes.
"""
import math, os, struct, sys
import numpy as np, pyarrow.parquet as pq, shapely

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "bldg_overture")
ZOOMS = (15, 16)
LOD = {"min_area_m2": 100, "min_height_m": 12}
EXTENT = 4096
SHORT = {"OpenStreetMap": "OSM", "Google Open Buildings": "Google", "Microsoft ML Buildings": "Microsoft"}


# ---------- minimal MVT writer (same rules as netlify/mvt.mjs) ----------
def varint(v):
    out = bytearray()
    while v > 0x7F:
        out.append((v & 0x7F) | 0x80)
        v >>= 7
    out.append(v)
    return bytes(out)


def key(field, wire):
    return varint(field * 8 + wire)


def msg(field, payload):
    return key(field, 2) + varint(len(payload)) + payload


def packed(field, values):
    return msg(field, b"".join(varint(v) for v in values))


def zz(n):
    return (n << 1) ^ (n >> 31)


def project(lon, lat, z, x, y):
    n = 2 ** z
    s = np.sin(np.radians(lat))
    px = ((lon + 180) / 360 * n - x) * EXTENT
    py = ((0.5 - np.log((1 + s) / (1 - s)) / (4 * np.pi)) * n - y) * EXTENT
    return np.rint(px).astype(np.int64), np.rint(py).astype(np.int64)


def ring_cmds(coords, z, x, y, exterior, cursor):
    px, py = project(coords[:, 0], coords[:, 1], z, x, y)
    pts = []
    for a, b in zip(px.tolist(), py.tolist()):
        if not pts or pts[-1] != (a, b):
            pts.append((a, b))
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        return []
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if area == 0:
        return []
    if (area > 0) != exterior:
        pts.reverse()
    cx, cy = cursor
    cmd = [9, zz(pts[0][0] - cx), zz(pts[0][1] - cy)]
    cx, cy = pts[0]
    cmd.append(2 | ((len(pts) - 1) << 3))
    for a, b in pts[1:]:
        cmd += [zz(a - cx), zz(b - cy)]
        cx, cy = a, b
    cmd.append(15)
    cursor[:] = [cx, cy]
    return cmd


def encode_tile(features, z, x, y):
    keys, kidx, vals, vidx, feats = [], {}, [], {}, []
    for geom, props in features:
        cursor, cmd = [0, 0], []
        polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
        for p in polys:
            cmd += ring_cmds(np.asarray(p.exterior.coords), z, x, y, True, cursor)
            for hole in p.interiors:
                cmd += ring_cmds(np.asarray(hole.coords), z, x, y, False, cursor)
        if not cmd:
            continue
        tags = []
        for k, v in props.items():
            if v is None:
                continue
            if k not in kidx:
                kidx[k] = len(keys); keys.append(k)
            vk = (type(v).__name__, v)
            if vk not in vidx:
                vidx[vk] = len(vals); vals.append(v)
            tags += [kidx[k], vidx[vk]]
        feats.append(msg(2, (packed(2, tags) if tags else b"") + key(3, 0) + varint(3) + packed(4, cmd)))
    if not feats:
        return b""
    layer = key(15, 0) + varint(2) + msg(1, b"buildings") + b"".join(feats)
    layer += b"".join(msg(3, k.encode()) for k in keys)
    for v in vals:
        if isinstance(v, str):
            layer += msg(4, msg(1, v.encode()))
        elif isinstance(v, int) and v >= 0:
            layer += msg(4, key(5, 0) + varint(v))
        else:
            layer += msg(4, key(2, 5) + struct.pack("<f", float(v)))
    layer += key(5, 0) + varint(EXTENT)
    return msg(3, layer)


# ---------- buildings ----------
def lon2x(lon, z):
    return np.floor((np.asarray(lon) + 180) / 360 * 2 ** z).astype(int)


def lat2y(lat, z):
    r = np.radians(np.asarray(lat))
    return np.floor((1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * 2 ** z).astype(int)


t = pq.read_table(SRC, columns=["geometry", "height", "num_floors", "sources"])
geoms = shapely.from_wkb(t.column("geometry").to_numpy(zero_copy_only=False))
height = t.column("height").to_pylist()
floors = t.column("num_floors").to_pylist()
srcs = [SHORT.get(s[0]["dataset"], s[0]["dataset"]) if s else None for s in t.column("sources").to_pylist()]
keep = np.array([g is not None and g.geom_type in ("Polygon", "MultiPolygon") and not g.is_empty for g in geoms])
print(f"{len(geoms)} buildings, {keep.sum()} polygons")

cent = shapely.centroid(geoms)
clon, clat = shapely.get_x(cent), shapely.get_y(cent)
kx = 111320 * np.cos(np.radians(clat))
area = shapely.area(geoms) * kx * 110540          # degrees² -> m² near each building
b = shapely.bounds(geoms)                           # minx, miny, maxx, maxy

props = []
for i in range(len(geoms)):
    hm = height[i] if height[i] is not None else (floors[i] * 3.0 if floors[i] is not None else None)
    props.append({"h": None if hm is None else round(float(hm), 1), "s": None if floors[i] is None else int(floors[i]), "d": srcs[i]})

total_bytes, files = 0, 0
for z in ZOOMS:
    tiles = {}
    lod = (area >= LOD["min_area_m2"]) | np.array([p["h"] is not None and p["h"] >= LOD["min_height_m"] for p in props])
    sel = keep & (lod if z < 16 else True)
    ox, oy = lon2x(clon, z), lat2y(clat, z)
    x0, x1 = lon2x(b[:, 0], z), lon2x(b[:, 2], z)
    y0, y1 = lat2y(b[:, 3], z), lat2y(b[:, 1], z)
    for i in np.nonzero(sel)[0]:
        for tx in range(x0[i], x1[i] + 1):
            for ty in range(y0[i], y1[i] + 1):
                tiles.setdefault((tx, ty), []).append((geoms[i], {**props[i], "o": int(tx == ox[i] and ty == oy[i])}))
    for (tx, ty), feats in tiles.items():
        data = encode_tile(feats, z, tx, ty)
        if not data:
            continue
        d = os.path.join(OUT, str(z), str(tx))
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, f"{ty}.pbf"), "wb").write(data)
        total_bytes += len(data); files += 1
    print(f"z{z}: {int(sel.sum())} buildings in {len(tiles)} tiles")
print(f"wrote {files} tiles, {total_bytes / 1e6:.1f} MB -> {OUT}")
