import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FACTOR_BY_KEY, PRESETS } from "../factors";
import { CATEGORIES, CATEGORY_ORDER, type Category } from "../decision";
import { chartValue, comparePair, METHOD_PAIRS, summarise, type MethodPair, type PairRow } from "../methods";
import { effectiveShare } from "../scoring";
import { downloadText } from "../download";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { PageProps } from "../pageProps";
import type { Weights } from "../types";

/** short names for the four decision groups (the full names are long for a table cell) */
const CAT_SHORT: Record<Category, [string, string]> = {
  promote: ["ส่งเสริม", "Promote"],
  upgrade: ["ยกระดับ", "Upgrade"],
  prepare: ["เตรียมโครงสร้างพื้นฐาน", "Infrastructure first"],
  maintain: ["คงสภาพ", "Maintain"],
};

const RULES = [{ id: "current", th: "ที่ตั้งไว้ในหน้าแผนที่", en: "As set on the map page" }, ...PRESETS];

type Fmt = (n: number, digits?: number) => string;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
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

/** 0 … a round number at or above max, about `count` steps */
function niceTicks(max: number, count: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

export default function Compare({ data, weights, param }: PageProps & { param?: string }) {
  const { t, num, lang } = useI18n();
  const [pairId, setPairId] = useState(() => (METHOD_PAIRS.some((p) => p.id === param) ? param! : METHOD_PAIRS[0].id));
  const [ruleId, setRuleId] = useState("current");
  const [hover, setHover] = useState<string | null>(null);

  const pair = METHOD_PAIRS.find((p) => p.id === pairId)!;
  const rule = RULES.find((r) => r.id === ruleId)!;
  const w: Weights = ruleId === "current" ? weights : PRESETS.find((p) => p.id === ruleId)!.weights;

  const tambons = useMemo(() => data.tambons.features.map((f) => f.properties), [data]);
  const rows = useMemo(() => comparePair(tambons, w, pair), [tambons, w, pair]);
  const sum = useMemo(() => summarise(pair, rows), [pair, rows]);

  const pickPair = (id: string) => {
    setPairId(id);
    // keep the choice in the address without firing hashchange (which scrolls the page to the top)
    try {
      history.replaceState(null, "", href("compare", id));
    } catch {
      /* history unavailable */
    }
  };

  const name = (r: PairRow) => t(r.props.tambon_th, r.props.tambon_en);
  const cat = (c: Category) => t(...CAT_SHORT[c]);
  const share = pair.factor ? effectiveShare(pair.a.weights ? pair.a.weights(w) : w, pair.factor) : 100;
  const factorName = pair.factor ? t(FACTOR_BY_KEY[pair.factor].th, FACTOR_BY_KEY[pair.factor].en) : "";
  const ruleName = t(rule.th, rule.en);
  const factorOff = pair.factor != null && share === 0;

  const fmtRaw = (v: number | null, side: "a" | "b") =>
    v == null ? t("ไม่มีค่า", "no value") : `${num(v, pair.digits)} ${t(pair[side].unitTh, pair[side].unitEn)}`;
  const diffUnit = pair.diff === "points" ? t("จุด", "pts") : pair.diff === "score" ? t("คะแนน", "pts") : pair.diff === "unit" ? t(pair.a.unitTh, pair.a.unitEn) : "";
  const signed = (v: number, d: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), d)}`;

  const readout = (r: PairRow) => {
    const parts: string[] = [];
    if (pair.chart !== "score") parts.push(`${t("แบบ A", "A")} ${fmtRaw(r.a.raw, "a")} → ${t("แบบ B", "B")} ${fmtRaw(r.b.raw, "b")}`);
    if (pair.chart === "part" && !factorOff && r.a.part != null && r.b.part != null) parts.push(`${t("คะแนนปัจจัย", "factor score")} ${num(r.a.part, 1)} → ${num(r.b.part, 1)}`);
    parts.push(`${t("คะแนนรวม", "score")} ${num(r.a.score, 1)} → ${num(r.b.score, 1)}`);
    parts.push(`${t("อันดับ", "rank")} ${r.a.rank} → ${r.b.rank}`);
    parts.push(r.a.cat === r.b.cat ? cat(r.a.cat) : `${cat(r.a.cat)} → ${cat(r.b.cat)}`);
    return parts.join(" · ");
  };
  const hovered = rows.find((r) => r.props.id === hover) ?? null;

  const exportCsv = () => {
    const cols = ["method", "rule", "tambon_th", "tambon_en", "value_a", "value_b", "factor_score_a", "factor_score_b", "score_a", "score_b", "rank_a", "rank_b", "group_a", "group_b"];
    const lines = rows.map((r) =>
      [pair.id, rule.id, r.props.tambon_th, r.props.tambon_en, r.a.raw, r.b.raw, r.a.part, r.b.part, r.a.score, r.b.score, r.a.rank, r.b.rank, r.a.cat, r.b.cat]
        .map((v) => (typeof v === "number" ? String(Number(v.toFixed(2))) : JSON.stringify(v ?? "")))
        .join(","),
    );
    downloadText(`phuket_compare_${pair.id}_${rule.id}.csv`, "﻿" + [cols.join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <div className="page compare">
      <header style={{ display: "grid", gap: 8 }}>
        <h1>{t("ข้อมูลชุดเดิม คิดคนละวิธี คำตอบเปลี่ยนไหม", "Same data, a different method: does the answer change?")}</h1>
        <p className="lede">
          {t("เลือกเรื่อง แล้วดูว่าถ้าเปลี่ยนจากวิธีที่เว็บใช้ (แบบ A) เป็นอีกวิธี (แบบ B) อันดับและกลุ่มการตัดสินใจของ 17 ตำบลเปลี่ยนแค่ไหน ข้อมูลทุกตัวมาจากชุดเดียวกัน ต่างแค่วิธีคิด",
             "Pick a topic and see how far the ranks and decision groups of the 17 sub-districts move when the site's method (A) is swapped for another (B). Both use exactly the same data; only the method differs.")}
        </p>
      </header>

      <section className="cmp-controls" aria-label={t("ตัวเลือก", "Options")}>
        <div className="choice cmp-pairs" role="group" aria-label={t("เรื่องที่เทียบ", "Topic")}>
          {METHOD_PAIRS.map((p) => (
            <button key={p.id} aria-pressed={p.id === pairId} onClick={() => pickPair(p.id)}>
              <b>{t(p.th, p.en)}</b>
              <span className="small muted">{t(p.a.th, p.a.en)} ↔ {t(p.b.th, p.b.en)}</span>
            </button>
          ))}
        </div>
        <div className="row cmp-rule">
          <span className="small muted">{t("หลักเกณฑ์ที่ใช้คิดคะแนน", "Rule used for the scores")}</span>
          <div className="seg" role="group" aria-label={t("หลักเกณฑ์", "Rule")}>
            {RULES.map((r) => (
              <button key={r.id} aria-pressed={r.id === ruleId} onClick={() => setRuleId(r.id)}>{t(r.th, r.en)}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="cmp-ab" aria-label={t("สองวิธีที่เทียบ", "The two methods")}>
        {(["a", "b"] as const).map((k) => (
          <div key={k} className={`cmp-side ${k}`}>
            <div className="cmp-side-head">
              <Key side={k} />
              <b>{k === "a" ? t("แบบ A · ที่เว็บใช้", "A · what the site uses") : t("แบบ B · อีกวิธี", "B · the alternative")}</b>
            </div>
            <h2>{t(pair[k].th, pair[k].en)}</h2>
            <p>{t(pair[k].howTh, pair[k].howEn)}</p>
          </div>
        ))}
      </section>

      <section className="cmp-result" aria-live="polite">
        <p className="cmp-rule-note">
          {pair.factor == null
            ? t(`หลักเกณฑ์ "${ruleName}" เปลี่ยนวิธีนี้กับทุกปัจจัยที่เปิดอยู่`, `Rule "${ruleName}": the method applies to every factor switched on`)
            : factorOff
              ? pair.matrixAxis
                ? t(`หลักเกณฑ์ "${ruleName}" ปิดปัจจัย${factorName}อยู่ คะแนนจึงไม่เปลี่ยน แต่ Logic Matrix ยังใช้ค่านี้แบ่งกลุ่ม`, `Rule "${ruleName}" switches ${factorName.toLowerCase()} off, so scores do not move, but the Logic Matrix still uses it to split the groups`)
                : t(`หลักเกณฑ์ "${ruleName}" ปิดปัจจัย${factorName}อยู่ วิธีคิดนี้จึงไม่เปลี่ยนคำตอบ ลองเลือกหลักเกณฑ์อื่น`, `Rule "${ruleName}" switches ${factorName.toLowerCase()} off, so this method cannot change the answer. Try another rule`)
              : t(`หลักเกณฑ์ "${ruleName}" ให้น้ำหนัก${factorName} ${num(share, 0)}% ของคะแนน`, `Rule "${ruleName}" gives ${factorName.toLowerCase()} ${num(share, 0)} % of the score`)}
        </p>
        <p className="cmp-lead">
          {sum.rankChanged === 0 && sum.catChanged.length === 0
            ? t("เปลี่ยนเป็นแบบ B แล้ว ไม่มีตำบลไหนเปลี่ยนอันดับหรือกลุ่มการตัดสินใจ", "With method B no sub-district changes rank or decision group.")
            : t(
                `เปลี่ยนเป็นแบบ B แล้ว ${sum.rankChanged ? `อันดับเปลี่ยน ${sum.rankChanged} จาก 17 ตำบล (ขยับมากสุด ${sum.maxMove} อันดับ) 5 อันดับแรกยังอยู่ ${sum.top5Same} ตำบล` : "อันดับไม่เปลี่ยนเลย"} และกลุ่มการตัดสินใจ${sum.catChanged.length ? `เปลี่ยน ${sum.catChanged.length} ตำบล` : "ไม่เปลี่ยน"}`,
                `With method B, ${sum.rankChanged ? `${sum.rankChanged} of 17 sub-districts change rank (at most ${sum.maxMove} places) and ${sum.top5Same} of the top 5 stay there` : "no rank changes"}; ${sum.catChanged.length ? `${sum.catChanged.length} change decision group` : "no decision group changes"}.`,
              )}
        </p>
        {sum.catChanged.length > 0 && (
          <ul className="cmp-changes">
            {sum.catChanged.map((r) => (
              <li key={r.props.id}>
                <b>{name(r)}</b> <Swatch c={r.a.cat} />{cat(r.a.cat)} → <Swatch c={r.b.cat} />{cat(r.b.cat)}{" "}
                <span className="muted small">
                  {pair.matrixAxis && r.a.raw != null && r.b.raw != null
                    ? t(`(ที่ดินพัฒนาได้ ${num(r.a.raw, 1)}% → ${num(r.b.raw, 1)}%)`, `(developable ${num(r.a.raw, 1)} % → ${num(r.b.raw, 1)} %)`)
                    : t(`(คะแนน ${num(r.a.score, 1)} → ${num(r.b.score, 1)})`, `(score ${num(r.a.score, 1)} → ${num(r.b.score, 1)})`)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(sum.biggest || sum.missingB.length > 0) && (
          <p className="small muted">
            {sum.biggest && pair.diff && (() => {
              const r = sum.biggest!;
              const a = chartValue(pair, r.a)!, b = chartValue(pair, r.b)!;
              return t(`ต่างกันมากที่สุด: ${name(r)} ${num(a, pair.digits)} → ${num(b, pair.digits)} (${signed(b - a, pair.digits)} ${diffUnit})`,
                       `Largest gap: ${name(r)} ${num(a, pair.digits)} → ${num(b, pair.digits)} (${signed(b - a, pair.digits)} ${diffUnit})`);
            })()}
            {sum.biggest && pair.diff && sum.missingB.length > 0 && " · "}
            {sum.missingB.length > 0 &&
              t(`${sum.missingB.map(name).join(", ")} ไม่มีค่าแบบ B จึงได้คะแนนปัจจัยกลาง 50`,
                `${sum.missingB.map(name).join(", ")} ${sum.missingB.length > 1 ? "have" : "has"} no B value, so ${sum.missingB.length > 1 ? "they get" : "it gets"} the middle factor score of 50`)}
          </p>
        )}
      </section>

      <section className="cmp-charts">
        <figure className="cmp-fig">
          <h2>{t("อันดับขยับอย่างไร", "How the ranks move")}</h2>
          <SlopeChart rows={rows} hover={hover} setHover={setHover} name={name} t={t} readout={readout} />
          <figcaption className="cmp-legend">
            {CATEGORY_ORDER.map((c) => (
              <span key={c}><Swatch c={c} round />{cat(c)}</span>
            ))}
            <span className="muted">{t("เส้นเข้ม = กลุ่มเปลี่ยน", "dark line = group changes")}</span>
          </figcaption>
        </figure>
        <figure className="cmp-fig">
          <h2>
            {pair.chart === "raw"
              ? t(`ค่าของแต่ละตำบล (${pair.a.unitTh})`, `Value per sub-district (${pair.a.unitEn})`)
              : pair.chart === "part"
                ? t("คะแนนปัจจัย 0–100 (หน่วยดิบต่างกัน)", "Factor score 0–100 (raw units differ)")
                : t("คะแนนรวม 0–100", "Overall score 0–100")}
          </h2>
          <DotChart pair={pair} rows={rows} hover={hover} setHover={setHover} name={name} t={t} num={num} readout={readout} />
          <figcaption className="cmp-legend">
            <span><Key side="a" />{t(`แบบ A ${pair.a.th}`, `A ${pair.a.en}`)}</span>
            <span><Key side="b" />{t(`แบบ B ${pair.b.th}`, `B ${pair.b.en}`)}</span>
            {pair.threshold && <span><i className="cmp-thr-key" />{t(pair.threshold.th, pair.threshold.en)}</span>}
          </figcaption>
        </figure>
        <p className="cmp-readout small" aria-live="polite">
          {hovered ? <><b>{name(hovered)}</b> · {readout(hovered)}</> : <span className="muted">{t("ชี้หรือแตะตำบลในกราฟหรือตารางเพื่อดูค่า", "Point at or tap a sub-district in a chart or the table to see its values")}</span>}
        </p>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>{t("ตาราง 17 ตำบล", "All 17 sub-districts")}</h2>
          <button className="btn ghost" onClick={exportCsv}>{t("ดาวน์โหลด CSV", "Download CSV")}</button>
        </div>
        <div className="tbl">
          <table className="cmp-table">
            <thead>
              <tr>
                <th>{t("ตำบล", "Sub-district")}</th>
                {pair.chart !== "score" && <th className="num">{t("แบบ A", "A")}<span className="unit">{t(pair.a.unitTh, pair.a.unitEn)}</span></th>}
                {pair.chart !== "score" && <th className="num">{t("แบบ B", "B")}<span className="unit">{t(pair.b.unitTh, pair.b.unitEn)}</span></th>}
                {pair.diff && pair.chart !== "score" && <th className="num">B − A<span className="unit">{diffUnit}</span></th>}
                {pair.factor && !factorOff && <th className="num">{t("คะแนนปัจจัย A → B", "Factor score A → B")}</th>}
                <th className="num">{t("คะแนนรวม A → B", "Score A → B")}</th>
                {pair.chart === "score" && <th className="num">B − A<span className="unit">{t("คะแนน", "pts")}</span></th>}
                <th className="num">{t("อันดับ A → B", "Rank A → B")}</th>
                <th>{t("กลุ่ม A → B", "Group A → B")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const moved = r.b.rank - r.a.rank;
                const catChange = r.a.cat !== r.b.cat;
                return (
                  <tr key={r.props.id} className={`${hover === r.props.id ? "hl" : ""} ${catChange ? "changed" : ""}`}
                      onMouseEnter={() => setHover(r.props.id)} onMouseLeave={() => setHover(null)}>
                    <td>
                      <a href={href("map", r.props.id)} onFocus={() => setHover(r.props.id)} onBlur={() => setHover(null)}>{name(r)}</a>
                      <div className="small muted">{t(`อ.${r.props.amphoe_th}`, r.props.amphoe_en)}</div>
                    </td>
                    {pair.chart !== "score" && <td className="num">{r.a.raw == null ? "–" : num(r.a.raw, pair.digits)}</td>}
                    {pair.chart !== "score" && <td className="num">{r.b.raw == null ? <span className="muted">{t("ไม่มีค่า", "none")}</span> : num(r.b.raw, pair.digits)}</td>}
                    {pair.diff && pair.chart !== "score" && (
                      <td className="num">{r.a.raw == null || r.b.raw == null ? "–" : signed(r.b.raw - r.a.raw, pair.digits)}</td>
                    )}
                    {pair.factor && !factorOff && <td className="num">{num(r.a.part ?? 50, 1)} → {num(r.b.part ?? 50, 1)}</td>}
                    <td className="num">{num(r.a.score, 1)} → {num(r.b.score, 1)}</td>
                    {pair.chart === "score" && <td className="num">{signed(r.b.score - r.a.score, 1)}</td>}
                    <td className="num">
                      {r.a.rank} → {r.b.rank}{" "}
                      <span className={moved ? "" : "muted"} aria-label={moved ? t(`${moved < 0 ? "ขึ้น" : "ลง"} ${Math.abs(moved)} อันดับ`, `${moved < 0 ? "up" : "down"} ${Math.abs(moved)}`) : t("เท่าเดิม", "same")}>
                        {moved < 0 ? `▲${-moved}` : moved > 0 ? `▼${moved}` : "="}
                      </span>
                    </td>
                    <td>
                      <Swatch c={r.a.cat} />{cat(r.a.cat)}
                      {catChange && <> → <Swatch c={r.b.cat} /><b>{cat(r.b.cat)}</b></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid3 cmp-notes">
        <div className="card">
          <h3>{t("อ่านอย่างไร", "How to read it")}</h3>
          <ul>{(lang === "th" ? pair.readTh : pair.readEn).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card">
          <h3>{t("ห้ามสรุปว่า…", "Do not conclude…")}</h3>
          <ul>{(lang === "th" ? pair.notTh : pair.notEn).map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card">
          <h3>{t("ทำไมเว็บใช้แบบ A", "Why the site uses A")}</h3>
          <p>{t(pair.whyTh, pair.whyEn)}</p>
        </div>
      </section>

      <p className="small muted">
        {t("ข้อมูล", "Data")}: {t(pair.sourceTh, pair.sourceEn)} ·{" "}
        {t("คะแนนคิดในเบราว์เซอร์ด้วยสูตรเดียวกับหน้าแผนที่ แบบ A คือค่าตั้งต้นของเว็บ เกณฑ์กลุ่ม = คะแนน 50 × ที่ดินพัฒนาได้ 20%",
           "Scores are worked out in the browser with the same formula as the map page; A is the site's default. Group cut-offs: score 50 × developable land 20 %.")}{" "}
        <a href={href("method")}>{t("วิธีคิดและแหล่งข้อมูล", "Method & data")}</a>
      </p>
    </div>
  );
}

function Swatch({ c, round }: { c: Category; round?: boolean }) {
  return <i className={`cmp-sw${round ? " round" : ""}`} style={{ background: CATEGORIES[c].color }} aria-hidden="true" />;
}

function Key({ side }: { side: "a" | "b" }) {
  return (
    <svg className="cmp-key" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {side === "a" ? <circle cx="7" cy="7" r="4" fill="var(--cmp-a)" /> : <circle cx="7" cy="7" r="5.5" fill="var(--sheet)" stroke="var(--cmp-b)" strokeWidth="2.5" />}
    </svg>
  );
}

interface ChartProps {
  rows: PairRow[];
  hover: string | null;
  setHover: (id: string | null) => void;
  name: (r: PairRow) => string;
  t: (th: string, en: string) => string;
  readout: (r: PairRow) => string;
}

/** Rank under A (left) joined to rank under B (right); end dots coloured by decision group. */
function SlopeChart({ rows, hover, setHover, name, t, readout }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = rows.length;
  const rowH = 22, top = 28;
  const h = top + n * rowH + 4;
  const labelW = Math.round(Math.min(150, Math.max(96, width * 0.3)));
  const x0 = labelW, x1 = Math.max(labelW + 40, width - labelW);
  const y = (rank: number) => top + (rank - 0.5) * rowH;
  const kind = (r: PairRow) => (r.a.cat !== r.b.cat ? 2 : r.a.rank !== r.b.rank ? 1 : 0);
  const order = [...rows].sort((p, q) => kind(p) - kind(q) || Number(p.props.id === hover) - Number(q.props.id === hover));

  return (
    <div ref={ref} className="cmp-chart">
      {width > 0 && (
        <svg width={width} height={h} role="group" aria-label={t("กราฟอันดับแบบ A ทางซ้าย เชื่อมกับอันดับแบบ B ทางขวา", "Ranks under A on the left joined to ranks under B on the right")}>
          <text className="cv-head" x={x0} y={14} textAnchor="middle">{t("แบบ A", "A")}</text>
          <text className="cv-head" x={x1} y={14} textAnchor="middle">{t("แบบ B", "B")}</text>
          {order.map((r) => {
            const k = kind(r), on = r.props.id === hover;
            const ya = y(r.a.rank), yb = y(r.b.rank);
            return (
              <g key={r.props.id} className={`cv-row${on ? " on" : ""}`} tabIndex={0}
                 aria-label={`${name(r)}: ${readout(r)}`}
                 onMouseEnter={() => setHover(r.props.id)} onMouseLeave={() => setHover(null)}
                 onFocus={() => setHover(r.props.id)} onBlur={() => setHover(null)}>
                <rect x={0} y={ya - rowH / 2} width={x0} height={rowH} fill="transparent" />
                <rect x={x1} y={yb - rowH / 2} width={width - x1} height={rowH} fill="transparent" />
                <line x1={x0} y1={ya} x2={x1} y2={yb} stroke="transparent" strokeWidth={14} />
                <line x1={x0} y1={ya} x2={x1} y2={yb}
                      stroke={on ? "var(--overprint)" : k === 2 ? "var(--ink)" : k === 1 ? "var(--muted)" : "var(--rule)"}
                      strokeWidth={on ? 3 : k === 2 ? 2.25 : k === 1 ? 1.5 : 1.5} strokeLinecap="round" />
                <circle cx={x0} cy={ya} r={4.5} fill={CATEGORIES[r.a.cat].color} stroke="var(--sheet)" strokeWidth={2} />
                <circle cx={x1} cy={yb} r={4.5} fill={CATEGORIES[r.b.cat].color} stroke="var(--sheet)" strokeWidth={2} />
                <text className="cv-rank" x={0} y={ya} dy="0.35em">{r.a.rank}</text>
                <text className={`cv-name${k === 2 ? " strong" : ""}`} x={x0 - 10} y={ya} dy="0.35em" textAnchor="end">{name(r)}</text>
                <text className={`cv-name${k === 2 ? " strong" : ""}`} x={x1 + 10} y={yb} dy="0.35em">{name(r)}</text>
                <text className="cv-rank" x={width} y={yb} dy="0.35em" textAnchor="end">{r.b.rank}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** A filled dot (method A) and a ring (method B) per sub-district, joined by a line, on one shared axis. */
function DotChart({ pair, rows, hover, setHover, name, t, num, readout }: ChartProps & { pair: MethodPair; num: Fmt }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const sorted = useMemo(
    () => [...rows].sort((p, q) => (chartValue(pair, q.a) ?? -1) - (chartValue(pair, p.a) ?? -1)),
    [rows, pair],
  );
  const vals = sorted.flatMap((r) => [chartValue(pair, r.a), chartValue(pair, r.b)]).filter((v): v is number => v != null);
  const ticks = pair.chart === "raw" ? niceTicks(Math.max(...vals, pair.threshold?.value ?? 0), width < 420 ? 4 : 5) : [0, 25, 50, 75, 100];
  const max = ticks[ticks.length - 1];
  const rowH = 22, top = 24;
  const h = top + sorted.length * rowH + 4;
  const labelW = Math.round(Math.min(130, Math.max(88, width * 0.26)));
  const right = 18;
  const x = (v: number) => labelW + (v / max) * (width - labelW - right);
  // thousands of baht get a "k" on narrow screens so the tick labels do not touch
  const fmtTick = (v: number) => (max >= 10000 && width < 560 ? `${num(v / 1000)}k` : num(v));

  return (
    <div ref={ref} className="cmp-chart">
      {width > 0 && (
        <svg width={width} height={h} role="group" aria-label={t("กราฟจุดคู่ แบบ A กับแบบ B ของแต่ละตำบล", "Paired dots, A and B, for each sub-district")}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={top - 4} y2={h - 4} stroke="var(--rule)" strokeWidth={1} />
              <text className="cv-tick" x={x(v)} y={12} textAnchor="middle">{fmtTick(v)}</text>
            </g>
          ))}
          {pair.threshold && (
            <line x1={x(pair.threshold.value)} x2={x(pair.threshold.value)} y1={top - 6} y2={h - 2} stroke="var(--ink)" strokeWidth={1.25} />
          )}
          {sorted.map((r, i) => {
            const a = chartValue(pair, r.a), b = chartValue(pair, r.b);
            const yy = top + (i + 0.5) * rowH;
            const on = r.props.id === hover;
            return (
              <g key={r.props.id} className={`cv-row${on ? " on" : ""}`} tabIndex={0} aria-label={`${name(r)}: ${readout(r)}`}
                 onMouseEnter={() => setHover(r.props.id)} onMouseLeave={() => setHover(null)}
                 onFocus={() => setHover(r.props.id)} onBlur={() => setHover(null)}>
                <rect x={0} y={yy - rowH / 2} width={width} height={rowH} className="cv-band" />
                <text className="cv-name" x={labelW - 12} y={yy} dy="0.35em" textAnchor="end">{name(r)}</text>
                {a != null && b != null && (
                  <line x1={x(a)} x2={x(b)} y1={yy} y2={yy} stroke={on ? "var(--overprint)" : "var(--muted)"} strokeWidth={on ? 2.5 : 1.5} strokeLinecap="round" />
                )}
                {b != null ? (
                  <circle cx={x(b)} cy={yy} r={6} fill="var(--sheet)" stroke="var(--cmp-b)" strokeWidth={2.5} />
                ) : (
                  a != null && <text className="cv-tick" x={x(a) + 10} y={yy} dy="0.35em">{t("ไม่มีค่าแบบ B", "no B value")}</text>
                )}
                {a != null && <circle cx={x(a)} cy={yy} r={4} fill="var(--cmp-a)" />}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
