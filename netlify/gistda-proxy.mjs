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
 *   3. อาคารรายหลัง 3 มิติ    /buildings/16/{x}/{y}.json  -> features/thailand-buildings-footprint/items?bbox=<แผ่นนั้น>
 *      ตัวกลางสร้าง GeoJSON ใหม่ที่มีแค่รูปอาคาร ความสูง จำนวนชั้น (ไม่ส่งผลดิบต่อ เพราะผลดิบมี key อยู่ใน "links")
 *
 * ผลที่ไม่ใช่ภาพ (เช่น ข้อความ error) จะไม่ถูกส่งต่อ เพราะ GISTDA เคยใส่ key ไว้ในผลลัพธ์ (ดู PROJECT_REPORT.md หัวข้อ 7)
 * ไม่ต้องติดตั้ง package เพิ่ม ใช้ fetch / Request / Response ของ Node 22
 */

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
/** แผ่นของอาคาร 3 มิติใช้ซูม 16 อย่างเดียว (ประมาณ 600 × 600 ม. ส่วนใหญ่ไม่เกิน 1,000 หลัง = 1 คำขอ) */
export const BUILDING_TILE_Z = 16;
const BUILDINGS_PATH = "/features/thailand-buildings-footprint/items";
const BUILDING_PAGE = 1000;
const BUILDING_MAX_PAGES = 5;

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
  const bm = /^\/buildings\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.json$/.exec(path);
  if (bm) {
    const [z, x, y] = bm.slice(1).map(Number);
    if (z !== BUILDING_TILE_Z || x >= 2 ** z || y >= 2 ** z) return { ok: false, status: 400, reason: "bad tile" };
    const b = tileBounds(z, x, y);
    if (!overlaps(b.west, b.south, b.east, b.north, AREA)) return { ok: false, status: 403, reason: "outside Phuket" };
    const bbox = [b.west, b.south, b.east, b.north].map((v) => v.toFixed(6)).join(",");
    return { ok: true, kind: "buildings", upstreamPath: `${BUILDINGS_PATH}?bbox=${bbox}&limit=${BUILDING_PAGE}` };
  }
  return { ok: false, status: 403, reason: "path not allowed" };
}

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const roundCoords = (c) => (typeof c[0] === "number" ? [r6(c[0]), r6(c[1])] : c.map(roundCoords));

/** keep only what the map draws: footprint, height, storeys (no links, no other fields) */
function slimBuilding(f) {
  const g = f && f.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon") || !Array.isArray(g.coordinates)) return null;
  const p = f.properties || {};
  const h = Number(p.BL_HEIGHT), s = Number(p.BL_NSTOREY);
  return {
    type: "Feature",
    geometry: { type: g.type, coordinates: roundCoords(g.coordinates) },
    properties: { id: String(p.globalId ?? f.id ?? ""), h: Number.isFinite(h) ? Math.round(h * 10) / 10 : null, s: Number.isFinite(s) ? s : null },
  };
}

async function fetchBuildings(base, upstreamPath, key, fetchImpl) {
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
  const extra = Number.isFinite(total) ? Math.min(BUILDING_MAX_PAGES, Math.ceil(total / BUILDING_PAGE)) - 1 : 0;
  // a dense tile needs more than one page: ask for the rest at the same time
  if (extra > 0) pages.push(...(await Promise.all(Array.from({ length: extra }, (_, i) => page((i + 1) * BUILDING_PAGE)))));
  const features = pages.flatMap((d) => (Array.isArray(d.features) ? d.features : [])).map(slimBuilding).filter(Boolean);
  return { type: "FeatureCollection", features, truncated: Number.isFinite(total) && total > BUILDING_MAX_PAGES * BUILDING_PAGE };
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
    let fc;
    try {
      fc = await fetchBuildings(base, c.upstreamPath, key, fetchImpl);
    } catch {
      return text(502, "GISTDA buildings request failed");
    }
    return new Response(JSON.stringify(fc), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
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
