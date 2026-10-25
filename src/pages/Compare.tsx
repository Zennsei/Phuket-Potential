import { useMemo, useState } from "react";
import { FACTOR_BY_KEY, PRESETS } from "../factors";
import { CATEGORIES, CATEGORY_ORDER, type Category } from "../decision";
import { chartValue, comparePair, METHOD_PAIRS, summarise, type PairRow } from "../methods";
import { KINDS, SOURCE_PAIRS, type SourceKind } from "../sources";
import { effectiveShare } from "../scoring";
import { downloadText } from "../download";
import { useI18n } from "../i18n";
import { href } from "../router";
import { DotChart, Key, useWidth } from "../components/CompareCharts";
import SourceCompare from "../components/SourceCompare";
import type { PageProps } from "../pageProps";
import type { TambonProps, Weights } from "../types";

/** short names for the four decision groups (the full names are long for a table cell) */
const CAT_SHORT: Record<Category, [string, string]> = {
  promote: ["ส่งเสริม", "Promote"],
  upgrade: ["ยกระดับ", "Upgrade"],
  prepare: ["เตรียมโครงสร้างพื้นฐาน", "Infrastructure first"],
  maintain: ["คงสภาพ", "Maintain"],
};

const RULES = [{ id: "current", th: "ที่ตั้งไว้ในหน้าแผนที่", en: "As set on the map page" }, ...PRESETS];

type Kind = SourceKind | "method";

interface Topic {
  id: string;
  kind: Kind;
  th: string;
  en: string;
  subTh: string;
  subEn: string;
}

const TOPICS: Topic[] = [
  ...METHOD_PAIRS.map((p) => ({ id: p.id, kind: "method" as const, th: p.th, en: p.en, subTh: `${p.a.th} ↔ ${p.b.th}`, subEn: `${p.a.en} ↔ ${p.b.en}` })),
  ...SOURCE_PAIRS.map((p) => {
    const [ath, aen] = p.a.label({ measure: "footprint", from: 2559, to: 2568 });
    const [bth, ben] = p.b.label({ measure: "footprint", from: 2559, to: 2568 });
    return { id: p.id, kind: p.kind, th: p.th, en: p.en, subTh: p.option === "years" ? "เลือกปีได้" : `${ath} ↔ ${bth}`, subEn: p.option === "years" ? "pick the years" : `${aen} ↔ ${ben}` };
  }),
];

const setAddress = (id: string) => {
  // keep the choice in the address without firing hashchange (which scrolls the page to the top)
  try {
    history.replaceState(null, "", href("compare", id));
  } catch {
    /* history unavailable */
  }
};

export default function Compare({ data, weights, param }: PageProps & { param?: string }) {
  const { t } = useI18n();
  const [topicId, setTopicId] = useState(() => (TOPICS.some((p) => p.id === param) ? param! : TOPICS[0].id));
  const topic = TOPICS.find((p) => p.id === topicId)!;
  const kind = KINDS.find((k) => k.id === topic.kind)!;
  const tambons = useMemo(() => data.tambons.features.map((f) => f.properties), [data]);

  const pick = (id: string) => {
    setTopicId(id);
    setAddress(id);
  };

  return (
    <div className="page compare">
      <header style={{ display: "grid", gap: 8 }}>
        <h1>{t("เรื่องเดียวกัน ข้อมูลต่างกัน เทียบอย่างไร", "Same topic, different numbers: how to compare")}</h1>
        <p className="lede">
          {t("บางเรื่องมีข้อมูลมากกว่า 1 แหล่ง คิดได้หลายวิธี หรือมีหลายปี แต่ละแบบต้องคิดผลต่างคนละแบบ เพราะความหมายของส่วนต่างไม่เหมือนกัน",
             "Some topics have more than one source, more than one method, or several years. Each needs its own way of working out the gap, because the gap means something different each time.")}
        </p>
      </header>

      <section className="cmp-controls" aria-label={t("ตัวเลือก", "Options")}>
        <nav className="mission-nav cmp-kinds" aria-label={t("แบบการเทียบ", "Kind of comparison")}>
          {KINDS.map((k) => (
            <button key={k.id} aria-current={k.id === topic.kind ? "step" : undefined} onClick={() => pick(TOPICS.find((p) => p.kind === k.id)!.id)}>
              {t(k.th, k.en)}
            </button>
          ))}
        </nav>
        <p className="cmp-kind-lead">{t(kind.leadTh, kind.leadEn)}</p>
        <div className="choice cmp-pairs" role="group" aria-label={t("เรื่องที่เทียบ", "Topic")}>
          {TOPICS.filter((p) => p.kind === topic.kind).map((p) => (
            <button key={p.id} aria-pressed={p.id === topicId} onClick={() => pick(p.id)}>
              <b>{t(p.th, p.en)}</b>
              <span className="small muted">{t(p.subTh, p.subEn)}</span>
            </button>
          ))}
        </div>
      </section>

      {topic.kind === "method" ? (
        <MethodView key={topic.id} pairId={topic.id} tambons={tambons} weights={weights} />
      ) : (
        <SourceCompare key={topic.id} pair={SOURCE_PAIRS.find((p) => p.id === topic.id)!} tambons={tambons} />
      )}
    </div>
  );
}

