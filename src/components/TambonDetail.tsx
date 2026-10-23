import Fold from "./Fold";
import { FACTORS, TRAVEL_DESTS, developableOf, travelMinutes, unitOf } from "../factors";
import { CATEGORIES, DEFAULT_THRESHOLDS, categoryOf } from "../decision";
import { LANDUSE_COLORS } from "../layers";
import { REG_YEARS, regHouse, regPop } from "../years";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { Scored, Weights } from "../types";

/** Right-hand panel for one sub-district: the answer first, details folded underneath. */
export default function TambonDetail({ s, total, weights }: { s: Scored; total: number; weights: Weights }) {
  const { t, num } = useI18n();
  const p = s.props;
  const raw: Record<string, string> = {
    buildings: weights.buildings.measure === "floor" ? num(p.floor_to_land_pct, 1) : num(p.bldg_per_km2),
    road: num(p.road_dist_m),
    services: num(p.services_per_km2, 1),
    population: num(p.pop_per_km2),
    land: p.land_median == null ? "–" : num(p.land_median),
    developable: num(developableOf(p, weights.developable), 1),
    growth: num(p.house_growth_pct, 1),
    travel: num(travelMinutes(p, weights.travel.dest), 1),
  };
  const dest = TRAVEL_DESTS.find((d) => d.id === (weights.travel.dest ?? "oldtown"))!;
  const cat = CATEGORIES[categoryOf(s.score, p, DEFAULT_THRESHOLDS, weights.developable)];
  const on = FACTORS.filter((f) => weights[f.key].direction !== 0);
  const off = FACTORS.filter((f) => weights[f.key].direction === 0);
  const lu = [
    { k: "U1", v: p.lu_urban_pct, th: "พื้นที่ชุมชนและสิ่งปลูกสร้าง", en: "Built-up" },
    { k: "A", v: p.lu_agri_pct, th: "เกษตรกรรม", en: "Agriculture" },
    { k: "M", v: p.lu_misc_pct, th: "เบ็ดเตล็ด", en: "Miscellaneous" },
    { k: "F", v: p.lu_forest_pct, th: "ป่าไม้", en: "Forest" },
  ];
  const popMax = Math.max(...REG_YEARS.map((y) => regPop(p, y)), ...REG_YEARS.map((y) => regHouse(p, y)));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div className="eyebrow">{t(`อ.${p.amphoe_th}`, `${p.amphoe_en} district`)}</div>
        <h2 style={{ fontSize: 24 }}>{t(`ต.${p.tambon_th}`, p.tambon_en)}</h2>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
        <span className="bigscore">{num(s.score, 1)}</span>
        <span className="muted">{t(`คะแนนศักยภาพ อันดับ ${s.rank} จาก ${total}`, `potential score, rank ${s.rank} of ${total}`)}</span>
      </div>
      <div>
        <span className="badge" style={{ background: cat.color }}>{t(cat.th, cat.en)}</span>
        <p className="small muted" style={{ margin: "6px 0 0" }}>{t(cat.actionTh, cat.actionEn)}</p>
      </div>

      <div className="tiles">
        <div className="tile"><div className="v">{num(p.reg_pop_2568)}</div><div className="l">{t("ประชากรตามทะเบียน 2568", "Registered people 2025")}</div></div>
        <div className="tile"><div className="v">{num(p.population)}</div><div className="l">{t(`คนอยู่จริง (ประมาณ) · ${num(p.unreg_ratio, 1)} เท่าของทะเบียน`, `Residents (est.) · ${num(p.unreg_ratio, 1)}× registered`)}</div></div>
        <div className="tile"><div className="v">{num(p.bldg_2567)}</div><div className="l">{t(`อาคาร 2567 · สูงเฉลี่ย ${num(p.mean_height_m, 1)} ม.`, `Buildings 2024 · mean ${num(p.mean_height_m, 1)} m`)}</div></div>
        <div className="tile"><div className="v">{p.land_median == null ? "–" : num(p.land_median)}</div><div className="l">{t("ราคาประเมินกลาง บาท/ตร.ว.", "Median appraisal THB/sq.wah")}</div></div>
      </div>

      <div>
        <Fold title={t("คะแนนแยกตามปัจจัย", "Score by factor")} hint={t(`เปิด ${on.length} จาก ${FACTORS.length}`, `${on.length} of ${FACTORS.length} on`)} open>
          {on.map((f) => (
            <div key={f.key}>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                <span>{t(f.th, f.en)}{weights[f.key].direction === -1 ? t(" (กลับด้าน)", " (reversed)") : ""}</span>
                <span className="mono">{num(s.parts[f.key])}</span>
              </div>
              <div className="bar"><i style={{ width: `${s.parts[f.key]}%`, background: f.color }} /></div>
              <div className="small muted">
                {raw[f.key]} {(() => { const u = unitOf(f, weights[f.key]); return t(u.th, u.en); })()}{f.key === "travel" && ` · ${t(dest.th, dest.en)}`}
              </div>
            </div>
          ))}
          {off.length > 0 && (
            <p className="small muted" style={{ margin: 0 }}>
              {t("ปิดอยู่", "Off")}: {off.map((f) => `${t(f.th, f.en)} ${raw[f.key]}`).join(" · ")}
            </p>
          )}
        </Fold>

        <Fold title={t("ทะเบียนราษฎร์รายปี", "Civil registry by year")} hint={`${REG_YEARS[0]}–${REG_YEARS[REG_YEARS.length - 1]}`}>
          <div className="ybars" role="table" aria-label={t("ประชากรและบ้านตามทะเบียนรายปี", "Registered people and houses by year")}>
            {REG_YEARS.map((y) => (
              <div key={y} style={{ display: "contents" }} role="row">
                <span role="cell">{y}</span>
                <span role="cell" style={{ display: "grid", gap: 2 }}>
                  <span className="track"><i style={{ width: `${(regPop(p, y) / popMax) * 100}%`, background: "#0e7c74" }} /></span>
                  <span className="track"><i style={{ width: `${(regHouse(p, y) / popMax) * 100}%`, background: "#8a4f7d" }} /></span>
                </span>
                <span role="cell" className="mono" style={{ textAlign: "right" }}>{num(regPop(p, y))}<br /><span className="muted">{num(regHouse(p, y))}</span></span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            <i style={{ display: "inline-block", width: 9, height: 9, background: "#0e7c74" }} /> {t("คน", "people")}{"  "}
            <i style={{ display: "inline-block", width: 9, height: 9, background: "#8a4f7d" }} /> {t("บ้าน (บ้านเลขที่)", "houses (house numbers)")}
            {" · "}{t(`2559→2568: คน ${p.reg_pop_growth_pct > 0 ? "+" : ""}${num(p.reg_pop_growth_pct, 1)}%, บ้าน +${num(p.house_growth_pct, 1)}%`, `2016→2025: people ${p.reg_pop_growth_pct > 0 ? "+" : ""}${num(p.reg_pop_growth_pct, 1)}%, houses +${num(p.house_growth_pct, 1)}%`)}
          </p>
        </Fold>

        <Fold title={t("การใช้ที่ดิน ปี 2563", "Land use 2020")} hint={t(`พัฒนาได้ ${num(p.developable_pct, 1)}%`, `${num(p.developable_pct, 1)}% developable`)}>
          <div style={{ display: "flex", height: 12, borderRadius: 3, overflow: "hidden" }}>
            {lu.map((x) => <i key={x.k} title={`${t(x.th, x.en)} ${x.v}%`} style={{ width: `${x.v}%`, background: LANDUSE_COLORS[x.k].c }} />)}
          </div>
          <div className="row small muted" style={{ gap: "2px 10px" }}>
            {lu.map((x) => (
              <span key={x.k} className="row" style={{ gap: 4 }}>
                <i style={{ width: 8, height: 8, background: LANDUSE_COLORS[x.k].c, display: "inline-block" }} />
                {t(x.th, x.en)} {num(x.v, 1)}%
              </span>
            ))}
          </div>
          <span className="small muted">{t("กรมพัฒนาที่ดิน", "Land Development Department")}</span>
        </Fold>

        <Fold title={t("ภูมิประเทศ: ความสูงและความชัน", "Terrain: height & slope")} hint={t(`ชันเกิน 35% ${num(p.slope_35_pct, 0)}%`, `${num(p.slope_35_pct, 0)}% over 35 %`)}>
          <dl className="kv">
            <dt>{t("ความสูงเฉลี่ยจากระดับน้ำทะเล", "Mean height above sea level")}</dt><dd>{num(p.elev_mean_m)} {t("ม.", "m")}</dd>
            <dt>{t("สูง 40–80 ม. (อาคารสูงไม่เกิน 8 ม.)", "40–80 m (buildings up to 8 m)")}</dt><dd>{num(p.elev_40_80_pct, 1)}%</dd>
            <dt>{t("สูงเกิน 80 ม. (ห้ามก่อสร้าง)", "Above 80 m (no building)")}</dt><dd>{num(p.elev_80_pct, 1)}%</dd>
            <dt>{t("ความชัน 20–35%", "Slope 20–35 %")}</dt><dd>{num(p.slope_20_35_pct, 1)}%</dd>
            <dt>{t("ความชันเกิน 35%", "Slope over 35 %")}</dt><dd>{num(p.slope_35_pct, 1)}%</dd>
            <dt>{t("เกษตร + เบ็ดเตล็ด ทั้งหมด", "Agri. + misc., all")}</dt><dd>{num(p.developable_pct, 1)}%</dd>
            <dt>{t("เกษตร + เบ็ดเตล็ด บนที่ราบ", "Agri. + misc., gentle & low")}</dt><dd>{num(p.developable_flat_pct, 1)}%</dd>
          </dl>
          <span className="small muted">{t("ที่ราบ = ชันไม่เกิน 20% และต่ำกว่า 80 ม. ตามประกาศเขตคุ้มครองสิ่งแวดล้อมภูเก็ต พ.ศ. 2567 (เกิน 80 ม. ห้ามก่อสร้าง, ลาดเชิงเขาสร้างได้เฉพาะบ้านเดี่ยว) · Copernicus DEM 30 ม.", "Gentle & low = slope under 20 % and below 80 m, following Phuket's 2024 environmental protection announcement (no building above 80 m, single houses only on hillsides) · Copernicus DEM 30 m")}</span>
        </Fold>

        <Fold title={t("อาคารและความสูง", "Buildings & height")} hint="GISTDA">
          <dl className="kv">
            <dt>{t("อาคาร 2565 (ใช้คิดความหนาแน่น)", "Buildings 2022 (density factor)")}</dt><dd>{num(p.buildings)}</dd>
            <dt>{t("อาคาร 2567 (มีความสูง)", "Buildings 2024 (with height)")}</dt><dd>{num(p.bldg_2567)}</dd>
            <dt>{t("ความสูงเฉลี่ย", "Mean height")}</dt><dd>{num(p.mean_height_m, 1)} {t("ม.", "m")}</dd>
            <dt>{t("อาคาร 4 ชั้นขึ้นไป", "4+ storeys")}</dt><dd>{num(p.midrise_pct, 1)}%</dd>
            <dt>{t("อาคาร 8 ชั้นขึ้นไป", "8+ storeys")}</dt><dd>{num(p.highrise)}</dd>
            <dt>{t("พื้นที่ใช้สอยต่อพื้นที่ดิน", "Floor area ÷ land")}</dt><dd>{num(p.floor_to_land_pct, 1)}%</dd>
            <dt>{t("อาคารใหญ่ ≥1,000 ตร.ม.", "Large bldgs ≥1,000 m²")}</dt><dd>{num(p.large_bldg)}</dd>
          </dl>
          <span className="small muted">{t("ความสูงเป็นค่าจากแบบจำลองของ GISTDA ข้อมูลสองปีมาจากคนละแหล่ง จึงไม่นำมาลบกัน", "Heights are GISTDA model estimates. The two years come from different sources, so they are not subtracted.")}</span>
        </Fold>

        <Fold title={t("เวลาเดินทางตามถนน", "Travel time by road")} hint={t("ค่ากลาง นาที", "median min")}>
          <dl className="kv">
            {TRAVEL_DESTS.map((d) => (
              <span key={d.id} style={{ display: "contents" }}>
                <dt>{t(d.th, d.en)}</dt><dd>{num(travelMinutes(p, d.id), 1)}</dd>
              </span>
            ))}
          </dl>
          <span className="small muted">{t("ความเร็วตามประเภทถนน ไม่คิดรถติด", "Speed by road class, no traffic")}</span>
        </Fold>

        <Fold title={t("บริการและข้อมูลอื่น", "Services & other figures")}>
          <dl className="kv">
            <dt>{t("พื้นที่", "Area")}</dt><dd>{num(p.area_km2, 1)} {t("ตร.กม.", "km²")}</dd>
            <dt>{t("โรงเรียน/สถานศึกษา", "Education")}</dt><dd>{num(p.svc_education)}</dd>
            <dt>{t("สถานพยาบาล/ร้านยา", "Health")}</dt><dd>{num(p.svc_health)}</dd>
            <dt>{t("ห้าง/ตลาด/ร้านค้า", "Retail & markets")}</dt><dd>{num(p.svc_retail)}</dd>
            <dt>{t("ที่พัก", "Lodging")}</dt><dd>{num(p.lodging)}</dd>
            <dt>{t("ระยะถึงถนนสายหลัก (ค่ากลาง)", "To main road (median)")}</dt><dd>{num(p.road_dist_m)} {t("ม.", "m")}</dd>
            <dt>{t("แปลงที่ดินที่ใช้คิดราคา", "Parcels in land price")}</dt><dd>{num(p.land_parcels)}</dd>
          </dl>
        </Fold>
      </div>

      <p className="small muted">
        {t("คะแนนแต่ละปัจจัยเทียบกันเฉพาะ 17 ตำบลในภูเก็ต 100 คือดีที่สุดในจังหวัด 0 คือต่ำสุด กลุ่มการตัดสินใจใช้เกณฑ์ตั้งต้น",
           "Each factor is scored relative to Phuket's 17 sub-districts: 100 is the best in the province, 0 the lowest. The decision group uses the default cut-offs.")}{" "}
        <a href={href("method")}>{t("วิธีคิด", "How it works")}</a>
      </p>
    </div>
  );
}
