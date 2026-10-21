import { FACTORS } from "../factors";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { Scored, Weights } from "../types";

export default function TambonDetail({ s, total, weights }: { s: Scored; total: number; weights: Weights }) {
  const { t, num } = useI18n();
  const p = s.props;
  const raw: Record<string, string> = {
    buildings: num(p.bldg_per_km2),
    road: num(p.road_dist_m),
    services: num(p.services_per_km2, 1),
    population: num(p.pop_per_km2),
    land: p.land_median == null ? "–" : num(p.land_median),
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div className="eyebrow">{t(`อ.${p.amphoe_th}`, `${p.amphoe_en} district`)}</div>
        <h2 style={{ fontSize: 24 }}>{t(`ต.${p.tambon_th}`, p.tambon_en)}</h2>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
        <span className="bigscore">{num(s.score, 1)}</span>
        <span className="muted">
          {t(`คะแนนศักยภาพ · อันดับ ${s.rank} จาก ${total}`, `potential score · rank ${s.rank} of ${total}`)}
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
                {raw[f.key]} {t(f.unitTh, f.unitEn)}
              </div>
            </div>
          );
        })}
      </div>
      <dl className="kv">
        <dt>{t("พื้นที่", "Area")}</dt><dd>{num(p.area_km2, 1)} {t("ตร.กม.", "km²")}</dd>
        <dt>{t("อาคารทั้งหมด", "Buildings")}</dt><dd>{num(p.buildings)}</dd>
        <dt>{t("อาคารใหญ่ ≥1,000 ตร.ม.", "Large bldgs ≥1,000 m²")}</dt><dd>{num(p.large_bldg)}</dd>
        <dt>{t("ประชากร (ประมาณการ)", "Population (est.)")}</dt><dd>{num(p.population)}</dd>
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