/** "Different method": the same data worked out two ways, scored with the same rule. */
function MethodView({ pairId, tambons, weights }: { pairId: string; tambons: TambonProps[]; weights: Weights }) {
  const { t, num, lang } = useI18n();
  const [ruleId, setRuleId] = useState("current");
  const [hover, setHover] = useState<string | null>(null);

  const pair = METHOD_PAIRS.find((p) => p.id === pairId)!;
  const rule = RULES.find((r) => r.id === ruleId)!;
  const w: Weights = ruleId === "current" ? weights : PRESETS.find((p) => p.id === ruleId)!.weights;

  const rows = useMemo(() => comparePair(tambons, w, pair), [tambons, w, pair]);
  const sum = useMemo(() => summarise(pair, rows), [pair, rows]);

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
  /** % difference against the midpoint of A and B; only for same-unit values that are not already percentages */
  const pctOf = (a: number | null, b: number | null) => (pair.diff !== "unit" || a == null || b == null || a + b <= 0 ? null : ((b - a) / ((a + b) / 2)) * 100);

  const readout = (r: PairRow) => {
    const parts: string[] = [];
    if (pair.chart !== "score") parts.push(`${t("แบบ A", "A")} ${fmtRaw(r.a.raw, "a")} → ${t("แบบ B", "B")} ${fmtRaw(r.b.raw, "b")}`);
    const p = pctOf(r.a.raw, r.b.raw);
    if (p != null) parts.push(t(`ต่าง ${signed(p, 1)}% ของค่ากลาง`, `${signed(p, 1)} % of the midpoint`));
    if (pair.chart === "part" && !factorOff && r.a.part != null && r.b.part != null) parts.push(`${t("คะแนนปัจจัย", "factor score")} ${num(r.a.part, 1)} → ${num(r.b.part, 1)}`);
    parts.push(`${t("คะแนนรวม", "score")} ${num(r.a.score, 1)} → ${num(r.b.score, 1)}`);
    parts.push(`${t("อันดับ", "rank")} ${r.a.rank} → ${r.b.rank}`);
    parts.push(r.a.cat === r.b.cat ? cat(r.a.cat) : `${cat(r.a.cat)} → ${cat(r.b.cat)}`);
    return parts.join(" · ");
  };
  const hovered = rows.find((r) => r.props.id === hover) ?? null;
  const dotItems = [...rows]
    .sort((p, q) => (chartValue(pair, q.a) ?? -1) - (chartValue(pair, p.a) ?? -1))
    .map((r) => ({ id: r.props.id, name: name(r), a: chartValue(pair, r.a), b: chartValue(pair, r.b), aria: `${name(r)}: ${readout(r)}` }));

  const exportCsv = () => {
    const cols = ["method", "rule", "tambon_th", "tambon_en", "value_a", "value_b", "pct_of_midpoint", "factor_score_a", "factor_score_b", "score_a", "score_b", "rank_a", "rank_b", "group_a", "group_b"];
    const lines = rows.map((r) =>
      [pair.id, rule.id, r.props.tambon_th, r.props.tambon_en, r.a.raw, r.b.raw, pctOf(r.a.raw, r.b.raw), r.a.part, r.b.part, r.a.score, r.b.score, r.a.rank, r.b.rank, r.a.cat, r.b.cat]
        .map((v) => (typeof v === "number" ? String(Number(v.toFixed(2))) : JSON.stringify(v ?? "")))
        .join(","),
    );
    downloadText(`phuket_compare_${pair.id}_${rule.id}.csv`, "﻿" + [cols.join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
  };

  return (
    <>
      <div className="row cmp-rule">
        <span className="small muted">{t("หลักเกณฑ์ที่ใช้คิดคะแนน", "Rule used for the scores")}</span>
        <div className="seg" role="group" aria-label={t("หลักเกณฑ์", "Rule")}>
          {RULES.map((r) => (
            <button key={r.id} aria-pressed={r.id === ruleId} onClick={() => setRuleId(r.id)}>{t(r.th, r.en)}</button>
          ))}
        </div>
      </div>

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
              const p = pctOf(a, b);
              const pct = p == null ? "" : t(`, ${signed(p, 1)}% ของค่ากลาง`, `, ${signed(p, 1)} % of the midpoint`);
              return t(`ต่างกันมากที่สุด: ${name(r)} ${num(a, pair.digits)} → ${num(b, pair.digits)} (${signed(b - a, pair.digits)} ${diffUnit}${pct})`,
                       `Largest gap: ${name(r)} ${num(a, pair.digits)} → ${num(b, pair.digits)} (${signed(b - a, pair.digits)} ${diffUnit}${pct})`);
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
          <DotChart items={dotItems} hover={hover} setHover={setHover} t={t} num={num}
                    threshold={pair.threshold?.value} ticks={pair.chart === "raw" ? undefined : [0, 25, 50, 75, 100]}
                    missingB={t("ไม่มีค่าแบบ B", "no B value")}
                    ariaLabel={t("กราฟจุดคู่ แบบ A กับแบบ B ของแต่ละตำบล", "Paired dots, A and B, for each sub-district")} />
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
                {pair.diff === "unit" && <th className="num">{t("% ต่าง", "% difference")}<span className="unit">{t("เทียบค่ากลาง", "of the midpoint")}</span></th>}
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
                const p = pctOf(r.a.raw, r.b.raw);
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
                    {pair.diff === "unit" && <td className="num">{p == null ? "–" : `${signed(p, 1)}%`}</td>}
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
        {t("คะแนนคิดในเบราว์เซอร์ด้วยสูตรเดียวกับหน้าแผนที่ แบบ A คือค่าตั้งต้นของเว็บ เกณฑ์กลุ่ม = คะแนน 50 × ที่ดินพัฒนาได้ 20% · % ต่างเทียบกับค่ากลางของสองแบบ ค่าที่เป็น % อยู่แล้วบอกผลต่างเป็นจุด",
           "Scores are worked out in the browser with the same formula as the map page; A is the site's default. Group cut-offs: score 50 × developable land 20 %. % difference is against the midpoint of the two; values that are already percentages show the gap in points.")}{" "}
        <a href={href("method")}>{t("วิธีคิดและแหล่งข้อมูล", "Method & data")}</a>
      </p>
    </>
  );
}

function Swatch({ c, round }: { c: Category; round?: boolean }) {
  return <i className={`cmp-sw${round ? " round" : ""}`} style={{ background: CATEGORIES[c].color }} aria-hidden="true" />;
}

interface SlopeProps {
  rows: PairRow[];
  hover: string | null;
  setHover: (id: string | null) => void;
  name: (r: PairRow) => string;
  t: (th: string, en: string) => string;
  readout: (r: PairRow) => string;
}

/** Rank under A (left) joined to rank under B (right); end dots coloured by decision group. */
function SlopeChart({ rows, hover, setHover, name, t, readout }: SlopeProps) {
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
                      strokeWidth={on ? 3 : k === 2 ? 2.25 : 1.5} strokeLinecap="round" />
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
