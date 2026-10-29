import type { TambonProps, Weights } from "./types";

/** A stress test: change the rule (weights) and/or the data (rows), then score again. */
export interface Scenario {
  id: string;
  th: string;
  en: string;
  descTh: string;
  descEn: string;
  apply: (w: Weights) => Weights;
  rows?: (p: TambonProps) => TambonProps;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "no-road", th: "ถนนสายหลักถูกตัด", en: "Main road cut off",
    descTh: "น้ำท่วมหรือดินสไลด์ทำให้ใช้ถนนไม่ได้ ปัจจัยความหนาแน่นถนนถูกปิด",
    descEn: "A flood or landslide makes the roads unreliable, so the road density factor is switched off",
    apply: (w) => ({ ...w, road: { ...w.road, direction: 0 } }),
  },
  {
    id: "decentralise", th: "นโยบายลดความแออัด", en: "Decongestion policy",
    descTh: "จังหวัดไม่ส่งเสริมพื้นที่ที่อาคารหนาแน่นอยู่แล้ว ความหนาแน่นอาคารยิ่งน้อยยิ่งได้คะแนน",
    descEn: "The province stops promoting already dense areas: lower building density now scores higher",
    apply: (w) => ({ ...w, buildings: { weight: w.buildings.weight || 20, direction: -1 } }),
  },
  {
    id: "slope-ok", th: "นับที่ลาดชันเป็นที่พัฒนาได้", en: "Count steep land as developable",
    descTh: "ถ้าไม่สนความชันและความสูง (เช่น เทคโนโลยีก่อสร้างหรือกฎหมายเปลี่ยน) ที่ดินเกษตรบนเขาจะนับเป็นที่พัฒนาได้ทั้งหมด",
    descEn: "If slope and height are ignored (for example new building methods or rules), farmland on hills counts as developable too",
    apply: (w) => ({ ...w, developable: { ...w.developable, landBasis: "all" } }),
  },
  {
    id: "registry-pop", th: "ใช้ประชากรตามทะเบียนแทนแบบจำลอง", en: "Registered population instead of the model",
    descTh: "เปลี่ยนแหล่งข้อมูลประชากรจาก Kontur (รวมประชากรแฝง) เป็นทะเบียนราษฎร์ปี 2568 ดูว่าคำตอบขึ้นกับแหล่งข้อมูลแค่ไหน",
    descEn: "Swap the population source from Kontur (includes unregistered residents) to the 2025 civil registry, to see how much the answer depends on the data source",
    apply: (w) => w,
    rows: (p) => ({ ...p, pop_per_km2: p.reg_pop_per_km2 }),
  },
];

export const applyScenarioRows = (rows: TambonProps[], sc: Scenario) => (sc.rows ? rows.map(sc.rows) : rows);
