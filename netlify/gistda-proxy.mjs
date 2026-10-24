/**
 * ตัวกลางเติม key ของ GISTDA API Gateway ให้ภาพที่แสดงบนแผนที่
 * (key อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น เบราว์เซอร์ไม่เห็น)
 *
 * ใช้ 2 ที่ด้วยโค้ดเดียวกัน:
 *   - `npm run dev` / `npm run preview`  ->  middleware ใน vite.config.ts (อ่าน key จาก .env)
 *   - Netlify                              ->  netlify/functions/gistda.mjs (อ่าน key จาก Environment variables ของ Netlify)
 *
 * ยอมให้ผ่านเฉพาะ 3 อย่าง และต้องอยู่ในกรอบภูเก็ตเท่านั้น เพื่อไม่ให้คนอื่นใช้เครดิตของ key ทีมไปขอข้อมูลที่อื่น:
 *   1. ภาพถ่ายดาวเทียมรายปี  /gfms/service/?SERVICE=WMS&REQUEST=GetMap&LAYERS=<ชั้นในรายการ>&CRS=EPSG:3857&BBOX=...
 *   2. GI Basemap            /tiles/basemap_latest/{z}/{x}/{y}.png
 *   3. อาคารรายหลัง 3 มิติ    /buildings/{15|16}/{x}/{y}.pbf  -> features/thailand-buildings-footprint/items?bbox=<แผ่นนั้น>
 *      ตัวกลางสร้างแผ่นเวกเตอร์ (MVT) ใหม่ที่มีแค่รูปอาคาร ความสูง จำนวนชั้น (ไม่ส่งผลดิบต่อ เพราะผลดิบมี key อยู่ใน "links")
 *      ซูม 16 = ทุกหลัง · ซูม 15 = เฉพาะหลังใหญ่หรือสูง (ลดรายละเอียดตอนซูมออก)
 *
 * ผลที่ไม่ใช่ภาพ (เช่น ข้อความ error) จะไม่ถูกส่งต่อ เพราะ GISTDA เคยใส่ key ไว้ในผลลัพธ์ (ดู PROJECT_REPORT.md หัวข้อ 7)
 * ไม่ต้องติดตั้ง package เพิ่ม ใช้ fetch / Request / Response ของ Node 22
 */

import { encodePolygonTile } from "./mvt.mjs";

export const GISTDA_BASE = "https://api-gateway.gistda.or.th/api/2.0/resources";

/** กรอบที่ยอมให้ขอภาพ (ลองจิจูด/ละติจูด) ใหญ่กว่าเกาะภูเก็ตเล็กน้อย */
export const AREA = { west: 98.2, south: 7.7, east: 98.55, north: 8.25 };

/** ชั้นภาพรายปีที่มีใน /gfms/service/ (GetCapabilities จากการทดสอบรอบ 3 วันที่ 24 ต.ค. 2569 ได้ 45 ชั้น) */
export const IMAGERY_LAYERS = [
  1972, 1973, 1975, 1976, 1979,
  ...Array.from({ length: 2011 - 1987 + 1 }, (_, i) => 1987 + i),
  ...Array.from({ length: 2025 - 2013 + 1 }, (_, i) => 2013 + i),
].map((y) => `thailand_sat_${y}`).concat(["thailand_2563_2564_2m", "thailand_2567_2m"]);

const LAYER_SET = new Set(IMAGERY_LAYERS);
const R = 6378137;
const toMercX = (lon) => (lon * Math.PI * R) / 180;
const toMercY = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const AREA_M = { west: toMercX(AREA.west), south: toMercY(AREA.south), east: toMercX(AREA.east), north: toMercY(AREA.north) };

const overlaps = (w, s, e, n, a) => w < a.east && e > a.west && s < a.north && n > a.south;

function tileBounds(z, x, y) {
  const n = 2 ** z;
  const lon = (i) => (i / n) * 360 - 180;
  const lat = (j) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * j) / n))) * 180) / Math.PI;
  return { west: lon(x), east: lon(x + 1), north: lat(y), south: lat(y + 1) };
}

/**
 * ตรวจคำขอจากเบราว์เซอร์ แล้วสร้าง URL ปลายทางที่ GISTDA ขึ้นมาใหม่ (ไม่ส่งพารามิเตอร์อื่นของผู้ใช้ต่อไป)
 * @param {string} path  ส่วนหลัง /gistda เช่น "/gfms/service/" หรือ "/tiles/basemap_latest/13/6574/3955.png"
 * @param {URLSearchParams} q
 * @returns {{ ok: true, upstreamPath: string, kind: "imagery" | "basemap" } | { ok: false, status: number, reason: string }}
 */
