import { useI18n } from "../i18n";
import { href } from "../router";
import { scoreColor } from "../color";
import type { Scored } from "../types";

export default function Home({ scored }: { scored: Scored[] }) {
  const { t, num } = useI18n();
  const totalBldg = scored.reduce((s, x) => s + x.props.buildings, 0);
  const parcels = scored.reduce((s, x) => s + x.props.land_parcels, 0);
  return (
    <div className="page">
      <header style={{ display: "grid", gap: 14 }}>
        <div className="eyebrow">{t("ด้านการจัดการเมืองและเส้นทางระเบียงเศรษฐกิจ · จังหวัดภูเก็ต", "Urban management & economic corridors · Phuket")}</div>
        <h1>{t("ตำบลไหนในภูเก็ตพร้อมเป็นพื้นที่เศรษฐกิจใหม่", "Which part of Phuket is ready to become a new economic area")}</h1>
        <p className="lede">
          {t("รวมข้อมูลอาคารจาก GISTDA, ประชากร, ถนน, สถานที่บริการ และราคาประเมินที่ดินไว้ในแผนที่เดียว ให้หน่วยงานรัฐใช้วางผังเมือง และให้นักลงทุนกับประชาชนใช้เทียบศักยภาพของแต่ละตำบล",
             "Building data from GISTDA, population, roads, services and land appraisal values in one map: for government planners, and for investors and residents comparing the potential of each sub-district.")}
        </p>
        <div className="row">
          <a className="btn" href={href("map")}>{t("เปิดแผนที่วิเคราะห์", "Open the analysis map")}</a>
          <a className="btn ghost" href={href("mission")}>{t("เริ่มภารกิจ", "Start the mission")}</a>
        </div>
      </header>

      <section className="grid4">
        <div className="card stat"><b>{num(totalBldg)}</b><span>{t("อาคาร (GISTDA)", "buildings (GISTDA)")}</span></div>
        <div className="card stat"><b>17</b><span>{t("ตำบลที่วิเคราะห์", "sub-districts analysed")}</span></div>
        <div className="card stat"><b>{num(parcels)}</b><span>{t("แปลงที่ดินที่ใช้คิดราคา", "land parcels priced")}</span></div>
        <div className="card stat"><b>5</b><span>{t("ปัจจัยที่ปรับน้ำหนักได้", "adjustable factors")}</span></div>
      </section>

      <section>
        <h2>{t("ทำงานอย่างไร", "How it works")}</h2>
        <div className="steps">
          <div className="card"><b>{t("รวมข้อมูลหลายชั้น", "Combine data layers")}</b><p className="small muted">{t("อาคาร GISTDA, ประชากร Kontur, ถนนและสถานที่ OpenStreetMap, ราคาประเมินกรมธนารักษ์ สรุปเป็นรายตำบล", "GISTDA buildings, Kontur population, OpenStreetMap roads and places, Treasury land values, summarised per sub-district")}</p></div>
          <div className="card"><b>{t("ตั้งหลักเกณฑ์", "Set a decision rule")}</b><p className="small muted">{t("เลือกว่าปัจจัยไหนสำคัญแค่ไหน และมากหรือน้อยถึงจะดี", "Choose how much each factor matters and whether more or less is better")}</p></div>
          <div className="card"><b>{t("ได้คะแนนและอันดับ", "Get scores and ranks")}</b><p className="small muted">{t("คะแนน 0–100 ของแต่ละตำบล ทดสอบซ้ำได้เมื่อสถานการณ์เปลี่ยน", "A 0–100 score per sub-district that you can re-test when conditions change")}</p></div>
        </div>
      </section>

      <section>
        <h2>{t("อันดับตามหลักเกณฑ์เริ่มต้น", "Ranking under the default rule")}</h2>
        <div className="card rankbars">
          {scored.slice(0, 5).map((s) => (
            <a key={s.props.id} className="rb" href={href("map", s.props.id)} style={{ color: "inherit", textDecoration: "none" }}>
              <span>{s.rank}. {t(s.props.tambon_th, s.props.tambon_en)}</span>
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
