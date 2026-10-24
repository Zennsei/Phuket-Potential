"""Minimal Mapbox Vector Tile (v2) writer used by the data-prep scripts (no package needed).
Same rules as netlify/mvt.mjs (used by the GISTDA proxy). Spec: https://github.com/mapbox/vector-tile-spec/tree/master/2.1

encode_tile(features, z, x, y, layer) -> bytes
  features: [(shapely geometry, {name: str | int | float | None}), ...]
  Polygon / MultiPolygon -> polygon features (exterior rings positive area, holes negative)
  LineString / MultiLineString -> line features
Geometry is not clipped: a feature crossing the tile edge goes a little outside 0..EXTENT, which MapLibre allows.
"""
import struct
import numpy as np

EXTENT = 4096


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


def _points(coords, z, x, y):
    px, py = project(coords[:, 0], coords[:, 1], z, x, y)
    pts = []
    for a, b in zip(px.tolist(), py.tolist()):
        if not pts or pts[-1] != (a, b):
            pts.append((a, b))
    return pts


def _path(pts, cursor, close):
    cx, cy = cursor
    cmd = [9, zz(pts[0][0] - cx), zz(pts[0][1] - cy)]
    cx, cy = pts[0]
    cmd.append(2 | ((len(pts) - 1) << 3))
    for a, b in pts[1:]:
        cmd += [zz(a - cx), zz(b - cy)]
        cx, cy = a, b
    if close:
        cmd.append(15)
    cursor[:] = [cx, cy]
    return cmd


def _ring(coords, z, x, y, exterior, cursor):
    pts = _points(coords, z, x, y)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        return []
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if area == 0:
        return []
    if (area > 0) != exterior:
        pts.reverse()
    return _path(pts, cursor, True)


def _line(coords, z, x, y, cursor):
    pts = _points(coords, z, x, y)
    return _path(pts, cursor, False) if len(pts) >= 2 else []


def encode_tile(features, z, x, y, layer="buildings"):
    keys, kidx, vals, vidx, feats = [], {}, [], {}, []
    for geom, props in features:
        cursor, cmd = [0, 0], []
        t = geom.geom_type
        if t in ("Polygon", "MultiPolygon"):
            gtype = 3
            for p in (geom.geoms if t == "MultiPolygon" else [geom]):
                cmd += _ring(np.asarray(p.exterior.coords), z, x, y, True, cursor)
                for hole in p.interiors:
                    cmd += _ring(np.asarray(hole.coords), z, x, y, False, cursor)
        elif t in ("LineString", "MultiLineString"):
            gtype = 2
            for ln in (geom.geoms if t == "MultiLineString" else [geom]):
                cmd += _line(np.asarray(ln.coords), z, x, y, cursor)
        else:
            continue
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
        feats.append(msg(2, (packed(2, tags) if tags else b"") + key(3, 0) + varint(gtype) + packed(4, cmd)))
    if not feats:
        return b""
    out = key(15, 0) + varint(2) + msg(1, layer.encode()) + b"".join(feats)
    out += b"".join(msg(3, k.encode()) for k in keys)
    for v in vals:
        if isinstance(v, str):
            out += msg(4, msg(1, v.encode()))
        elif isinstance(v, int) and v >= 0:
            out += msg(4, key(5, 0) + varint(v))
        else:
            out += msg(4, key(2, 5) + struct.pack("<f", float(v)))
    out += key(5, 0) + varint(EXTENT)
    return msg(3, out)


def lon2x(lon, z):
    return np.floor((np.asarray(lon) + 180) / 360 * 2 ** z).astype(int)


def lat2y(lat, z):
    r = np.radians(np.asarray(lat))
    return np.floor((1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * 2 ** z).astype(int)
