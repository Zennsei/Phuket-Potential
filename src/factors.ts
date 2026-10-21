import type { FactorKey, TambonProps, Weights } from "./types";

export interface FactorDef {
  key: FactorKey;
  th: string;
  en: string;
  unitTh: string;
  unitEn: string;
  /** raw value used for scoring */
  value: (p: TambonProps) => number | null;
  /** higher raw value is "better" when direction = +1; road distance is reversed */
  higherIsBetter: boolean;
  sourceTh: string;
  sourceEn: string;
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
    value: (p) => p.bldg_per_km2,
    higherIsBetter: true,
    sourceTh: "ข้อมูลรูปแปลงอาคาร GISTDA (2565)",
    sourceEn: "GISTDA building footprints (2022)",
    gistda: true,
    color: "#c4512e",
  },
  {
    key: "road",
    th: "ความใกล้ถนนสายหลัก",
    en: "Main-road access",
    unitTh: "ม. (ค่ากลาง จากอาคารถึงถนน)",
    unitEn: "m (median, building → road)",
    value: (p) => p.road_dist_m,
    higherIsBetter: false,
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
    higherIsBetter: true,
    sourceTh: "Kontur Population (พ.ย. 2566)",
    sourceEn: "Kontur Population (Nov 2023)",
    color: "#0e7c74",
  },
  {
    key: "land",
    th: "ราคาประเมินที่ดิน",
    en: "Land appraisal value",
    unitTh: "บาท/ตร.ว. (ค่ากลาง)",
    unitEn: "THB/sq.wah (median)",
    value: (p) => p.land_median,
    higherIsBetter: true,
    sourceTh: "กรมธนารักษ์ รอบบัญชี 2566–2569 ผ่าน data.go.th",
    sourceEn: "Treasury Dept., 2023–2026 round, via data.go.th",
    color: "#a3741b",
  },
  {
    key: "developable",
    th: "ที่ดินที่ยังพัฒนาได้",
    en: "Developable land",
    unitTh: "% ของพื้นที่ (เกษตร + เบ็ดเตล็ด)",
    unitEn: "% of land (agriculture + misc.)",
    value: (p) => p.developable_pct,
    higherIsBetter: true,
    sourceTh: "การใช้ที่ดิน กรมพัฒนาที่ดิน ปี 2563",
    sourceEn: "LDD land use 2020 (2563)",
    color: "#5c8a3a",
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

const w = (b: number, r: number, s: number, p: number, l: number, landDir: 1 | -1 | 0 = 1, d = 0): Weights => ({
  buildings: { weight: b, direction: b ? 1 : 0 },
  road: { weight: r, direction: r ? 1 : 0 },
  services: { weight: s, direction: s ? 1 : 0 },
  population: { weight: p, direction: p ? 1 : 0 },
  land: { weight: l, direction: l ? landDir : 0 },
  developable: { weight: d, direction: d ? 1 : 0 },
});

export const PRESETS: Preset[] = [
  {
    id: "equal",
    th: "ถ่วงน้ำหนักเท่ากัน",
    en: "Equal weights",
    descTh: "5 ปัจจัยหลัก ปัจจัยละ 20% (ปิดปัจจัยที่ดินที่ยังพัฒนาได้) ผลที่ได้คือพื้นที่ที่เจริญอยู่แล้วในปัจจุบัน",
    descEn: "The 5 core factors at 20% each (developable land off): areas that are already developed",
    weights: w(20, 20, 20, 20, 20),
  },
  {
    id: "emerging",
    th: "พื้นที่เศรษฐกิจใหม่",
    en: "Emerging areas",
    descTh: "เข้าถึงถนนและบริการได้ดี ราคาที่ดินยังไม่สูง (ราคายิ่งต่ำยิ่งได้คะแนน) และยังมีที่ดินเหลือให้พัฒนา",
    descEn: "Good road and service access, land still cheap (lower price scores higher), and land left to develop",
    weights: w(5, 25, 20, 10, 20, -1, 20),
  },
  {
    id: "people",
    th: "เน้นคุณภาพชีวิตประชาชน",
    en: "Residents first",
    descTh: "ให้น้ำหนักกับสถานที่บริการและประชากร ไม่สนราคาที่ดิน",
    descEn: "Weights services and population, ignores land price",
    weights: w(15, 25, 35, 25, 0),
  },
];

export const DEFAULT_WEIGHTS: Weights = PRESETS[0].weights;
