/**
 * Base maps from the GISTDA API Gateway: yearly satellite imagery 1972–2025 (WMS /gfms/service/) and GI Basemap.
 *
 * The browser never sees the GISTDA key: every tile goes to /gistda/… on our own site, and the proxy
 * (netlify/gistda-proxy.mjs: Vite middleware locally, Netlify Function online) adds the key.
 *
 * GISTDA marks these pictures "Copyrighted by GISTDA, Fees: Yes". Until GISTDA allows public use they are for the
 * team only, so the menu items appear only when VITE_GISTDA_IMAGERY=1 is set (in .env on the team's computers;
 * do not set it on Netlify before permission). Each tile uses one credit of the team key the first time.
 */
import { AREA, IMAGERY_LAYERS } from "../netlify/gistda-proxy.mjs";
import { BASEMAPS, type Basemap } from "./sphere";

export const GISTDA_IMAGERY: boolean = import.meta.env.VITE_GISTDA_IMAGERY === "1";

export interface ImageryYear {
  layer: string;
  /** Christian-era year (the 2 m layers: the last year they cover) */
  ce: number;
  th: string;
  en: string;
  /** high-resolution 2 m mosaic */
  fine: boolean;
}

export const IMAGERY_YEARS: ImageryYear[] = IMAGERY_LAYERS.map((layer) => {
  if (layer === "thailand_2563_2564_2m") return { layer, ce: 2021.5, th: "2563–64 (2 ม.)", en: "2020–21 (2 m)", fine: true };
  if (layer === "thailand_2567_2m") return { layer, ce: 2024.5, th: "2567 (2 ม.)", en: "2024 (2 m)", fine: true };
  const ce = Number(layer.slice(-4));
  return { layer, ce, th: String(ce + 543), en: String(ce), fine: false };
}).sort((a, b) => a.ce - b.ce);

/** a picture with a clear view of the whole island (round-3 test, 24 Oct 2026) */
export const DEFAULT_IMAGERY = "thailand_sat_2025";

const GISTDA_ATTR = "Satellite imagery: Copyrighted by GISTDA (API Gateway) · team evaluation only";
const BOUNDS: [number, number, number, number] = [AREA.west, AREA.south, AREA.east, AREA.north];

/** absolute address of our own proxy (MapLibre loads tiles in a worker, so relative addresses are not safe) */
const proxyBase = () => new URL("gistda/", document.baseURI).href;

export const GISTDA_BASEMAPS: Basemap[] = [
  { id: "gistda_years", th: "ภาพดาวเทียมรายปี 2515–2568", en: "Yearly satellite imagery 1972–2025", tiles: [], attribution: GISTDA_ATTR, gistda: true, gistdaApi: true },
  { id: "gi_basemap", th: "GI Basemap", en: "GI Basemap", tiles: [], attribution: "GI Basemap: Copyrighted by GISTDA (API Gateway) · team evaluation only", gistda: true, gistdaApi: true },
];

/** tiles for one yearly picture; the proxy only answers inside the Phuket box */
export function imageryBasemap(layer: string): Basemap {
  const y = IMAGERY_YEARS.find((x) => x.layer === layer) ?? IMAGERY_YEARS[IMAGERY_YEARS.length - 1];
  const q = `SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${y.layer}&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg&BBOX={bbox-epsg-3857}`;
  return {
    id: `gistda_years:${y.layer}`,
    th: `ภาพดาวเทียม ${y.th}`,
    en: `Satellite imagery ${y.en}`,
    tiles: [`${proxyBase()}gfms/service/?${q}`],
    attribution: GISTDA_ATTR,
    gistda: true,
    gistdaApi: true,
    bounds: BOUNDS,
    // beyond this zoom MapLibre enlarges the last tiles instead of asking (and paying) for new ones
    maxzoom: y.fine ? 17 : 15,
  };
}

export function giBasemap(): Basemap {
  return { ...GISTDA_BASEMAPS[1], tiles: [`${proxyBase()}tiles/basemap_latest/{z}/{x}/{y}.png`], bounds: BOUNDS, maxzoom: 18 };
}

/** the base map for an id used by the map page ("gistda_years:<layer>", "gi_basemap" or a Sphere / CARTO id) */
export function resolveBasemap(id: string): Basemap {
  if (id.startsWith("gistda_years:")) return imageryBasemap(id.slice("gistda_years:".length));
  if (id === "gi_basemap") return giBasemap();
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}
