import { categoryOf, DEFAULT_THRESHOLDS, type Category } from "./decision";
import { scoreTambons, type Normalise } from "./scoring";
import type { FactorKey, TambonProps, Weights } from "./types";

/**
 * "Different method" comparisons: the same data worked out two ways.
 * A = the way the site works it out, B = the alternative. Both are scored with the same rule (weights),
 * so any change in rank or decision group comes from the method alone.
 */

export interface MethodSide {
  th: string;
  en: string;
  howTh: string;
  howEn: string;
  unitTh: string;
  unitEn: string;
  /** raw value shown in the table and the dot chart */
  value: (p: TambonProps) => number | null;
  /** change the data before scoring */
  rows?: (p: TambonProps) => TambonProps;
  /** change the rule before scoring */
  weights?: (w: Weights) => Weights;
  normalise?: Normalise;
}

export interface MethodPair {
  id: string;
  th: string;
  en: string;
  /** factor the two methods feed (null = every factor, e.g. the 0–100 scaling) */
  factor: FactorKey | null;
  /** also feeds the land axis of the Logic Matrix (developable land), so groups can change even when the factor is off */
  matrixAxis?: boolean;
  /** what the dot chart plots: raw values, the 0–100 factor score, or the overall score */
  chart: "raw" | "part" | "score";
  /** how B − A is read: same unit, percentage points, score points, or not at all (different units) */
  diff: "unit" | "points" | "score" | null;
  digits: number;
  threshold?: { value: number; th: string; en: string };
  a: MethodSide;
  b: MethodSide;
  readTh: string[];
  readEn: string[];
  notTh: string[];
  notEn: string[];
  whyTh: string;
  whyEn: string;
  sourceTh: string;
  sourceEn: string;
}

const flat = (w: Weights): Weights => ({ ...w, developable: { ...w.developable, landBasis: "flat" } });
const count = (w: Weights): Weights => ({ ...w, buildings: { ...w.buildings, measure: "count" } });

const SCORE_UNIT = { unitTh: "คะแนน 0–100", unitEn: "score 0–100" };

