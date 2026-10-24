import { FACTORS } from "../factors";
import { CATEGORIES, DEFAULT_THRESHOLDS, UNREG_FLAG } from "../decision";
import { SCENARIOS } from "../scenarios";
import { useI18n } from "../i18n";
import { GISTDA_IMAGERY } from "../gistda";
import type { AppData } from "../data";

const DATA_MD = "https://github.com/Zennsei/Phuket-Potential/blob/main/DATA.md";

interface StatusItem { th: string; en: string }
const status: { th: string; en: string; items: StatusItem[] }[] = [
  {
    th: "ใช้ในเว็บแล้ว", en: "In use",
    items: [
      { th: "อาคาร GISTDA 2565", en: "GISTDA buildings 2022" },
      { th: "การใช้ที่ดิน LDD 2563", en: "LDD land use 2020" },
      { th: "แผนที่ ภาพดาวเทียม และการค้นหา GISTDA Sphere (ออนไลน์)", en: "GISTDA Sphere maps, imagery and search (live)" },
      { th: "ราคาประเมินที่ดิน รอบ 2566–2569", en: "Land appraisal 2023–2026 round" },
      { th: "ประชากร Kontur 2566", en: "Kontur population 2023" },
      { th: "ถนนและสถานที่ OpenStreetMap 2569", en: "OpenStreetMap roads and places 2026" },
      { th: "สำมะโนประชากร 2533, 2543, 2553", en: "Census 1990, 2000, 2010" },
      { th: "ขอบเขต 17 ตำบล", en: "17 sub-district boundaries" },
      { th: "ประชากรและบ้านตามทะเบียนราษฎร์รายตำบล 2559, 2565, 2568", en: "Registered population and houses by sub-district 2016, 2022, 2025" },
      { th: "อาคารพร้อมความสูง GISTDA 2567 (239,992 หลัง)", en: "GISTDA buildings with height 2024 (239,992)" },
    ],
  },
  {
    th: "กำลังรอ", en: "On the way",
    items: [
      { th: "การใช้ที่ดินปี 2552 และ 2559 จากกรมพัฒนาที่ดิน (ยื่นขอ 22 ต.ค. 2569)", en: "LDD land use 2009 and 2016 (requested 22 Oct 2026)" },
      { th: "ผังเมืองรวมจังหวัดภูเก็ต (โซนสี) แบบแผนที่ (ขอไฟล์จากกรมโยธาฯ หรือวาดตามแผนที่ประกาศ)", en: "Phuket comprehensive plan zones as a map (requesting the file or tracing the official map)" },
    ],
  },
  {
    th: "ได้แล้ว ยังไม่ใส่ในเว็บ", en: "Received, not yet used",
    items: [
      { th: "อาคาร Overture 2569 ใช้ตรวจความครบของข้อมูลอาคาร", en: "Overture buildings 2026, to check building-data coverage" },
      { th: "ประชากรและจำนวนบ้านตามทะเบียนรายอำเภอ 2558–2562", en: "Registered population and houses by district 2015–2019" },
      { th: "วันที่ประกาศผังเมืองรวม (ภูเก็ต: 2554, แก้ไข 2556)", en: "Comprehensive-plan announcement dates (Phuket: 2011, amended 2013)" },
    ],
  },
];

