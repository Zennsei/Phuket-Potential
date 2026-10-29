import type { BuildingMeasure, FactorKey, FactorSetting, LandBasis, TambonProps, Weights } from "./types";

export const LAND_BASES: { id: LandBasis; th: string; en: string; unitTh: string; unitEn: string }[] = [
  { id: "flat", th: "เฉพาะที่ราบ (ชันไม่เกิน 20% และต่ำกว่า 80 ม.)", en: "Gentle, low land only (slope < 20 %, below 80 m)",
    unitTh: "% ของพื้นที่ (เกษตร + เบ็ดเตล็ด บนที่ราบ)", unitEn: "% of land (agri. + misc. on gentle, low land)" },
  { id: "all", th: "ทั้งหมด (ไม่สนความชันและความสูง)", en: "All of it (ignore slope and height)",
    unitTh: "% ของพื้นที่ (เกษตร + เบ็ดเตล็ด)", unitEn: "% of land (agriculture + misc.)" },
];
export const landBasis = (s?: FactorSetting) => LAND_BASES.find((b) => b.id === (s?.landBasis ?? "flat"))!;
/** developable land under the chosen basis (default: gentle, low land only) */
export const developableOf = (p: TambonProps, s?: FactorSetting) => ((s?.landBasis ?? "flat") === "all" ? p.developable_pct : p.developable_flat_pct);

export const BUILDING_MEASURES: { id: BuildingMeasure; th: string; en: string; unitTh: string; unitEn: string; sourceTh: string; sourceEn: string }[] = [
  { id: "count", th: "จำนวนอาคารต่อพื้นที่", en: "Buildings per area", unitTh: "หลัง/ตร.กม.", unitEn: "bldg/km²",
    sourceTh: "ข้อมูลรูปแปลงอาคาร GISTDA (2565)", sourceEn: "GISTDA building footprints (2022)" },
  { id: "floor", th: "พื้นที่ใช้สอยต่อพื้นที่ดิน (มีความสูงอาคาร)", en: "Floor area per land area (with height)", unitTh: "% (พื้นที่ใช้สอย ÷ พื้นที่ตำบล)", unitEn: "% (floor area ÷ land area)",
    sourceTh: "อาคารพร้อมความสูง GISTDA API Gateway (2567)", sourceEn: "GISTDA API Gateway buildings with height (2024)" },
];
export const buildingMeasure = (s?: FactorSetting) => BUILDING_MEASURES.find((m) => m.id === (s?.measure ?? "count"))!;

export interface FactorDef {
  key: FactorKey;
  th: string;
  en: string;
  unitTh: string;
  unitEn: string;
  /** raw value used for scoring (the setting matters for the building and developable-land factors) */
  value: (p: TambonProps, s?: FactorSetting) => number | null;
  /** higher raw value is "better" when direction = +1; road distance is reversed */
  higherIsBetter: boolean;
  sourceTh: string;
  sourceEn: string;
  /** how the raw value is worked out, in plain words (shown on the method page) */
  howTh: string;
  howEn: string;
  gistda?: boolean;
  color: string;
}