export const METHOD_PAIRS: MethodPair[] = [
  {
    id: "developable",
    th: "ที่ดินพัฒนาได้: นับที่ดินบนเขาด้วยไหม",
    en: "Developable land: count land on hills?",
    factor: "developable",
    matrixAxis: true,
    chart: "raw",
    diff: "points",
    digits: 1,
    threshold: { value: 20, th: "เกณฑ์ Logic Matrix 20%", en: "Logic Matrix cut 20 %" },
    a: {
      th: "เฉพาะที่ราบ", en: "Gentle, low land only",
      howTh: "พื้นที่เกษตร + เบ็ดเตล็ด ที่ชันไม่ถึง 20% และต่ำกว่า 80 ม. ÷ พื้นที่บก",
      howEn: "Farm and miscellaneous land with slope under 20 % and below 80 m ÷ land area",
      unitTh: "% ของพื้นที่บก", unitEn: "% of land",
      value: (p) => p.developable_flat_pct,
      weights: flat,
    },
    b: {
      th: "ทั้งหมด", en: "All of it",
      howTh: "พื้นที่เกษตร + เบ็ดเตล็ดทั้งหมด ไม่สนความชันและความสูง ÷ พื้นที่บก",
      howEn: "All farm and miscellaneous land, ignoring slope and height ÷ land area",
      unitTh: "% ของพื้นที่บก", unitEn: "% of land",
      value: (p) => p.developable_pct,
      weights: (w) => ({ ...w, developable: { ...w.developable, landBasis: "all" } }),
    },
    readTh: [
      "ตำบลที่จุดสองแบบอยู่คนละฝั่งของเส้น 20% คือตำบลที่กลุ่มการตัดสินใจเปลี่ยน เพราะ Logic Matrix ใช้ค่านี้แบ่งว่า \"ยังมีที่ดินให้ขยาย\" หรือไม่",
      "ผลต่างยิ่งมาก ที่ดินเกษตรของตำบลนั้นยิ่งอยู่บนเขามาก",
      "แม้หลักเกณฑ์จะปิดปัจจัยนี้ กลุ่มการตัดสินใจก็ยังเปลี่ยนได้ เพราะ Logic Matrix ใช้ค่านี้แบ่งกลุ่มเสมอ",
    ],
    readEn: [
      "Sub-districts whose two dots sit on opposite sides of the 20 % line are the ones that change decision group, because the Logic Matrix uses this value to decide whether there is land left to grow into",
      "The bigger the gap, the more of the sub-district's farmland is on hills",
      "Even when the rule switches this factor off, groups can still change: the Logic Matrix always uses it to split the groups",
    ],
    notTh: [
      "ห้ามสรุปว่าที่ดินบนเขาสร้างได้: ประกาศเขตคุ้มครองสิ่งแวดล้อมภูเก็ต พ.ศ. 2567 ห้ามก่อสร้างบนพื้นที่สูงเกิน 80 ม. (ยกเว้นบ้านเดี่ยวบางกรณี)",
      "แบบ B ใช้ตอบคำถาม \"ถ้ากฎหรือเทคโนโลยีเปลี่ยน\" เท่านั้น ตรงกับ Stress Test \"นับที่ลาดชันเป็นที่พัฒนาได้\"",
    ],
    notEn: [
      "Do not conclude that land on hills can be built on: the 2024 Phuket environmental protection notice bans building above 80 m (with narrow exceptions for single houses)",
      "B only answers \"what if the rules or building methods change\", the same as the stress test \"Count steep land as developable\"",
    ],
    whyTh: "ตรงกับประกาศเขตคุ้มครองสิ่งแวดล้อมภูเก็ต 2567 ที่ห้ามก่อสร้างบนพื้นที่สูงเกิน 80 ม. ส่วนเกณฑ์ความชัน 20% ใช้ตามฉบับ 2560 เพราะฉบับ 2567 ไม่ระบุตัวเลข",
    whyEn: "It follows the 2024 Phuket environmental protection notice, which bans building above 80 m. The 20 % slope cut comes from the 2017 notice because the 2024 one gives no number",
    sourceTh: "การใช้ที่ดิน กรมพัฒนาที่ดิน 2563 (D2) + ความสูงและความชัน Copernicus DEM (D17)",
    sourceEn: "LDD land use 2020 (D2) + height and slope from the Copernicus DEM (D17)",
  },
  {
    id: "buildings",
    th: "ความหนาแน่นอาคาร: นับหลัง หรือ วัดพื้นที่หลังคา",
    en: "Building density: count buildings or measure roof area",
    factor: "buildings",
    chart: "part",
    diff: null,
    digits: 1,
    a: {
      th: "นับหลัง", en: "Count buildings",
      howTh: "จำนวนอาคาร ÷ พื้นที่ตำบล",
      howEn: "Number of buildings ÷ sub-district area",
      unitTh: "หลัง/ตร.กม.", unitEn: "bldg/km²",
      value: (p) => p.bldg_per_km2,
      weights: count,
    },
    b: {
      th: "พื้นที่หลังคา", en: "Roof area",
      howTh: "พื้นที่ฐานอาคาร (หลังคา) รวม ÷ พื้นที่ตำบล × 100",
      howEn: "Total building footprint (roof) area ÷ sub-district area × 100",
      unitTh: "% ของพื้นที่ตำบล", unitEn: "% of area",
      value: (p) => p.roof_cover_pct,
      weights: count,
      rows: (p) => ({ ...p, bldg_per_km2: p.roof_cover_pct }),
    },
    readTh: [
      "สองค่าหน่วยต่างกัน จึงเทียบด้วยคะแนนปัจจัย 0–100 และอันดับ ไม่ใช่ตัวเลขดิบ",
      "ตำบลที่คะแนนลดเมื่อวัดพื้นที่หลังคา อาคารส่วนใหญ่เป็นหลังเล็ก ตำบลที่คะแนนเพิ่มมีอาคารหลังใหญ่มากกว่า เช่น โรงแรม ห้าง โกดัง",
    ],
    readEn: [
      "The two values have different units, so they are compared by 0–100 factor score and rank, not raw numbers",
      "A sub-district that loses points on roof area has mostly small buildings; one that gains has more large ones, such as hotels, malls or warehouses",
    ],
    notTh: [
      "ห้ามเอาสองค่าลบกัน หน่วยต่างกัน (หลัง/ตร.กม. กับ %)",
      "ทั้งสองแบบไม่บอกความสูงอาคาร ถ้าต้องการการพัฒนาแนวดิ่ง ใช้ตัวเลือก \"พื้นที่ใช้สอยต่อพื้นที่ดิน\" (อาคาร 2567) ในหน้าแผนที่",
    ],
    notEn: [
      "Do not subtract one from the other: the units differ (bldg/km² and %)",
      "Neither tells you building height; for vertical growth use the \"floor area per land area\" option (2024 buildings) on the map page",
    ],
    whyTh: "เว็บใช้การนับหลังมาตั้งแต่รุ่นแรก (ต่อจากแนวคิด 5 ปัจจัยของ prototype) หน้านี้เทียบกับพื้นที่หลังคาจากข้อมูลชุดเดียวกันเป็นครั้งแรก",
    whyEn: "The site has counted buildings since its first version (following the prototype's 5-factor idea); this page is the first comparison with roof area from the same data",
    sourceTh: "รูปแปลงอาคาร GISTDA 2565 (D1) 130,403 หลัง",
    sourceEn: "GISTDA building footprints 2022 (D1), 130,403 buildings",
  },
  {
    id: "scaling",
    th: "แปลงเป็นคะแนน 0–100: Min-Max หรือ อันดับ",
    en: "Turning values into 0–100: Min-Max or rank",
    factor: null,
    chart: "score",
    diff: "score",
    digits: 1,
    threshold: { value: 50, th: "เกณฑ์ Logic Matrix 50", en: "Logic Matrix cut 50" },
    a: {
      th: "Min-Max", en: "Min-Max",
      howTh: "ต่ำสุด = 0 สูงสุด = 100 ตำบลอื่นอยู่ตามสัดส่วนระยะห่างของค่า",
      howEn: "Lowest = 0, highest = 100, the rest in proportion to how far their values are",
      ...SCORE_UNIT,
      value: () => null,
    },
    b: {
      th: "อันดับ", en: "Rank",
      howTh: "เรียง 17 ตำบล ต่ำสุด = 0 สูงสุด = 100 ห่างกันขั้นละ 6.25 ไม่สนว่าค่าจริงห่างกันมากหรือน้อย",
      howEn: "Order the 17 sub-districts, lowest = 0, highest = 100, in equal steps of 6.25 whatever the real gaps",
      ...SCORE_UNIT,
      value: () => null,
      normalise: "rank",
    },
    readTh: [
      "Min-Max: ตำบลที่ค่าโดด (เช่น ตลาดใหญ่มีสถานที่บริการ 14.79 แห่ง/ตร.กม.) ดันตำบลอื่นไปกองใกล้ 0",
      "แบบอันดับวางทุกตำบลห่างเท่ากัน ไม่ว่าค่าจริงจะห่างกันแค่ไหน",
    ],
    readEn: [
      "Min-Max: one outlier (Talat Yai has 14.79 service places per km²) pushes the others down towards 0",
      "Rank spaces every sub-district evenly, however far apart the real values are",
    ],
    notTh: [
      "ห้ามเทียบกับเกณฑ์ 50 แบบตรงๆ: เกณฑ์ 50 ตั้งไว้กับ Min-Max ในแบบอันดับ ค่าเฉลี่ยของทุกปัจจัยคือ 50 พอดี ตำบลราวครึ่งหนึ่งจึงผ่านเกณฑ์เอง กลุ่มที่เปลี่ยนส่วนหนึ่งมาจากเรื่องนี้ ไม่ใช่จากข้อมูล",
      "ห้ามสรุปว่าแบบไหนถูก ทั้งสองแบบใช้ข้อมูลชุดเดียวกันทุกตัว",
    ],
    notEn: [
      "Do not compare with the 50 cut as if nothing changed: 50 was set for Min-Max. Under rank scaling every factor averages exactly 50, so about half the sub-districts pass on their own; part of the group change comes from that, not from the data",
      "Do not conclude that either one is right: both use exactly the same data",
    ],
    whyTh: "Min-Max เก็บไว้ว่าตำบลห่างกันมากหรือน้อย และอธิบายด้วยไม้บรรทัด 0–100 ได้ แบบอันดับทนค่าโดดได้ดีกว่าแต่ทิ้งข้อมูลส่วนนี้ไป",
    whyEn: "Min-Max keeps how far apart the sub-districts are and can be explained as a 0–100 ruler; rank copes better with outliers but throws that information away",
    sourceTh: "ทุกปัจจัยที่เปิดอยู่ในหลักเกณฑ์ที่เลือก",
    sourceEn: "Every factor switched on in the chosen rule",
  },
];

