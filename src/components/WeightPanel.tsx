import { useState } from "react";
import { BUILDING_MEASURES, FACTORS, LAND_BASES, PRESETS, TRAVEL_DESTS, buildingMeasure, landBasis } from "../factors";
import { useI18n } from "../i18n";
import { effectiveShare } from "../scoring";
import type { BuildingMeasure, Direction, FactorKey, LandBasis, TravelDest, Weights } from "../types";

interface Props {
  weights: Weights;
  setWeights: (w: Weights) => void;
  compact?: boolean;
}

/**
 * The decision rule: weight and direction of each factor. Used on the map and in the mission.
 * Simple view: presets + a slider for each factor that is switched on.
 * Advanced view: every factor, its direction (on/off/reversed) and its options.
 */
export default function WeightPanel({ weights, setWeights, compact }: Props) {
  const { t, num } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const set = (key: FactorKey, patch: Partial<Weights[FactorKey]>) =>
    setWeights({ ...weights, [key]: { ...weights[key], ...patch } });
  const active = PRESETS.find((p) => JSON.stringify(p.weights) === JSON.stringify(weights));
  const on = FACTORS.filter((f) => weights[f.key].direction !== 0);
  const shown = advanced ? FACTORS : on;

  const option = (key: FactorKey) => {
    const s = weights[key];
    if (key === "travel") {
      const d = TRAVEL_DESTS.find((x) => x.id === (s.dest ?? "oldtown"))!;
      return t(`ปลายทาง: ${d.th}`, `to ${d.en}`);
    }
    if (key === "buildings") {
      const m = buildingMeasure(s);
      return t(`วัดจาก: ${m.th}`, `measure: ${m.en}`);
    }
    if (key === "developable") {
      const b = landBasis(s);
      return t(`นับ: ${b.th}`, `counts: ${b.en}`);
    }
    return null;
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`btn ${active?.id === p.id ? "" : "ghost"}`}
            style={{ padding: "4px 10px", fontSize: 13 }}
            onClick={() => setWeights(p.weights)}
            title={t(p.descTh, p.descEn)}
          >
            {t(p.th, p.en)}
          </button>
        ))}
      </div>
      {!compact && (
        <p className="small muted" style={{ marginBottom: 10 }}>
          {active ? t(active.descTh, active.descEn) : t("หลักเกณฑ์ที่ปรับเอง", "Custom rule")}
        </p>
      )}

      {shown.length === 0 && (
        <p className="small muted">{t("ยังไม่ได้เปิดปัจจัยไหน กด \"ตั้งค่าขั้นสูง\" เพื่อเปิด", "No factor is on. Open the advanced settings to switch one on.")}</p>
      )}
      {shown.map((f) => {
        const s = weights[f.key];
        const dirs: { d: Direction; label: string }[] = [
          { d: 1, label: f.higherIsBetter ? t("มาก=ดี", "high=good") : t("ใกล้=ดี", "near=good") },
          { d: -1, label: f.higherIsBetter ? t("น้อย=ดี", "low=good") : t("ไกล=ดี", "far=good") },
          { d: 0, label: t("ปิด", "off") },
        ];
        const opt = option(f.key);
        return (
          <div className="wrow" key={f.key} style={{ opacity: s.direction === 0 ? 0.6 : 1 }}>
            <label htmlFor={`w-${f.key}`}>
              <span className="sw" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: f.color, marginRight: 6 }} />
              {t(f.th, f.en)}
              {s.direction === -1 && <span className="muted small">{t(" (กลับด้าน)", " (reversed)")}</span>}
            </label>
            <span className="share">{num(effectiveShare(weights, f.key))}%</span>
            <input
              id={`w-${f.key}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={s.weight}
              disabled={s.direction === 0}
              onChange={(e) => set(f.key, { weight: Number(e.target.value) })}
            />
            {!advanced && opt && <span className="small muted" style={{ gridColumn: "1 / -1" }}>{opt}</span>}
            {advanced && f.key === "buildings" && (
              <select
                aria-label={t("วัดจาก", "Measure")}
                value={s.measure ?? "count"}
                onChange={(e) => set("buildings", { measure: e.target.value as BuildingMeasure })}
                style={{ gridColumn: "1 / -1", fontSize: 13 }}
              >
                {BUILDING_MEASURES.map((m) => <option key={m.id} value={m.id}>{t(`วัดจาก: ${m.th}`, `Measure: ${m.en}`)}</option>)}
              </select>
            )}
            {advanced && f.key === "developable" && (
              <select
                aria-label={t("นับที่ดินแบบไหน", "Which land counts")}
                value={s.landBasis ?? "flat"}
                onChange={(e) => set("developable", { landBasis: e.target.value as LandBasis })}
                style={{ gridColumn: "1 / -1", fontSize: 13 }}
              >
                {LAND_BASES.map((b) => <option key={b.id} value={b.id}>{t(`นับ: ${b.th}`, `Count: ${b.en}`)}</option>)}
              </select>
            )}
            {advanced && f.key === "travel" && (
              <select
                aria-label={t("ปลายทาง", "Destination")}
                value={s.dest ?? "oldtown"}
                onChange={(e) => set("travel", { dest: e.target.value as TravelDest })}
                style={{ gridColumn: "1 / -1", fontSize: 13 }}
              >
                {TRAVEL_DESTS.map((d) => <option key={d.id} value={d.id}>{t(`ปลายทาง: ${d.th}`, `To: ${d.en}`)}</option>)}
              </select>
            )}
            {advanced && (
              <div className="dir" role="group" aria-label={t("ทิศทาง", "Direction")} style={{ gridColumn: "1 / -1" }}>
                {dirs.map((d) => (
                  <button
                    key={d.d}
                    aria-pressed={s.direction === d.d}
                    onClick={() => set(f.key, { direction: d.d, weight: d.d !== 0 && s.weight === 0 ? 20 : s.weight })}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button className="linkbtn" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
        {advanced
          ? t("ซ่อนตั้งค่าขั้นสูง", "Hide advanced settings")
          : t(`ตั้งค่าขั้นสูง: เปิด/ปิดปัจจัย กลับด้าน ปลายทาง (มีอีก ${FACTORS.length - on.length} ปัจจัยที่ปิดอยู่)`,
              `Advanced: switch factors, reverse, destination (${FACTORS.length - on.length} more factors are off)`)}
      </button>
    </div>
  );
}
