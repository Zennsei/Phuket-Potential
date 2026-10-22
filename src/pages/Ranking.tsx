import { useMemo, useState } from "react";
import { FACTORS } from "../factors";
import { CATEGORIES, DEFAULT_THRESHOLDS, decide } from "../decision";
import { scoreColor } from "../color";
import { downloadText } from "../download";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { PageProps } from "../pageProps";
import type { FactorKey, Scored } from "../types";

type SortKey = "rank" | "name" | FactorKey;

export default function Ranking({ scored, weights }: PageProps) {
  const { t, num, lang } = useI18n();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: "rank", desc: false });
  const decisions = useMemo(
    () => new Map(decide(scored.map((s) => s.props), weights, DEFAULT_THRESHOLDS).map((d) => [d.s.props.id, d])),
    [scored, weights],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const r = scored.filter((s) =>
      !needle || [s.props.tambon_th, s.props.tambon_en, s.props.amphoe_th, s.props.amphoe_en].some((x) => x.toLowerCase().includes(needle)),
    );
    const val = (s: Scored): number | string => {
      if (sort.k === "rank") return s.rank;
      if (sort.k === "name") return lang === "th" ? s.props.tambon_th : s.props.tambon_en;
      return FACTORS.find((f) => f.key === sort.k)!.value(s.props) ?? -Infinity;
    };
    return [...r].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(String(y), lang) : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
  }, [scored, q, sort, lang]);

  const head = (k: SortKey, label: string, right = false) => (
    <th className={right ? "num" : ""} aria-sort={sort.k === k ? (sort.desc ? "descending" : "ascending") : undefined}>
      <button onClick={() => setSort({ k, desc: sort.k === k ? !sort.desc : k !== "rank" && k !== "name" })}>
        {label}{sort.k === k ? (sort.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  const exportRows = () =>
    scored.map((s) => ({
      rank: s.rank,
      tambon_th: s.props.tambon_th,
      tambon_en: s.props.tambon_en,
      amphoe_th: s.props.amphoe_th,
      score: Number(s.score.toFixed(2)),
      decision: decisions.get(s.props.id)?.category ?? "",
      decision_changes_under: decisions.get(s.props.id)?.changesUnder.join(" ") ?? "",
      ...Object.fromEntries(FACTORS.map((f) => [`score_${f.key}`, Number(s.parts[f.key].toFixed(2))])),
      bldg_per_km2: s.props.bldg_per_km2,
      road_dist_m: s.props.road_dist_m,
      services_per_km2: s.props.services_per_km2,
      pop_per_km2: s.props.pop_per_km2,
      land_median: s.props.land_median,
      developable_pct: s.props.developable_pct,
      house_growth_pct: s.props.house_growth_pct,
      reg_pop_2568: s.props.reg_pop_2568,
      reg_pop_growth_pct: s.props.reg_pop_growth_pct,
      unreg_ratio: s.props.unreg_ratio,
    }));

  const exportCsv = () => {
    const r = exportRows();
    const cols = Object.keys(r[0]);
    const csv = [cols.join(","), ...r.map((o) => cols.map((c) => JSON.stringify((o as Record<string, unknown>)[c] ?? "")).join(","))].join("\n");
    downloadText("phuket_potential_ranking.csv", "﻿" + csv, "text/csv;charset=utf-8");
  };
  const exportJson = () =>
    downloadText("phuket_potential_ranking.json", JSON.stringify({ weights, rows: exportRows() }, null, 2), "application/json");

  return (
    <div className="page">
      <header style={{ display: "grid", gap: 8 }}>
        <h1>{t("ตำบลไหนมีศักยภาพสูงสุด", "Which sub-districts rank highest")}</h1>
        <p className="lede">
          {t("อันดับเปลี่ยนตามหลักเกณฑ์ที่ตั้งไว้ในหน้าแผนที่ ปรับน้ำหนักปัจจัยแล้วกลับมาดูหน้านี้ได้",
             "The ranking follows the decision rule set on the map page. Change the weights there and come back.")}{" "}
          <a href={href("map")}>{t("ไปปรับหลักเกณฑ์", "Adjust the rule")}</a>
        </p>
      </header>

      <section className="card">
        <h2>{t("10 อันดับแรก", "Top 10")}</h2>
        <div className="rankbars">
          {scored.slice(0, 10).map((s) => (
            <a key={s.props.id} className="rb" href={href("map", s.props.id)} style={{ color: "inherit", textDecoration: "none" }}>
              <span>{s.rank}. {t(s.props.tambon_th, s.props.tambon_en)}</span>
              <span className="track"><i style={{ width: `${s.score}%`, background: scoreColor(s.score) }} /></span>
              <span className="num">{num(s.score, 1)}</span>
            </a>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <input
            id="rank-search"
            type="search"
            placeholder={t("ค้นหาตำบลหรืออำเภอ", "Search sub-district or district")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--rule)", background: "var(--sheet)", minWidth: 0, flex: "1 1 220px", maxWidth: 360 }}
          />
          <div className="row">
            <button className="btn ghost" onClick={exportCsv}>{t("ดาวน์โหลด CSV", "Download CSV")}</button>
            <button className="btn ghost" onClick={exportJson}>{t("ดาวน์โหลด JSON", "Download JSON")}</button>
          </div>
        </div>
        <div className="tbl">
          <table>
            <thead>
              <tr>
                {head("rank", t("อันดับ / คะแนน", "Rank / score"))}
                {head("name", t("ตำบล", "Sub-district"))}
                <th>{t("กลุ่มการตัดสินใจ", "Decision")}</th>
                {FACTORS.map((f) => head(f.key, `${t(f.th, f.en)}`, true))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.props.id}>
                  <td className="mono"><span className="muted">{s.rank}</span> <b>{num(s.score, 1)}</b></td>
                  <td>
                    <a href={href("map", s.props.id)}>{t(s.props.tambon_th, s.props.tambon_en)}</a>
                    <div className="small muted">{t(`อ.${s.props.amphoe_th}`, s.props.amphoe_en)}</div>
                  </td>
                  <td className="small">
                    {(() => {
                      const d = decisions.get(s.props.id);
                      if (!d) return "–";
                      const c = CATEGORIES[d.category];
                      return (
                        <>
                          <b style={{ color: c.color }}>{t(c.th, c.en)}</b>
                          {d.changesUnder.length > 0 && <div className="muted">{t("อ่อนไหวต่อ Stress Test", "sensitive to stress tests")}</div>}
                        </>
                      );
                    })()}
                  </td>
                  {FACTORS.map((f) => {
                    const v = f.value(s.props);
                    return (
                      <td key={f.key} className="num">
                        {v == null ? "–" : num(v, f.key === "services" ? 1 : 0)}
                        <div className="small muted">{num(s.parts[f.key])}/100</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          {FACTORS.map((f) => `${t(f.th, f.en)}: ${t(f.unitTh, f.unitEn)}`).join(", ")}
        </p>
        <p className="small muted">
          {t(`กลุ่มการตัดสินใจใช้เกณฑ์ตั้งต้น คะแนน ${DEFAULT_THRESHOLDS.score} และที่ดินที่ยังพัฒนาได้ ${DEFAULT_THRESHOLDS.land}% (ปรับเกณฑ์ได้ในหน้าภารกิจ)`,
             `Decision groups use the default cut-offs: score ${DEFAULT_THRESHOLDS.score} and developable land ${DEFAULT_THRESHOLDS.land}% (adjustable on the mission page).`)}{" "}
          <a href={href("mission")}>{t("ไปหน้าภารกิจ", "Go to the mission")}</a>
        </p>
      </section>
    </div>
  );
}
