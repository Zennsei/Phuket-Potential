import { useMemo, useState } from "react";
import type { MultiPolygon, Polygon, Position } from "geojson";
import { scoreColor } from "../color";
import { useI18n } from "../i18n";
import { href } from "../router";
import { dm } from "./Collar";
import type { Scored, TambonCollection } from "../types";

// main island extent (Ko Racha, south of 7.74°N, is left off this small sheet)
const W = 98.255, E = 98.485, S = 7.745, N = 8.205;
const K = Math.cos((8 * Math.PI) / 180);
const PAD = 30;
const INNER_W = 420;
const SCALE = INNER_W / ((E - W) * K);
const INNER_H = (N - S) * SCALE;
const px = (lon: number, lat: number): [number, number] => [PAD + (lon - W) * K * SCALE, PAD + (N - lat) * SCALE];

function pathOf(g: Polygon | MultiPolygon): string {
  const polys: Position[][][] = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys
    .map((poly) => poly.map((ring) => ring.map(([x, y], i) => `${i ? "L" : "M"}${px(x, y).map((n) => n.toFixed(1)).join(",")}`).join("") + "Z").join(""))
    .join("");
}

/** The island drawn as a printed map sheet: sub-districts coloured by score, a framed graticule every 3′. */
export default function SheetMap({ tambons, scored }: { tambons: TambonCollection; scored: Scored[] }) {
  const { t, num } = useI18n();
  const [hover, setHover] = useState<Scored | null>(null);
  const paths = useMemo(() => tambons.features.map((f) => ({ id: f.properties.id, d: pathOf(f.geometry) })), [tambons]);
  const byId = useMemo(() => Object.fromEntries(scored.map((s) => [s.props.id, s])), [scored]);
  const step = 0.05; // 3 minutes
  const lons: number[] = [];
  for (let v = Math.ceil(W / step) * step; v <= E; v += step) lons.push(v);
  const lats: number[] = [];
  for (let v = Math.ceil(S / step) * step; v <= N; v += step) lats.push(v);
  const w = INNER_W + PAD * 2, h = INNER_H + PAD * 2;

  return (
    <figure className="sheetmap" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label={t("แผนที่ 17 ตำบลของภูเก็ต ระบายสีตามคะแนนศักยภาพ", "Map of Phuket's 17 sub-districts coloured by potential score")}>
        <rect x={PAD} y={PAD} width={INNER_W} height={INNER_H} fill="var(--sheet-2)" />
        {lons.map((v) => {
          const [x] = px(v, S);
          return (
            <g key={`x${v}`}>
              <line x1={x} x2={x} y1={PAD} y2={PAD + INNER_H} stroke="var(--rule)" strokeWidth={0.6} />
              <line x1={x} x2={x} y1={PAD - 6} y2={PAD} stroke="var(--ink)" />
              <line x1={x} x2={x} y1={PAD + INNER_H} y2={PAD + INNER_H + 6} stroke="var(--ink)" />
              <text className="tick" x={x} y={PAD - 10} textAnchor="middle">{dm(v, false)}</text>
              <text className="tick" x={x} y={PAD + INNER_H + 18} textAnchor="middle">{dm(v, false)}</text>
            </g>
          );
        })}
        {lats.map((v) => {
          const [, y] = px(W, v);
          return (
            <g key={`y${v}`}>
              <line x1={PAD} x2={PAD + INNER_W} y1={y} y2={y} stroke="var(--rule)" strokeWidth={0.6} />
              <line x1={PAD - 6} x2={PAD} y1={y} y2={y} stroke="var(--ink)" />
              <line x1={PAD + INNER_W} x2={PAD + INNER_W + 6} y1={y} y2={y} stroke="var(--ink)" />
              <text className="tick" x={PAD - 9} y={y} textAnchor="middle" transform={`rotate(-90 ${PAD - 9} ${y})`} dy="0.35em">{dm(v, false)}</text>
            </g>
          );
        })}
        <clipPath id="sheetclip"><rect x={PAD} y={PAD} width={INNER_W} height={INNER_H} /></clipPath>
        <g clipPath="url(#sheetclip)">
          {paths.map((p) => {
            const s = byId[p.id];
            if (!s) return null;
            return (
              <a key={p.id} href={href("map", p.id)} aria-label={t(`ต.${s.props.tambon_th} อันดับ ${s.rank} คะแนน ${num(s.score, 1)}`, `${s.props.tambon_en}, rank ${s.rank}, score ${num(s.score, 1)}`)}
                 onMouseEnter={() => setHover(s)} onFocus={() => setHover(s)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}>
                <path className="tam" d={p.d} fill={scoreColor(s.score)} fillRule="evenodd" />
              </a>
            );
          })}
        </g>
        <rect className="frame" x={PAD} y={PAD} width={INNER_W} height={INNER_H} />
      </svg>
      <figcaption className="sheet-caption">
        {hover ? (
          <span><b>{t(`ต.${hover.props.tambon_th}`, hover.props.tambon_en)}</b> {t(`อ.${hover.props.amphoe_th}`, hover.props.amphoe_en)}, {t("อันดับ", "rank")} {hover.rank}, {t("คะแนน", "score")} <b>{num(hover.score, 1)}</b></span>
        ) : (
          <span>{t("ชี้หรือแตะตำบลเพื่อดูคะแนน คลิกเพื่อเปิดในแผนที่", "Point at a sub-district to see its score; click to open it on the map")}</span>
        )}
        <span style={{ whiteSpace: "nowrap" }}>{t("ระวาง 4624 I", "Sheet 4624 I")}</span>
      </figcaption>
    </figure>
  );
}
