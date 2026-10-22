import { FACTORS, TRAVEL_DESTS, travelMinutes, unitOf } from "../factors";
import { LANDUSE_COLORS } from "../layers";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { Scored, Weights } from "../types";

export default function TambonDetail({ s, total, weights }: { s: Scored; total: number; weights: Weights }) {
  const { t, num } = useI18n();
  const p = s.props;
  const raw: Record<string, string> = {
    buildings: weights.buildings.measure === "floor" ? num(p.floor_to_land_pct, 1) : num(p.bldg_per_km2),
    road: num(p.road_dist_m),
    services: num(p.services_per_km2, 1),
    population: num(p.pop_per_km2),
    land: p.land_median == null ? "–" : num(p.land_median),
    developable: num(p.developable_pct, 1),
    growth: num(p.house_growth_pct, 1),
    travel: num(travelMinutes(p, weights.travel.dest), 1),
  };
  const dest = TRAVEL_DESTS.find((d) => d.id === (weights.travel.dest ?? "oldtown"))!;
  const lu = [
    { k: "U1", v: p.lu_urban_pct, th: "พื้นที่ชุมชนและสิ่งปลูกสร้าง", en: "Built-up" },
    { k: "A", v: p.lu_agri_pct, th: "เกษตรกรรม", en: "Agriculture" },
    { k: "M", v: p.lu_misc_pct, th: "เบ็ดเตล็ด", en: "Miscellaneous" },
    { k: "F", v: p.lu_forest_pct, th: "ป่าไม้", en: "Forest" },
  ];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="eyebrow">{t(`อ.${p.amphoe_th}`, `${p.amphoe_en} district`)}</div>
        <h2 style={{ fontSize: 24 }}>{t(`ต.${p.tambon_th}`, p.tambon_en)}</h2>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
        <span className="bigscore">{num(s.score, 1)}</span>
        <span className="muted">
          {t(`คะแนนศักยภาพ อันดับ ${s.rank} จาก ${total}`, `potential score, rank ${s.rank} of ${total}`)}
        </span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {FACTORS.map((f) => {
          const off = weights[f.key].direction === 0;
          return (
            <div key={f.key} style={{ opacity: off ? 0.45 : 1 }}>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                <span>{t(f.th, f.en)}{weights[f.key].direction === -1 ? t(" (กลับด้าน)", " (reversed)") : ""}</span>
                <span className="mono">{off ? t("ปิด", "off") : num(s.parts[f.key])}</span>
              </div>
              <div className="bar"><i style={{ width: `${s.parts[f.key]}%`, background: f.color }} /></div>
              <div className="small muted">
                {raw[f.key]} {(() => { const u = unitOf(f, weights[f.key]); return t(u.th, u.en); })()}{f.key === "travel" && ` · ${t(dest.th, dest.en)}`}
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <div className="small" style={{ marginBottom: 4 }}>{t("การใช้ที่ดิน ปี 2563 (กรมพัฒนาที่ดิน)", "Land use 2020 (LDD)")}</div>
        <div style={{ display: "flex", height: 12, borderRadius: 3, overflow: "hidden" }}>
          {lu.map((x) => <i key={x.k} title={`${t(x.th, x.en)} ${x.v}%`} style={{ width: `${x.v}%`, background: LANDUSE_COLORS[x.k].c }} />)}
        </div>
        <div className="row small muted" style={{ gap: "2px 10px", marginTop: 4 }}>
          {lu.map((x) => (
            <span key={x.k} className="row" style={{ gap: 4 }}>
              <i style={{ width: 8, height: 8, background: LANDUSE_COLORS[x.k].c, display: "inline-block" }} />
              {t(x.th, x.en)} {num(x.v, 1)}%
            </span>
          ))}
        </div>
      </div>
      <dl className="kv">
        <dt>{t("พื้นที่", "Area")}</dt><dd>{num(p.area_km2, 1)} {t("ตร.กม.", "km²")}</dd>
        <dt>{t("อาคารทั้งหมด", "Buildings")}</dt><dd>{num(p.buildings)}</dd>
        <dt>{t("อาคารใหญ่ ≥1,000 ตร.ม.", "Large bldgs ≥1,000 m²")}</dt><dd>{num(p.large_bldg)}</dd>
        <dt>{t("อาคาร 2567 (มีความสูง)", "Buildings 2024 (with height)")}</dt><dd>{num(p.bldg_2567)}</dd>
        <dt>{t("ความสูงเฉลี่ย", "Mean height")}</dt><dd>{num(p.mean_height_m, 1)} {t("ม.", "m")}</dd>
        <dt>{t("อาคาร 4 ชั้นขึ้นไป", "4+ storeys")}</dt><dd>{num(p.midrise_pct, 1)}% · {t(`8 ชั้นขึ้นไป ${num(p.highrise)} หลัง`, `8+ storeys: ${num(p.highrise)}`)}</dd>
        <dt>{t("พื้นที่ใช้สอยต่อพื้นที่ดิน", "Floor area ÷ land")}</dt><dd>{num(p.floor_to_land_pct, 1)}%</dd>
        <dt>{t("ประชากร (ประมาณการ Kontur 2566)", "Population (Kontur est. 2023)")}</dt><dd>{num(p.population)}</dd>
        <dt>{t("ประชากรตามทะเบียน 2568", "Registered population 2025")}</dt><dd>{num(p.reg_pop_2568)} <span className="muted">({p.reg_pop_growth_pct > 0 ? "+" : ""}{num(p.reg_pop_growth_pct, 1)}% {t("จาก 2559", "since 2016")})</span></dd>
        <dt>{t("คนอยู่จริงต่อคนในทะเบียน", "Residents per registered person")}</dt><dd>{num(p.unreg_ratio, 1)} {t("เท่า", "×")}</dd>
        <dt>{t("บ้านตามทะเบียน 2568", "Registered houses 2025")}</dt><dd>{num(p.reg_house_2568)}</dd>
        <dt>{t("โรงเรียน/สถานศึกษา", "Education")}</dt><dd>{num(p.svc_education)}</dd>
        <dt>{t("สถานพยาบาล/ร้านยา", "Health")}</dt><dd>{num(p.svc_health)}</dd>
        <dt>{t("ห้าง/ตลาด/ร้านค้า", "Retail & markets")}</dt><dd>{num(p.svc_retail)}</dd>
        <dt>{t("ที่พัก", "Lodging")}</dt><dd>{num(p.lodging)}</dd>
        <dt>{t("แปลงที่ดินที่ใช้คิดราคา", "Parcels in land price")}</dt><dd>{num(p.land_parcels)}</dd>
      </dl>
      <p className="small muted">
        {t(
          "คะแนนแต่ละปัจจัยเทียบกันเฉพาะ 17 ตำบลในภูเก็ต 100 คือดีที่สุดในจังหวัด 0 คือต่ำสุด",
          "Each factor is scored relative to Phuket's 17 sub-districts: 100 is the best in the province, 0 the lowest.",
        )}{" "}
        <a href={href("method")}>{t("วิธีคิด", "How it works")}</a>
      </p>
    </div>
  );
}
