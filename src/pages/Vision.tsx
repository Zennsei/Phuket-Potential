import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { href } from "../router";

interface Census {
  source: string;
  years: number[];
  rows: { amphoe: string; values: number[] }[];
}

const AMPHOE_EN: Record<string, string> = { เมืองภูเก็ต: "Mueang Phuket", กะทู้: "Kathu", ถลาง: "Thalang", รวม: "Whole province" };

type Status = "used" | "built" | "ready" | "none";

export default function Vision() {
  const { t, num } = useI18n();
  const [census, setCensus] = useState<Census>();
  useEffect(() => {
    fetch("data/census_amphoe.json").then((r) => r.json()).then(setCensus, () => undefined);
  }, []);

  const statusLabel: Record<Status, [string, string, string]> = {
    used: ["ใช้แล้วในเว็บนี้", "In use", "var(--ok)"],
    built: ["ทำแล้ว รออนุญาตเผยแพร่", "Built, awaiting permission", "var(--warn)"],
    ready: ["มีบริการแล้ว พร้อมต่อยอด", "Service exists, ready to add", "var(--sea)"],
    none: ["ไม่มีข้อมูลภูเก็ต", "No Phuket data", "var(--muted)"],
  };
  const Pill = ({ s }: { s: Status }) => (
    <span className="pill wrap" style={{ color: statusLabel[s][2] }}>{t(statusLabel[s][0], statusLabel[s][1])}</span>
  );

  const gistda: { s: Status; th: string; en: string; dth: string; den: string }[] = [
    { s: "used", th: "รูปแปลงอาคาร GISTDA (2565)", en: "GISTDA building footprints (2022)", dth: "ปัจจัยความหนาแน่นอาคาร 130,403 หลัง", den: "Building-density factor, 130,403 buildings" },
    { s: "used", th: "อาคารพร้อมความสูง GISTDA 2567 (API Gateway)", en: "GISTDA buildings with height, 2024 (API Gateway)", dth: "ตัวเลือก \"พื้นที่ใช้สอยต่อพื้นที่ดิน\" ของปัจจัยอาคาร และชั้นอาคาร 3 มิติช่อง 500 ม. วัดการพัฒนาในแนวดิ่ง ไม่ใช่แค่จำนวนหลัง (239,992 หลัง)", den: "The \"floor area per land area\" option of the building factor and the 500 m 3D layer: measure vertical growth, not just building counts (239,992 buildings)" },
    { s: "used", th: "Sphere: แผนที่ ภาพดาวเทียม ค้นหา ที่อยู่ สถานที่ใกล้เคียง", en: "Sphere: map, imagery, search, address, nearby places", dth: "ใช้แบบสดในหน้าแผนที่", den: "Used live on the map page" },
    { s: "built", th: "ภาพถ่ายดาวเทียม ปี 2515–2568 (GISTDA API Gateway)", en: "Satellite imagery 1972–2025 (GISTDA API Gateway)", dth: "ตัวเลื่อนปีและเทียบ 2 ปีแบบเลื่อนเส้นแบ่ง ดูภูเก็ตเปลี่ยนไปอย่างไรในรอบ 50 ปี ใช้ภายในทีมไปก่อน ทดสอบแล้วได้ภาพภูเก็ตครบ 45 ชั้น ภาพรายปีตั้งแต่ปี 2533 ชัดและแทบไม่มีเมฆ", den: "A year slider and a two-year swipe comparison showing how Phuket changed over 50 years, team-only for now. All 45 layers cover Phuket; the yearly images from 1990 on are clear with little cloud" },
    { s: "built", th: "อาคาร 3 มิติรายหลัง (GISTDA API Gateway)", en: "3D buildings one by one (GISTDA API Gateway)", dth: "แสดงความสูงรายหลังเมื่อซูมใกล้ พร้อมเส้นขอบอาคาร Overture ซ้อนเทียบตำแหน่ง (90% ของอาคารมีอาคาร Overture ห่างไม่เกิน 10 ม.)", den: "Each building's height when zoomed in, with Overture outlines on top to check positions (90 % have an Overture building within 10 m)" },
    { s: "built", th: "GI Basemap (GISTDA API Gateway)", en: "GI Basemap (GISTDA API Gateway)", dth: "ภาพดาวเทียมพื้นหลังอีกชุด สลับเทียบกับ Sphere ได้ คมชัดตั้งแต่ซูม 13", den: "Another satellite base map to compare with Sphere, sharp from zoom 13" },
    { s: "built", th: "พื้นที่เปลี่ยนแปลงรายปี (Landtrendr, GISTDA API Gateway)", en: "Year of land change (Landtrendr, GISTDA API Gateway)", dth: "สีบอกปีที่พื้นที่เปลี่ยน ช่วยหาบริเวณที่เมืองขยายโดยไม่ต้องรอการใช้ที่ดินปีอื่น ใส่ในแผนที่แล้ว GISTDA ไม่มีคำอธิบายสี ทีมจึงเทียบสีกับภาพรายปีเองจนได้ช่วงปีโดยประมาณ", den: "Colours show the year the land changed, to find where the town spread without waiting for more land-use years. On the map now; GISTDA gives no colour key, so the team matched the colours with the yearly pictures to get approximate years" },
    { s: "ready", th: "ภาพ THEOS-2 ความละเอียดสูง", en: "High-resolution THEOS-2 imagery", dth: "ตรวจจับอาคารใหม่ทุกปี แล้วใช้แทนข้อมูลอาคารปี 2565 จะได้ปัจจัย \"อัตราการขยายตัวของเมือง\" ที่เป็นปัจจุบัน (ต้องขอหรือซื้อภาพภูเก็ตจาก GISTDA)", den: "Detect new buildings every year to replace the 2022 layer, giving a current \"urban expansion rate\" factor (Phuket images must be requested or bought from GISTDA)" },
    { s: "ready", th: "Sphere Route API", en: "Sphere Route API", dth: "เวลาเดินทางจริงไปสนามบินและตัวเมือง แทนระยะเส้นตรงถึงถนน", den: "Real travel time to the airport and town instead of straight-line distance to a road" },
    { s: "none", th: "พื้นที่น้ำท่วมซ้ำซาก (GISTDA)", en: "Recurrent flood areas (GISTDA)", dth: "ทดสอบ 33 จุดทั่วเกาะ บริการตอบว่าไม่พบข้อมูล จึงยังใช้เป็นปัจจัยความเสี่ยงไม่ได้", den: "33 points tested across the island and the service found no records, so it cannot be a risk factor yet" },
    { s: "none", th: "ภาพ PLEIADES และเกาะความร้อน (UHI)", en: "PLEIADES imagery and urban heat islands (UHI)", dth: "PLEIADES มี 21 ชุดแต่ไม่มีชุดไหนครอบคลุมภูเก็ต · UHI ไม่มีข้อมูลที่ภูเก็ต", den: "21 PLEIADES collections, none over Phuket · no UHI data for Phuket" },
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
          <p className="small muted">{t("ที่มา: สำนักงานสถิติแห่งชาติ สำมะโนประชากรและเคหะ (data.go.th) ข้อมูลระดับอำเภอ", "Source: National Statistical Office census (data.go.th), district level")}</p>
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
        <p className="small muted" style={{ marginTop: 8 }}>
          {t("ทีมทดสอบบริการของ GISTDA API Gateway 3 รอบ (23–24 ต.ค. 2569 รวมประมาณ 120 คำขอ) ว่าบริการไหนมีข้อมูลภูเก็ต รายละเอียดอยู่ในหน้า",
             "The team tested GISTDA API Gateway services in 3 rounds (23–24 Oct 2026, about 120 requests) to see which have Phuket data. Details are on the")}{" "}
          <a href={href("method")}>{t("วิธีคิดและแหล่งข้อมูล", "Method & data page")}</a>
        </p>
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
        <h2>{t("ข้อมูลและสิทธิ์ที่กำลังรอ", "Data and permissions on the way")}</h2>
        <p>• {t("การใช้ที่ดินปี 2552 และ 2559 จากกรมพัฒนาที่ดิน (ยื่นขอแล้ว) เทียบกับปี 2563 ดูว่าพื้นที่เมืองขยายตรงไหนในรอบ 10 ปี", "LDD land use 2009 and 2016 (requested): compared with 2020 to show where built-up land spread over 10 years")}</p>
        <p>• {t("ผังเมืองรวมจังหวัดภูเก็ต (โซนสี) ใช้ตัดพื้นที่ที่กฎหมายไม่ให้พัฒนาออกจากที่ดินที่ยังพัฒนาได้", "Phuket comprehensive plan zoning: removes legally restricted land from the developable-land factor")}</p>
        <p>• {t("สิทธิ์เผยแพร่ภาพดาวเทียมรายปี GI Basemap และอาคาร 3 มิติรายหลังจาก GISTDA API Gateway บนเว็บสาธารณะ (ภาพระบุ \"Copyrighted by GISTDA, Fees: Yes\")", "Permission to show GISTDA API Gateway yearly imagery, GI Basemap and per-building 3D on the public site (the images say \"Copyrighted by GISTDA, Fees: Yes\")")}</p>
        <p>• {t("วิธีเข้าถึงภาพ THEOS-1 (ลิงก์ภาพชี้ไปอีกระบบที่ key ของทีมใช้ไม่ได้) และภาพ THEOS-2 ของภูเก็ต", "Access to THEOS-1 images (their links point to another system our key cannot use) and THEOS-2 images of Phuket")}</p>
      </section>
    </div>
  );
}
