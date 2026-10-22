import { useMemo } from "react";
import { CATEGORIES, CATEGORY_ORDER, UNREG_FLAG, decide, type Decision, type Thresholds } from "../decision";
import { SCENARIOS } from "../scenarios";
import { useI18n } from "../i18n";
import type { TambonProps, Weights } from "../types";

interface Props {
  rows: TambonProps[];
  weights: Weights;
  th: Thresholds;
  setTh?: (t: Thresholds) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const W = 640, H = 380, M = { l: 54, r: 16, t: 30, b: 40 };
const X_MAX = 70; // developable land, %
const x = (v: number) => M.l + (Math.min(v, X_MAX) / X_MAX) * (W - M.l - M.r);
const y = (v: number) => H - M.b - (v / 100) * (H - M.t - M.b);

/** Logic matrix: potential score (y) against developable land (x), split by the two thresholds. */
export default function DecisionMatrix({ rows, weights, th, setTh, selectedId, onSelect }: Props) {
  const { t, num } = useI18n();
  const decisions = useMemo(() => decide(rows, weights, th), [rows, weights, th]);
  const scName = (id: string) => {
    const sc = SCENARIOS.find((s) => s.id === id)!;
    return t(sc.th, sc.en);
  };

  // place labels: try right, left, above, below; skip spots that overlap a placed label
  const labels = useMemo(() => {
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    // dots and the four quadrant titles are obstacles too
    for (const d of decisions) {
      const cx = x(d.s.props.developable_pct), cy = y(d.s.score);
      boxes.push({ x0: cx - 7, y0: cy - 7, x1: cx + 7, y1: cy + 7 });
    }
    for (const c of ["promote", "upgrade", "prepare", "maintain"] as const) {
      const w = t(CATEGORIES[c].th, CATEGORIES[c].en).length * 7.2 + 8;
      const right = c === "promote" || c === "prepare", top = c === "promote" || c === "upgrade";
      const x0 = right ? W - M.r - 6 - w : M.l + 2;
      const y0 = top ? 0 : H - M.b - 22;
      boxes.push({ x0, y0, x1: x0 + w, y1: y0 + 20 });
    }
    const sorted = [...decisions].sort((a, b) => b.s.score - a.s.score);
    return sorted.map((d) => {
      const name = t(d.s.props.tambon_th, d.s.props.tambon_en);
      const w = name.length * 6.6 + 4, h = 13;
      const cx = x(d.s.props.developable_pct), cy = y(d.s.score);
      const tries: [number, number, "start" | "end" | "middle"][] = [
        [cx + 9, cy + 4, "start"], [cx - 9, cy + 4, "end"], [cx, cy - 10, "middle"], [cx, cy + 18, "middle"],
        [cx + 9, cy + 16, "start"], [cx + 9, cy - 8, "start"], [cx - 9, cy - 8, "end"], [cx - 9, cy + 16, "end"],
      ];
      for (const [lx, ly, anchor] of tries) {
        const x0 = anchor === "start" ? lx : anchor === "end" ? lx - w : lx - w / 2;
        const b = { x0, y0: ly - h + 2, x1: x0 + w, y1: ly + 2 };
        const inside = b.x0 >= 0 && b.x1 <= W && b.y0 >= M.t - 2 && b.y1 <= H - M.b + 4;
        if (inside && !boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) {
          boxes.push(b);
          return { id: d.s.props.id, name, lx, ly, anchor };
        }
      }
      return { id: d.s.props.id, name, lx: cx + 9, ly: cy + 4, anchor: "start" as const };
    });
  }, [decisions, t, th]);

  const groups = CATEGORY_ORDER.map((c) => ({ c, items: decisions.filter((d) => d.category === c) }));
  const qx = x(th.land), qy = y(th.score);

  const tag = (d: Decision) => (
    <>
      {d.changesUnder.length > 0 && (
        <span className="small" style={{ color: "var(--warn)" }}>
          {" "}· {t("เปลี่ยนกลุ่มเมื่อ", "changes under")}: {d.changesUnder.map(scName).join(", ")}
        </span>
      )}
      {d.unregFlag && (
        <span className="small" style={{ color: "var(--bad)" }}>
          {" "}· {t(`คนอยู่จริง ${num(d.s.props.unreg_ratio, 1)} เท่าของทะเบียน`, `${num(d.s.props.unreg_ratio, 1)}× the registered population`)}
        </span>
      )}
    </>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {setTh && (
        <div className="grid4" style={{ alignItems: "end" }}>
          <label className="small">
            {t("เกณฑ์คะแนนศักยภาพ", "Potential score cut-off")}: <b>{th.score}</b>
            <input type="range" min={20} max={80} step={5} value={th.score} onChange={(e) => setTh({ ...th, score: Number(e.target.value) })} style={{ width: "100%" }} />
          </label>
          <label className="small">
            {t("เกณฑ์ที่ดินที่ยังพัฒนาได้", "Developable land cut-off")}: <b>{th.land}%</b>
            <input type="range" min={5} max={50} step={5} value={th.land} onChange={(e) => setTh({ ...th, land: Number(e.target.value) })} style={{ width: "100%" }} />
          </label>
        </div>
      )}

      <div className="matrix-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" className="matrix"
        aria-label={t("แผนภาพ Logic Matrix: คะแนนศักยภาพเทียบกับที่ดินที่ยังพัฒนาได้", "Logic matrix: potential score against developable land")}>
        {/* quadrants */}
        <rect x={qx} y={M.t} width={W - M.r - qx} height={qy - M.t} fill="var(--cat-promote)" opacity={0.08} />
        <rect x={M.l} y={M.t} width={qx - M.l} height={qy - M.t} fill="var(--cat-upgrade)" opacity={0.08} />
        <rect x={qx} y={qy} width={W - M.r - qx} height={H - M.b - qy} fill="var(--cat-prepare)" opacity={0.08} />
        <rect x={M.l} y={qy} width={qx - M.l} height={H - M.b - qy} fill="var(--cat-maintain)" opacity={0.08} />
        {(["promote", "upgrade", "prepare", "maintain"] as const).map((c) => {
          const right = c === "promote" || c === "prepare";
          const top = c === "promote" || c === "upgrade";
          return (
            <text key={c} x={right ? W - M.r - 6 : M.l + 6} y={top ? M.t - 10 : H - M.b - 8}
              textAnchor={right ? "end" : "start"} fontSize={12} fontWeight={600} fill={`var(--cat-${c})`}>
              {t(CATEGORIES[c].th, CATEGORIES[c].en)}
            </text>
          );
        })}
        {/* axes */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={`y${v}`}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={0.5} />
            <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{v}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, 50, 60, 70].map((v) => (
          <text key={`x${v}`} x={x(v)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">{v}%</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ink)">
          {t("ที่ดินที่ยังพัฒนาได้ (% ของพื้นที่ตำบล, กรมพัฒนาที่ดิน 2563)", "Developable land (% of sub-district, LDD 2020)")}
        </text>
        <text transform={`translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="var(--ink)">
          {t("คะแนนศักยภาพ", "Potential score")}
        </text>
        {/* thresholds */}
        <line x1={qx} x2={qx} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeDasharray="4 3" />
        <line x1={M.l} x2={W - M.r} y1={qy} y2={qy} stroke="var(--ink)" strokeDasharray="4 3" />
        {/* points */}
        {decisions.map((d) => {
          const sel = d.s.props.id === selectedId;
          return (
            <g key={d.s.props.id} style={{ cursor: onSelect ? "pointer" : undefined }} onClick={() => onSelect?.(d.s.props.id)}>
              <title>{`${t(d.s.props.tambon_th, d.s.props.tambon_en)}: ${num(d.s.score, 1)} / ${num(d.s.props.developable_pct, 1)}%`}</title>
              <circle cx={x(d.s.props.developable_pct)} cy={y(d.s.score)} r={sel ? 8 : 6}
                fill={`var(--cat-${d.category})`} stroke={sel ? "var(--overprint)" : "var(--sheet)"} strokeWidth={sel ? 3 : 1.5}
                strokeDasharray={d.changesUnder.length && !sel ? "2 2" : undefined} />
            </g>
          );
        })}
        {labels.map((l) => (
          <text key={l.id} x={l.lx} y={l.ly} textAnchor={l.anchor} fontSize={11}
            fill={l.id === selectedId ? "var(--overprint)" : "var(--ink)"} fontWeight={l.id === selectedId ? 700 : 400}
            paintOrder="stroke" stroke="var(--sheet)" strokeWidth={3} strokeLinejoin="round">{l.name}</text>
        ))}
      </svg>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t("เส้นประคือเกณฑ์ จุดขอบประคือตำบลที่เปลี่ยนกลุ่มเมื่อเจอ Stress Test อย่างน้อย 1 สถานการณ์",
           "Dashed lines are the cut-offs. A dashed outline marks a sub-district whose group changes in at least one stress test.")}
      </p>

      <div className="grid2">
        {groups.map(({ c, items }) => (
          <div className="card" key={c} style={{ borderTopColor: `var(--cat-${c})` }}>
            <b style={{ color: `var(--cat-${c})` }}>{t(CATEGORIES[c].th, CATEGORIES[c].en)}</b>
            <p className="small muted" style={{ margin: "4px 0 8px" }}>{t(CATEGORIES[c].actionTh, CATEGORIES[c].actionEn)}</p>
            {items.length === 0 ? (
              <p className="small muted">{t("ไม่มีตำบลในกลุ่มนี้", "No sub-district here")}</p>
            ) : (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {items.map((d) => (
                  <li key={d.s.props.id} style={{ marginBottom: 4 }}>
                    <b>{t(d.s.props.tambon_th, d.s.props.tambon_en)}</b> {num(d.s.score, 1)}
                    {tag(d)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t(`ข้อสังเกตสีแดง: ประชากรที่อยู่จริงตามแบบจำลอง Kontur มากกว่าทะเบียนราษฎร์ตั้งแต่ ${UNREG_FLAG} เท่า บริการที่วางแผนจากตัวเลขทะเบียนอาจไม่พอ`,
           `Red note: Kontur's modelled population is at least ${UNREG_FLAG}× the civil registry, so services planned from registry numbers may fall short.`)}
      </p>
    </div>
  );
}
