import { useMemo, useState } from "react";
import MapView from "../components/MapView";
import WeightPanel from "../components/WeightPanel";
import TambonDetail from "../components/TambonDetail";
import SphereSearch from "../components/SphereSearch";
import SphereNearby from "../components/SphereNearby";
import { FACTORS } from "../factors";
import { LANDUSE_COLORS, OVERLAYS, POI_COLORS, type OverlayId } from "../layers";
import { BASEMAPS, type SpherePlace } from "../sphere";
import { RAMP, classOf, quantileBreaks, scoreColor } from "../color";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { PageProps } from "../pageProps";
import type { FactorKey } from "../types";

type ColorBy = "score" | FactorKey;

export default function MapPage({ data, scored, weights, setWeights, selectedId }: PageProps & { selectedId?: string }) {
  const { t, num } = useI18n();
  const [colorBy, setColorBy] = useState<ColorBy>("score");
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>({ landuse: false, buildings: false, population: false, land: false, roads: true, pois: false });
  const [basemap, setBasemap] = useState(BASEMAPS[0].id);
  const [labels, setLabels] = useState(true);
  const [tambonFill, setTambonFill] = useState(true);
  const [baseFailed, setBaseFailed] = useState(false);
  const [clickPoint, setClickPoint] = useState<{ lon: number; lat: number }>();
  const [pins, setPins] = useState<SpherePlace[]>([]);
  const [focus, setFocus] = useState<{ key: string; lon: number; lat: number; zoom: number }>();

  const { fills, legend } = useMemo(() => {
    if (colorBy === "score") {
      const fills = Object.fromEntries(scored.map((s) => [s.props.id, scoreColor(s.score)]));
      return { fills, legend: { title: t("คะแนนศักยภาพ (0–100)", "Potential score (0–100)"), ends: ["0", "100"] } };
    }
    const f = FACTORS.find((x) => x.key === colorBy)!;
    const vals = scored.map((s) => f.value(s.props) ?? NaN);
    const br = quantileBreaks(vals);
    const fills = Object.fromEntries(
      scored.map((s) => {
        const v = f.value(s.props);
        if (v == null) return [s.props.id, "#cccccc"];
        let c = classOf(v, br);
        if (!f.higherIsBetter) c = 4 - c; // nearer road = darker
        return [s.props.id, RAMP[c]];
      }),
    );
    const lo = Math.min(...vals.filter(Number.isFinite)), hi = Math.max(...vals.filter(Number.isFinite));
    return {
      fills,
      legend: {
        title: `${t(f.th, f.en)} (${t(f.unitTh, f.unitEn)})`,
        ends: f.higherIsBetter ? [num(lo), num(hi)] : [num(hi), num(lo)],
      },
    };
  }, [colorBy, scored, t, num]);

  const anyFillOverlay = overlays.landuse || overlays.buildings || overlays.population || overlays.land;
  const selected = scored.find((s) => s.props.id === selectedId);
  const onMapClick = (hit: { id?: string; lon: number; lat: number }) => {
    setClickPoint({ lon: hit.lon, lat: hit.lat });
    if (hit.id) window.location.hash = href("map", hit.id);
  };
  const pickPlace = (p: SpherePlace) => {
    setFocus({ key: `${p.id}-${Date.now()}`, lon: p.lon, lat: p.lat, zoom: 16 });
    setClickPoint({ lon: p.lon, lat: p.lat });
  };

  return (
    <div className="mapwrap">
      <aside className="panel left" aria-label={t("ตัวควบคุม", "Controls")}>
        <section>
          <h3>{t("ระบายสีตำบลตาม", "Colour sub-districts by")}</h3>
          <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)} aria-label={t("ระบายสีตำบลตาม", "Colour sub-districts by")}>
            <option value="score">{t("คะแนนศักยภาพรวม", "Overall potential score")}</option>
            {FACTORS.map((f) => (
              <option key={f.key} value={f.key}>{t(f.th, f.en)}</option>
            ))}
          </select>
        </section>
        <section>
          <h3>{t("ค้นหาสถานที่ (GISTDA Sphere)", "Find a place (GISTDA Sphere)")}</h3>
          <SphereSearch center={{ lon: 98.36, lat: 7.95 }} onResults={setPins} onPick={pickPlace} />
        </section>
        <section>
          <h3>{t("หลักเกณฑ์ (Decision Rule)", "Decision rule")}</h3>
          <WeightPanel weights={weights} setWeights={setWeights} />
        </section>
        <section>
          <h3>{t("ชั้นข้อมูล", "Layers")}</h3>
          <label className="check">
            <input type="checkbox" checked={tambonFill} onChange={(e) => setTambonFill(e.target.checked)} />
            <span className="sw" style={{ background: "#c4512e" }} />
            <span>{t("สีตำบลตามคะแนน", "Sub-district colours")}</span>
          </label>
          {OVERLAYS.map((o) => (
            <label key={o.id} className="check">
              <input type="checkbox" checked={overlays[o.id]} onChange={(e) => setOverlays({ ...overlays, [o.id]: e.target.checked })} />
              <span className="sw" style={{ background: o.swatch }} />
              <span>
                {t(o.th, o.en)} <span className={`pill ${o.gistda ? "gistda" : "muted"}`} style={{ fontSize: 10, padding: "0 6px" }}>{t(o.sourceTh, o.sourceEn)}</span>
              </span>
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            <span>{t("ชื่อตำบล", "Sub-district names")}</span>
          </label>
        </section>
        <section>
          <h3>{t("แผนที่พื้นหลัง", "Base map")}</h3>
          <select value={basemap} onChange={(e) => setBasemap(e.target.value)} aria-label={t("แผนที่พื้นหลัง", "Base map")}>
            {BASEMAPS.map((b) => (
              <option key={b.id} value={b.id}>{t(b.th, b.en)}{b.gistda ? " · GISTDA" : ""}</option>
            ))}
          </select>
        </section>
      </aside>

      <div className="mapbox">
        <MapView
          tambons={data.tambons}
          fills={fills}
          tambonOpacity={anyFillOverlay ? 0.12 : 0.72}
          showTambonFill={tambonFill}
          overlays={overlays}
          basemap={basemap}
          showLabels={labels}
          selectedId={selectedId}
          onMapClick={onMapClick}
          onBaseError={setBaseFailed}
          pins={pins.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, label: p.name }))}
          focus={focus}
          clickPoint={clickPoint}
        />
        {baseFailed && (
          <div className="notice" role="status">
            {t("โหลดแผนที่พื้นหลังไม่สำเร็จ (อาจเป็นเพราะ API key หรือเครดิตของ Sphere) ข้อมูลวิเคราะห์ยังใช้ได้ตามปกติ ",
               "The base map did not load (possibly the Sphere API key or credits). The analysis layers still work. ")}
            {basemap !== "carto" && (
              <button className="btn ghost" style={{ padding: "1px 8px", fontSize: 12 }} onClick={() => setBasemap("carto")}>
                {t("ใช้แผนที่สำรอง", "Use backup map")}
              </button>
            )}
          </div>
        )}
        <div className="legend">
          {!anyFillOverlay && tambonFill && (
            <>
              <b>{legend.title}</b>
              <div className="ramp">{RAMP.map((c) => <i key={c} style={{ background: c }} />)}</div>
              <div className="ends"><span>{legend.ends[0]}</span><span>{legend.ends[1]}</span></div>
            </>
          )}
          {OVERLAYS.filter((o) => overlays[o.id] && o.ramp).map((o) => (
            <div key={o.id}>
              <b>{t(o.th, o.en)}</b>
              <div className="ramp">{o.ramp!.map((c) => <i key={c} style={{ background: c }} />)}</div>
              <div className="ends"><span>&lt;{num(o.breaks![0])}</span><span>{num(o.breaks![3])}+ {t(o.unitTh!, o.unitEn!)}</span></div>
            </div>
          ))}
          {overlays.landuse && (
            <div>
              <b>{t("การใช้ที่ดิน ปี 2563", "Land use 2020")}</b>
              <div className="row" style={{ gap: "2px 8px" }}>
                {Object.values(LANDUSE_COLORS).map((c) => (
                  <span key={c.th} className="row" style={{ gap: 4 }}><i style={{ width: 9, height: 9, background: c.c, display: "inline-block" }} />{t(c.th, c.en)}</span>
                ))}
              </div>
            </div>
          )}
          {overlays.pois && (
            <div className="row" style={{ gap: "2px 8px" }}>
              {Object.values(POI_COLORS).map((c) => (
                <span key={c.th} className="row" style={{ gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 4, background: c.c, display: "inline-block" }} />{t(c.th, c.en)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="panel right" aria-label={t("รายละเอียดตำบล", "Sub-district details")}>
        {clickPoint && <SphereNearby point={clickPoint} />}
        {selected ? (
          <TambonDetail s={selected} total={scored.length} weights={weights} />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <h3>{t("5 อันดับแรกตามหลักเกณฑ์ตอนนี้", "Top 5 under the current rule")}</h3>
            <div className="rankbars">
              {scored.slice(0, 5).map((s) => (
                <a key={s.props.id} href={href("map", s.props.id)} className="rb" style={{ color: "inherit", textDecoration: "none" }}>
                  <span>{s.rank}. {t(s.props.tambon_th, s.props.tambon_en)}</span>
                  <span className="track"><i style={{ width: `${s.score}%`, background: scoreColor(s.score) }} /></span>
                  <span className="num">{num(s.score, 1)}</span>
                </a>
              ))}
            </div>
            <p className="small muted">{t("คลิกตำบลบนแผนที่เพื่อดูคะแนนแยกตามปัจจัยและตัวเลขจริง", "Click a sub-district on the map to see its factor scores and raw figures.")}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
