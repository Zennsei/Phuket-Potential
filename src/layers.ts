/** Overlay layers shown on the map, with their colour classes (used by the map and its legend). */
export type OverlayId = "buildings" | "population" | "land" | "roads" | "pois";

export interface Overlay {
  id: OverlayId;
  file: string;
  th: string;
  en: string;
  sourceTh: string;
  sourceEn: string;
  gistda?: boolean;
  /** property used for colour classes */
  prop?: string;
  breaks?: number[];
  ramp?: string[];
  unitTh?: string;
  unitEn?: string;
  swatch: string;
}

export const OVERLAYS: Overlay[] = [
  {
    id: "buildings", file: "data/buildings_grid500.geojson",
    th: "ความหนาแน่นอาคาร (ช่อง 500 ม.)", en: "Building density (500 m cells)",
    sourceTh: "GISTDA", sourceEn: "GISTDA", gistda: true,
    prop: "n", breaks: [10, 35, 100, 200], ramp: ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"],
    unitTh: "หลังต่อช่อง", unitEn: "bldgs per cell", swatch: "#c4512e",
  },
  {
    id: "population", file: "data/population_h3.geojson",
    th: "ความหนาแน่นประชากร (หกเหลี่ยม H3)", en: "Population density (H3 hexagons)",
    sourceTh: "Kontur Population 2566", sourceEn: "Kontur Population 2023",
    prop: "density", breaks: [500, 1500, 3000, 6000], ramp: ["#dcefea", "#a3d6cc", "#62b4a8", "#2b8a80", "#0b5d57"],
    unitTh: "คน/ตร.กม.", unitEn: "people/km²", swatch: "#2b8a80",
  },
  {
    id: "land", file: "data/land_value_1km.geojson",
    th: "ราคาประเมินที่ดิน (ช่อง 1 กม.)", en: "Land appraisal (1 km cells)",
    sourceTh: "กรมธนารักษ์", sourceEn: "Treasury Dept.",
    prop: "median_price", breaks: [4000, 8000, 16000, 32000], ramp: ["#f6edd0", "#e7cf86", "#cfa649", "#a3741b", "#6b4a0c"],
    unitTh: "บาท/ตร.ว.", unitEn: "THB/sq.wah", swatch: "#a3741b",
  },
  {
    id: "roads", file: "data/roads_main.geojson",
    th: "ถนนสายหลัก", en: "Main roads",
    sourceTh: "OpenStreetMap", sourceEn: "OpenStreetMap", swatch: "#2b6f9e",
  },
  {
    id: "pois", file: "data/pois.geojson",
    th: "สถานที่บริการและท่องเที่ยว", en: "Services & tourism places",
    sourceTh: "OpenStreetMap", sourceEn: "OpenStreetMap", swatch: "#7a5aa6",
  },
];

export const POI_COLORS: Record<string, { c: string; th: string; en: string }> = {
  education: { c: "#2f6fd0", th: "การศึกษา", en: "Education" },
  health: { c: "#d0352f", th: "สุขภาพ", en: "Health" },
  retail: { c: "#7a5aa6", th: "ห้าง/ร้านค้า", en: "Retail" },
  market: { c: "#9a5fc0", th: "ตลาด", en: "Market" },
  finance: { c: "#2f8f5b", th: "ธนาคาร", en: "Finance" },
  public: { c: "#1d3c5a", th: "หน่วยงานรัฐ", en: "Public" },
  transport: { c: "#b8860b", th: "คมนาคม", en: "Transport" },
  lodging: { c: "#8a8f98", th: "ที่พัก", en: "Lodging" },
  attraction: { c: "#e07b39", th: "แหล่งท่องเที่ยว", en: "Attraction" },
};