export const FACTORS: FactorDef[] = [
  {
    key: "buildings",
    th: "ความหนาแน่นอาคาร",
    en: "Building density",
    unitTh: "หลัง/ตร.กม.",
    unitEn: "bldg/km²",
    value: (p, s) => (s?.measure === "floor" ? p.floor_to_land_pct : p.bldg_per_km2),
    howTh: "จำนวนอาคาร ÷ พื้นที่ตำบล (หรือเลือกใช้พื้นที่ใช้สอยรวมของอาคารปี 2567 ÷ พื้นที่ตำบล)",
    howEn: "Number of buildings ÷ sub-district area (or, as an option, total floor area of the 2024 buildings ÷ area)",
    higherIsBetter: true,
    sourceTh: "ข้อมูลรูปแปลงอาคาร GISTDA (2565) หรืออาคารพร้อมความสูง GISTDA API Gateway (2567)",
    sourceEn: "GISTDA building footprints (2022) or GISTDA API Gateway buildings with height (2024)",
    gistda: true,
    color: "#c4512e",
  },
  {
    key: "road",
    th: "ความหนาแน่นถนน",
    en: "Road density",
    unitTh: "กม./ตร.กม.",
    unitEn: "km/km²",
    value: (p) => p.road_km_per_km2,
    howTh: "ความยาวถนนสายหลักและสายรอง (primary, secondary, tertiary) ในตำบล ÷ พื้นที่ตำบล",
    howEn: "Length of main and secondary roads (primary, secondary, tertiary) inside the sub-district ÷ its area",
    higherIsBetter: true,
    sourceTh: "OpenStreetMap (ต.ค. 2569)",
    sourceEn: "OpenStreetMap (Oct 2026)",
    color: "#2b6f9e",
  },
  {
    key: "services",
    th: "ความหนาแน่นสถานที่บริการ",
    en: "Service density",
    unitTh: "แห่ง/ตร.กม.",
    unitEn: "places/km²",
    value: (p) => p.services_per_km2,
    howTh: "จำนวนโรงเรียน สถานพยาบาล ตลาด ร้านค้า ธนาคาร หน่วยงานรัฐ และจุดคมนาคม ÷ พื้นที่ตำบล",
    howEn: "Schools, health places, markets, shops, banks, government offices and transport stops ÷ sub-district area",
    higherIsBetter: true,
    sourceTh: "OpenStreetMap (ต.ค. 2569)",
    sourceEn: "OpenStreetMap (Oct 2026)",
    color: "#7a5aa6",
  },
  {
    key: "population",
    th: "ความหนาแน่นประชากร",
    en: "Population density",
    unitTh: "คน/ตร.กม.",
    unitEn: "people/km²",
    value: (p) => p.pop_per_km2,
    howTh: "รวมคนในช่องหกเหลี่ยมที่อยู่ในตำบล ÷ พื้นที่ตำบล",
    howEn: "People in the hexagon cells inside the sub-district ÷ its area",
    higherIsBetter: true,
    sourceTh: "Kontur Population (พ.ย. 2566)",
    sourceEn: "Kontur Population (Nov 2023)",
    color: "#0e7c74",
  },
  {
    key: "developable",
    th: "ที่ดินที่ยังพัฒนาได้",
    en: "Developable land",
    unitTh: "% ของพื้นที่ (เกษตร + เบ็ดเตล็ด)",
    unitEn: "% of land (agriculture + misc.)",
    value: (p, s) => developableOf(p, s),
    howTh: "พื้นที่เกษตร + เบ็ดเตล็ดที่ชันน้อยกว่า 20% และต่ำกว่า 80 ม. ÷ พื้นที่บก",
    howEn: "Farm and miscellaneous land with slope under 20 % and below 80 m ÷ land area",
    higherIsBetter: true,
    sourceTh: "การใช้ที่ดิน กรมพัฒนาที่ดิน ปี 2563 + ความสูงและความชันจาก Copernicus DEM",
    sourceEn: "LDD land use 2020 + height and slope from the Copernicus DEM",
    color: "#5c8a3a",
  },
  {
    key: "growth",
    th: "การเติบโตของบ้านตามทะเบียน",
    en: "Growth in registered houses",
    unitTh: "% เพิ่มขึ้น 2559–2568",
    unitEn: "% change 2016–2025",
    value: (p) => p.house_growth_pct,
    howTh: "(บ้านปี 2568 ÷ บ้านปี 2559 − 1) × 100",
    howEn: "(houses in 2025 ÷ houses in 2016 − 1) × 100",
    higherIsBetter: true,
    sourceTh: "ทะเบียนราษฎร์ กรมการปกครอง 2559, 2568",
    sourceEn: "DOPA civil registry 2016, 2025",
    color: "#8a4f7d",
  },
];

export const FACTOR_BY_KEY = Object.fromEntries(FACTORS.map((f) => [f.key, f])) as Record<FactorKey, FactorDef>;

export interface Preset {
  id: string;
  th: string;
  en: string;
  descTh: string;
  descEn: string;
  weights: Weights;
}

const w = (b: number, r: number, s: number, p: number, d = 0, g = 0): Weights => ({
  buildings: { weight: b, direction: b ? 1 : 0 },
  road: { weight: r, direction: r ? 1 : 0 },
  services: { weight: s, direction: s ? 1 : 0 },
  population: { weight: p, direction: p ? 1 : 0 },
  developable: { weight: d, direction: d ? 1 : 0 },
  growth: { weight: g, direction: g ? 1 : 0 },
});

export const PRESETS: Preset[] = [
  {
    id: "equal",
    th: "ถ่วงน้ำหนักเท่ากัน",
    en: "Equal weights",
    descTh: "4 ปัจจัยหลัก ปัจจัยละ 25% (ปิดปัจจัยที่ดินที่ยังพัฒนาได้และการเติบโต) ผลที่ได้คือพื้นที่ที่เจริญอยู่แล้วในปัจจุบัน",
    descEn: "The 4 core factors at 25% each (developable land and growth off): areas that are already developed",
    weights: w(25, 25, 25, 25),
  },
  {
    id: "emerging",
    th: "พื้นที่เศรษฐกิจใหม่",
    en: "Emerging areas",
    descTh: "มีถนนและบริการพอ ยังมีที่ดินเหลือให้พัฒนา และมีบ้านเกิดใหม่ต่อเนื่อง",
    descEn: "Enough roads and services, land left to develop, and steady growth in new houses",
    weights: w(5, 25, 20, 10, 20, 15),
  },
  {
    id: "people",
    th: "เน้นคุณภาพชีวิตประชาชน",
    en: "Residents first",
    descTh: "ให้น้ำหนักกับสถานที่บริการ ประชากร และโครงข่ายถนน",
    descEn: "Weights services, population and the road network",
    weights: w(15, 25, 35, 25),
  },
];

export const DEFAULT_WEIGHTS: Weights = PRESETS[0].weights;

/** unit of a factor under its current setting (the building factor has two measures) */
export function unitOf(f: FactorDef, s?: FactorSetting): { th: string; en: string } {
  if (f.key === "buildings") {
    const m = buildingMeasure(s);
    return { th: m.unitTh, en: m.unitEn };
  }
  if (f.key === "developable") {
    const b = landBasis(s);
    return { th: b.unitTh, en: b.unitEn };
  }
  return { th: f.unitTh, en: f.unitEn };
}
