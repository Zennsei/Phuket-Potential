import { useEffect, useState } from "react";
import { UNREG_FLAG } from "./decision";
import { REG_YEARS, regHouse, regPop } from "./years";
import type { TambonProps } from "./types";

/**
 * Comparing two data sources (the "different method" kind lives in methods.ts):
 *  - same:       two sources meant to measure the same thing → difference, % difference against the midpoint
 *                of the two (neither source is taken as the truth), and a midpoint estimate ± half the gap
 *  - definition: two things with different meanings → ratio B ÷ A ("times"), never called an error
 *  - time:       one source in two years → change, % change against the first year, and % per year
 * Island totals are summed first and then compared (never an average of the 17 percentages).
 */

export type SourceKind = "same" | "definition" | "time";

/** buildings per tambon from three sources, counted the same way (data-prep/building_sources.py) */
export interface BuildingRow {
  gistda2565_count: number;
  gistda2565_footprint_m2: number;
  gistda2567_count: number;
  gistda2567_footprint_m2: number;
  overture_count: number;
  overture_footprint_m2: number;
}

export type BuildingMeasure = "footprint" | "count";

export interface SourceOpts {
  measure: BuildingMeasure;
  from: number;
  to: number;
}

export const DEFAULT_OPTS: SourceOpts = { measure: "footprint", from: 2559, to: 2568 };

export interface Extra {
  bldg?: Map<string, BuildingRow>;
}

type Label = [string, string];

export interface SourceSide {
  label: (o: SourceOpts) => Label;
  noteTh: string;
  noteEn: string;
  value: (p: TambonProps, x: Extra, o: SourceOpts) => number | null;
}

export interface SourcePair {
  id: string;
  kind: SourceKind;
  th: string;
  en: string;
  /** which extra control the topic has */
  option?: "measure" | "years";
  needsBuildings?: boolean;
  unit: (o: SourceOpts) => Label;
  digits: (o: SourceOpts) => number;
  /** below this base (midpoint for "same", first year for "time") the % is hidden: a tiny base makes any % look huge */
  minBase: (o: SourceOpts) => number;
  a: SourceSide;
  b: SourceSide;
  /** reference lines for the ratio chart ("definition" only) */
  refs?: { value: number; th: string; en: string }[];
  readTh: string[];
  readEn: string[];
  notTh: string[];
  notEn: string[];
  /** extra warning shown for some options (e.g. a registry year known to be odd) */
  warn?: (o: SourceOpts) => Label | null;
  sourceTh: string;
  sourceEn: string;
}