export interface SideResult {
  raw: number | null;
  /** 0–100 score of the pair's factor (null for the scaling pair) */
  part: number | null;
  score: number;
  rank: number;
  cat: Category;
}

export interface PairRow {
  props: TambonProps;
  a: SideResult;
  b: SideResult;
}

function run(rows: TambonProps[], weights: Weights, pair: MethodPair, side: MethodSide) {
  const r = side.rows ? rows.map(side.rows) : rows;
  const w = side.weights ? side.weights(weights) : weights;
  const scored = scoreTambons(r, w, side.normalise);
  return new Map(
    scored.map((s) => [
      s.props.id,
      {
        part: pair.factor ? s.parts[pair.factor] : null,
        score: s.score,
        rank: s.rank,
        cat: categoryOf(s.score, s.props, DEFAULT_THRESHOLDS, w.developable),
      },
    ]),
  );
}

/** Score every tambon with method A and method B under the same rule. Sorted by rank under A. */
export function comparePair(rows: TambonProps[], weights: Weights, pair: MethodPair): PairRow[] {
  const ra = run(rows, weights, pair, pair.a);
  const rb = run(rows, weights, pair, pair.b);
  return rows
    .map((p) => ({
      props: p,
      a: { raw: pair.a.value(p), ...ra.get(p.id)! },
      b: { raw: pair.b.value(p), ...rb.get(p.id)! },
    }))
    .sort((x, y) => x.a.rank - y.a.rank);
}

