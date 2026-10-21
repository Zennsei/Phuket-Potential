import { FACTORS } from "../factors";
import { useI18n } from "../i18n";
import type { AppData } from "../data";

export default function Method({ data }: { data: AppData }) {
  const { t } = useI18n();
  const n = data.sources.notes;
  const rows = [
    { th: "รูปแปลงอาคาร", en: "Building footprints", src: "GISTDA", date: t("มิ.ย. 2565", "Jun 2022"), use: t("จำนวนอาคารต่อ ตร.กม. และพื้นที่หลังคา", "Buildings per km² and roof area"), note: n.buildings, gistda: true },
    { th: "แผนที่พื้นหลังและภาพดาวเทียม", en: "Base map & satellite imagery", src: "GISTDA Sphere", date: t("ออนไลน์", "live"), use: t("แผนที่ถนนและภาพดาวเทียม (ชั้น sphere_streets, thailand_images) ในหน้าแผนที่", "Street map and satellite imagery (sphere_streets, thailand_images layers) on the map page"), note: "https://sphere.gistda.or.th/", gistda: true },
    { th: "ค้นหาสถานที่ ที่อยู่ และสถานที่ใกล้เคียง", en: "Place search, address & nearby places", src: "GISTDA Sphere API", date: t("ออนไลน์", "live"), use: t("ค้นหาสถานที่ และดูที่อยู่กับสถานที่รอบจุดที่คลิก (เรียกเมื่อผู้ใช้กดเท่านั้น)", "Search places, and look up the address and places around a clicked point (only when the user asks)"), note: "api.sphere.gistda.or.th/services/search · /poi · /geo/address", gistda: true },
    { th: "ขอบเขตตำบล", en: "Sub-district boundaries", src: "THA_Tambon", date: t("ไม่ทราบปีข้อมูล (ไฟล์สร้าง มิ.ย. 2566)", "unknown (file created Jun 2023)"), use: t("หน่วยที่ใช้สรุปผล 17 ตำบล", "The 17 units of analysis"), note: n.boundaries },
    { th: "ประชากร", en: "Population", src: "Kontur Population", date: t("พ.ย. 2566", "Nov 2023"), use: t("คนต่อ ตร.กม.", "People per km²"), note: n.population },
    { th: "ถนนและสถานที่บริการ", en: "Roads & services", src: "OpenStreetMap (Geofabrik)", date: t("20 ต.ค. 2569", "20 Oct 2026"), use: t("ระยะถึงถนนสายหลัก และจำนวนสถานที่บริการต่อ ตร.กม.", "Distance to main roads, services per km²"), note: n.roads_pois },
    { th: "การใช้ที่ดิน", en: "Land use", src: t("กรมพัฒนาที่ดิน (LDD)", "Land Development Dept. (LDD)"), date: "2563 (2020)", use: t("สัดส่วนพื้นที่เมือง เกษตร ป่า และที่ดินที่ยังพัฒนาได้ ต่อตำบล + ชั้นข้อมูลบนแผนที่", "Share of built-up, farm, forest and developable land per sub-district + a map layer"), note: "LU_PKT_2563 · lddcatalog.ldd.go.th" },
    { th: "สำมะโนประชากร", en: "Population census", src: t("สำนักงานสถิติแห่งชาติ (data.go.th)", "National Statistical Office (data.go.th)"), date: "2533, 2543, 2553", use: t("บริบทการเติบโตของประชากรรายอำเภอในหน้าวิสัยทัศน์", "District population growth on the vision page"), note: "data.go.th/dataset/0703_01_14" },
    { th: "ราคาประเมินที่ดิน", en: "Land appraisal", src: t("กรมธนารักษ์ (data.go.th)", "Treasury Dept. (data.go.th)"), date: t("รอบบัญชี 2566–2569", "2023–2026 round"), use: t("ค่ากลางราคาบาท/ตร.ว. ต่อตำบล", "Median THB/sq.wah per sub-district"), note: n.land_value },
  ];
  return (
    <div className="page">
      <header style={{ display: "grid", gap: 8 }}>
        <div className="eyebrow">{t("วิธีคิดและแหล่งข้อมูล", "Method & data")}</div>
        <h1>{t("คะแนนศักยภาพคิดอย่างไร", "How the potential score works")}</h1>
      </header>

      <section className="prose">
        <h2>{t("สูตร", "Formula")}</h2>
        <p>{t("1. สรุปแต่ละปัจจัยเป็นค่ารายตำบล เช่น จำนวนอาคารต่อ ตร.กม.", "1. Summarise each factor per sub-district, e.g. buildings per km².")}</p>
        <p>{t("2. แปลงเป็นคะแนน 0–100 แบบ Min-Max เทียบกันใน 17 ตำบล: คะแนน = (ค่า − ค่าต่ำสุด) ÷ (ค่าสูงสุด − ค่าต่ำสุด) × 100 ส่วนระยะถึงถนนใช้แบบกลับด้าน (ใกล้ = คะแนนสูง)",
               "2. Convert to a 0–100 score with min-max scaling across the 17 sub-districts: score = (value − min) ÷ (max − min) × 100. Road distance is reversed (nearer = higher).")}</p>
        <p>{t("3. คะแนนรวม = ค่าเฉลี่ยถ่วงน้ำหนักของคะแนนปัจจัย ผู้ใช้ปรับน้ำหนักได้ และกลับด้านปัจจัยได้ เช่น ให้ราคาที่ดินต่ำได้คะแนนสูงเมื่อหาพื้นที่เกิดใหม่",
               "3. Total = weighted average of the factor scores. Users set the weights and can reverse a factor, e.g. give cheaper land a higher score when looking for emerging areas.")}</p>
        <pre className="card mono small" style={{ whiteSpace: "pre-wrap" }}>
          {"score = Σ ( wᵢ × sᵢ ) ÷ Σ wᵢ      sᵢ = 100 × (xᵢ − min) ÷ (max − min)"}
        </pre>
      </section>

      <section>
        <h2>{t("ปัจจัยทั้ง 5", "The five factors")}</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>{t("ปัจจัย", "Factor")}</th><th>{t("หน่วย", "Unit")}</th><th>{t("ทิศทางเริ่มต้น", "Default direction")}</th><th>{t("แหล่ง", "Source")}</th></tr></thead>
            <tbody>
              {FACTORS.map((f) => (
                <tr key={f.key}>
                  <td>{t(f.th, f.en)}</td>
                  <td>{t(f.unitTh, f.unitEn)}</td>
                  <td>{f.higherIsBetter ? t("มาก = ดี", "higher = better") : t("ใกล้ = ดี", "nearer = better")}</td>
                  <td>{t(f.sourceTh, f.sourceEn)} {f.gistda && <span className="pill gistda">GISTDA</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{t("แหล่งข้อมูล", "Data sources")}</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>{t("ข้อมูล", "Data")}</th><th>{t("แหล่ง", "Source")}</th><th>{t("ข้อมูล ณ", "As of")}</th><th>{t("ใช้ทำอะไร", "Used for")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.en}>
                  <td>{t(r.th, r.en)}<div className="small muted">{r.note}</div></td>
                  <td>{r.src} {r.gistda && <span className="pill gistda">GISTDA</span>}</td>
                  <td>{r.date}</td>
                  <td>{r.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="prose">
        <h2>{t("ข้อจำกัดที่ควรรู้", "Limitations")}</h2>
        <p>• {t("คะแนนเป็นค่าเทียบกันภายในภูเก็ตเท่านั้น ไม่ใช่ค่ามาตรฐานระดับประเทศ", "Scores are relative within Phuket only, not a national standard.")}</p>
        <p>• {t("ประชากรของ Kontur เป็นค่าประมาณจากแบบจำลอง (รวมประชากรแฝง) จึงสูงกว่าตัวเลขทะเบียนราษฎร์ ส่วนต่างปี 2565 กับ 2566 มาจากการปรับแบบจำลองด้วย จึงไม่ควรใช้เป็นอัตราการเติบโต",
               "Kontur population is a modelled estimate (including unregistered residents), so it is higher than the civil registry. The 2022–2023 difference partly reflects model changes and should not be read as growth.")}</p>
        <p>• {t("ไฟล์ราคาประเมินไม่มีพิกัดรายแปลง ระบบจึงหาตำแหน่งจากเลขระวาง UTM (ความละเอียด 250 ม.–2 กม.) แปลงที่ใช้ระวางมาตราส่วน 1:5000 (ประมาณ 8%) แปลงเป็นตำแหน่งไม่ได้จึงไม่ได้นับ",
               "The appraisal file has no parcel coordinates, so parcels are located by their UTM map-sheet number (250 m–2 km precision). Parcels on 1:5000 sheets (about 8%) cannot be located and are excluded.")}</p>
        <p>• {t("ข้อมูลอาคารเป็นของปี 2565 อาคารที่สร้างหลังจากนั้นยังไม่ถูกนับ ภาพจากดาวเทียม THEOS-2 ใช้ปรับปรุงชั้นข้อมูลนี้ได้ในอนาคต",
               "Building data dates from 2022, so newer buildings are missing. THEOS-2 imagery could be used to update this layer in future.")}</p>
        <p>• {t("ถนนและสถานที่จาก OpenStreetMap มาจากอาสาสมัคร บางพื้นที่อาจไม่ครบ", "OpenStreetMap roads and places are volunteer-mapped and may be incomplete in places.")}</p>
      </section>
    </div>
  );
}