export const KINDS: { id: SourceKind | "method"; th: string; en: string; leadTh: string; leadEn: string; formulaTh: string; formulaEn: string }[] = [
  {
    id: "method", th: "ต่างวิธีคิด", en: "Different method",
    leadTh: "ข้อมูลชุดเดิม คิดคนละวิธี แล้วดูว่าอันดับและกลุ่มการตัดสินใจเปลี่ยนแค่ไหน",
    leadEn: "The same data worked out two ways: how far do ranks and decision groups move?",
    formulaTh: "คิดคะแนนด้วยหลักเกณฑ์เดียวกันทั้งสองแบบ แล้วเทียบอันดับและกลุ่ม",
    formulaEn: "Both methods are scored with the same rule, then ranks and groups are compared",
  },
  {
    id: "same", th: "วัดสิ่งเดียวกัน", en: "Same thing, two sources",
    leadTh: "สองแหล่งตั้งใจวัดสิ่งเดียวกัน ต่างที่วิธีเก็บ: ต่างกันกี่ % และควรประมาณว่าเท่าไร",
    leadEn: "Two sources that set out to measure the same thing, collected differently: how far apart are they, and what is a fair estimate?",
    formulaTh: "% ต่าง = (B − A) ÷ ค่ากลางของสองแหล่ง × 100 · ค่าประมาณ = ค่ากลาง ± ครึ่งของผลต่าง (ไม่ถือว่าแหล่งไหนถูก)",
    formulaEn: "% difference = (B − A) ÷ midpoint of the two × 100 · estimate = midpoint ± half the gap (neither source is taken as the truth)",
  },
  {
    id: "definition", th: "นิยามต่างกัน", en: "Different definitions",
    leadTh: "สองค่าวัดคนละความหมาย ส่วนต่างจึงไม่ใช่ความคลาดเคลื่อน แต่บอกอะไรบางอย่างเอง",
    leadEn: "The two values mean different things, so the gap is not an error; it tells you something in itself",
    formulaTh: "อัตราส่วน = B ÷ A (เท่า) ไม่คิด % ต่างและไม่หาค่ากลาง",
    formulaEn: "Ratio = B ÷ A (times); no % difference and no midpoint",
  },
  {
    id: "time", th: "ต่างช่วงเวลา", en: "Different years",
    leadTh: "แหล่งเดียวกันคนละปี: เปลี่ยนไปเท่าไร คิดเป็นกี่ % และเฉลี่ยปีละเท่าไร",
    leadEn: "One source in two years: how much changed, by what %, and how much a year on average",
    formulaTh: "% เปลี่ยน = (ปีหลัง ÷ ปีแรก − 1) × 100 (ใช้ปีแรกเป็นฐานเพราะเวลามีทิศทาง) · % ต่อปี = ((ปีหลัง ÷ ปีแรก) ^ (1 ÷ จำนวนปี) − 1) × 100",
    formulaEn: "% change = (later ÷ first − 1) × 100 (the first year is the base because time has a direction) · % a year = ((later ÷ first) ^ (1 ÷ years) − 1) × 100",
  },
];

const bldgUnit = (o: SourceOpts): Label => (o.measure === "footprint" ? ["ตร.กม.", "km²"] : ["หลัง", "buildings"]);
/** what the building topics measure, for headings */
export const measureLabel = (o: SourceOpts): Label => (o.measure === "footprint" ? ["พื้นที่ฐานอาคารรวม", "total building footprint"] : ["จำนวนอาคาร", "number of buildings"]);
const bldgDigits = (o: SourceOpts) => (o.measure === "footprint" ? 2 : 0);
const bldgMin = (o: SourceOpts) => (o.measure === "footprint" ? 0.05 : 100);
const bldg = (key: "gistda2565" | "gistda2567" | "overture") => (p: TambonProps, x: Extra, o: SourceOpts) => {
  const r = x.bldg?.get(p.id);
  if (!r) return null;
  return o.measure === "footprint" ? r[`${key}_footprint_m2`] / 1e6 : r[`${key}_count`];
};

const G65: SourceSide = {
  label: () => ["GISTDA 2565", "GISTDA 2022"],
  noteTh: "รูปแปลงอาคาร GISTDA ไฟล์ มิ.ย. 2565 (D1)",
  noteEn: "GISTDA building footprints, June 2022 file (D1)",
  value: bldg("gistda2565"),
};
const G67: SourceSide = {
  label: () => ["GISTDA 2567", "GISTDA 2024"],
  noteTh: "อาคารจาก GISTDA API Gateway ปี 2567 รวมรูปอาคารจาก Google, Microsoft, OSM, MPA และภาพ UAV ของ GISTDA (D13)",
  noteEn: "GISTDA API Gateway buildings, 2024, merged from Google, Microsoft, OSM, MPA and GISTDA drone imagery (D13)",
  value: bldg("gistda2567"),
};
const OVT: SourceSide = {
  label: () => ["Overture 2569", "Overture 2026"],
  noteTh: "Overture Maps รุ่น 2026-09-23 รวม OSM, Google และ Microsoft (D9)",
  noteEn: "Overture Maps release 2026-09-23, merging OSM, Google and Microsoft (D9)",
  value: bldg("overture"),
};

