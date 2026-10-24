/**
 * 3D buildings, one box per building, as vector tiles that MapLibre loads by itself (in its worker, only the
 * tiles in view, kept in its own cache), from two sources the user can switch between:
 *
 *  - "gistda": GISTDA API Gateway buildings with modelled height (2024 / 2567), live through our proxy
 *    (/gistda/buildings/{z}/{x}/{y}.pbf, netlify/gistda-proxy.mjs). Team only (VITE_GISTDA_IMAGERY=1).
 *  - "overture": Overture Maps buildings (release 2026-09-23), static tiles made by data-prep/overture_tiles.py.
 *    Open data, so always available. Heights exist for very few buildings (0.2 %); the rest are 1-storey boxes.
 *
 * Level of detail: zoom-16 tiles hold every building; zoom-15 tiles (used between zoom 15 and 16) hold only
 * buildings with a footprint of 100 m² or more or 12 m or taller; below zoom 15 nothing is drawn.
 * The other source can be drawn as outlines on top, to check that both put the buildings in the same place.
 */
import { AREA, BUILDING_LOD } from "../netlify/gistda-proxy.mjs";
import { GISTDA_IMAGERY } from "./gistda";

export type BldgSource = "gistda" | "overture";
export const BLDG_SOURCES: BldgSource[] = GISTDA_IMAGERY ? ["gistda", "overture"] : ["overture"];

export const BLDG_MIN_ZOOM = 15;
export { BUILDING_LOD };
const BOUNDS: [number, number, number, number] = [AREA.west, AREA.south, AREA.east, AREA.north];

/** height classes (m): about 1–2, 3–4, 5–6, 7–13 storeys and 14+ */
export const BLDG_BREAKS = [6, 12, 20, 40];
export const BLDG_RAMP = ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"];
/** buildings without a height (most Overture buildings) */
export const BLDG_NO_HEIGHT = "#cfd6d4";
export const OUTLINE_COLOR: Record<BldgSource, string> = { gistda: "#b0186e", overture: "#1c7fa6" };

export const BLDG_INFO: Record<BldgSource, { th: string; en: string; attr: string }> = {
  gistda: {
    th: "GISTDA 2567 (ความสูงจากแบบจำลอง)", en: "GISTDA 2024 (modelled heights)",
    attr: "อาคารรายหลัง: GISTDA API Gateway 2567 · ใช้ภายในทีม (รูปอาคารจาก Global Building Atlas: © OpenStreetMap contributors, Google Open Buildings · ความสูงจากแบบจำลอง)",
  },
  overture: {
    th: "Overture 2026-09 (มีความสูงไม่ถึง 2%)", en: "Overture 2026-09 (heights for under 2 %)",
    attr: 'อาคาร Overture: © <a href="https://overturemaps.org" target="_blank" rel="noopener">Overture Maps Foundation</a> · © OpenStreetMap contributors (ODbL) · Google Open Buildings · Microsoft ML Buildings',
  },
};

export interface BuildingStatus {
  /** zoomed in far enough to show buildings */
  zoomOk: boolean;
  loading: boolean;
  failed: boolean;
}

/** MapLibre vector source for one building source (absolute URLs: tiles are fetched by a worker) */
export function bldgSourceSpec(src: BldgSource) {
  const base = new URL(src === "gistda" ? "gistda/" : "data/", document.baseURI).href;
  return {
    type: "vector" as const,
    tiles: [src === "gistda" ? `${base}buildings/{z}/{x}/{y}.pbf` : `${base}bldg_overture/{z}/{x}/{y}.pbf`],
    minzoom: 15,
    maxzoom: 16,
    bounds: BOUNDS,
    attribution: BLDG_INFO[src].attr,
  };
}
