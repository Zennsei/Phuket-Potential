import Fold from "./Fold";
import { FACTORS, unitOf } from "../factors";
import { CATEGORIES, CATEGORY_ORDER } from "../decision";
import { scoreColor } from "../color";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { Level, UnitSummary } from "../levels";
import type { Weights } from "../types";

/**
 * Right-hand panel at the district or province level: the three districts ranked 1–3, then the chosen district
 * (or the province): average score, its own figures added up from its tambons, decision groups and its tambons.
 */
export default function UnitDetail({ level, unit, amphoes, province, weights, onPickAmphoe, onPickTambon }: {
  level: Level;
  unit?: UnitSummary;
  amphoes: UnitSummary[];
  province: UnitSummary;
  weights: Weights;
  onPickAmphoe: (id: string) => void;
  onPickTambon: (id: string) => void;
}) {
  const { t, num } = useI18n();
  const dp = (k: string) => (k === "road" ? 2 : k === "buildings" && weights.buildings.measure !== "floor" ? 0 : k === "population" ? 0 : 1);
  const name = (u: UnitSummary) => (u.id === province.id ? t(`จ.${u.th}`, `${u.en} Province`) : t(`อ.${u.th}`, `${u.en} District`));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <h3>{t("อันดับอำเภอ", "District ranking")}</h3>
        <div className="unitrank">
          {amphoes.map((a) => (
            <button key={a.id} aria-pressed={unit?.id === a.id} onClick={() => onPickAmphoe(a.id)}>
              <span className="rk">{a.rank}</span>
              <span>
                <b>{name(a)}</b>
                <span className="small muted" style={{ display: "block" }}>
                  {t(`${a.members.length} ตำบล · ดีสุด ต.${a.members[0].props.tambon_th} (${num(a.members[0].score, 1)})`,
                     `${a.members.length} sub-districts · best ${a.members[0].props.tambon_en} (${num(a.members[0].score, 1)})`)}
                </span>
              </span>
              <span className="mono" style={{ fontSize: 18 }}>{num(a.score, 1)}</span>
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: "6px 0 0" }}>{t(
          "คะแนนอำเภอ = ค่าเฉลี่ยคะแนนของตำบลในอำเภอ ถ่วงตามพื้นที่ (ตำบลใหญ่มีผลมากกว่า) คะแนนยังคิดที่ระดับตำบลเหมือนเดิม",
          "District score = the mean of its sub-district scores, weighted by area (bigger sub-districts count more). Scores are still worked out per sub-district.")}</p>
      </div>

      {!unit ? (
        <p className="small muted">{level === "amphoe" ? t("คลิกอำเภอบนแผนที่หรือในรายการเพื่อดูรายละเอียด", "Click a district on the map or in the list for details.") : null}</p>
      ) : (
        <>
          <div>
            <div className="eyebrow">{unit.id === province.id ? t("ทั้งจังหวัด", "Whole province") : t(`อันดับ ${unit.rank} จาก ${amphoes.length} อำเภอ`, `Rank ${unit.rank} of ${amphoes.length} districts`)}</div>
            <h2 style={{ fontSize: 24 }}>{name(unit)}</h2>
          </div>
          <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
            <span className="bigscore">{num(unit.score, 1)}</span>
            <span className="muted">{t("คะแนนเฉลี่ยของตำบล ถ่วงตามพื้นที่", "area-weighted mean of sub-district scores")}</span>
          </div>

          <div className="tiles">
            <div className="tile"><div className="v">{num(unit.area_km2, 1)}</div><div className="l">{t("พื้นที่ (ตร.กม.)", "Area (km²)")}</div></div>
            <div className="tile"><div className="v">{num(unit.reg_pop_2568)}</div><div className="l">{t("ประชากรตามทะเบียน 2568", "Registered people 2025")}</div></div>
            <div className="tile"><div className="v">{num(unit.buildings)}</div><div className="l">{t("อาคาร GISTDA 2565", "GISTDA buildings 2022")}</div></div>
            <div className="tile"><div className="v">{num(unit.road_km, 1)}</div><div className="l">{t("ถนนสายหลักและสายรอง (กม.)", "Main & secondary roads (km)")}</div></div>
          </div>

          <div>
            <div className="small" style={{ marginBottom: 4 }}><b>{t("ตำบลอยู่กลุ่มไหนบ้าง", "Sub-districts by decision group")}</b></div>
            <div className="groupchips">
              {CATEGORY_ORDER.filter((c) => unit.groups[c] > 0).map((c) => (
                <span key={c}><i style={{ background: CATEGORIES[c].color }} />{t(CATEGORIES[c].th, CATEGORIES[c].en)} {unit.groups[c]}</span>
              ))}
            </div>
          </div>

          <div>
            <Fold title={t("ค่าของแต่ละปัจจัย (รวมจากทุกตำบล)", "Factor figures (added up from all sub-districts)")} open>
              <div className="kvt">
                {FACTORS.map((f) => {
                  const u = unitOf(f, weights[f.key]);
                  return (
                    <div key={f.key} className="row" style={{ justifyContent: "space-between", fontSize: 13, opacity: weights[f.key].direction === 0 ? 0.6 : 1 }}>
                      <span>{t(f.th, f.en)}{weights[f.key].direction === 0 ? t(" (ปิด)", " (off)") : ""}</span>
                      <span className="mono">{num(unit.values[f.key], dp(f.key))} <span className="muted small">{t(u.th, u.en)}</span></span>
                    </div>
                  );
                })}
              </div>
              <p className="small muted" style={{ margin: "6px 0 0" }}>{t(
                "รวมแบบเดียวกับตำบล: ผลรวมของทุกตำบล ÷ พื้นที่รวม (เช่น อาคารทั้งอำเภอ ÷ พื้นที่ทั้งอำเภอ) ไม่ใช่เฉลี่ยตัวเลขของแต่ละตำบล · ที่ดินพัฒนาได้เฉลี่ยตามพื้นที่บก · การเติบโตใช้บ้านรวมทั้งอำเภอ",
                "Added up the same way as a sub-district: the total of all its sub-districts ÷ total area (e.g. all buildings ÷ all area), not an average of their figures · developable land weighted by land area · growth from the total houses")}</p>
            </Fold>

            <Fold title={t("ตำบลในพื้นที่นี้", "Sub-districts here")} hint={t(`${unit.members.length} ตำบล`, `${unit.members.length}`)} open>
              <div className="rankbars">
                {unit.members.map((s) => (
                  <a key={s.props.id} className="rb" href={href("map", s.props.id)} onClick={(e) => { e.preventDefault(); onPickTambon(s.props.id); }} style={{ color: "inherit", textDecoration: "none" }}>
                    <span>{s.rank}. {t(s.props.tambon_th, s.props.tambon_en)}</span>
                    <span className="track"><i style={{ width: `${s.score}%`, background: scoreColor(s.score) }} /></span>
                    <span className="num">{num(s.score, 1)}</span>
                  </a>
                ))}
              </div>
              <p className="small muted" style={{ margin: 0 }}>{t("ตัวเลขหน้าชื่อ = อันดับในทั้งจังหวัด (17 ตำบล) · คลิกเพื่อดูตำบล", "Number = rank among all 17 sub-districts · click to open")}</p>
            </Fold>
          </div>
        </>
      )}
    </div>
  );
}