const BLDG_COMMON = {
  kind: "same" as const,
  option: "measure" as const,
  needsBuildings: true,
  unit: bldgUnit,
  digits: bldgDigits,
  minBase: bldgMin,
  sourceTh: "นับด้วยกติกาเดียวกันทุกแหล่ง: เฉพาะเกาะภูเก็ตหลัก (ไม่รวมเกาะทางใต้ที่ Overture ไม่ครอบคลุม) จุดกึ่งกลางอาคารอยู่ในตำบลไหนนับเข้าตำบลนั้น อาคารริมฝั่งนับเข้าตำบลที่ใกล้สุดไม่เกิน 3 กม. ไม่นับอาคารฝั่งพังงา (data-prep/building_sources.py)",
  sourceEn: "Counted the same way for every source: main island only (the southern islands Overture does not cover are left out), each building goes to the sub-district its centre is in, coastal ones to the nearest within 3 km, mainland Phang Nga buildings are dropped (data-prep/building_sources.py)",
};

const regYearsLabel = (y: number): Label => [`ปี ${y}`, `${y - 543}`];

export const SOURCE_PAIRS: SourcePair[] = [
  {
    ...BLDG_COMMON,
    id: "bldg-gistda-overture",
    th: "อาคาร: GISTDA 2565 กับ Overture",
    en: "Buildings: GISTDA 2022 and Overture",
    a: G65,
    b: OVT,
    readTh: [
      "พื้นที่ฐานเทียบได้ดีกว่าจำนวนหลัง เพราะแต่ละแหล่งแบ่งอาคารต่างกัน หลังคาผืนเดียวอาจเป็น 1 หลังในแหล่งหนึ่งและ 3 หลังในอีกแหล่ง",
      "Overture มากกว่า GISTDA 2565 ทุกตำบลทั้งพื้นที่ฐานและจำนวนหลัง ส่วนหนึ่งเพราะเผยแพร่ทีหลังราว 4 ปี และส่วนหนึ่งเพราะรวมรูปอาคารจากหลายแหล่ง",
      "% ต่างใช้ค่ากลางของสองแหล่งเป็นฐาน จึงได้ขนาดเท่ากันไม่ว่าจะเอาแหล่งไหนขึ้นก่อน",
    ],
    readEn: [
      "Footprint compares better than building counts, because each source splits buildings differently: one roof may be 1 building in one source and 3 in another",
      "Overture is higher than GISTDA 2022 in every sub-district, in footprint and in count, partly because it was published about 4 years later and partly because it merges several footprint sources",
      "The % difference uses the midpoint of the two as its base, so it has the same size whichever source is listed first",
    ],
    notTh: [
      "ห้ามสรุปว่าผลต่างคือ \"อาคารใหม่\" สองแหล่งเก็บต่างปีและต่างวิธี",
      "ห้ามสรุปว่าแหล่งไหนถูก ค่าประมาณกลางเป็นค่ากลางระหว่างสองแหล่ง ไม่ใช่ค่าจริงที่ตรวจในพื้นที่",
    ],
    notEn: [
      "Do not read the gap as \"new buildings\": the two sources differ in year and method",
      "Do not conclude that either source is right: the estimate is the middle of the two, not a surveyed figure",
    ],
  },
  {
    ...BLDG_COMMON,
    id: "bldg-gistda-years",
    th: "อาคาร: GISTDA 2565 กับ GISTDA 2567",
    en: "Buildings: GISTDA 2022 and GISTDA 2024",
    a: G65,
    b: G67,
    readTh: [
      "ทั้งสองชุดมาจาก GISTDA แต่ชุด 2567 รวมรูปอาคารจากหลายแหล่ง (Google, Microsoft, OSM, MPA, ภาพ UAV) จำนวนหลังจึงเกือบสองเท่า",
      "พื้นที่ฐานต่างกันน้อยกว่าจำนวนหลังมาก จำนวนหลังที่ต่างกันจึงมาจากการแบ่งหลังต่างกันด้วย ไม่ใช่แค่อาคารที่มีเพิ่ม",
    ],
    readEn: [
      "Both come from GISTDA, but the 2024 set merges footprints from several sources (Google, Microsoft, OSM, MPA, drone imagery), so it has almost twice as many buildings",
      "Footprint differs much less than the building count, so part of the count gap comes from splitting buildings differently, not only from extra buildings",
    ],
    notTh: [
      "ห้ามลบสองปีนี้แล้วเรียกว่า \"อาคารใหม่ปี 2565–2567\" (กฎของโปรเจกต์) วิธีเก็บต่างกัน",
      "ห้ามสรุปว่าแหล่งไหนถูก ค่าประมาณกลางเป็นค่ากลางระหว่างสองแหล่ง",
    ],
    notEn: [
      "Do not subtract the two years and call it \"new buildings 2022–2024\" (a project rule): the methods differ",
      "Do not conclude that either source is right: the estimate is the middle of the two",
    ],
  },
  {
    ...BLDG_COMMON,
    id: "bldg-2567-overture",
    th: "อาคาร: GISTDA 2567 กับ Overture",
    en: "Buildings: GISTDA 2024 and Overture",
    a: G67,
    b: OVT,
    readTh: [
      "สองชุดนี้ใกล้กันที่สุด เพราะรวมรูปอาคารจากแหล่งต้นทางชุดเดียวกันบางส่วน (Google, Microsoft, OSM)",
      "ตำแหน่งตรงกันด้วย: 90.1% ของอาคาร GISTDA 2567 มีอาคาร Overture ห่างไม่เกิน 10 ม.",
    ],
    readEn: [
      "These two agree most closely, because they partly merge the same upstream footprints (Google, Microsoft, OSM)",
      "Positions agree too: 90.1 % of GISTDA 2024 buildings have an Overture building within 10 m",
    ],
    notTh: [
      "ห้ามสรุปว่าการที่สองแหล่งตรงกันคือการยืนยันอิสระ ทั้งสองใช้ต้นทางร่วมกันบางส่วน",
    ],
    notEn: [
      "Do not treat the agreement as independent confirmation: the two partly share their upstream sources",
    ],
  },
  {
    id: "kontur-releases",
    kind: "same",
    th: "ประชากรแบบจำลอง Kontur: รุ่น 2565 กับ 2566",
    en: "Kontur modelled population: 2022 and 2023 releases",
    unit: () => ["คน", "people"],
    digits: () => 0,
    minBase: () => 500,
    a: {
      label: () => ["Kontur มิ.ย. 2565", "Kontur Jun 2022"],
      noteTh: "Kontur Population รุ่น 30 มิ.ย. 2565 (เก็บไว้เทียบ)",
      noteEn: "Kontur Population, 30 June 2022 release (kept for comparison)",
      value: (p) => p.population_2022,
    },
    b: {
      label: () => ["Kontur พ.ย. 2566", "Kontur Nov 2023"],
      noteTh: "Kontur Population รุ่น 1 พ.ย. 2566 (ที่เว็บใช้คิดคะแนน)",
      noteEn: "Kontur Population, 1 November 2023 release (the one the site scores with)",
      value: (p) => p.population,
    },
    readTh: [
      "สองรุ่นห่างกัน 17 เดือน แต่ส่วนต่างส่วนใหญ่มาจากการปรับแบบจำลอง ตำบลที่ลดลงมีหลายตำบลทั้งที่ทะเบียนบอกว่าบ้านเพิ่ม",
      "ช่วงของค่าประมาณบอกว่าจำนวนคนรายตำบลจากแบบจำลองไม่แน่นอนราวเท่าไร",
    ],
    readEn: [
      "The releases are 17 months apart, but most of the gap comes from model changes: several sub-districts go down although the registry shows more houses",
      "The width of the estimate shows roughly how uncertain the modelled count per sub-district is",
    ],
    notTh: [
      "ห้ามใช้ส่วนต่างเป็นอัตราการเติบโตของประชากร (ตัดสินไว้ตั้งแต่ 21 ต.ค.)",
    ],
    notEn: [
      "Do not use the gap as population growth (decided on 21 Oct)",
    ],
    sourceTh: "Kontur Population ผ่าน HDX ช่องหกเหลี่ยมราว 400 ม. รวมรายตำบลด้วยจุดกึ่งกลางช่อง (D5)",
    sourceEn: "Kontur Population via HDX, ~400 m hexagons summed per sub-district by cell centre (D5)",
  },
  {
    id: "people-kontur-registry",
    kind: "definition",
    th: "ประชากร: คนอยู่จริง (Kontur) กับ คนในทะเบียน",
    en: "Population: people living there (Kontur) and registered residents",
    unit: () => ["คน", "people"],
    digits: () => 0,
    minBase: () => 500,
    refs: [
      { value: 1, th: "เท่ากัน", en: "equal" },
      { value: UNREG_FLAG, th: `${UNREG_FLAG} เท่า`, en: `${UNREG_FLAG}×` },
    ],
    a: {
      label: () => ["ทะเบียน ธ.ค. 2565", "Registry Dec 2022"],
      noteTh: "คนที่มีชื่อในทะเบียนบ้าน กรมการปกครอง (D15)",
      noteEn: "People named in the house register, Department of Provincial Administration (D15)",
      value: (p) => p.reg_pop_2565,
    },
    b: {
      label: () => ["Kontur พ.ย. 2566", "Kontur Nov 2023"],
      noteTh: "คนที่อยู่จริงจากแบบจำลอง รวมแรงงานและผู้อยู่โดยไม่ย้ายทะเบียน (D5)",
      noteEn: "People actually living there, modelled, including workers and residents who never moved their registration (D5)",
      value: (p) => p.population,
    },
    readTh: [
      "อัตราส่วนสูงแปลว่ามีคนอยู่จริงมากกว่าคนที่มีชื่อในทะเบียนมาก เช่น ย่านท่องเที่ยวที่มีแรงงานย้ายมาอยู่",
      "อัตราส่วนต่ำกว่า 1 (เมืองเก่า) แปลว่าคนมีชื่อในทะเบียนแต่ไม่ได้อยู่จริงในตำบลนั้น",
      "ตำบลที่เกิน 3 เท่า เว็บใส่หมายเหตุประชากรแฝงใน Logic Matrix",
    ],
    readEn: [
      "A high ratio means far more people live there than are registered, e.g. tourist areas with workers who moved in",
      "A ratio below 1 (old town) means people are registered there but live elsewhere",
      "Sub-districts at 3× or more get the unregistered-resident note in the Logic Matrix",
    ],
    notTh: [
      "ห้ามเรียกส่วนต่างว่า \"ความคลาดเคลื่อน\" ของแหล่งใด ทั้งสองถูกตามนิยามของตัวเอง",
      "ห้ามบวกหรือเฉลี่ยสองค่านี้เป็นจำนวนประชากร",
      "Kontur เป็นแบบจำลอง อัตราส่วนเป็นค่าบอกแนวโน้ม ไม่ใช่จำนวนประชากรแฝงที่นับได้",
    ],
    notEn: [
      "Do not call the gap an \"error\" of either source: each is right by its own definition",
      "Do not add or average the two into a population figure",
      "Kontur is a model; the ratio shows a tendency, not a counted number of unregistered residents",
    ],
    sourceTh: "Kontur Population พ.ย. 2566 (D5) ÷ ทะเบียนราษฎร์ ธ.ค. 2565 (D15) เหมือนคอลัมน์ unreg_ratio ที่เว็บใช้",
    sourceEn: "Kontur Population Nov 2023 (D5) ÷ civil registry Dec 2022 (D15), the same as the site's unreg_ratio column",
  },
  {
    id: "reg-pop",
    kind: "time",
    option: "years",
    th: "ประชากรตามทะเบียน: ปีไหนกับปีไหน",
    en: "Registered population: one year against another",
    unit: () => ["คน", "people"],
    digits: () => 0,
    minBase: () => 500,
    a: { label: (o) => regYearsLabel(o.from), noteTh: "ทะเบียนราษฎร์ เดือนธันวาคม", noteEn: "Civil registry, December", value: (p, _x, o) => regPop(p, o.from) },
    b: { label: (o) => regYearsLabel(o.to), noteTh: "ทะเบียนราษฎร์ เดือนธันวาคม", noteEn: "Civil registry, December", value: (p, _x, o) => regPop(p, o.to) },
    readTh: [
      "% ต่อปีใช้เทียบช่วงที่ยาวไม่เท่ากันได้ เช่น 2552–2559 (7 ปี) กับ 2559–2568 (9 ปี)",
      "ช่วง 2559 → 2568 เมืองเก่าลดลงตามทะเบียน ขณะที่ตำบลทางเหนือเพิ่ม",
    ],
    readEn: [
      "% a year lets you compare spans of different length, e.g. 2009–2016 (7 years) with 2016–2025 (9 years)",
      "From 2016 to 2025 the old town shrinks on the register while the northern sub-districts grow",
    ],
    notTh: [
      "ห้ามสรุปว่าคนที่อยู่จริงลดลง ทะเบียนนับคนที่มีชื่อ ไม่ใช่คนที่อยู่จริง (ดูแบบนิยามต่างกัน)",
    ],
    notEn: [
      "Do not conclude that the people living there decreased: the register counts names, not residents (see Different definitions)",
    ],
    sourceTh: "ทะเบียนราษฎร์รายตำบล กรมการปกครอง ปี 2552, 2559, 2563, 2565, 2568 (D15)",
    sourceEn: "DOPA civil registry per sub-district, 2009, 2016, 2020, 2022, 2025 (D15)",
  },
  {
    id: "reg-house",
    kind: "time",
    option: "years",
    th: "บ้านตามทะเบียน: ปีไหนกับปีไหน",
    en: "Registered houses: one year against another",
    unit: () => ["หลัง", "houses"],
    digits: () => 0,
    minBase: () => 200,
    a: { label: (o) => regYearsLabel(o.from), noteTh: "ทะเบียนบ้าน เดือนธันวาคม", noteEn: "House register, December", value: (p, _x, o) => regHouse(p, o.from) },
    b: { label: (o) => regYearsLabel(o.to), noteTh: "ทะเบียนบ้าน เดือนธันวาคม", noteEn: "House register, December", value: (p, _x, o) => regHouse(p, o.to) },
    warn: (o) =>
      o.from === 2552 || o.to === 2552
        ? ["บ้านตามทะเบียนปี 2552 ต่ำผิดปกติ (อาจเปลี่ยนวิธีนับ) ปัจจัยการเติบโตของเว็บจึงใช้ 2559 → 2568", "Registered houses in 2009 are unusually low (the counting method may have changed), which is why the site's growth factor uses 2016 → 2025"]
        : null,
    readTh: [
      "ช่วง 2559 → 2568 คือปัจจัย \"การเติบโตของบ้าน\" ที่เว็บใช้คิดคะแนน",
      "% ต่อปีใช้เทียบช่วงที่ยาวไม่เท่ากันได้",
    ],
    readEn: [
      "2016 → 2025 is the \"growth in registered houses\" factor the site scores with",
      "% a year lets you compare spans of different length",
    ],
    notTh: [
      "ห้ามสรุปว่าบ้านที่เพิ่มคืออาคารที่สร้างใหม่ทั้งหมด ทะเบียนนับเลขที่บ้าน ไม่ใช่อาคาร (ห้องชุดแต่ละห้องก็มีเลขที่บ้าน)",
    ],
    notEn: [
      "Do not conclude that every added house is a new building: the register counts house numbers, not buildings (each condominium unit has its own number)",
    ],
    sourceTh: "ทะเบียนราษฎร์รายตำบล กรมการปกครอง ปี 2552, 2559, 2563, 2565, 2568 (D15)",
    sourceEn: "DOPA civil registry per sub-district, 2009, 2016, 2020, 2022, 2025 (D15)",
  },
];

