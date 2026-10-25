import { useMemo, useState } from "react";
import { BarChart, DotChart, Key } from "./CompareCharts";
import { UNREG_FLAG } from "../decision";
import { compareSources, DEFAULT_OPTS, KINDS, measureLabel, useBuildingSources, YEARS, type SourceOpts, type SourcePair, type SourceRow } from "../sources";
import { downloadText } from "../download";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { TambonProps } from "../types";

/** The "same thing / different definitions / different years" comparisons: data against data, no scores involved. */
export default function SourceCompare({ pair, tambons }: { pair: SourcePair; tambons: TambonProps[] }) {
  const { t, num, lang } = useI18n();
  const [opts, setOpts] = useState<SourceOpts>(DEFAULT_OPTS);
  const [hover, setHover] = useState<string | null>(null);
  const bldg = useBuildingSources(!!pair.needsBuildings);
  const kind = KINDS.find((k) => k.id === pair.kind)!;

  const ready = !pair.needsBuildings || !!bldg.data;
  const res = useMemo(() => (ready ? compareSources(tambons, pair, { bldg: bldg.data }, opts) : null), [ready, tambons, pair, bldg.data, opts]);

  const d = pair.digits(opts);
  const unit = t(...pair.unit(opts));
  /** "total building footprint, km²" for the building topics, just the unit otherwise */
  const what = pair.option === "measure" ? `${t(...measureLabel(opts))} ${unit}` : unit;
  const la = t(...pair.a.label(opts)), lb = t(...pair.b.label(opts));
  const name = (r: SourceRow) => t(r.props.tambon_th, r.props.tambon_en);
  const signed = (v: number, digits: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${num(Math.abs(v), digits)}`;
  const pctTxt = (v: number | null) => (v == null ? "–" : `${signed(v, 1)}%`);
  const times = (v: number | null) => (v == null ? "–" : t(`${num(v, 2)} เท่า`, `${num(v, 2)}×`));
  const est = (r: { mid: number | null; diff: number | null }) => (r.mid == null || r.diff == null ? "–" : `${num(r.mid, d)} ± ${num(Math.abs(r.diff) / 2, d)}`);
  const warn = pair.warn?.(opts);

  /** the value chart 2 plots, and what is printed at the bar's end */
  const metric = (r: Omit<SourceRow, "props">) => (pair.kind === "definition" ? r.ratio : r.pct);
  const metricLabel = (r: Omit<SourceRow, "props">) => (pair.kind === "definition" ? (r.ratio == null ? "–" : num(r.ratio, 1)) : pctTxt(r.pct));

  const readout = (r: SourceRow) => {
    const parts = [`${la} ${r.a == null ? "–" : num(r.a, d)} · ${lb} ${r.b == null ? "–" : num(r.b, d)} ${unit}`];
    if (pair.kind === "same") parts.push(`${t("ต่าง", "difference")} ${pctTxt(r.pct)} ${t("ของค่ากลาง", "of the midpoint")}`, `${t("ค่าประมาณ", "estimate")} ${est(r)}`);
    if (pair.kind === "definition") parts.push(`${lb} ÷ ${la} = ${times(r.ratio)}`);
    if (pair.kind === "time") parts.push(`${t("เปลี่ยน", "change")} ${pctTxt(r.pct)} (${pctTxt(r.perYear)} ${t("ต่อปี", "a year")})`);
    return parts.join(" · ");
  };

  const sorted = useMemo(
    () => (res ? [...res.rows].sort((p, q) => ((pair.kind === "definition" ? q.ratio : q.pct) ?? -Infinity) - ((pair.kind === "definition" ? p.ratio : p.pct) ?? -Infinity)) : []),
    [res, pair],
  );
  const hovered = sorted.find((r) => r.props.id === hover) ?? null;

  const exportCsv = () => {
    if (!res) return;
    const cols = ["topic", "tambon_th", "tambon_en", "a", "b", "b_minus_a", pair.kind === "same" ? "midpoint" : "", pair.kind === "definition" ? "ratio_b_over_a" : "pct", pair.kind === "time" ? "pct_per_year" : ""].filter(Boolean);
    const row = (th: string, en: string, r: Omit<SourceRow, "props">) =>
      [pair.id, th, en, r.a, r.b, r.diff, ...(pair.kind === "same" ? [r.mid] : []), pair.kind === "definition" ? r.ratio : r.pct, ...(pair.kind === "time" ? [r.perYear] : [])]
        .map((v) => (typeof v === "number" ? String(Number(v.toFixed(4))) : JSON.stringify(v ?? "")))
        .join(",");
    const lines = [...sorted.map((r) => row(r.props.tambon_th, r.props.tambon_en, r)), row("ทั้งเกาะ", "Whole island", res.island)];
    const tag = pair.option === "measure" ? `_${opts.measure}` : pair.option === "years" ? `_${opts.from}_${opts.to}` : "";
    downloadText(`phuket_compare_${pair.id}${tag}.csv`, "﻿" + [cols.join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
  };

  const pickYear = (k: "from" | "to", y: number) =>
    setOpts((o) => {
      const n = { ...o, [k]: y };
      if (n.from >= n.to) return k === "from" ? { ...n, to: YEARS.find((v) => v > y) ?? o.to } : { ...n, from: [...YEARS].reverse().find((v) => v < y) ?? o.from };
      return n;
    });

  return (
    <>
      {pair.option && (
        <div className="row cmp-rule">
          {pair.option === "measure" ? (
            <>
              <span className="small muted">{t("วัดด้วย", "Measure")}</span>
              <div className="seg" role="group" aria-label={t("วัดด้วย", "Measure")}>
                <button aria-pressed={opts.measure === "footprint"} onClick={() => setOpts({ ...opts, measure: "footprint" })}>{t("พื้นที่ฐาน (แนะนำ)", "Footprint (recommended)")}</button>
                <button aria-pressed={opts.measure === "count"} onClick={() => setOpts({ ...opts, measure: "count" })}>{t("จำนวนหลัง", "Building count")}</button>
              </div>
            </>
          ) : (
            <>
              <label className="small muted" htmlFor="cmp-from">{t("ปีแรก", "From")}</label>
              <select id="cmp-from" className="cmp-select" value={opts.from} onChange={(e) => pickYear("from", Number(e.target.value))}>
                {YEARS.slice(0, -1).map((y) => <option key={y} value={y}>{t(`${y}`, `${y - 543}`)}</option>)}
              </select>
              <label className="small muted" htmlFor="cmp-to">{t("ปีหลัง", "To")}</label>
              <select id="cmp-to" className="cmp-select" value={opts.to} onChange={(e) => pickYear("to", Number(e.target.value))}>
                {YEARS.slice(1).map((y) => <option key={y} value={y}>{t(`${y}`, `${y - 543}`)}</option>)}
              </select>
              <span className="small muted">{t(`${opts.to - opts.from} ปี`, `${opts.to - opts.from} years`)}</span>
            </>
          )}
        </div>
      )}

      <section className="cmp-ab" aria-label={t("สองค่าที่เทียบ", "The two values")}>
        {(["a", "b"] as const).map((k) => (
          <div key={k} className={`cmp-side ${k}`}>
            <div className="cmp-side-head">
              <Key side={k} />
              <b>{k === "a" ? t("A", "A") : t("B", "B")}</b>
            </div>
            <h2>{k === "a" ? la : lb}</h2>
            <p>{t(pair[k].noteTh, pair[k].noteEn)}</p>
          </div>
        ))}
      </section>

      {!res ? (
        <p className="muted">{bldg.error ? t("โหลดข้อมูลอาคารไม่สำเร็จ ลองรีเฟรชหน้า", "Could not load the building data. Refresh to try again.") : t("กำลังโหลดข้อมูลอาคาร…", "Loading building data…")}</p>
      ) : (
        <>
          <section className="cmp-result" aria-live="polite">
            <p className="cmp-rule-note">{t(kind.formulaTh, kind.formulaEn)}</p>
            <p className="cmp-lead">{lead(pair, res.island, sorted, { t, num, d, unit, la, lb, est, pctTxt, times, name, opts, what: pair.option === "measure" ? t(...measureLabel(opts)) : "" })}</p>
            {warn && <p className="cmp-warn small">{t(...warn)}</p>}
          </section>

          <section className="cmp-charts">
            <figure className="cmp-fig">
              <h2>{pair.kind === "same" ? t(`สองแหล่ง และค่าประมาณกลาง (${what})`, `Both sources and the midpoint (${what})`) : t(`ค่าของแต่ละตำบล (${what})`, `Value per sub-district (${what})`)}</h2>
              <DotChart
                items={sorted.map((r) => ({ id: r.props.id, name: name(r), a: r.a, b: r.b, mid: pair.kind === "same" ? r.mid : null, aria: `${name(r)}: ${readout(r)}` }))}
                hover={hover} setHover={setHover} t={t} num={num} missingB={t("ไม่มีค่า", "no value")}
                ariaLabel={t("กราฟจุดคู่ A กับ B ของแต่ละตำบล", "Paired dots, A and B, for each sub-district")} />
              <figcaption className="cmp-legend">
                <span><Key side="a" />A {la}</span>
                <span><Key side="b" />B {lb}</span>
                {pair.kind === "same" && <span><Key side="mid" />{t("ค่าประมาณกลาง", "midpoint estimate")}</span>}
              </figcaption>
            </figure>
            <figure className="cmp-fig">
              <h2>
                {pair.kind === "same" ? t("B ต่างจาก A กี่ % ของค่ากลาง", "B against A, % of the midpoint")
                  : pair.kind === "definition" ? t(`${lb} ÷ ${la} (เท่า)`, `${lb} ÷ ${la} (times)`)
                  : t(`เปลี่ยนไปกี่ % (${la} → ${lb})`, `% change (${la} → ${lb})`)}
              </h2>
              <BarChart
                items={sorted.map((r) => ({ id: r.props.id, name: name(r), v: metric(r), label: metricLabel(r), aria: `${name(r)}: ${readout(r)}` }))}
                hover={hover} setHover={setHover} t={t} num={num} empty={t("ฐานเล็กเกินไป", "base too small")}
                refs={pair.refs?.map((r) => ({ value: r.value, label: t(r.th, r.en) }))}
                fmtTick={(v) => (pair.kind === "definition" ? num(v) : `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v))}%`)}
                ariaLabel={t("กราฟแท่งของแต่ละตำบล เรียงจากมากไปน้อย", "Bars per sub-district, largest first")} />
              <figcaption className="cmp-legend">
                {pair.kind === "same" && <span className="muted">{t("ขวา = B มากกว่า A · ซ้าย = A มากกว่า B", "right = B above A · left = A above B")}</span>}
                {pair.kind === "definition" && <span className="muted">{t(`เส้น 1 = เท่ากัน · เส้น ${UNREG_FLAG} เท่า = เว็บใส่หมายเหตุประชากรแฝง`, `line at 1 = equal · line at ${UNREG_FLAG}× = the site adds the unregistered-resident note`)}</span>}
                {pair.kind === "time" && <span className="muted">{t("ขวา = เพิ่ม · ซ้าย = ลด", "right = up · left = down")}</span>}
              </figcaption>
            </figure>
            <p className="cmp-readout small" aria-live="polite">
              {hovered ? <><b>{name(hovered)}</b> · {readout(hovered)}</> : <span className="muted">{t("ชี้หรือแตะตำบลในกราฟหรือตารางเพื่อดูค่า", "Point at or tap a sub-district in a chart or the table to see its values")}</span>}
            </p>
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{t("ตาราง 17 ตำบล + ทั้งเกาะ", "All 17 sub-districts + whole island")}</h2>
              <button className="btn ghost" onClick={exportCsv}>{t("ดาวน์โหลด CSV", "Download CSV")}</button>
            </div>
            <div className="tbl">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th>{t("ตำบล", "Sub-district")}</th>
                    <th className="num">A<span className="unit">{la}</span></th>
                    <th className="num">B<span className="unit">{lb}</span></th>
                    {pair.kind !== "definition" && <th className="num">B − A<span className="unit">{unit}</span></th>}
                    {pair.kind === "same" && <th className="num">{t("% ต่าง", "% difference")}<span className="unit">{t("เทียบค่ากลาง", "of the midpoint")}</span></th>}
                    {pair.kind === "same" && <th className="num">{t("ค่าประมาณ", "Estimate")}<span className="unit">{t("ค่ากลาง ± ครึ่งผลต่าง", "midpoint ± half the gap")}</span></th>}
                    {pair.kind === "definition" && <th className="num">B ÷ A<span className="unit">{t("เท่า", "times")}</span></th>}
                    {pair.kind === "time" && <th className="num">{t("% เปลี่ยน", "% change")}<span className="unit">{t("เทียบปีแรก", "of the first year")}</span></th>}
                    {pair.kind === "time" && <th className="num">{t("% ต่อปี", "% a year")}<span className="unit">{t(`เฉลี่ย ${opts.to - opts.from} ปี`, `over ${opts.to - opts.from} years`)}</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.props.id} className={hover === r.props.id ? "hl" : ""} onMouseEnter={() => setHover(r.props.id)} onMouseLeave={() => setHover(null)}>
                      <td>
                        <a href={href("map", r.props.id)} onFocus={() => setHover(r.props.id)} onBlur={() => setHover(null)}>{name(r)}</a>
                        <div className="small muted">{t(`อ.${r.props.amphoe_th}`, r.props.amphoe_en)}</div>
                      </td>
                      <Cells pair={pair} r={r} d={d} num={num} signed={signed} pctTxt={pctTxt} times={times} est={est} />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>{t("ทั้งเกาะ", "Whole island")}</b><div className="small muted">{t("รวมก่อนแล้วจึงคิด", "summed, then compared")}</div></td>
                    <Cells pair={pair} r={res.island} d={d} num={num} signed={signed} pctTxt={pctTxt} times={times} est={est} />
                  </tr>
                </tfoot>
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
              <h3>{t("คิดอย่างไร", "How it is worked out")}</h3>
              <p>{t(kind.formulaTh, kind.formulaEn)}</p>
              <p className="small muted" style={{ marginTop: 8 }}>
                {t("ทั้งเกาะ = รวมค่าของ 17 ตำบลก่อนแล้วจึงคิด ไม่ใช่เฉลี่ย % ของแต่ละตำบล", "Whole island = add up the 17 sub-districts first, then compare; never an average of the 17 percentages")}
              </p>
            </div>
          </section>

          <p className="small muted">
            {t("ข้อมูล", "Data")}: {t(pair.sourceTh, pair.sourceEn)} ·{" "}
            {t("หน้านี้เทียบตัวข้อมูล ไม่ได้เปลี่ยนคะแนนของเว็บ", "This view compares the data itself; it does not change the site's scores.")}{" "}
            <a href={href("method")}>{t("วิธีคิดและแหล่งข้อมูล", "Method & data")}</a>
          </p>
        </>
      )}
    </>
  );
}

type Fmt = (n: number, digits?: number) => string;

function Cells({ pair, r, d, num, signed, pctTxt, times, est }: {
  pair: SourcePair; r: Omit<SourceRow, "props">; d: number; num: Fmt;
  signed: (v: number, d: number) => string; pctTxt: (v: number | null) => string; times: (v: number | null) => string;
  est: (r: { mid: number | null; diff: number | null }) => string;
}) {
  return (
    <>
      <td className="num">{r.a == null ? "–" : num(r.a, d)}</td>
      <td className="num">{r.b == null ? "–" : num(r.b, d)}</td>
      {pair.kind !== "definition" && <td className="num">{r.diff == null ? "–" : signed(r.diff, d)}</td>}
      {pair.kind === "same" && <td className="num">{pctTxt(r.pct)}</td>}
      {pair.kind === "same" && <td className="num">{est(r)}</td>}
      {pair.kind === "definition" && <td className="num">{times(r.ratio)}</td>}
      {pair.kind === "time" && <td className="num">{pctTxt(r.pct)}</td>}
      {pair.kind === "time" && <td className="num">{pctTxt(r.perYear)}</td>}
    </>
  );
}

/** the one-sentence answer above the charts */
function lead(
  pair: SourcePair,
  isl: Omit<SourceRow, "props">,
  rows: SourceRow[],
  f: {
    t: (th: string, en: string) => string; num: Fmt; d: number; unit: string; la: string; lb: string;
    est: (r: { mid: number | null; diff: number | null }) => string; pctTxt: (v: number | null) => string;
    times: (v: number | null) => string; name: (r: SourceRow) => string; opts: SourceOpts; what: string;
  },
): string {
  const { t, num, d, unit, la, lb, est, pctTxt, times, name, what } = f;
  const head = what ? t(`ทั้งเกาะ (${what})`, `Whole island (${what})`) : t("ทั้งเกาะ", "Whole island");
  const valid = rows.filter((r) => (pair.kind === "definition" ? r.ratio : r.pct) != null);
  const val = (r: SourceRow) => (pair.kind === "definition" ? r.ratio! : r.pct!);
  if (!valid.length || isl.a == null || isl.b == null) return t("ไม่มีข้อมูลพอให้เทียบ", "Not enough data to compare.");
  const top = valid[0], bottom = valid[valid.length - 1];
  if (pair.kind === "same") {
    const byGap = [...valid].sort((p, q) => Math.abs(val(q)) - Math.abs(val(p)));
    const far = byGap[0], close = byGap[byGap.length - 1];
    return t(
      `${head}: ${la} ${num(isl.a, d)} · ${lb} ${num(isl.b, d)} ${unit} ต่างกัน ${pctTxt(isl.pct)} ของค่ากลาง ค่าประมาณ ${est(isl)} ${unit} · ต่างมากสุด ${name(far)} (${pctTxt(far.pct)}) · ใกล้กันที่สุด ${name(close)} (${pctTxt(close.pct)})`,
      `${head}: ${la} ${num(isl.a, d)} · ${lb} ${num(isl.b, d)} ${unit}, ${pctTxt(isl.pct)} of the midpoint apart; estimate ${est(isl)} ${unit}. Largest gap ${name(far)} (${pctTxt(far.pct)}), closest ${name(close)} (${pctTxt(close.pct)}).`,
    );
  }
  if (pair.kind === "definition") {
    const over = valid.filter((r) => val(r) >= UNREG_FLAG).length;
    return t(
      `ทั้งเกาะ: ${lb} ÷ ${la} = ${times(isl.ratio)} · สูงสุด ${name(top)} ${times(top.ratio)} · ต่ำสุด ${name(bottom)} ${times(bottom.ratio)} · ${over} ตำบลเกิน ${UNREG_FLAG} เท่า`,
      `Whole island: ${lb} ÷ ${la} = ${times(isl.ratio)}. Highest ${name(top)} ${times(top.ratio)}, lowest ${name(bottom)} ${times(bottom.ratio)}; ${over} sub-districts at ${UNREG_FLAG}× or more.`,
    );
  }
  const down = valid.filter((r) => val(r) < 0);
  return t(
    `ทั้งเกาะ ${la} → ${lb}: ${pctTxt(isl.pct)} (${pctTxt(isl.perYear)} ต่อปี) · เพิ่มมากสุด ${name(top)} ${pctTxt(top.pct)} · ${down.length ? `ลดลง ${down.length} ตำบล ลดมากสุด ${name(bottom)} ${pctTxt(bottom.pct)}` : "ไม่มีตำบลที่ลดลง"}`,
    `Whole island ${la} → ${lb}: ${pctTxt(isl.pct)} (${pctTxt(isl.perYear)} a year). Largest rise ${name(top)} ${pctTxt(top.pct)}; ${down.length ? `${down.length} went down, most ${name(bottom)} ${pctTxt(bottom.pct)}` : "none went down"}.`,
  );
}
