import { FACTORS, PRESETS, TRAVEL_DESTS } from "../factors";
import { useI18n } from "../i18n";
import { effectiveShare } from "../scoring";
import type { Direction, FactorKey, TravelDest, Weights } from "../types";

interface Props {
  weights: Weights;
  setWeights: (w: Weights) => void;
  compact?: boolean;
}

/** The decision rule: weight and direction of each factor. Used on the map and in the mission. */
export default function WeightPanel({ weights, setWeights, compact }: Props) {
  const { t, num } = useI18n();
  const set = (key: FactorKey, patch: Partial<Weights[FactorKey]>) =>
    setWeights({ ...weights, [key]: { ...weights[key], ...patch } });
  const active = PRESETS.find((p) => JSON.stringify(p.weights) === JSON.stringify(weights));

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
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
      {active && !compact && <p className="small muted" style={{ marginBottom: 12 }}>{t(active.descTh, active.descEn)}</p>}
      {FACTORS.map((f) => {
        const s = weights[f.key];
        const dirs: { d: Direction; label: string; title: string }[] = [
          { d: 1, label: f.higherIsBetter ? t("มาก=ดี", "high=good") : t("ใกล้=ดี", "near=good"), title: "" },
          { d: -1, label: f.higherIsBetter ? t("น้อย=ดี", "low=good") : t("ไกล=ดี", "far=good"), title: "" },
          { d: 0, label: t("ปิด", "off"), title: "" },
        ];
        return (
          <div className="wrow" key={f.key}>
            <label htmlFor={`w-${f.key}`}>
              <span className="sw" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: f.color, marginRight: 6 }} />
              {t(f.th, f.en)}
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
            {f.key === "travel" && (
              <select
                aria-label={t("ปลายทาง", "Destination")}
                value={s.dest ?? "oldtown"}
                onChange={(e) => set("travel", { dest: e.target.value as TravelDest })}
                style={{ gridColumn: "1 / -1", fontSize: 13 }}
              >
                {TRAVEL_DESTS.map((d) => <option key={d.id} value={d.id}>{t(`ปลายทาง: ${d.th}`, `To: ${d.en}`)}</option>)}
              </select>
            )}
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
          </div>
        );
      })}
    </div>
  );
}
