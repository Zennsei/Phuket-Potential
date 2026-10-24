/**
 * Landtrendr from the GISTDA API Gateway (/maps/coverage/landtrendr-all): land that changed, coloured by the year
 * of change found by LandTrendr (a method that reads the Landsat time series of each 30 m pixel).
 *
 * Team only, like the other GISTDA API Gateway pictures (VITE_GISTDA_IMAGERY=1, see src/gistda.ts): tiles go through
 * our proxy (/gistda/maps/coverage/landtrendr-all/{z}/{x}/{y}), which adds the key.
 *
 * The API gives no legend (legend/style/metadata addresses: 404). Over Phuket the tiles use exactly the 35 colours
 * below. Their years were worked out by the team (data-prep/landtrendr_legend.py on the probe 6 pictures, 25 Oct
 * 2026; result in data-prep/checks/landtrendr_legend.txt): colours of the same hue cover one stretch of years, from
 * red (oldest) to yellow (newest). `year` is filled only where one year clearly stands out; elsewhere null.
 * These are estimates, not GISTDA's legend: the page says "about" and says the team worked them out.
 */
import { AREA, LANDTRENDR_ZOOMS } from "../netlify/gistda-proxy.mjs";

export type LtGroupId = "red" | "orange" | "blue" | "pinkPurple" | "green" | "yellow";

export interface LtGroup {
  id: LtGroupId;
  th: string;
  en: string;
  /** about which years (Christian era); from = null: this year or earlier */
  from: number | null;
  to: number;
}

/** hue groups, oldest first (years from data-prep/checks/landtrendr_legend.txt) */
export const LT_GROUPS: LtGroup[] = [
  { id: "red", th: "แดง", en: "Red", from: null, to: 1990 },
  { id: "orange", th: "ส้ม-น้ำตาล", en: "Orange-brown", from: 1992, to: 1999 },
  { id: "blue", th: "ฟ้า-น้ำเงิน", en: "Blue", from: 1996, to: 2004 },
  { id: "pinkPurple", th: "ชมพู-ม่วง", en: "Pink-purple", from: 2008, to: 2013 },
  { id: "green", th: "เขียว", en: "Green", from: 2014, to: 2018 },
  { id: "yellow", th: "เหลือง", en: "Yellow", from: 2022, to: 2024 },
];

export interface LtColour {
  rgb: [number, number, number];
  group: LtGroupId;
  /** year of change (Christian era) when one year clearly stands out, else null (use the group's years) */
  year: number | null;
}

/** the 35 colours seen over Phuket, by group, lightest first */
export const LT_COLOURS: LtColour[] = [
  { rgb: [255, 168, 166], group: "red", year: 1990 },
  { rgb: [255, 118, 115], group: "red", year: null },
  { rgb: [255, 220, 168], group: "orange", year: null },
  { rgb: [255, 194, 114], group: "orange", year: null },
  { rgb: [255, 174, 76], group: "orange", year: null },
  { rgb: [254, 157, 57], group: "orange", year: null },
  { rgb: [253, 121, 7], group: "orange", year: null },
  { rgb: [201, 96, 6], group: "orange", year: null },
  { rgb: [150, 86, 30], group: "orange", year: 1997 },
  { rgb: [157, 207, 242], group: "blue", year: 1996 },
  { rgb: [145, 174, 242], group: "blue", year: null },
  { rgb: [112, 134, 253], group: "blue", year: null },
  { rgb: [110, 188, 242], group: "blue", year: null },
  { rgb: [73, 126, 242], group: "blue", year: null },
  { rgb: [65, 111, 217], group: "blue", year: null },
  { rgb: [6, 146, 241], group: "blue", year: null },
  { rgb: [0, 94, 217], group: "blue", year: 1999 },
  { rgb: [0, 114, 191], group: "blue", year: 1999 },
  { rgb: [241, 178, 245], group: "pinkPurple", year: null },
  { rgb: [202, 173, 237], group: "pinkPurple", year: null },
  { rgb: [241, 162, 212], group: "pinkPurple", year: null },
  { rgb: [235, 141, 239], group: "pinkPurple", year: null },
  { rgb: [176, 126, 237], group: "pinkPurple", year: null },
  { rgb: [150, 78, 237], group: "pinkPurple", year: null },
  { rgb: [118, 61, 186], group: "pinkPurple", year: null },
  { rgb: [85, 45, 135], group: "pinkPurple", year: 2009 },
  { rgb: [197, 235, 185], group: "green", year: null },
  { rgb: [154, 251, 198], group: "green", year: 2014 },
  { rgb: [146, 237, 119], group: "green", year: 2018 },
  { rgb: [111, 209, 149], group: "green", year: 2017 },
  { rgb: [49, 177, 136], group: "green", year: null },
  { rgb: [83, 135, 68], group: "green", year: 2017 },
  { rgb: [255, 251, 197], group: "yellow", year: 2022 },
  { rgb: [248, 228, 168], group: "yellow", year: 2023 },
  { rgb: [253, 192, 3], group: "yellow", year: null },
];

export const ltGroup = (id: LtGroupId) => LT_GROUPS.find((g) => g.id === id)!;

/** "about 1992-1999" in the page language (Thai: Buddhist era) */
export function ltYears(g: LtGroup, th: boolean): string {
  const y = (v: number) => (th ? v + 543 : v);
  if (g.from === null) return th ? `ราว ${y(g.to)} หรือก่อนนั้น` : `about ${g.to} or earlier`;
  return th ? `ราว ${y(g.from)}–${y(g.to)}` : `about ${g.from}–${g.to}`;
}

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