/**
 * แผ่นอาคาร 3 มิติ: ซูม 16 (ประมาณ 600 × 600 ม.) มีทุกหลัง ส่วนใหญ่ไม่เกิน 1,000 หลัง = 1 คำขอ
 * ซูม 15 (ประมาณ 1.2 × 1.2 กม.) ใช้ตอนซูมออกเล็กน้อย เก็บเฉพาะหลังที่ใหญ่หรือสูง (BUILDING_LOD) ต้องขอ GISTDA หลายหน้ากว่า
 */
export const BUILDING_TILE_ZOOMS = [15, 16];
/** zoom 15 keeps buildings with a footprint of at least 100 m² or at least 12 m tall: about 47 % of buildings, 84 % of roof area */
export const BUILDING_LOD = { minAreaM2: 100, minHeightM: 12 };
const BUILDINGS_PATH = "/features/thailand-buildings-footprint/items";
const BUILDING_PAGE = 1000;
const BUILDING_MAX_PAGES = { 15: 10, 16: 5 };

export function checkGistdaRequest(path, q) {
  if (path === "/gfms/service" || path === "/gfms/service/") {
    const get = (k) => {
      for (const [key, v] of q) if (key.toUpperCase() === k) return v;
      return null;
    };
    if ((get("SERVICE") ?? "").toUpperCase() !== "WMS" || (get("REQUEST") ?? "") !== "GetMap") return { ok: false, status: 403, reason: "only WMS GetMap" };
    const layer = get("LAYERS") ?? "";
    if (!LAYER_SET.has(layer)) return { ok: false, status: 403, reason: "layer not allowed" };
    if ((get("CRS") ?? get("SRS") ?? "") !== "EPSG:3857") return { ok: false, status: 403, reason: "only EPSG:3857" };
    const bbox = (get("BBOX") ?? "").split(",").map(Number);
    if (bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) return { ok: false, status: 400, reason: "bad BBOX" };
    if (!overlaps(bbox[0], bbox[1], bbox[2], bbox[3], AREA_M)) return { ok: false, status: 403, reason: "outside Phuket" };
    const w = Number(get("WIDTH")), h = Number(get("HEIGHT"));
    if (!(Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 512 && h <= 512)) return { ok: false, status: 400, reason: "bad WIDTH/HEIGHT" };
    const format = get("FORMAT") === "image/png" ? "image/png" : "image/jpeg";
    const out = new URLSearchParams({
      SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetMap", LAYERS: layer, STYLES: "",
      CRS: "EPSG:3857", BBOX: bbox.join(","), WIDTH: String(w), HEIGHT: String(h), FORMAT: format,
    });
    return { ok: true, kind: "imagery", upstreamPath: `/gfms/service/?${out.toString().replace(/%3A/g, ":").replace(/%2C/g, ",")}` };
  }
  const m = /^\/tiles\/basemap_latest\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/.exec(path);
  if (m) {
    const [z, x, y] = m.slice(1).map(Number);
    if (z < 8 || z > 19 || x >= 2 ** z || y >= 2 ** z) return { ok: false, status: 400, reason: "bad tile" };
    const b = tileBounds(z, x, y);
    if (!overlaps(b.west, b.south, b.east, b.north, AREA)) return { ok: false, status: 403, reason: "outside Phuket" };
    return { ok: true, kind: "basemap", upstreamPath: `/tiles/basemap_latest/${z}/${x}/${y}.png` };
  }
  const bm = /^\/buildings\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.pbf$/.exec(path);
  if (bm) {
    const [z, x, y] = bm.slice(1).map(Number);
    if (!BUILDING_TILE_ZOOMS.includes(z) || x >= 2 ** z || y >= 2 ** z) return { ok: false, status: 400, reason: "bad tile" };
    const b = tileBounds(z, x, y);
    if (!overlaps(b.west, b.south, b.east, b.north, AREA)) return { ok: false, status: 403, reason: "outside Phuket" };
    const bbox = [b.west, b.south, b.east, b.north].map((v) => v.toFixed(6)).join(",");
    return { ok: true, kind: "buildings", tile: { z, x, y, ...b }, upstreamPath: `${BUILDINGS_PATH}?bbox=${bbox}&limit=${BUILDING_PAGE}` };
  }
  return { ok: false, status: 403, reason: "path not allowed" };
}

/** footprint area (m²) and a centre point of a lon/lat polygon list, on a local flat projection (fine for buildings) */
function areaAndCentre(polygons) {
  let area = 0, cx = 0, cy = 0;
  const [lon0, lat0] = polygons[0][0][0];
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  for (const poly of polygons) {
    const r = poly[0];
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const x1 = (r[i][0] - lon0) * kx, y1 = (r[i][1] - lat0) * ky, x2 = (r[i + 1][0] - lon0) * kx, y2 = (r[i + 1][1] - lat0) * ky;
      const c = x1 * y2 - x2 * y1;
      a += c; x += (x1 + x2) * c; y += (y1 + y2) * c;
    }
    if (a !== 0) { area += Math.abs(a) / 2; cx += (x / (3 * a)) * (Math.abs(a) / 2); cy += (y / (3 * a)) * (Math.abs(a) / 2); }
  }
  if (!area) return { area: 0, lon: lon0, lat: lat0 };
  return { area, lon: lon0 + cx / area / kx, lat: lat0 + cy / area / ky };
}

