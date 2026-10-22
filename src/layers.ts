/** Overlay layers shown on the map, with their colour classes (used by the map and its legend). */
export type OverlayId = "landuse" | "buildings" | "population" | "land" | "travel" | "height3d" | "roads" | "pois";

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
  /** credit shown in the map's attribution box while the layer is loaded */
  attr: string;
}

const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';

export const OVERLAYS: Overlay[] = [
  {
    id: "landuse", file: "data/landuse_2563.geojson",
    th: "การใช้ที่ดิน ปี 2563", en: "Land use 2020 (2563)",
    sourceTh: "กรมพัฒนาที่ดิน", sourceEn: "LDD",
    swatch: "#5c8a3a", attr: "การใช้ที่ดิน: กรมพัฒนาที่ดิน",
  },
  {
    id: "buildings", file: "data/buildings_grid500.geojson",
    th: "ความหนาแน่นอาคาร (ช่อง 500 ม.)", en: "Building density (500 m cells)",
    sourceTh: "GISTDA", sourceEn: "GISTDA", gistda: true,
    prop: "n", breaks: [10, 35, 100, 200], ramp: ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"],
    unitTh: "หลังต่อช่อง", unitEn: "bldgs per cell", swatch: "#c4512e", attr: "อาคาร: GISTDA",
  },
  {
    id: "population", file: "data/population_h3.geojson",
    th: "ความหนาแน่นประชากร (หกเหลี่ยม H3)", en: "Population density (H3 hexagons)",
    sourceTh: "Kontur Population 2566", sourceEn: "Kontur Population 2023",
    prop: "density", breaks: [500, 1500, 3000, 6000], ramp: ["#dcefea", "#a3d6cc", "#62b4a8", "#2b8a80", "#0b5d57"],
    unitTh: "คน/ตร.กม.", unitEn: "people/km²", swatch: "#2b8a80", attr: "ประชากร: Kontur (CC BY 4.0)",
  },
  {
    id: "land", file: "data/land_value_1km.geojson",
    th: "ราคาประเมินที่ดิน (ช่อง 1 กม.)", en: "Land appraisal (1 km cells)",
    sourceTh: "กรมธนารักษ์", sourceEn: "Treasury Dept.",
    prop: "median_price", breaks: [4000, 8000, 16000, 32000], ramp: ["#f6edd0", "#e7cf86", "#cfa649", "#a3741b", "#6b4a0c"],
    unitTh: "บาท/ตร.ว.", unitEn: "THB/sq.wah", swatch: "#a3741b", attr: "ราคาประเมิน: กรมธนารักษ์",
  },
  {
    id: "travel", file: "data/travel_grid500.geojson",
    th: "เวลาเดินทาง (ช่อง 500 ม.)", en: "Travel time (500 m cells)",
    sourceTh: "OSM + อาคาร GISTDA", sourceEn: "OSM + GISTDA buildings",
    prop: "o", breaks: [5, 10, 20, 30], ramp: ["#2a2f6e", "#4b5aa8", "#8391cc", "#c3cbe8", "#eef0f8"],
    unitTh: "นาที", unitEn: "min", swatch: "#4b5aa8", attr: `เวลาเดินทาง: คำนวณจากถนน ${OSM} และอาคาร GISTDA`,
  },
  {
    id: "height3d", file: "data/height_grid500.geojson",
    th: "อาคาร 3 มิติ: พื้นที่ใช้สอย (ช่อง 500 ม.)", en: "3D: building floor area (500 m cells)",
    sourceTh: "GISTDA 2567", sourceEn: "GISTDA 2024", gistda: true,
    prop: "h_mean", breaks: [5, 6.5, 8, 10], ramp: ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"],
    unitTh: "ม. สูงเฉลี่ย", unitEn: "m mean height", swatch: "#e08a45", attr: `อาคาร 3 มิติ: GISTDA (รูปอาคารจาก Global Building Atlas: ${OSM}, Google Open Buildings)`,
  },
  {
    id: "roads", file: "data/roads_main.geojson",
    th: "ถนนสายหลัก", en: "Main roads",
    sourceTh: "OpenStreetMap", sourceEn: "OpenStreetMap", swatch: "#c4511c", attr: OSM,
  },
  {
    id: "pois", file: "data/pois.geojson",
    th: "สถานที่บริการและท่องเที่ยว", en: "Services & tourism places",
    sourceTh: "OpenStreetMap", sourceEn: "OpenStreetMap", swatch: "#7a5aa6", attr: OSM,
  },
];

/** land use classes (level 1, urban split into level 2) */
export const LANDUSE_COLORS: Record<string, { c: string; th: string; en: string }> = {
  U1: { c: "#b2182b", th: "ตัวเมือง/ย่านการค้า", en: "City & commercial" },
  U2: { c: "#e7837a", th: "หมู่บ้าน/ที่อยู่อาศัย", en: "Housing" },
  U3: { c: "#8e5aa3", th: "สถานที่ราชการ", en: "Institutional" },
  U4: { c: "#6b6b6b", th: "คมนาคม", en: "Transport" },
  U5: { c: "#5b3a29", th: "อุตสาหกรรม", en: "Industrial" },
  U6: { c: "#f0a33a", th: "รีสอร์ท/โรงแรม", en: "Resort & hotel" },
  U7: { c: "#b7d36b", th: "สนามกอล์ฟ", en: "Golf" },
  A: { c: "#e9dc8f", th: "เกษตรกรรม", en: "Agriculture" },
  F: { c: "#2e6b3a", th: "ป่าไม้", en: "Forest" },
  W: { c: "#4a90c2", th: "แหล่งน้ำ", en: "Water" },
  M: { c: "#c8b8a0", th: "เบ็ดเตล็ด", en: "Miscellaneous" },
};

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