export const YEARS = REG_YEARS;

export interface SourceRow {
  props: TambonProps;
  a: number | null;
  b: number | null;
  diff: number | null;
  /** midpoint of the two ("same") */
  mid: number | null;
  /** % difference against the midpoint ("same"), % change against the first year ("time"); null when the base is too small */
  pct: number | null;
  /** B ÷ A ("definition") */
  ratio: number | null;
  /** compound % a year ("time") */
  perYear: number | null;
}

function metrics(pair: SourcePair, o: SourceOpts, a: number | null, b: number | null): Omit<SourceRow, "props"> {
  const none = { a, b, diff: null, mid: null, pct: null, ratio: null, perYear: null };
  if (a == null || b == null) return none;
  const diff = b - a;
  const min = pair.minBase(o);
  if (pair.kind === "same") {
    const mid = (a + b) / 2;
    return { ...none, diff, mid, pct: mid >= min ? (diff / mid) * 100 : null };
  }
  if (pair.kind === "definition") return { ...none, diff, ratio: a > 0 ? b / a : null };
  const years = o.to - o.from;
  return {
    ...none,
    diff,
    pct: a >= min ? (b / a - 1) * 100 : null,
    perYear: a >= min && years !== 0 && b > 0 ? ((b / a) ** (1 / years) - 1) * 100 : null,
  };
}