async function fetchBuildings(base, upstreamPath, key, fetchImpl, maxPages) {
  const page = async (offset) => {
    const r = await fetchImpl(`${base}${upstreamPath}&offset=${offset}`, {
      headers: { "API-Key": key, Accept: "application/geo+json" }, signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`GISTDA answered ${r.status}`);
    return r.json();
  };
  const first = await page(0);
  const pages = [first];
  const total = Number(first.numberMatched);
  const extra = Number.isFinite(total) ? Math.min(maxPages, Math.ceil(total / BUILDING_PAGE)) - 1 : 0;
  // a dense tile needs more than one page: ask for the rest at the same time
  if (extra > 0) pages.push(...(await Promise.all(Array.from({ length: extra }, (_, i) => page((i + 1) * BUILDING_PAGE)))));
  return pages.flatMap((d) => (Array.isArray(d.features) ? d.features : []));
}

/**
 * GISTDA features -> vector tile. Only footprint, height (h), storeys (s) and "o" (1 = this tile owns the
 * building: its centre is inside the tile) are kept. 3D boxes are drawn from owned buildings only, so a building
 * on a tile edge is drawn once; outlines use every building so they are not cut at tile edges.
 */
export function buildingsTile(apiFeatures, t) {
  const out = [];
  const seen = new Set();
  for (const f of apiFeatures) {
    const g = f && f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon") || !Array.isArray(g.coordinates) || !g.coordinates.length) continue;
    const p = f.properties || {};
    const id = String(p.globalId ?? f.id ?? "");
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (!polygons[0] || !polygons[0][0] || polygons[0][0].length < 4) continue;
    const h = Number(p.BL_HEIGHT), s = Number(p.BL_NSTOREY);
    const c = areaAndCentre(polygons);
    if (t.z < 16 && !(c.area >= BUILDING_LOD.minAreaM2 || h >= BUILDING_LOD.minHeightM)) continue;
    const own = c.lon >= t.west && c.lon < t.east && c.lat > t.south && c.lat <= t.north ? 1 : 0;
    out.push({ polygons, props: { h: Number.isFinite(h) ? Math.round(h * 10) / 10 : null, s: Number.isInteger(s) && s >= 0 ? s : null, o: own } });
  }
  return encodePolygonTile(out, t.z, t.x, t.y, "buildings");
}

const text = (status, msg) =>
  new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

/**
 * รับคำขอ ตรวจ แล้วขอภาพจาก GISTDA โดยเติม header API-Key
 * @param {{ path: string, search: string, key?: string, base?: string, fetchImpl?: typeof fetch }} o
 * @returns {Promise<Response>}
 */
export async function proxyGistda({ path, search, key, base = GISTDA_BASE, fetchImpl = fetch }) {
  if (!key) return text(503, "GISTDA_API_KEY is not set on the server");
  const c = checkGistdaRequest(path, new URLSearchParams(search));
  if (!c.ok) return text(c.status, c.reason);
  if (c.kind === "buildings") {
    let body;
    try {
      body = buildingsTile(await fetchBuildings(base, c.upstreamPath, key, fetchImpl, BUILDING_MAX_PAGES[c.tile.z]), c.tile);
    } catch {
      return text(502, "GISTDA buildings request failed");
    }
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/x-protobuf",
        "cache-control": "public, max-age=604800",
        "netlify-cdn-cache-control": "public, durable, s-maxage=2592000",
        "x-gistda-kind": "buildings",
      },
    });
  }
  let res;
  try {
    res = await fetchImpl(base + c.upstreamPath, { headers: { "API-Key": key }, signal: AbortSignal.timeout(25000) });
  } catch {
    return text(504, "GISTDA did not answer");
  }
  const type = res.headers.get("content-type") ?? "";
  // only pictures go back to the browser: an error body could contain the key
  if (res.status === 204) return new Response(null, { status: 204, headers: { "cache-control": "public, max-age=86400" } });
  if (!res.ok || !type.startsWith("image/")) return text(502, `GISTDA answered ${res.status}`);
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": type,
      // browser keeps a tile for 7 days; Netlify's CDN keeps it for 30 days, so a repeated view does not use credits again
      "cache-control": "public, max-age=604800",
      "netlify-cdn-cache-control": "public, durable, s-maxage=2592000",
      "x-gistda-kind": c.kind,
    },
  });
}
