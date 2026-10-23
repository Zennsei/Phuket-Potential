import { useEffect, useMemo, useState } from "react";
import MapView, { type MapViewport } from "../components/MapView";
import Collar from "../components/Collar";
import Fold from "../components/Fold";
import WeightPanel from "../components/WeightPanel";
import TambonDetail from "../components/TambonDetail";
import SphereSearch from "../components/SphereSearch";
import SphereNearby from "../components/SphereNearby";
import { FACTORS, TRAVEL_DESTS, unitOf } from "../factors";
import { LANDUSE_COLORS, OVERLAYS, POI_COLORS, TERRAIN_CLASSES, type OverlayId } from "../layers";
import { BASEMAPS, type SpherePlace } from "../sphere";
import { RAMP, classOf, quantileBreaks, scoreColor } from "../color";
import { REG_YEARS, regHouse, regPop } from "../years";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { PageProps } from "../pageProps";
import type { FactorKey } from "../types";

/** "reg_pop" / "reg_house": registered people / houses per km² in the chosen year */
type ColorBy = "score" | FactorKey | "reg_pop" | "reg_house";

const LAYER_GROUPS: { th: string; en: string; ids: OverlayId[] }[] = [
  { th: "พื้นที่และอาคาร", en: "Land & buildings", ids: ["landuse", "terrain", "buildings", "height3d"] },
  { th: "ประชากร", en: "People", ids: ["population"] },
  { th: "การเดินทาง", en: "Getting around", ids: ["travel", "roads", "pois"] },
  { th: "ราคาที่ดิน", en: "Land price", ids: ["land"] },
];