export default function Method({ data }: { data: AppData }) {
  const { t } = useI18n();
  const n = data.sources.notes;
  // GISTDA API Gateway pictures are listed only where the menu that shows them is switched on (see src/gistda.ts)
  const imageryRow = { th: "ภาพถ่ายดาวเทียมรายปี, GI Basemap และอาคาร 3 มิติรายหลัง", en: "Yearly satellite imagery, GI Basemap & 3D buildings", src: "GISTDA API Gateway", date: t("2515–2568 (45 ชั้น รวมภาพ 2 ม. ปี 2563–64 และ 2567)", "1972–2025 (45 layers, incl. 2 m mosaics 2020–21 and 2024)"), use: t("แผนที่พื้นหลัง ตัวเลื่อนปี เทียบ 2 ปี และอาคาร 3 มิติรายหลังเมื่อซูมใกล้ (ดูเท่านั้น ไม่ใช้คำนวณคะแนน)", "Base map, year slider, two-year comparison and per-building 3D when zoomed in (viewing only, not used in scores)"), note: t("Copyrighted by GISTDA, Fees: Yes · ใช้ประเมินภายในทีม ยังไม่ได้รับอนุญาตให้เผยแพร่ · /gfms/service/ (WMS), /tiles/basemap_latest/, features/thailand-buildings-footprint (ความสูงจากแบบจำลอง)", "Copyrighted by GISTDA, Fees: Yes · team evaluation only, not yet cleared for publishing · /gfms/service/ (WMS), /tiles/basemap_latest/, features/thailand-buildings-footprint (modelled heights)"), gistda: true };
  const baseRows = [
    { th: "รูปแปลงอาคาร", en: "Building footprints", src: "GISTDA", date: t("มิ.ย. 2565", "Jun 2022"), use: t("จำนวนอาคารต่อ ตร.กม. และพื้นที่หลังคา", "Buildings per km² and roof area"), note: n.buildings, gistda: true },
    { th: "แผนที่พื้นหลังและภาพดาวเทียม", en: "Base map & satellite imagery", src: "GISTDA Sphere", date: t("ออนไลน์", "live"), use: t("แผนที่ถนนและภาพดาวเทียม (ชั้น sphere_streets, thailand_images) ในหน้าแผนที่", "Street map and satellite imagery (sphere_streets, thailand_images layers) on the map page"), note: "https://sphere.gistda.or.th/", gistda: true },
    { th: "ค้นหาสถานที่ ที่อยู่ และสถานที่ใกล้เคียง", en: "Place search, address & nearby places", src: "GISTDA Sphere API", date: t("ออนไลน์", "live"), use: t("ค้นหาสถานที่ และดูที่อยู่กับสถานที่รอบจุดที่คลิก (เรียกเมื่อผู้ใช้กดเท่านั้น)", "Search places, and look up the address and places around a clicked point (only when the user asks)"), note: "api.sphere.gistda.or.th/services/search, /poi, /geo/address", gistda: true },
    { th: "ขอบเขตตำบล", en: "Sub-district boundaries", src: "THA_Tambon", date: t("ไม่ทราบปีข้อมูล (ไฟล์สร้าง มิ.ย. 2566)", "unknown (file created Jun 2023)"), use: t("หน่วยที่ใช้สรุปผล 17 ตำบล", "The 17 units of analysis"), note: n.boundaries },
    { th: "ประชากร", en: "Population", src: "Kontur Population", date: t("พ.ย. 2566", "Nov 2023"), use: t("คนต่อ ตร.กม.", "People per km²"), note: n.population },
    { th: "ถนนและสถานที่บริการ", en: "Roads & services", src: "OpenStreetMap (Geofabrik)", date: t("20 ต.ค. 2569", "20 Oct 2026"), use: t("ระยะถึงถนนสายหลัก และจำนวนสถานที่บริการต่อ ตร.กม.", "Distance to main roads, services per km²"), note: n.roads_pois },
    { th: "การใช้ที่ดิน", en: "Land use", src: t("กรมพัฒนาที่ดิน (LDD)", "Land Development Dept. (LDD)"), date: "2563 (2020)", use: t("สัดส่วนพื้นที่เมือง เกษตร ป่า และที่ดินที่ยังพัฒนาได้ ต่อตำบล + ชั้นข้อมูลบนแผนที่", "Share of built-up, farm, forest and developable land per sub-district + a map layer"), note: "LU_PKT_2563 จาก lddcatalog.ldd.go.th" },
    { th: "สำมะโนประชากร", en: "Population census", src: t("สำนักงานสถิติแห่งชาติ (data.go.th)", "National Statistical Office (data.go.th)"), date: "2533, 2543, 2553", use: t("บริบทการเติบโตของประชากรรายอำเภอในหน้าวิสัยทัศน์", "District population growth on the vision page"), note: "data.go.th/dataset/0703_01_14" },
    { th: "อาคารรายหลัง (3 มิติ ซูมใกล้)", en: "Building footprints (3D when zoomed in)", src: "Overture Maps Foundation", date: t("release 2026-09-23", "release 2026-09-23"), use: t("ชั้นอาคาร 3 มิติรายหลังเมื่อซูมใกล้ (ดูเท่านั้น) และเทียบตำแหน่งกับอาคาร GISTDA", "Per-building 3D layer when zoomed in (viewing only) and a position check against the GISTDA buildings"), note: t("223,218 หลัง · มีความสูงแค่ 0.2% ที่เหลือแสดงเป็น 1 ชั้น · © OpenStreetMap contributors (ODbL), Google Open Buildings, Microsoft ML Buildings", "223,218 buildings · heights for only 0.2 %, the rest drawn as 1 storey · © OpenStreetMap contributors (ODbL), Google Open Buildings, Microsoft ML Buildings") },
    { th: "อาคารพร้อมความสูงและจำนวนชั้น", en: "Buildings with height & storeys", src: "GISTDA API Gateway", date: t("2567 (อัปเดต ส.ค. 2569)", "2024 (updated Aug 2026)"), use: t("ตัวเลือก \"พื้นที่ใช้สอยต่อพื้นที่ดิน\" ของปัจจัยอาคาร + ชั้นอาคาร 3 มิติ", "\"Floor area per land area\" option of the building factor + 3D building layer"), note: t("239,992 หลังในภูเก็ต · รูปอาคารจาก Global Building Atlas (OSM/Google) · ความสูงจากแบบจำลอง (GEE_Height) · ดึงผ่าน features/thailand-buildings-footprint", "239,992 buildings in Phuket · footprints from Global Building Atlas (OSM/Google) · modelled heights (GEE_Height) · via features/thailand-buildings-footprint"), gistda: true },
    { th: "ความสูงและความชันของพื้นที่", en: "Land height & slope", src: "Copernicus DEM GLO-30 (ESA / EU)", date: t("ข้อมูลปี 2554–2558", "acquired 2011–2015"), use: t("ตัดที่สูง 80 ม. ขึ้นไปและที่ชันเกิน 20% ออกจากที่ดินที่ยังพัฒนาได้ + ชั้นภูเขาและที่ลาดชัน", "Removes land at 80 m+ or steeper than 20 % from developable land + hills & steep land layer"), note: "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA" },
    { th: "เวลาเดินทางตามถนน", en: "Road travel time", src: t("คำนวณจากโครงข่ายถนน OpenStreetMap + จุดกึ่งกลางอาคาร GISTDA", "Computed on the OpenStreetMap road network + GISTDA building centroids"), date: t("ถนน 20 ต.ค. 2569, อาคาร 2565", "roads 20 Oct 2026, buildings 2022"), use: t("ปัจจัยเวลาเดินทางถึงปลายทางที่เลือก + ชั้นช่อง 500 ม.", "Travel-time factor to the chosen destination + 500 m layer"), note: t("ความเร็วตามประเภทถนน (สายหลัก 60, สายรอง 50, ท้องถิ่น 40, ในหมู่บ้าน 25, ซอย/ทางเข้า 15 กม./ชม.) ไม่คิดรถติด", "Speed by road class (primary 60, secondary 50, tertiary 40, residential 25, service 15 km/h), no traffic") },
    { th: "ประชากรและบ้านตามทะเบียนราษฎร์", en: "Registered population & houses", src: t("กรมการปกครอง", "Dept. of Provincial Administration"), date: "2559, 2565, 2568", use: t("ปัจจัยการเติบโตของบ้าน, Stress Test เปลี่ยนแหล่งข้อมูลประชากร, เทียบคนอยู่จริงกับทะเบียน", "House-growth factor, population-source stress test, residents vs registered"), note: "stat.bora.dopa.go.th (ระดับตำบล, ข้อมูล ณ ธ.ค.)" },
    { th: "ราคาประเมินที่ดิน", en: "Land appraisal", src: t("กรมธนารักษ์ (data.go.th)", "Treasury Dept. (data.go.th)"), date: t("รอบบัญชี 2566–2569", "2023–2026 round"), use: t("ค่ากลางราคาบาท/ตร.ว. ต่อตำบล", "Median THB/sq.wah per sub-district"), note: n.land_value },
  ];
  const rows: (typeof baseRows)[number][] = GISTDA_IMAGERY ? [imageryRow, ...baseRows] : baseRows;
  return (
    <div className="page">
      <header style={{ display: "grid", gap: 8 }}>
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
        <h2>{t(`ปัจจัยทั้ง ${FACTORS.length}`, `The ${FACTORS.length} factors`)}</h2>
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

      <section style={{ display: "grid", gap: 12 }}>
        <h2>{t("Logic Matrix: จากคะแนนไปสู่การตัดสินใจ", "Logic matrix: from score to decision")}</h2>
        <p className="prose">
          {t(`คะแนนอย่างเดียวบอกได้แค่ว่าตำบลไหน "พร้อม" แต่ไม่ได้บอกว่าควรทำอะไร จึงนำคะแนนมาเทียบกับที่ดินที่ยังพัฒนาได้ (การใช้ที่ดิน กรมพัฒนาที่ดิน 2563) ได้ 4 กลุ่ม เกณฑ์ตั้งต้นคือ คะแนน ${DEFAULT_THRESHOLDS.score} และที่ดิน ${DEFAULT_THRESHOLDS.land}% ผู้ใช้ปรับได้ในหน้าภารกิจ`,
             `A score only says which areas are "ready", not what to do. So the score is set against developable land (LDD land use 2020) to give 4 groups. Default cut-offs: score ${DEFAULT_THRESHOLDS.score} and land ${DEFAULT_THRESHOLDS.land}%, adjustable on the mission page.`)}
        </p>
        <div className="tbl">
          <table>
            <thead><tr><th></th><th>{t(`ที่ดินที่ยังพัฒนาได้ ≥ ${DEFAULT_THRESHOLDS.land}%`, `Developable land ≥ ${DEFAULT_THRESHOLDS.land}%`)}</th><th>{t(`ที่ดินที่ยังพัฒนาได้ < ${DEFAULT_THRESHOLDS.land}%`, `Developable land < ${DEFAULT_THRESHOLDS.land}%`)}</th></tr></thead>
            <tbody>
              {[["promote", "upgrade"], ["prepare", "maintain"]].map((pair, i) => (
                <tr key={i}>
                  <th>{i === 0 ? t(`คะแนน ≥ ${DEFAULT_THRESHOLDS.score}`, `Score ≥ ${DEFAULT_THRESHOLDS.score}`) : t(`คะแนน < ${DEFAULT_THRESHOLDS.score}`, `Score < ${DEFAULT_THRESHOLDS.score}`)}</th>
                  {pair.map((c) => {
                    const d = CATEGORIES[c as keyof typeof CATEGORIES];
                    return <td key={c}><b style={{ color: d.color }}>{t(d.th, d.en)}</b><div className="small muted">{t(d.actionTh, d.actionEn)}</div></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="prose">
          {t(`ความมั่นใจ: คำนวณกลุ่มซ้ำภายใต้ Stress Test ${SCENARIOS.length} สถานการณ์ (${SCENARIOS.map((x) => x.th).join(", ")}) ถ้ากลุ่มไม่เปลี่ยนเลยถือว่ามั่นใจสูง ถ้าเปลี่ยนจะบอกว่าเปลี่ยนในสถานการณ์ไหน`,
             `Confidence: the group is recomputed under ${SCENARIOS.length} stress tests (${SCENARIOS.map((x) => x.en).join(", ")}). If it never changes, confidence is high; otherwise the page names the scenario that changes it.`)}
        </p>
        <p className="prose">
          {t(`ข้อสังเกตประชากรแฝง: ถ้าประชากรประมาณการของ Kontur มากกว่าทะเบียนราษฎร์ตั้งแต่ ${UNREG_FLAG} เท่า จะมีหมายเหตุว่าบริการที่วางแผนจากตัวเลขทะเบียนอาจไม่พอ ข้อสังเกตนี้ไม่เปลี่ยนกลุ่ม`,
             `Unregistered-population note: where Kontur's estimate is at least ${UNREG_FLAG}× the civil registry, a note warns that services planned from registry numbers may fall short. The note does not change the group.`)}
        </p>
        <p className="small muted">
          {t("ถ้าเปิดปัจจัย \"ที่ดินที่ยังพัฒนาได้\" ในหลักเกณฑ์ด้วย ข้อมูลชุดนี้จะถูกใช้ทั้งในคะแนนและในแกนของ Matrix ควรรู้ไว้เมื่ออ่านผล",
             "If the developable-land factor is also switched on in the rule, the same data counts in both the score and the matrix axis; keep that in mind when reading the result.")}
        </p>
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

      <section>
        <h2>{t("สถานะข้อมูล", "Data status")}</h2>
        <p className="small muted" style={{ marginBottom: 12 }}>{t("ข้อมูล ณ 23 ต.ค. 2569", "As of 23 Oct 2026")}</p>
        <div className="grid4">
          {status.map((g) => (
            <div className="card" key={g.en}>
              <b>{t(g.th, g.en)}</b>
              <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {g.items.map((i) => <li key={i.en} style={{ marginBottom: 4 }}>{t(i.th, i.en)}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          {t("รายละเอียดเต็มของทุกชุด (แหล่ง ปี ขั้นตอนประมวลผล ไฟล์ผลลัพธ์ ข้อจำกัด และเครดิต) อยู่ใน ", "Full details of every dataset (source, year, processing, outputs, limits and credits) are in ")}
          <a href={DATA_MD} target="_blank" rel="noreferrer">DATA.md</a>
        </p>
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
        <p>• {t("แปลงราคาประเมินที่ตัดออก (ระวาง 1:5000) ส่วนใหญ่ราคาถูกและอยู่ทางเหนือของเกาะมากกว่า ราคากลางของตำบลใน อ.ถลาง จึงน่าจะสูงกว่าความจริงเล็กน้อย",
               "The appraisal records left out (1:5000 sheets) are mostly cheaper and more common in the north, so the median price of Thalang sub-districts is probably a little too high.")}</p>
        <p>• {t("ข้อมูลอาคารปี 2565 และ 2567 มาจากคนละวิธี ปี 2567 แบ่งอาคารเป็นชิ้นเล็กกว่า จึงมีจำนวนมากกว่า 1.5–2.4 เท่า แต่พื้นที่ฐานมากกว่าเพียง 1.1–1.8 เท่า ห้ามนำจำนวนมาลบกัน ความสูงและจำนวนชั้นปี 2567 เป็นค่าประมาณจากแบบจำลอง เมื่อเทียบกับจำนวนชั้นที่บันทึกใน OpenStreetMap ต่างไม่เกิน 1 ชั้นราว 79% แต่มักนับมากไป 1 ชั้น โดยเฉพาะบ้านชั้นเดียว",
               "The 2022 and 2024 building data use different methods: 2024 splits buildings into smaller pieces, so it has 1.5–2.4× as many buildings but only 1.1–1.8× the footprint. Do not subtract the counts. 2024 heights and storeys are model estimates: compared with storeys recorded in OpenStreetMap, about 79% are within one storey, but they tend to add one storey, especially for single-storey houses.")}</p>
        <p>• {t("\"ที่ดินที่ยังพัฒนาได้\" หมายถึงที่ดินที่ยังไม่ถูกสร้างทับตามการใช้ที่ดินปี 2563 ไม่ได้แปลว่ากฎหมายผังเมืองอนุญาตให้สร้าง",
               "\"Developable land\" means land not yet built on in the 2020 land-use survey; it does not mean the town plan allows building there.")}</p>
        <p>• {t("คะแนนรวมข้อมูลหลายปี (2563–2569) จึงเป็นภาพรวมช่วงเวลา ไม่ใช่ภาพ ณ ปีใดปีหนึ่ง", "The score combines data from 2020–2026, so it describes a period, not a single year.")}</p>
        <p>• {t("ที่ราบ = ชันไม่เกิน 20% และต่ำกว่า 80 ม. ตามประกาศกระทรวงทรัพยากรฯ เขตคุ้มครองสิ่งแวดล้อมภูเก็ต พ.ศ. 2567 (มีผล 14 ธ.ค. 2567 ห้าปี): สูงเกิน 80 ม. ห้ามก่อสร้าง ยกเว้นบ้านเดี่ยวสูงไม่เกิน 6 ม. บนที่ดินที่ครอบครองก่อนปี 2560 ช่วง 80–140 ม., พื้นที่ลาดเชิงเขาสร้างได้เฉพาะบ้านเดี่ยว ประกาศไม่ได้ระบุ % ความชันของ \"ลาดเชิงเขา\" (อ้างมาตรฐานกรมโยธาธิการฯ) จึงใช้ 20% ตามฉบับ 2560 ความสูงมาจาก Copernicus DEM ซึ่งรวมยอดไม้และหลังคา ละเอียด 30 ม.",
               "Gentle & low = slope under 20 % and below 80 m, following Phuket's 2024 environmental protection announcement (in force 14 Dec 2024 for five years): no building above 80 m except a 6 m single house on land held before 2017 at 80–140 m, and only single houses on hillsides. The announcement does not give a slope % for \"hillside\" (it refers to the Public Works standard), so 20 % from the 2017 version is used. Heights come from the Copernicus DEM, which includes tree tops and roofs, at 30 m.")}</p>
        <p>• {t("เวลาเดินทางเป็นแบบจำลองอย่างง่าย: ใช้ความเร็วตามประเภทถนน ไม่คิดรถติด สัญญาณไฟ หรือถนนเดินรถทางเดียว จึงเหมาะใช้เทียบกันระหว่างตำบล ไม่ใช่เวลาจริง อาคารที่ห่างถนนเกิน 1 กม. (เกาะที่ไม่มีสะพาน) ไม่ได้นับ",
               "Travel time is a simple model: speed by road class, no traffic, signals or one-way streets, so it compares sub-districts rather than predicting real trips. Buildings more than 1 km from a road (islands without a bridge) are left out.")}</p>
      </section>
    </div>
  );
}
