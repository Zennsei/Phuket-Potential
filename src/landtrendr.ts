/**
 * Landtrendr from the GISTDA API Gateway (/maps/coverage/landtrendr-all): land that changed, coloured by the year
 * of change found by LandTrendr (a method that reads the Landsat time series of each 30 m pixel).
 *
 * Team only, like the other GISTDA API Gateway pictures (VITE_GISTDA_IMAGERY=1, see src/gistda.ts): tiles go through
 * our proxy (/gistda/maps/coverage/landtrendr-all/{z}/{x}/{y}), which adds the key.
 *
 * The API gives no legend. Over Phuket the tiles use exactly the 35 colours below (round-3 sample tiles, 24 Oct 2026).
 * Their years are being worked out (data-prep/gistda_api_probe6.py); until then `year` is null and the page says so.
 */
import { AREA, LANDTRENDR_ZOOMS } from "../netlify/gistda-proxy.mjs";

export interface LtColour {
  rgb: [number, number, number];
  /** year of change (Christian era) once known */
  year: number | null;
}

/** the 35 colours seen over Phuket, most common first */
export const LT_COLOURS: LtColour[] = ([
  [255, 118, 115], [255, 220, 168], [255, 194, 114], [110, 188, 242], [73, 126, 242], [150, 78, 237], [150, 86, 30],
  [112, 134, 253], [201, 96, 6], [65, 111, 217], [145, 174, 242], [241, 178, 245], [255, 168, 166], [253, 121, 7],
  [154, 251, 198], [118, 61, 186], [235, 141, 239], [241, 162, 212], [176, 126, 237], [157, 207, 242], [0, 94, 217],
  [146, 237, 119], [253, 192, 3], [111, 209, 149], [202, 173, 237], [197, 235, 185], [85, 45, 135], [49, 177, 136],
  [0, 114, 191], [254, 157, 57], [255, 251, 197], [255, 174, 76], [83, 135, 68], [248, 228, 168], [6, 146, 241],
] as [number, number, number][]).map((rgb) => ({ rgb, year: null }));

export const LT_ATTR = "Landtrendr: GISTDA API Gateway · ใช้ภายในทีม (team evaluation only)";
export const LT_OPACITY = 0.85;

const tileUrl = () => `${new URL("gistda/", document.baseURI).href}maps/coverage/landtrendr-all/{z}/{x}/{y}`;

/** MapLibre raster source (absolute URL: tiles are loaded by a worker) */
export function landtrendrSourceSpec() {
  return {
    type: "raster" as const,
    tiles: [tileUrl()],
    tileSize: 256,
    minzoom: LANDTRENDR_ZOOMS.min,
    // beyond this MapLibre enlarges zoom-14 tiles (the data is 30 m Landsat pixels) instead of asking for new ones
    maxzoom: LANDTRENDR_ZOOMS.max,
    bounds: [AREA.west, AREA.south, AREA.east, AREA.north] as [number, number, number, number],
    attribution: LT_ATTR,
  };
}

/** the colour under a point: reads the same tile the map shows (normally from the browser cache, no new credit) */
export async function landtrendrAt(lon: number, lat: number, mapZoom: number): Promise<{ colour: LtColour | null; rgb: [number, number, number] } | null> {
  const z = Math.max(LANDTRENDR_ZOOMS.min, Math.min(LANDTRENDR_ZOOMS.max, Math.floor(mapZoom)));
  const n = 2 ** z;
  const fx = ((lon + 180) / 360) * n;
  const fy = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const x = Math.floor(fx), y = Math.floor(fy);
  const res = await fetch(tileUrl().replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`tile ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const cv = document.createElement("canvas");
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const px = Math.min(bmp.width - 1, Math.floor((fx - x) * bmp.width));
  const py = Math.min(bmp.height - 1, Math.floor((fy - y) * bmp.height));
  const d = ctx.getImageData(px, py, 1, 1).data;
  if (d[3] === 0) return null;
  const rgb: [number, number, number] = [d[0], d[1], d[2]];
  let best: LtColour | null = null, bd = Infinity;
  for (const c of LT_COLOURS) {
    const dist = Math.abs(c.rgb[0] - rgb[0]) + Math.abs(c.rgb[1] - rgb[1]) + Math.abs(c.rgb[2] - rgb[2]);
    if (dist < bd) { bd = dist; best = c; }
  }
  return { colour: bd <= 12 ? best : null, rgb };
}

export const ltCss = (c: LtColour) => `rgb(${c.rgb.join(",")})`;