/** the value the dot chart plots for one side */
export const chartValue = (pair: MethodPair, s: SideResult): number | null =>
  pair.chart === "raw" ? s.raw : pair.chart === "part" ? s.part : s.score;

export interface PairSummary {
  rankChanged: number;
  maxMove: number;
  catChanged: PairRow[];
  top5Same: number;
  missingB: PairRow[];
  /** row with the largest gap in what the dot chart plots */
  biggest: PairRow | null;
}

export function summarise(pair: MethodPair, rows: PairRow[]): PairSummary {
  let biggest: PairRow | null = null;
  let gap = -1;
  for (const r of rows) {
    const a = chartValue(pair, r.a), b = chartValue(pair, r.b);
    if (a == null || b == null) continue;
    if (Math.abs(b - a) > gap) {
      gap = Math.abs(b - a);
      biggest = r;
    }
  }
  return {
    rankChanged: rows.filter((r) => r.a.rank !== r.b.rank).length,
    maxMove: Math.max(0, ...rows.map((r) => Math.abs(r.a.rank - r.b.rank))),
    catChanged: rows.filter((r) => r.a.cat !== r.b.cat),
    top5Same: rows.filter((r) => r.a.rank <= 5 && r.b.rank <= 5).length,
    missingB: pair.chart === "score" ? [] : rows.filter((r) => r.b.raw == null),
    biggest: gap > 0 ? biggest : null,
  };
}
