import { useLayoutEffect, useRef, useState } from "react";

/** Charts shared by the compare page. Plain SVG drawn at the container's real pixel width (no chart package). */

type T = (th: string, en: string) => string;
export type Fmt = (n: number, digits?: number) => string;

export function useWidth<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
}

/** 0 … a round number at or above max, about `count` steps */
export function niceTicks(max: number, count: number): number[] {
  if (!(max > 0)) return [0, 1];
  const step = niceStep(max / count);
  const out: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

/** round ticks covering lo … hi (lo ≤ 0 ≤ hi), about `count` steps */
function spanTicks(lo: number, hi: number, count: number): number[] {
  if (!(hi - lo > 0)) return [lo, lo + 1];
  const step = niceStep((hi - lo) / count);
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v < hi + step * 0.999; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

/** legend / side keys: A = filled dot, B = ring (shape as well as shade, so colour is never the only cue) */
export function Key({ side }: { side: "a" | "b" | "mid" }) {
  return (
    <svg className="cmp-key" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {side === "a" ? (
        <circle cx="7" cy="7" r="4" fill="var(--cmp-a)" />
      ) : side === "b" ? (
        <circle cx="7" cy="7" r="5.5" fill="var(--sheet)" stroke="var(--cmp-b)" strokeWidth="2.5" />
      ) : (
        <line x1="7" x2="7" y1="1" y2="13" stroke="var(--ink)" strokeWidth="2" />
      )}
    </svg>
  );
}

interface Hoverable {
  hover: string | null;
  setHover: (id: string | null) => void;
  t: T;
  num: Fmt;
  ariaLabel: string;
}

export interface DotItem {
  id: string;
  name: string;
  a: number | null;
  b: number | null;
  /** midpoint marker ("same" comparisons) */
  mid?: number | null;
  aria: string;
}

/** A filled dot (A) and a ring (B) per sub-district joined by a line, on one shared axis from 0; rows in the order given. */
export function DotChart({ items, hover, setHover, t, num, ariaLabel, threshold, ticks: fixed, missingB }: Hoverable & {
  items: DotItem[];
  threshold?: number;
  ticks?: number[];
  missingB: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const vals = items.flatMap((r) => [r.a, r.b]).filter((v): v is number => v != null);
  const ticks = fixed ?? niceTicks(Math.max(...vals, threshold ?? 0), width < 420 ? 4 : 5);
  const max = ticks[ticks.length - 1];
  const rowH = 22, top = 24;
  const h = top + items.length * rowH + 4;
  const labelW = Math.round(Math.min(130, Math.max(88, width * 0.26)));
  const right = 18;
  const x = (v: number) => labelW + (v / max) * (width - labelW - right);
  // big numbers get a "k" on narrow screens so the tick labels do not touch
  const fmtTick = (v: number) => (max >= 10000 && width < 560 ? `${num(v / 1000)}k` : num(v, max < 5 && v % 1 ? 1 : 0));

  return (
    <div ref={ref} className="cmp-chart">
      {width > 0 && (
        <svg width={width} height={h} role="group" aria-label={ariaLabel}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={top - 4} y2={h - 4} stroke="var(--rule)" strokeWidth={1} />
              <text className="cv-tick" x={x(v)} y={12} textAnchor="middle">{fmtTick(v)}</text>
            </g>
          ))}
          {threshold != null && <line x1={x(threshold)} x2={x(threshold)} y1={top - 6} y2={h - 2} stroke="var(--ink)" strokeWidth={1.25} />}
          {items.map((r, i) => {
            const yy = top + (i + 0.5) * rowH;
            const on = r.id === hover;
            return (
              <g key={r.id} className={`cv-row${on ? " on" : ""}`} tabIndex={0} aria-label={r.aria}
                 onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}
                 onFocus={() => setHover(r.id)} onBlur={() => setHover(null)}>
                <rect x={0} y={yy - rowH / 2} width={width} height={rowH} className="cv-band" />
                <text className="cv-name" x={labelW - 12} y={yy} dy="0.35em" textAnchor="end">{r.name}</text>
                {r.a != null && r.b != null && (
                  <line x1={x(r.a)} x2={x(r.b)} y1={yy} y2={yy} stroke={on ? "var(--overprint)" : "var(--muted)"} strokeWidth={on ? 2.5 : 1.5} strokeLinecap="round" />
                )}
                {r.b != null ? (
                  <circle cx={x(r.b)} cy={yy} r={6} fill="var(--sheet)" stroke="var(--cmp-b)" strokeWidth={2.5} />
                ) : (
                  r.a != null && <text className="cv-tick" x={x(r.a) + 10} y={yy} dy="0.35em">{missingB}</text>
                )}
                {r.a != null && <circle cx={x(r.a)} cy={yy} r={4} fill="var(--cmp-a)" />}
                {r.mid != null && <line x1={x(r.mid)} x2={x(r.mid)} y1={yy - 7} y2={yy + 7} stroke={on ? "var(--overprint)" : "var(--ink)"} strokeWidth={2} />}
              </g>
            );
          })}
        </svg>
      )}
      {width === 0 && <span className="muted small">{t("กำลังวาดกราฟ…", "Drawing…")}</span>}
    </div>
  );
}

