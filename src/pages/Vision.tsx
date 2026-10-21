import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { href } from "../router";

interface Census {
  source: string;
  years: number[];
  rows: { amphoe: string; values: number[] }[];
}

const AMPHOE_EN: Record<string, string> = { เมืองภูเก็ต: "Mueang Phuket", กะทู้: "Kathu", ถลาง: "Thalang", รวม: "Whole province" };

type Status = "used" | "ready" | "idea";

export default function Vision() {
  const { t, num } = useI18n();
  const [census, setCensus] = useState<Census>();
  useEffect(() => {
    fetch("data/census_amphoe.json").then((r) => r.json()).then(setCensus, () => undefined);
  }, []);

  const statusLabel: Record<Status, [string, string, string]> = {
    used: ["ใช้แล้วในเว็บนี้", "In use", "var(--ok)"],
    ready: ["มีบริการแล้ว พร้อมต่อยอด", "Service exists, ready to add", "var(--accent)"],
    idea: ["แนวคิด", "Idea", "var(--muted)"],
  };
  const Pill = ({ s }: { s: Status }) => (
    <span className="pill" style={{ color: statusLabel[s][2] }}>{t(statusLabel[s][0], statusLabel[s][1])}</span>
  );

  const gistda: { s: Status; th: string; en: string; dth: string; den: string }[] = [
    { s: "used", th: "รูปแปลงอาคาร GISTDA (2565)", en: "GISTDA building footprints (2022)", dth: "ปัจจัยความหนาแน่นอาคาร 130,403 หลัง", den: "Building-density factor, 130,403 buildings" },
    { s: "used", th: "Sphere: แผนที่ ภาพดาวเทียม ค้นหา ที่อยู่ สถานที่ใกล้เคียง", en: "Sphere: map, imagery, search, address, nearby places", dth: "ใช้แบบสดในหน้าแผนที่", den: "Used live on the map page" },
    { s: "ready", th: "ภาพ THEOS-2 ความละเอียดสูง", en: "High-resolution THEOS-2 imagery", dth: "ตรวจจับอาคารใหม่ทุกปี แล้วใช้แทนข้อมูลอาคารปี 2565 จะได้ปัจจัย \"อัตราการขยายตัวของเมือง\" ที่เป็นปัจจุบัน", den: "Detect new buildings every year to replace the 2022 layer, giving a current \"urban expansion rate\" factor" },
    { s: "ready", th: "ภาพถ่ายดาวเทียม ปี 2515–2568 (GISTDA API Gateway)", en: "Satellite imagery 1972–2025 (GISTDA API Gateway)", dth: "ตัวเลื่อนเวลา ดูภูเก็ตเปลี่ยนไปอย่างไรในรอบ 50 ปี", den: "A time slider showing how Phuket changed over 50 years" },
    { s: "ready", th: "อาคาร 3 มิติ LOD1 ปี 2569 (GISTDA 3D)", en: "LOD1 3D buildings 2026 (GISTDA 3D)", dth: "ความสูงและพื้นที่ใช้สอยของอาคาร วัดการพัฒนาในแนวดิ่ง ไม่ใช่แค่จำนวนหลัง", den: "Building height and floor area: measure vertical development, not just building counts" },
    { s: "ready", th: "Hillshade / GI Basemap (Vallaris)", en: "Hillshade / GI Basemap (Vallaris)", dth: "ความลาดชัน ใช้ตัดพื้นที่ลาดชันที่พัฒนายากออก", den: "Slope, to exclude steep land that is hard to develop" },
    { s: "ready", th: "Sphere Route API", en: "Sphere Route API", dth: "เวลาเดินทางจริงไปสนามบินและตัวเมือง แทนระยะเส้นตรงถึงถนน", den: "Real travel time to the airport and town instead of straight-line distance to a road" },
  ];

  const uses: { th: string; en: string; dth: string; den: string }[] = [
    { th: "ภัยพิบัติ: สึนามิฝั่งตะวันตก", en: "Disaster: west-coast tsunami", dth: "นับอาคารและประชากรในพื้นที่เสี่ยง แล้วหาเส้นทางอพยพด้วย Sphere Route ใช้ข้อมูลชุดเดียวกับเว็บนี้", den: "Count buildings and people in hazard zones and plan evacuation routes with Sphere Route, using the same data" },
    { th: "บริการสาธารณะ", en: "Public services", dth: "หาตำบลที่ประชากรหนาแน่นแต่โรงเรียนหรือโรงพยาบาลน้อย", den: "Find sub-districts with dense population but few schools or hospitals" },
    { th: "การท่องเที่ยว", en: "Tourism", dth: "เทียบจำนวนที่พักกับถนนและสาธารณูปโภค ดูว่าพื้นที่ไหนเกินขีดรองรับ", den: "Compare lodging against roads and utilities to see where capacity is exceeded" },
    { th: "จังหวัดอื่น", en: "Other provinces", dth: "สคริปต์เตรียมข้อมูลเปลี่ยนแค่รหัสจังหวัด ข้อมูลอาคาร GISTDA และราคาประเมินมีครบทุกจังหวัด", den: "The data scripts only need a new province code; GISTDA buildings and appraisal data exist for every province" },
  ];

  const max = census ? Math.max(...census.rows.filter((r) => r.amphoe !== "รวม").flatMap((r) => r.values)) : 1;

  return (
    <div className="page">
      <header style={{ display: "grid", gap: 8 }}>
        <div className="eyebrow">{t("วิสัยทัศน์และการต่อยอด", "Vision & next steps")}</div>
        <h1>{t("จากแผนที่ศักยภาพ สู่เครื่องมือวางแผนเมืองของภูเก็ต", "From a potential map to a planning tool for Phuket")}</h1>
        <p className="lede">
          {t("เว็บนี้คือต้นแบบ หน้านี้อธิบายว่าใครใช้ได้อย่างไร ต่อยอดด้วยข้อมูลของ GISTDA ได้อีกแค่ไหน และนำไปใช้กับเรื่องอื่นได้อย่างไร",
             "This site is a prototype. This page explains who can use it and how, what more GISTDA data can add, and where else the same approach applies.")}
        </p>
      </header>

      {census && (
        <section className="card" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ marginBottom: 0 }}>{t("ทำไมต้องภูเก็ต: ประชากรเพิ่มขึ้น 3 เท่าใน 20 ปี", "Why Phuket: population tripled in 20 years")}</h2>
          <p className="small muted">
            {t(`สำมะโนประชากร ปี ${census.years.join(", ")} ทั้งจังหวัด ${census.rows.find((r) => r.amphoe === "รวม")!.values.map((v) => num(v)).join(" → ")} คน`,
               `Census ${census.years.join(", ")}, whole province: ${census.rows.find((r) => r.amphoe === "รวม")!.values.map((v) => num(v)).join(" → ")} people`)}
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {census.rows.filter((r) => r.amphoe !== "รวม").map((r) => (
              <div key={r.amphoe} style={{ display: "grid", gap: 3 }}>
                <span className="small"><b>{t(`อ.${r.amphoe}`, AMPHOE_EN[r.amphoe])}</b> <span className="muted">{t("เพิ่มขึ้น", "growth")} {num(((r.values[2] / r.values[0]) - 1) * 100)}%</span></span>
                {r.values.map((v, i) => (
                  <div key={i} className="rankbars"><div className="rb">
                    <span className="mono small muted">{census.years[i]}</span>
                    <span className="track"><i style={{ width: `${(v / max) * 100}%`, background: ["#eebd78", "#e08a45", "#c4512e"][i] }} /></span>
                    <span className="num small">{num(v)}</span>
                  </div></div>
                ))}
              </div>
            ))}
          </div>
          <p className="small muted">{t("ที่มา: สำนักงานสถิติแห่งชาติ สำมะโนประชากรและเคหะ (data.go.th) · ข้อมูลระดับอำเภอ", "Source: National Statistical Office census (data.go.th) · district level")}</p>
        </section>
      )}

      <section>
        <h2>{t("ใครใช้ได้อย่างไร", "Who uses it, and how")}</h2>
        <div className="grid3">
          <div className="card"><b>{t("หน่วยงานรัฐ / ผังเมือง", "Government / planners")}</b><p className="small muted" style={{ marginTop: 6 }}>{t("เลือกพื้นที่ส่งเสริมเป็นศูนย์กลางใหม่ จัดลำดับการลงทุนถนนและบริการสาธารณะ และอธิบายเหตุผลด้วยข้อมูลที่ตรวจสอบได้", "Pick areas to promote as new centres, prioritise roads and public services, and justify decisions with checkable data")}</p></div>
          <div className="card"><b>{t("นักลงทุน / เจ้าของกิจการ", "Investors / businesses")}</b><p className="small muted" style={{ marginTop: 6 }}>{t("ใช้หลักเกณฑ์ \"พื้นที่เศรษฐกิจใหม่\" หาทำเลที่เข้าถึงง่ายแต่ราคาที่ดินยังไม่สูง แล้วใช้ภาพดาวเทียม Sphere ดูพื้นที่จริง", "Use the \"Emerging areas\" rule to find accessible places where land is still cheap, then check them on Sphere imagery")}</p></div>
          <div className="card"><b>{t("นักเรียน / ประชาชน", "Students / residents")}</b><p className="small muted" style={{ marginTop: 6 }}>{t("หน้าภารกิจสอนการตัดสินใจจากข้อมูลหลายชั้น และ Stress Test ใช้เป็นกิจกรรมในห้องเรียนหรือนิทรรศการ Roadshow ได้", "The mission teaches multi-layer decisions and stress tests, ready for classrooms or a roadshow exhibition")} <a href={href("mission")}>{t("ไปที่ภารกิจ", "Open mission")}</a></p></div>
        </div>
      </section>

      <section>
        <h2>{t("ต่อยอดด้วยข้อมูลของ GISTDA", "Extending with GISTDA data")}</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>{t("ข้อมูล / บริการ", "Data / service")}</th><th>{t("ใช้ทำอะไร", "What it adds")}</th><th>{t("สถานะ", "Status")}</th></tr></thead>
            <tbody>
              {gistda.map((g) => (
                <tr key={g.en}><td>{t(g.th, g.en)}</td><td>{t(g.dth, g.den)}</td><td><Pill s={g.s} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{t("ใช้วิธีเดียวกันกับเรื่องอื่น", "The same approach, other problems")}</h2>
        <div className="grid4">
          {uses.map((u) => (
            <div className="card" key={u.en}><b>{t(u.th, u.en)}</b><p className="small muted" style={{ marginTop: 6 }}>{t(u.dth, u.den)}</p></div>
          ))}
        </div>
      </section>

      <section className="prose">
        <h2>{t("ข้อมูลที่กำลังรอ", "Data on the way")}</h2>
        <p>• {t("การใช้ที่ดินปี 2568 จากกรมพัฒนาที่ดิน (ยื่นขอแล้ว) จะใช้แทนข้อมูลปี 2563 และเทียบกันได้ว่าพื้นที่เมืองเพิ่มขึ้นตรงไหน", "LDD land use 2025 (requested): replaces the 2020 layer and shows where built-up land grew")}</p>
        <p>• {t("ผังเมืองรวมจังหวัดภูเก็ต (โซนสี) ใช้ตัดพื้นที่ที่กฎหมายไม่ให้พัฒนาออกจากที่ดินที่ยังพัฒนาได้", "Phuket comprehensive plan zoning: removes legally restricted land from the developable-land factor")}</p>
        <p>• {t("ประชากรตามทะเบียนราษฎร์รายตำบล (กรมการปกครอง) ใช้เทียบกับค่าประมาณของ Kontur", "Civil-registry population by sub-district (DOPA), to compare with the Kontur estimate")}</p>
      </section>
    </div>
  );
}
