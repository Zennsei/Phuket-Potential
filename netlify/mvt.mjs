/**
 * A small Mapbox Vector Tile (MVT v2) writer for polygons, so the GISTDA proxy can answer with vector tiles
 * that MapLibre reads natively (no package needed). Spec: https://github.com/mapbox/vector-tile-spec/tree/master/2.1
 * data-prep/overture_tiles.py writes the same format for the Overture buildings.
 *
 * features: [{ polygons: [[ring, ...holes], ...] with rings as [[lon, lat], ...], props: { name: number | string } }]
 */
export const EXTENT = 4096;

class Writer {
  constructor() { this.buf = new Uint8Array(4096); this.len = 0; }
  ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const b = new Uint8Array(size);
    b.set(this.buf.subarray(0, this.len));
    this.buf = b;
  }
  byte(b) { this.ensure(1); this.buf[this.len++] = b; }
  varint(v) {
    this.ensure(10);
    while (v > 0x7f) { this.buf[this.len++] = (v & 0x7f) | 0x80; v = Math.floor(v / 128); }
    this.buf[this.len++] = v;
  }
  bytes(u8) { this.ensure(u8.length); this.buf.set(u8, this.len); this.len += u8.length; }
  tag(field, wire) { this.varint(field * 8 + wire); }
  message(field, w) { this.tag(field, 2); this.varint(w.len); this.bytes(w.out()); }
  string(field, s) { const b = new TextEncoder().encode(s); this.tag(field, 2); this.varint(b.length); this.bytes(b); }
  float(field, v) { this.tag(field, 5); const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, v, true); this.bytes(new Uint8Array(d.buffer)); }
  packed(field, arr) { const w = new Writer(); for (const v of arr) w.varint(v); this.message(field, w); }
  out() { return this.buf.subarray(0, this.len); }
}

const zigzag = (n) => (n << 1) ^ (n >> 31);

/** lon/lat -> integer position inside tile z/x/y (0..EXTENT; buildings crossing the edge go a little outside) */
export function tileProjector(z, x, y) {
  const n = 2 ** z;
  return (lon, lat) => {
    const s = Math.sin((lat * Math.PI) / 180);
    const px = (((lon + 180) / 360) * n - x) * EXTENT;
    const py = ((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n - y) * EXTENT;
    return [Math.round(px), Math.round(py)];
  };
}

/** a ring in tile units without repeated points or the closing point; null when too small to draw */
function cleanRing(ring, project) {
  const out = [];
  for (const [lon, lat] of ring) {
    const p = project(lon, lat);
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out.length >= 3 ? out : null;
}

const signedArea = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
};

/** MVT polygon commands; exterior rings with positive area (clockwise on screen), holes negative */
function polygonCommands(polygons, project) {
  const cmd = [];
  let cx = 0, cy = 0;
  for (const poly of polygons) {
    poly.forEach((raw, i) => {
      const r = cleanRing(raw, project);
      if (!r) return;
      const a = signedArea(r);
      if (a === 0) return;
      if ((i === 0) !== a > 0) r.reverse();
      cmd.push(9, zigzag(r[0][0] - cx), zigzag(r[0][1] - cy));
      cx = r[0][0]; cy = r[0][1];
      cmd.push(2 | ((r.length - 1) << 3));
      for (let k = 1; k < r.length; k++) { cmd.push(zigzag(r[k][0] - cx), zigzag(r[k][1] - cy)); cx = r[k][0]; cy = r[k][1]; }
      cmd.push(15);
    });
  }
  return cmd;
}

/** encode one layer of polygon features as a vector tile (Uint8Array; empty when nothing to draw) */
export function encodePolygonTile(features, z, x, y, layerName = "buildings") {
  const project = tileProjector(z, x, y);
  const keys = [], keyIdx = new Map(), values = [], valIdx = new Map();
  const layer = new Writer();
  let count = 0;
  for (const f of features) {
    const geom = polygonCommands(f.polygons, project);
    if (!geom.length) continue;
    const tags = [];
    for (const [k, v] of Object.entries(f.props)) {
      if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) continue;
      if (!keyIdx.has(k)) { keyIdx.set(k, keys.length); keys.push(k); }
      const vk = `${typeof v}:${v}`;
      if (!valIdx.has(vk)) { valIdx.set(vk, values.length); values.push(v); }
      tags.push(keyIdx.get(k), valIdx.get(vk));
    }
    const fw = new Writer();
    if (tags.length) fw.packed(2, tags);
    fw.tag(3, 0); fw.varint(3); // POLYGON
    fw.packed(4, geom);
    layer.message(2, fw);
    count++;
  }
  if (!count) return new Uint8Array(0);
  const head = new Writer();
  head.tag(15, 0); head.varint(2);
  head.string(1, layerName);
  head.bytes(layer.out());
  for (const k of keys) head.string(3, k);
  for (const v of values) {
    const vw = new Writer();
    if (typeof v === "string") vw.string(1, v);
    else if (Number.isInteger(v) && v >= 0) { vw.tag(5, 0); vw.varint(v); }
    else vw.float(2, v);
    head.message(4, vw);
  }
  head.tag(5, 0); head.varint(EXTENT);
  const tile = new Writer();
  tile.message(3, head);
  return tile.out().slice();
}