export interface BarItem {
  id: string;
  name: string;
  v: number | null;
  /** value printed at the bar's end */
  label: string;
  aria: string;
}

/** Horizontal bars from a zero line (negative to the left), value at each bar's end; rows in the order given. */
export function BarChart({ items, hover, setHover, ariaLabel, refs, fmtTick, empty }: Hoverable & {
  items: BarItem[];
  refs?: { value: number; label: string }[];
  fmtTick: (v: number) => string;
  /** text for a row without a value */
  empty: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const vals = items.map((r) => r.v).filter((v): v is number => v != null);
  const rv = (refs ?? []).map((r) => r.value);
  const lo = Math.min(0, ...vals, ...rv), hi = Math.max(0, ...vals, ...rv);
  const ticks = spanTicks(lo, hi, width < 420 ? 3 : 4);
  const t0 = ticks[0], t1 = ticks[ticks.length - 1];
  const rowH = 22, top = refs?.length ? 34 : 24;
  const h = top + items.length * rowH + 4;
  const labelW = Math.round(Math.min(130, Math.max(88, width * 0.26)));
  const padR = hi > 0 ? 50 : 14, padL = lo < 0 ? 50 : 8;
  const x = (v: number) => labelW + padL + ((v - t0) / (t1 - t0)) * (width - labelW - padL - padR);

  return (
    <div ref={ref} className="cmp-chart">
      {width > 0 && (
        <svg width={width} height={h} role="group" aria-label={ariaLabel}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={top - 4} y2={h - 4} stroke="var(--rule)" strokeWidth={1} />
              <text className="cv-tick" x={x(v)} y={12} textAnchor="middle">{fmtTick(v)}</text>
            </g>
          ))}
          {(refs ?? []).map((r) => (
            <g key={r.value}>
              <line x1={x(r.value)} x2={x(r.value)} y1={top - 6} y2={h - 2} stroke="var(--ink)" strokeWidth={1.25} />
              <text className="cv-tick strong" x={x(r.value) + 4} y={26} textAnchor="start">{r.label}</text>
            </g>
          ))}
          <line x1={x(0)} x2={x(0)} y1={top - 6} y2={h - 2} stroke="var(--ink)" strokeWidth={1} />
          {items.map((r, i) => {
            const yy = top + (i + 0.5) * rowH;
            const on = r.id === hover;
            const v = r.v;
            return (
              <g key={r.id} className={`cv-row${on ? " on" : ""}`} tabIndex={0} aria-label={r.aria}
                 onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}
                 onFocus={() => setHover(r.id)} onBlur={() => setHover(null)}>
                <rect x={0} y={yy - rowH / 2} width={width} height={rowH} className="cv-band" />
                <text className="cv-name" x={labelW - 12} y={yy} dy="0.35em" textAnchor="end">{r.name}</text>
                {v == null ? (
                  <text className="cv-tick" x={x(0) + 6} y={yy} dy="0.35em">{empty}</text>
                ) : (
                  <>
                    <rect x={Math.min(x(0), x(v))} y={yy - 6} width={Math.max(1, Math.abs(x(v) - x(0)))} height={12} rx={2}
                          fill={on ? "var(--overprint)" : "var(--cmp-a)"} />
                    <text className="cv-val" x={v >= 0 ? x(v) + 5 : x(v) - 5} y={yy} dy="0.35em" textAnchor={v >= 0 ? "start" : "end"}>{r.label}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