export function compareSources(rows: TambonProps[], pair: SourcePair, x: Extra, o: SourceOpts): { rows: SourceRow[]; island: Omit<SourceRow, "props"> } {
  const out = rows.map((p) => ({ props: p, ...metrics(pair, o, pair.a.value(p, x, o), pair.b.value(p, x, o)) }));
  const sum = (k: "a" | "b") => (out.every((r) => r[k] != null) ? out.reduce((s, r) => s + (r[k] as number), 0) : null);
  return { rows: out, island: metrics(pair, { ...o }, sum("a"), sum("b")) };
}

/** building_sources.csv, loaded once when a building topic is opened */
let bldgCache: Promise<Map<string, BuildingRow>> | null = null;

export function loadBuildingSources(): Promise<Map<string, BuildingRow>> {
  bldgCache ??= fetch("data/building_sources.csv")
    .then((r) => {
      if (!r.ok) throw new Error(`building_sources.csv: HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
      const [head, ...lines] = text.replace(/^﻿/, "").trim().split(/\r?\n/);
      const cols = head.split(",");
      const m = new Map<string, BuildingRow>();
      for (const line of lines) {
        const cells = line.split(",");
        const rec = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
        m.set(rec.id, Object.fromEntries(cols.filter((c) => c !== "id" && c !== "tambon_th").map((c) => [c, Number(rec[c])])) as unknown as BuildingRow);
      }
      return m;
    });
  bldgCache.catch(() => (bldgCache = null));
  return bldgCache;
}

export function useBuildingSources(enabled: boolean) {
  const [state, setState] = useState<{ data?: Map<string, BuildingRow>; error?: string }>({});
  useEffect(() => {
    if (!enabled || state.data) return;
    let live = true;
    loadBuildingSources().then(
      (data) => live && setState({ data }),
      (e: unknown) => live && setState({ error: String(e) }),
    );
    return () => {
      live = false;
    };
  }, [enabled, state.data]);
  return state;
}
