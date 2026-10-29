/** Overlay layers shown on the map, with their colour classes (used by the map and its legend). */
export type OverlayId = "landuse" | "terrain" | "landtrendr" | "population" | "land" | "height3d" | "bldg3d" | "streets" | "roads" | "pois";

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
    id: "terrain", file: "data/terrain.json",
    th: "ภูเขาและที่ลาดชัน", en: "Hills & steep land",
    sourceTh: "Copernicus DEM 30 ม.", sourceEn: "Copernicus DEM 30 m",
    swatch: "#96623c",
    attr: "ความสูง: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA",
  },
  {
    // raster tiles live from the GISTDA API Gateway through our proxy (src/landtrendr.ts), team only
    id: "landtrendr", file: "",
    th: "พื้นที่สีเขียวที่หายไป (Landtrendr)", en: "Lost green cover (Landtrendr)",
    sourceTh: "GISTDA API", sourceEn: "GISTDA API", gistda: true,
    swatch: "#ff7673", attr: "Landtrendr: GISTDA API Gateway · ใช้ภายในทีม (team evaluation only)",
  },
  {
    id: "population", file: "data/population_h3.geojson",
    th: "ความหนาแน่นประชากร (หกเหลี่ยม H3)", en: "Population density (H3 hexagons)",
    sourceTh: "Kontur Population 2566", sourceEn: "Kontur Population 2023",
    prop: "density", breaks: [500, 1500, 3000, 6000], ramp: ["#dcefea", "#a3d6cc", "#62b4a8", "#2b8a80", "#0b5d57"],
    unitTh: "คน/ตร.กม.", unitEn: "people/km²", swatch: "#2b8a80", attr: "ประชากร: Kontur (CC BY 4.0)",
  },
  {
    // placeholder only (data-prep/market_dummy.py: appraisal x 2); not used in any score, always labelled as simulated
    id: "land", file: "data/market_dummy_1km.geojson",
    th: "ราคาตลาดที่ดิน (ข้อมูลจำลอง)", en: "Market land price (simulated)",
    sourceTh: "ข้อมูลจำลอง", sourceEn: "Simulated",
    prop: "price", breaks: [8000, 16000, 32000, 64000], ramp: ["#f6edd0", "#e7cf86", "#cfa649", "#a3741b", "#6b4a0c"],
    unitTh: "บาท/ตร.ว.", unitEn: "THB/sq.wah", swatch: "#a3741b", attr: "ราคาตลาดที่ดิน: ข้อมูลจำลอง ไม่ใช่ข้อมูลจริง (simulated)",
  },
  {
    id: "height3d", file: "data/height_grid500.geojson",
    th: "อาคาร 3 มิติ: พื้นที่ใช้สอย (ช่อง 500 ม.)", en: "3D: building floor area (500 m cells)",
    sourceTh: "GISTDA 2567", sourceEn: "GISTDA 2024", gistda: true,
    prop: "h_mean", breaks: [5, 6.5, 8, 10], ramp: ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"],
    unitTh: "ม. สูงเฉลี่ย", unitEn: "m mean height", swatch: "#e08a45", attr: `อาคาร 3 มิติ: GISTDA (รูปอาคารจาก Global Building Atlas: ${OSM}, Google Open Buildings)`,
  },
  {
    // vector tiles while zoomed in (src/buildings3d.ts): Overture for everyone, GISTDA (live API) for the team only
    id: "bldg3d", file: "",
    th: "อาคาร 3 มิติรายหลัง (ซูมใกล้)", en: "3D buildings, one by one (zoom in)",
    sourceTh: "GISTDA / Overture", sourceEn: "GISTDA / Overture", gistda: true,
    prop: "h", breaks: [6, 12, 20, 40], ramp: ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"],
    unitTh: "ม. (ความสูง)", unitEn: "m (height)", swatch: "#c4512e",
    attr: `อาคารรายหลัง: GISTDA API Gateway 2567 · ใช้ภายในทีม (รูปอาคารจาก Global Building Atlas: ${OSM}, Google Open Buildings · ความสูงจากแบบจำลอง)`,
  },
  {
    // vector tiles (data-prep/roads_tiles.py), shown from zoom 14: village roads, sois, driveways, tracks
    id: "streets", file: "",
    th: "ถนนและซอยทุกประเภท (ซูมใกล้)", en: "All roads & alleys (zoom in)",
    sourceTh: "OpenStreetMap", sourceEn: "OpenStreetMap", swatch: "#9aa6a4", attr: OSM,
  },
  {
    id: "roads", file: "data/roads_main.geojson",
    th: "ถนนสายหลักและสายรอง", en: "Main & secondary roads",
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

/** classes drawn in terrain.png (data-prep/terrain_prep.py), in the order of precedence used there */
export const TERRAIN_CLASSES: { rgb: [number, number, number]; c: string; th: string; en: string }[] = [
  { rgb: [233, 178, 92], c: "rgba(233,178,92,.67)", th: "ลาดเชิงเขา ชัน 20–35%: สร้างได้เฉพาะบ้านเดี่ยว สูงไม่เกิน 6–12 ม. คลุมดินไม่เกิน 90 ตร.ม.", en: "Hillside, slope 20–35 %: single houses only, 6–12 m high, footprint up to 90 m²" },
  { rgb: [150, 98, 60], c: "rgba(150,98,60,.75)", th: "สูงเกิน 80 ม. (บริเวณที่ 6): ห้ามก่อสร้าง ยกเว้นบ้านเดี่ยวสูงไม่เกิน 6 ม. บนที่ดินที่ครอบครองก่อนปี 2560 ช่วง 80–140 ม.", en: "Above 80 m (zone 6): no building, except a 6 m single house on land held before 2017, at 80–140 m only" },
  { rgb: [122, 36, 24], c: "rgba(122,36,24,.82)", th: "ชันเกิน 35%: ลาดเชิงเขา และห้ามขุดดิน หิน ทรายเพื่อการค้า", en: "Slope over 35 %: hillside, and no commercial digging of soil, rock or sand" },
];
