import SheetMap from "../components/SheetMap";
import { RAMP, scoreColor } from "../color";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { AppData } from "../data";
import type { Scored } from "../types";

export default function Home({ scored, data }: { scored: Scored[]; data: AppData }) {
  const { t, num } = useI18n();
  const totalBldg = scored.reduce((s, x) => s + x.props.buildings, 0);
  const services = scored.reduce((s, x) => s + x.props.services, 0);
  const legend = [
    { c: "#c4512e", v: num(totalBldg), th: "อาคาร จากรูปแปลงอาคารของ GISTDA ปี 2565", en: "buildings, from GISTDA building footprints (2022)" },
    { c: "#2b8a80", v: "668", th: "ช่องหกเหลี่ยมประชากร Kontur ปี 2566", en: "population hexagons, Kontur (2023)" },
    { c: "#7a5aa6", v: num(services), th: "สถานที่บริการ (โรงเรียน สถานพยาบาล ตลาด ร้านค้า ธนาคาร ฯลฯ) OpenStreetMap", en: "service places (schools, health, markets, shops, banks…), OpenStreetMap" },
    { c: "#e9dc8f", v: "2563", th: "ปีของแผนที่การใช้ที่ดิน กรมพัฒนาที่ดิน", en: "year of the LDD land-use map" },
    { c: "#c4511c", v: "1,314", th: "ช่วงถนนสายหลักและสายรอง (primary, secondary, tertiary) OpenStreetMap ต.ค. 2569", en: "primary, secondary and tertiary road segments, OpenStreetMap (Oct 2026)" },
    { c: RAMP[3], v: "17", th: "ตำบล คิดคะแนนจาก 6 ปัจจัยที่ปรับน้ำหนักได้", en: "sub-districts scored on 6 adjustable factors" },
  ];
  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">Geo-Smart location analysis</div>
          <h1>{t("ภูเก็ตจะเติบโตไปทางไหนต่อ", "Where will Phuket grow next?")}</h1>
          <p className="lede">
            {t("แผนที่นี้รวมอาคารจาก GISTDA ประชากร ถนน สถานที่บริการ และการใช้ที่ดินไว้ในแผ่นเดียว ให้ผังเมืองใช้เลือกพื้นที่ส่งเสริม และให้นักลงทุนกับประชาชนเทียบศักยภาพของ 17 ตำบลด้วยหลักเกณฑ์ของตัวเอง ดูได้ทั้งระดับจังหวัด อำเภอ และตำบล",
               "This map puts GISTDA buildings, population, roads, services and land use on one sheet, so planners can choose areas to promote and investors and residents can compare Phuket's 17 sub-districts by their own rules, by province, district or sub-district.")}
          </p>
          <div className="row">
            <a className="btn" href={href("map")}>{t("เปิดแผนที่วิเคราะห์", "Open the analysis map")}</a>
            <a className="btn ghost" href={href("mission")}>{t("เริ่มภารกิจ", "Start the mission")}</a>
          </div>
        </div>
        <SheetMap tambons={data.tambons} scored={scored} />
      </section>

      <section>
        <h2>{t("ข้อมูลในแผ่นนี้", "What is on this sheet")}</h2>
        <div className="legendlist">
          {legend.map((l) => (
            <div key={l.en}>
              <i style={{ background: l.c }} />
              <span><b>{l.v}</b> {t(l.th, l.en)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>{t("อ่านแผนที่นี้อย่างไร", "How to read this map")}</h2>
        <div className="steps">
          <div className="card"><b>{t("ดูหลักฐานทีละชั้น", "Look at the evidence, layer by layer")}</b><p className="small muted">{t("เปิดชั้นอาคาร ประชากร ถนน หรือการใช้ที่ดิน แล้วคลิกจุดใดก็ได้เพื่อดูค่าของจุดนั้น", "Turn on buildings, population, roads or land use and click anywhere to read the values there")}</p></div>
          <div className="card"><b>{t("ตั้งหลักเกณฑ์ของคุณ", "Set your own rule")}</b><p className="small muted">{t("เลือกว่าปัจจัยไหนสำคัญแค่ไหน และมากหรือน้อยถึงจะดี", "Decide how much each factor matters and whether more or less is better")}</p></div>
          <div className="card"><b>{t("ดูว่าอันดับเปลี่ยนอย่างไร", "See how the ranking moves")}</b><p className="small muted">{t("สีของแผนที่และอันดับเปลี่ยนทันที ลอง Stress Test ในหน้าภารกิจได้", "Colours and ranks update at once; try the stress test in the mission")}</p></div>
        </div>
      </section>

      <section>
        <h2>{t("5 อันดับแรก เมื่อทุกปัจจัยหลักมีน้ำหนักเท่ากัน", "Top 5 with equal weights on the core factors")}</h2>
        <div className="rankbars">
          {scored.slice(0, 5).map((s) => (
            <a key={s.props.id} className="rb" href={href("map", s.props.id)} style={{ color: "inherit", textDecoration: "none" }}>
              <span>{t(s.props.tambon_th, s.props.tambon_en)}</span>
              <span className="track"><i style={{ width: `${s.score}%`, background: scoreColor(s.score) }} /></span>
              <span className="num">{num(s.score, 1)}</span>
            </a>
          ))}
          <a href={href("ranking")} className="small">{t("ดูทั้ง 17 ตำบล", "See all 17")}</a>
        </div>
      </section>
    </div>
  );
}