export default function MapPage({ data, scored, weights, setWeights, selectedId }: PageProps & { selectedId?: string }) {
  const { t, num } = useI18n();
  const [colorBy, setColorBy] = useState<ColorBy>("score");
  const [year, setYear] = useState<number>(REG_YEARS[REG_YEARS.length - 1]);
  const [playing, setPlaying] = useState(false);
  const [overlays, setOverlays] = useState<Record<OverlayId, boolean>>({ landuse: false, terrain: false, buildings: false, population: false, land: false, travel: false, height3d: false, roads: true, pois: false });
  const [basemap, setBasemap] = useState(BASEMAPS[0].id);
  const [labels, setLabels] = useState(true);
  const [tambonFill, setTambonFill] = useState(true);
  const [view, setView] = useState<MapViewport>();
  const [baseFailed, setBaseFailed] = useState(false);
  const [clickPoint, setClickPoint] = useState<{ lon: number; lat: number }>();
  const [pins, setPins] = useState<SpherePlace[]>([]);
  const [focus, setFocus] = useState<{ key: string; lon: number; lat: number; zoom: number }>();
  const yearly = colorBy === "reg_pop" || colorBy === "reg_house";

  // play through the years
  useEffect(() => {
    if (!playing || !yearly) return;
    const id = window.setInterval(() => {
      setYear((y) => {
        const i = REG_YEARS.indexOf(y as (typeof REG_YEARS)[number]);
        return REG_YEARS[(i + 1) % REG_YEARS.length];
      });
    }, 1300);
    return () => window.clearInterval(id);
  }, [playing, yearly]);

  const { fills, legend } = useMemo(() => {
    if (colorBy === "score") {
      const fills = Object.fromEntries(scored.map((s) => [s.props.id, scoreColor(s.score)]));
      return { fills, legend: { title: t("คะแนนศักยภาพ (0–100)", "Potential score (0–100)"), ends: ["0", "100"] } };
    }
    if (colorBy === "reg_pop" || colorBy === "reg_house") {
      const get = colorBy === "reg_pop" ? regPop : regHouse;
      // the same class breaks for every year, so colours can be compared between years
      const all = scored.flatMap((s) => REG_YEARS.map((y) => get(s.props, y) / s.props.area_km2));
      const br = quantileBreaks(all);
      const fills = Object.fromEntries(scored.map((s) => [s.props.id, RAMP[classOf(get(s.props, year) / s.props.area_km2, br)]]));
      const lo = Math.min(...all), hi = Math.max(...all);
      return {
        fills,
        legend: {
          title: colorBy === "reg_pop"
            ? t(`ประชากรตามทะเบียน ปี ${year} (คน/ตร.กม.)`, `Registered people ${year} (per km²)`)
            : t(`บ้านตามทะเบียน ปี ${year} (หลัง/ตร.กม.)`, `Registered houses ${year} (per km²)`),
          ends: [num(lo), num(hi)],
        },
      };
    }
    const f = FACTORS.find((x) => x.key === colorBy)!;
    const vals = scored.map((s) => f.value(s.props, weights[f.key]) ?? NaN);
    const br = quantileBreaks(vals);
    const fills = Object.fromEntries(
      scored.map((s) => {
        const v = f.value(s.props, weights[f.key]);
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
        title: `${t(f.th, f.en)} (${(() => { const u = unitOf(f, weights[f.key]); return t(u.th, u.en); })()})`,
        ends: f.higherIsBetter ? [num(lo), num(hi)] : [num(hi), num(lo)],
      },
    };
  }, [colorBy, scored, t, num, weights, year]);

  const anyFillOverlay = overlays.landuse || overlays.buildings || overlays.population || overlays.land || overlays.travel || overlays.height3d || overlays.terrain;
  const layersOn = OVERLAYS.filter((o) => overlays[o.id]).length;
  const travelDest = weights.travel.dest ?? "oldtown";
  const selected = scored.find((s) => s.props.id === selectedId);
  const onMapClick = (hit: { id?: string; lon: number; lat: number }) => {
    setClickPoint({ lon: hit.lon, lat: hit.lat });
    if (hit.id) window.location.hash = href("map", hit.id);
  };
  const pickPlace = (p: SpherePlace) => {
    setFocus({ key: `${p.id}-${Date.now()}`, lon: p.lon, lat: p.lat, zoom: 16 });
    setClickPoint({ lon: p.lon, lat: p.lat });
  };
  const colourName = (c: ColorBy) =>
    c === "score" ? t("คะแนนรวม", "score")
      : c === "reg_pop" ? t(`คนตามทะเบียน ${year}`, `registered people ${year}`)
        : c === "reg_house" ? t(`บ้านตามทะเบียน ${year}`, `registered houses ${year}`)
          : (() => { const f = FACTORS.find((x) => x.key === c)!; return t(f.th, f.en); })();

  return (
    <div className="mapwrap">
      <aside className="panel left folds" aria-label={t("ตัวควบคุม", "Controls")}>
        <Fold title={t("ค้นหาสถานที่", "Find a place")} hint="GISTDA Sphere" open>
          <SphereSearch center={{ lon: 98.36, lat: 7.95 }} onResults={setPins} onPick={pickPlace} />
        </Fold>
        <Fold title={t("หลักเกณฑ์ (Decision Rule)", "Decision rule")} hint={t(`${FACTORS.filter((f) => weights[f.key].direction !== 0).length} ปัจจัย`, `${FACTORS.filter((f) => weights[f.key].direction !== 0).length} factors`)} open>
          <WeightPanel weights={weights} setWeights={setWeights} />
        </Fold>
        <Fold title={t("ชั้นข้อมูล", "Layers")} hint={t(`เปิด ${layersOn}`, `${layersOn} on`)} open>
          {LAYER_GROUPS.map((g) => (
            <div key={g.en}>
              <p className="group-label">{t(g.th, g.en)}</p>
              {g.ids.map((id) => {
                const o = OVERLAYS.find((x) => x.id === id)!;
                return (
                  <label key={o.id} className="check">
                    <input type="checkbox" checked={overlays[o.id]} onChange={(e) => setOverlays({ ...overlays, [o.id]: e.target.checked })} />
                    <span className="sw" style={{ background: o.swatch }} />
                    <span>
                      {t(o.th, o.en)} <span className={`pill ${o.gistda ? "gistda" : "muted"}`} style={{ fontSize: 10, padding: "0 6px" }}>{t(o.sourceTh, o.sourceEn)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
          <p className="group-label">{t("การแสดงผล", "Display")}</p>
          <label className="check">
            <input type="checkbox" checked={tambonFill} onChange={(e) => setTambonFill(e.target.checked)} />
            <span className="sw" style={{ background: "#2c7a98" }} />
            <span>{t("สีตำบล", "Sub-district colours")}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            <span>{t("ชื่อตำบล", "Sub-district names")}</span>
          </label>
        </Fold>
        <Fold title={t("สีตำบลตาม", "Colour by")} hint={colourName(colorBy)}>
          <select value={colorBy} onChange={(e) => { setColorBy(e.target.value as ColorBy); setPlaying(false); }} aria-label={t("ระบายสีตำบลตาม", "Colour sub-districts by")}>
            <option value="score">{t("คะแนนศักยภาพรวม", "Overall potential score")}</option>
            <optgroup label={t("ปัจจัย", "Factors")}>
              {FACTORS.map((f) => <option key={f.key} value={f.key}>{t(f.th, f.en)}</option>)}
            </optgroup>
            <optgroup label={t("ข้อมูลรายปี (เลือกปีได้)", "Yearly data (pick a year)")}>
              <option value="reg_pop">{t("ประชากรตามทะเบียน", "Registered population")}</option>
              <option value="reg_house">{t("บ้านตามทะเบียน", "Registered houses")}</option>
            </optgroup>
          </select>
          {yearly && (
            <>
              <div className="yearbtns" role="group" aria-label={t("ปี", "Year")}>
                {REG_YEARS.map((y) => (
                  <button key={y} aria-pressed={y === year} onClick={() => { setYear(y); setPlaying(false); }}>{y}</button>
                ))}
                <button aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? t("หยุด", "Stop") : t("เล่นทุกปี", "Play")}</button>
              </div>
              <span className="small muted">{t("กรมการปกครอง ข้อมูล ณ ธ.ค. ของแต่ละปี สีใช้เกณฑ์เดียวกันทุกปีจึงเทียบกันได้", "DOPA, December of each year. Colours use the same classes for every year, so years can be compared.")}</span>
            </>
          )}
          {!tambonFill && <span className="small" style={{ color: "var(--warn)" }}>{t("เปิด \"สีตำบล\" ในชั้นข้อมูลเพื่อดูสี", "Turn on \"Sub-district colours\" under layers to see this")}</span>}
        </Fold>
        <Fold title={t("แผนที่พื้นหลัง", "Base map")} hint={(() => { const b = BASEMAPS.find((x) => x.id === basemap)!; return t(b.th, b.en); })()}>
          <select value={basemap} onChange={(e) => setBasemap(e.target.value)} aria-label={t("แผนที่พื้นหลัง", "Base map")}>
            {BASEMAPS.map((b) => (
              <option key={b.id} value={b.id}>{t(b.th, b.en)}{b.gistda ? " (GISTDA)" : ""}</option>
            ))}
          </select>
        </Fold>
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
          onView={setView}
          travelDest={travelDest}
        />
        {!overlays.height3d && <Collar view={view} note={t("ระวางอ้างอิง 4624 I และ 4625 II (WGS 84)", "Reference sheets 4624 I and 4625 II (WGS 84)")} />}
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
              <b>{t(o.th, o.en)}{o.id === "travel" && `: ${(() => { const d = TRAVEL_DESTS.find((x) => x.id === travelDest)!; return t(d.th, d.en); })()}`}</b>
              <div className="ramp">{o.ramp!.map((c) => <i key={c} style={{ background: c }} />)}</div>
              <div className="ends"><span>&lt;{num(o.breaks![0])}</span><span>{num(o.breaks![3])}+ {t(o.unitTh!, o.unitEn!)}</span></div>
              {o.id === "height3d" && <div className="small muted">{t("สี = ความสูงเฉลี่ย · ความสูงแท่ง = พื้นที่ใช้สอยในช่อง (ความสูงอาคารเป็นค่าจากแบบจำลองของ GISTDA)", "Colour = mean height · bar height = floor area in the cell (heights are GISTDA model estimates)")}</div>}
            </div>
          ))}
          {overlays.terrain && (
            <div>
              <b>{t("ภูเขาและที่ลาดชัน", "Hills & steep land")}</b>
              {TERRAIN_CLASSES.map((c) => (
                <div key={c.th} className="row small" style={{ gap: 6, flexWrap: "nowrap" }}><i style={{ width: 10, height: 10, background: c.c, display: "inline-block", flex: "none" }} />{t(c.th, c.en)}</div>
              ))}
              <div className="small muted">{t("ประกาศกระทรวงทรัพยากรฯ เขตคุ้มครองสิ่งแวดล้อมภูเก็ต พ.ศ. 2567 · ประกาศไม่ได้ระบุ % ของ \"ลาดเชิงเขา\" จึงใช้ 20% ตามฉบับ 2560 · Copernicus DEM 30 ม.", "Phuket environmental protection announcement 2024 · it does not give a slope % for \"hillside\", so 20 % from the 2017 version is used · Copernicus DEM 30 m")}</div>
            </div>
          )}
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
