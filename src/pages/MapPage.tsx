import { useEffect, useMemo, useState } from "react";
import MapView, { type MapViewport } from "../components/MapView";
import Collar from "../components/Collar";
import Fold from "../components/Fold";
import WeightPanel from "../components/WeightPanel";
import TambonDetail from "../components/TambonDetail";
import SphereSearch from "../components/SphereSearch";
import SphereNearby from "../components/SphereNearby";
import { FACTORS, unitOf } from "../factors";
import { LANDUSE_COLORS, OVERLAYS, POI_COLORS, TERRAIN_CLASSES, type OverlayId } from "../layers";
import { BASEMAPS, type SpherePlace } from "../sphere";
import { DEFAULT_IMAGERY, GISTDA_BASEMAPS, GISTDA_IMAGERY, IMAGERY_YEARS } from "../gistda";
import { LT_COLOURS, LT_GROUPS, ltCss, ltYears } from "../landtrendr";
import { BLDG_INFO, BLDG_SOURCES, BUILDING_LOD, OUTLINE_COLOR, type BldgSource, type BuildingStatus } from "../buildings3d";
import { RAMP, classOf, quantileBreaks, scoreColor } from "../color";
import { REG_YEARS, regHouse, regPop } from "../years";
import { useI18n } from "../i18n";
import { href } from "../router";
import type { PageProps } from "../pageProps";
import type { FactorKey } from "../types";

/** "reg_pop" / "reg_house": registered people / houses per km² in the chosen year */
type ColorBy = "score" | FactorKey | "reg_pop" | "reg_house";

type CatId = "tambon" | "buildings" | "roads" | "land" | "people" | "places" | "base";

/**
 * One layer category in the left panel: a row with the name, what is showing now and an on/off switch;
 * clicking the name opens the category's own choices (view, data source, notes). One category is open at a time.
 */
function Cat({ id, open, setOpen, title, summary, on, setOn, swatch, children }: {
  id: CatId; open: CatId | null; setOpen: (c: CatId | null) => void; title: string; summary: string;
  on?: boolean; setOn?: (v: boolean) => void; swatch?: string; children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <div className={`cat${isOpen ? " open" : ""}${on === false ? " off" : ""}`}>
      <div className="cat-head">
        <button type="button" className="cat-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>
          <span className="chev" aria-hidden>{isOpen ? "▾" : "▸"}</span>
          {swatch && <span className="sw" style={{ background: swatch }} />}
          <span className="cat-name">{title}</span>
          <span className="cat-sum">{summary}</span>
        </button>
        {setOn && (
          <label className="switch" title={title}>
            <input type="checkbox" checked={!!on} onChange={(e) => setOn(e.target.checked)} aria-label={title} />
            <span aria-hidden />
          </label>
        )}
      </div>
      {isOpen && <div className="cat-body">{children}</div>}
    </div>
  );
}

export default function MapPage({ data, scored, weights, setWeights, selectedId }: PageProps & { selectedId?: string }) {
  const { t, num, lang } = useI18n();
  const [colorBy, setColorBy] = useState<ColorBy>("score");
  const [year, setYear] = useState<number>(REG_YEARS[REG_YEARS.length - 1]);
  const [playing, setPlaying] = useState(false);
  // layer categories (left panel); `overlays` below is worked out from them
  const [openCat, setOpenCat] = useState<CatId | null>(null);
  const [bldgOn, setBldgOn] = useState(false);
  const [bldgView, setBldgView] = useState<"bldg3d" | "height3d">("bldg3d");
  const [roadsOn, setRoadsOn] = useState(true);
  const [roadsAll, setRoadsAll] = useState(true);
  const [landOn, setLandOn] = useState<Record<"landuse" | "terrain" | "landtrendr" | "land", boolean>>({ landuse: false, terrain: false, landtrendr: false, land: false });
  const [popOn, setPopOn] = useState(false);
  const [poisOn, setPoisOn] = useState(false);
  const overlays: Record<OverlayId, boolean> = {
    ...landOn,
    landtrendr: GISTDA_IMAGERY && landOn.landtrendr,
    population: popOn,
    height3d: bldgOn && bldgView === "height3d",
    bldg3d: bldgOn && bldgView === "bldg3d",
    roads: roadsOn,
    streets: roadsOn && roadsAll,
    pois: poisOn,
  };
  const [basemap, setBasemap] = useState(BASEMAPS[0].id);
  // GISTDA yearly imagery: the slider moves `imgIdx` at once, the picture follows when the slider rests (each new picture costs credits)
  const [imgLayer, setImgLayer] = useState(DEFAULT_IMAGERY);
  const [imgIdx, setImgIdx] = useState(() => IMAGERY_YEARS.findIndex((y) => y.layer === DEFAULT_IMAGERY));
  const [compareOn, setCompareOn] = useState(false);
  const [cmpLayer, setCmpLayer] = useState(DEFAULT_IMAGERY);
  const [labels, setLabels] = useState(true);
  const [tambonFill, setTambonFill] = useState(true);
  const [view, setView] = useState<MapViewport>();
  const [baseFailed, setBaseFailed] = useState(false);
  const [bldg, setBldg] = useState<BuildingStatus>();
  const [bldgSource, setBldgSource] = useState<BldgSource>(BLDG_SOURCES[0]);
  const [bldgOutline, setBldgOutline] = useState(false);
  const [clickPoint, setClickPoint] = useState<{ lon: number; lat: number }>();
  const [pins, setPins] = useState<SpherePlace[]>([]);
  const [focus, setFocus] = useState<{ key: string; lon: number; lat: number; zoom: number }>();
  const yearly = colorBy === "reg_pop" || colorBy === "reg_house";
  const baseChoices = GISTDA_IMAGERY ? [...BASEMAPS, ...GISTDA_BASEMAPS] : BASEMAPS;
  const onYears = GISTDA_IMAGERY && basemap === "gistda_years";
  const baseId = onYears ? `gistda_years:${imgLayer}` : basemap;
  const baseIsGistdaApi = baseChoices.find((b) => b.id === basemap)?.gistdaApi ?? false;
  const yearName = (layer: string) => { const y = IMAGERY_YEARS.find((x) => x.layer === layer)!; return t(y.th, y.en); };

  useEffect(() => {
    const layer = IMAGERY_YEARS[imgIdx]?.layer;
    if (!layer || layer === imgLayer) return;
    const id = window.setTimeout(() => setImgLayer(layer), 450);
    return () => window.clearTimeout(id);
  }, [imgIdx, imgLayer]);
  const stepYear = (d: number) => {
    const i = Math.min(IMAGERY_YEARS.length - 1, Math.max(0, imgIdx + d));
    setImgIdx(i);
    setImgLayer(IMAGERY_YEARS[i].layer);
  };
  const toggleCompare = (on: boolean) => {
    // the left side starts at an early clear picture, so the change is easy to see
    if (on && imgLayer === cmpLayer) {
      const i = IMAGERY_YEARS.findIndex((y) => y.layer === "thailand_sat_1990");
      setImgIdx(i);
      setImgLayer(IMAGERY_YEARS[i].layer);
    }
    setCompareOn(on);
  };

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

  const anyFillOverlay = overlays.landuse || overlays.population || overlays.land || overlays.height3d || overlays.terrain || overlays.landtrendr;
  const layersOn = [tambonFill, bldgOn, roadsOn, ...Object.values(landOn), popOn, poisOn].filter(Boolean).length;
  const ov = (id: OverlayId) => OVERLAYS.find((o) => o.id === id)!;
  const pill = (id: OverlayId, label?: string) => {
    const o = ov(id);
    return <span className={`pill ${o.gistda ? "gistda" : id === "land" ? "warn" : "muted"}`} style={{ fontSize: 10, padding: "0 6px" }}>{label ?? t(o.sourceTh, o.sourceEn)}</span>;
  };
  const landItems: ("landuse" | "terrain" | "landtrendr" | "land")[] = ["landuse", "terrain", ...(GISTDA_IMAGERY ? ["landtrendr" as const] : []), "land"];
  const baseName = onYears ? t(`ภาพดาวเทียม ${yearName(imgLayer)}`, `Imagery ${yearName(imgLayer)}`) : (() => { const b = baseChoices.find((x) => x.id === basemap)!; return t(b.th, b.en); })();
  const otherSrc = BLDG_SOURCES.find((x) => x !== bldgSource);
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
          <p className="small muted" style={{ margin: "0 0 4px" }}>{t("กดชื่อหมวดเพื่อเลือกรูปแบบและที่มาของข้อมูล · สวิตช์ขวา = เปิด/ปิด", "Click a category for its views and data sources · switch on the right = on/off")}</p>
          <div className="cats">
            <Cat id="tambon" open={openCat} setOpen={setOpenCat} title={t("สีตำบล", "Sub-district colours")} summary={colourName(colorBy)} on={tambonFill} setOn={setTambonFill} swatch="#2c7a98">
              <label className="small" style={{ display: "grid", gap: 2 }}>
                {t("ระบายสีตำบลตาม", "Colour sub-districts by")}
                <select value={colorBy} onChange={(e) => { setColorBy(e.target.value as ColorBy); setPlaying(false); setTambonFill(true); }}>
                  <option value="score">{t("คะแนนศักยภาพรวม", "Overall potential score")}</option>
                  <optgroup label={t("ปัจจัย", "Factors")}>
                    {FACTORS.map((f) => <option key={f.key} value={f.key}>{t(f.th, f.en)}</option>)}
                  </optgroup>
                  <optgroup label={t("ข้อมูลรายปี (เลือกปีได้)", "Yearly data (pick a year)")}>
                    <option value="reg_pop">{t("ประชากรตามทะเบียน", "Registered population")}</option>
                    <option value="reg_house">{t("บ้านตามทะเบียน", "Registered houses")}</option>
                  </optgroup>
                </select>
              </label>
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
              <label className="check small">
                <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
                <span>{t("แสดงชื่อตำบล", "Show sub-district names")}</span>
              </label>
            </Cat>

            <Cat id="buildings" open={openCat} setOpen={setOpenCat} title={t("อาคาร", "Buildings")}
              summary={bldgView === "bldg3d" ? t(`3 มิติรายหลัง · ${bldgSource === "gistda" ? "GISTDA" : "Overture"}`, `3D each · ${bldgSource === "gistda" ? "GISTDA" : "Overture"}`) : t("3 มิติ ช่อง 500 ม. · GISTDA", "3D 500 m cells · GISTDA")}
              on={bldgOn} setOn={setBldgOn} swatch="#c4512e">
              <div className="radios" role="radiogroup" aria-label={t("รูปแบบ", "View")}>
                <label className="check small"><input type="radio" name="bldgview" checked={bldgView === "bldg3d"} onChange={() => { setBldgView("bldg3d"); setBldgOn(true); }} /><span>{t("3 มิติรายหลัง (ซูมใกล้)", "3D, one by one (zoom in)")}</span></label>
                <label className="check small"><input type="radio" name="bldgview" checked={bldgView === "height3d"} onChange={() => { setBldgView("height3d"); setBldgOn(true); }} /><span>{t("3 มิติ ช่อง 500 ม. (ทั้งเกาะ)", "3D, 500 m cells (whole island)")}</span></label>
              </div>
              {bldgView === "bldg3d" ? (
                <>
                  {BLDG_SOURCES.length > 1 ? (
                    <label className="small" style={{ display: "grid", gap: 2 }}>
                      {t("ที่มาของข้อมูล", "Data source")}
                      <select value={bldgSource} onChange={(e) => setBldgSource(e.target.value as BldgSource)}>
                        {BLDG_SOURCES.map((src) => <option key={src} value={src}>{t(BLDG_INFO[src].th, BLDG_INFO[src].en)}</option>)}
                      </select>
                    </label>
                  ) : <span className="small">{t("ที่มา:", "Source:")} {pill("bldg3d", "Overture")}</span>}
                  {otherSrc && (
                    <label className="check small">
                      <input type="checkbox" checked={bldgOutline} onChange={(e) => setBldgOutline(e.target.checked)} />
                      <span className="sw" style={{ background: "transparent", border: `2px solid ${OUTLINE_COLOR[otherSrc]}` }} />
                      <span>{t(`ซ้อนขอบอาคาร ${otherSrc === "overture" ? "Overture" : "GISTDA"} (เทียบตำแหน่ง)`, `${otherSrc === "overture" ? "Overture" : "GISTDA"} outlines on top (compare positions)`)}</span>
                    </label>
                  )}
                </>
              ) : (
                <span className="small">{t("ที่มา:", "Source:")} {pill("height3d")} <span className="muted">{t("สี = ความสูงเฉลี่ย · ความสูงแท่ง = พื้นที่ใช้สอย", "colour = mean height · bar = floor area")}</span></span>
              )}
            </Cat>

            <Cat id="roads" open={openCat} setOpen={setOpenCat} title={t("ถนน", "Roads")} summary={roadsAll ? t("ทุกประเภทรวมซอย", "all, incl. alleys") : t("สายหลัก", "main roads")} on={roadsOn} setOn={setRoadsOn} swatch="#c4511c">
              <div className="radios" role="radiogroup" aria-label={t("แสดง", "Show")}>
                <label className="check small"><input type="radio" name="roads" checked={!roadsAll} onChange={() => { setRoadsAll(false); setRoadsOn(true); }} /><span>{t("ถนนสายหลัก", "Main roads")}</span></label>
                <label className="check small"><input type="radio" name="roads" checked={roadsAll} onChange={() => { setRoadsAll(true); setRoadsOn(true); }} /><span>{t("ทุกประเภทรวมซอย (ซอยขึ้นเมื่อซูมใกล้)", "All, incl. alleys (alleys appear when zoomed in)")}</span></label>
              </div>
              <span className="small">{t("ที่มา:", "Source:")} {pill("roads")}</span>
            </Cat>

            <Cat id="land" open={openCat} setOpen={setOpenCat} title={t("ที่ดิน", "Land")}
              summary={(() => { const n = landItems.filter((k) => landOn[k]).length; return n ? t(`เปิด ${n}`, `${n} on`) : t("ปิด", "off"); })()}
              on={landItems.some((k) => landOn[k])} setOn={(v) => setLandOn(v ? { ...landOn, landuse: true } : { landuse: false, terrain: false, landtrendr: false, land: false })} swatch="#5c8a3a">
              {landItems.map((k) => (
                <div key={k}>
                  <label className="check small">
                    <input type="checkbox" checked={landOn[k]} onChange={(e) => setLandOn({ ...landOn, [k]: e.target.checked })} />
                    <span className="sw" style={{ background: ov(k).swatch }} />
                    <span>{t(ov(k).th, ov(k).en)} {pill(k)}</span>
                  </label>
                  {k === "land" && landOn.land && (
                    <div className="small" style={{ color: "var(--warn)", margin: "0 0 4px 26px" }}>{t(
                      "ข้อมูลจำลอง ไม่ใช่ราคาจริง (ราคาประเมินกรมธนารักษ์ × 2) ใช้แสดงหน้าตาของชั้นนี้จนกว่าจะได้ราคาตลาดจริง · ไม่ได้ใช้คิดคะแนน",
                      "Simulated, not real prices (Treasury appraisal × 2), shown until real market prices are available · not used in any score")}</div>
                  )}
                  {k === "landtrendr" && landOn.landtrendr && (
                    <div className="small muted" style={{ margin: "0 0 4px 26px" }}>{t(
                      "ที่ที่เคยมีต้นไม้หรือพืชคลุม แล้วกลายเป็นพื้นโล่งหรือสิ่งปลูกสร้าง สีบอกปีโดยประมาณ บอกไม่ได้ว่ากลายเป็นอะไร (ดูภาพดาวเทียมรายปีประกอบ)",
                      "Places once covered by trees or plants that became bare ground or buildings; colour = approximate year. It cannot say what they became (check the yearly imagery).")}</div>
                  )}
                </div>
              ))}
            </Cat>

            <Cat id="people" open={openCat} setOpen={setOpenCat} title={t("ประชากร", "People")} summary={t("หกเหลี่ยม 400 ม.", "400 m hexagons")} on={popOn} setOn={setPopOn} swatch="#2b8a80">
              <span className="small">{t("ที่มา:", "Source:")} {pill("population")}</span>
              <span className="small muted">{t("ค่าประมาณจากแบบจำลอง รวมคนที่ไม่ได้ย้ายทะเบียน ใช้ดูว่าที่ไหนหนาแน่นกว่า ไม่ใช่จำนวนคนจริง", "Model estimate that includes people not registered there: shows where it is denser, not exact counts")}</span>
            </Cat>

            <Cat id="places" open={openCat} setOpen={setOpenCat} title={t("สถานที่", "Places")} summary={t("บริการและท่องเที่ยว", "services & tourism")} on={poisOn} setOn={setPoisOn} swatch="#7a5aa6">
              <span className="small">{t("ที่มา:", "Source:")} {pill("pois")}</span>
              <span className="small muted">{t("โรงเรียน สถานพยาบาล ตลาด ร้านค้า ธนาคาร หน่วยงานรัฐ คมนาคม ที่พัก แหล่งท่องเที่ยว · คลิกจุดบนแผนที่เพื่อถาม GISTDA Sphere ว่ารอบจุดมีอะไรเพิ่ม", "Schools, health, markets, shops, banks, public offices, transport, lodging, attractions · click the map to ask GISTDA Sphere what else is nearby")}</span>
            </Cat>

            <Cat id="base" open={openCat} setOpen={setOpenCat} title={t("แผนที่พื้นหลัง", "Base map")} summary={baseName}>
              <select value={basemap} onChange={(e) => setBasemap(e.target.value)} aria-label={t("แผนที่พื้นหลัง", "Base map")}>
                {baseChoices.map((b) => (
                  <option key={b.id} value={b.id}>{t(b.th, b.en)}{b.gistda ? (b.gistdaApi ? " (GISTDA API)" : " (GISTDA)") : ""}</option>
                ))}
              </select>
              {onYears && (
                <div className="imgyears">
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                    <button className="btn ghost" style={{ padding: "1px 10px" }} onClick={() => stepYear(-1)} disabled={imgIdx === 0} aria-label={t("ปีก่อนหน้า", "Previous year")}>◀</button>
                    <span className="yr" aria-live="polite">{t(IMAGERY_YEARS[imgIdx].th, IMAGERY_YEARS[imgIdx].en)}</span>
                    <button className="btn ghost" style={{ padding: "1px 10px" }} onClick={() => stepYear(1)} disabled={imgIdx === IMAGERY_YEARS.length - 1} aria-label={t("ปีถัดไป", "Next year")}>▶</button>
                  </div>
                  <input type="range" min={0} max={IMAGERY_YEARS.length - 1} step={1} value={imgIdx} onChange={(e) => setImgIdx(Number(e.target.value))}
                    aria-label={t("ปีของภาพดาวเทียม", "Imagery year")} aria-valuetext={t(IMAGERY_YEARS[imgIdx].th, IMAGERY_YEARS[imgIdx].en)} />
                  <div className="row small muted" style={{ justifyContent: "space-between" }}><span>{t("2515", "1972")}</span><span>{t("2568 + ภาพ 2 ม.", "2025 + 2 m mosaics")}</span></div>
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" checked={compareOn} onChange={(e) => toggleCompare(e.target.checked)} />
                    {t("เทียบ 2 ปี (เลื่อนเส้นแบ่งบนแผนที่)", "Compare 2 years (drag the divider on the map)")}
                  </label>
                  {compareOn && (
                    <label className="small" style={{ display: "grid", gap: 2 }}>
                      {t("ภาพด้านขวาของเส้นแบ่ง", "Picture right of the divider")}
                      <select value={cmpLayer} onChange={(e) => setCmpLayer(e.target.value)}>
                        {IMAGERY_YEARS.map((y) => <option key={y.layer} value={y.layer}>{t(y.th, y.en)}</option>)}
                      </select>
                    </label>
                  )}
                  <span className="small muted">{t(
                    "ปี 2515–2522 มีเมฆและริ้ว ตั้งแต่ 2533 ชัดเจน ภาพปีเก่าซูมใกล้จะเบลอ ซูมดูเมืองใช้ภาพ 2 ม. (2563–64, 2567)",
                    "1972–1979 have clouds and stripes; from 1990 they are clear. Older years blur when zoomed in; use the 2 m mosaics (2020–21, 2024) for close-ups.")}</span>
                </div>
              )}
              {GISTDA_IMAGERY && baseIsGistdaApi && (
                <span className="small muted">{t(
                  "ภาพจาก GISTDA API Gateway (Copyrighted by GISTDA) · ภาพแต่ละช่องที่เปิดครั้งแรกใช้เครดิต key ทีม 1 ครั้ง",
                  "Pictures from the GISTDA API Gateway (Copyrighted by GISTDA) · each tile seen for the first time uses 1 credit of the team key")}</span>
              )}
            </Cat>
          </div>
        </Fold>
      </aside>

      <div className="mapbox">
        <MapView
          tambons={data.tambons}
          fills={fills}
          tambonOpacity={anyFillOverlay ? 0.12 : 0.72}
          showTambonFill={tambonFill}
          overlays={overlays}
          basemap={baseId}
          compare={onYears && compareOn ? { basemap: `gistda_years:${cmpLayer}`, leftLabel: yearName(imgLayer), rightLabel: yearName(cmpLayer) } : undefined}
          showLabels={labels}
          selectedId={selectedId}
          onMapClick={onMapClick}
          onBaseError={setBaseFailed}
          pins={pins.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, label: p.name }))}
          focus={focus}
          clickPoint={clickPoint}
          onView={setView}
          onBldgStatus={setBldg}
          bldgSource={bldgSource}
          bldgOutline={bldgOutline}
        />
        {/* the edge coordinates only line up on a flat map, so the collar is hidden while the map is tilted */}
        {!overlays.height3d && (view?.pitch ?? 0) < 1 && <Collar view={view} note={t("ระวางอ้างอิง 4624 I และ 4625 II (WGS 84)", "Reference sheets 4624 I and 4625 II (WGS 84)")} />}
        {baseFailed && (
          <div className="notice" role="status">
            {baseIsGistdaApi
              ? t("โหลดภาพจาก GISTDA API Gateway ไม่สำเร็จ (ตรวจว่ามี GISTDA_API_KEY ใน .env แล้วเปิด npm run dev ใหม่ หรือตั้งใน Netlify และเครดิตของ key ยังเหลือ) ข้อมูลวิเคราะห์ยังใช้ได้ตามปกติ ",
                  "The GISTDA API Gateway pictures did not load (check GISTDA_API_KEY in .env and restart npm run dev, or set it on Netlify, and that the key has credits left). The analysis layers still work. ")
              : t("โหลดแผนที่พื้นหลังไม่สำเร็จ (อาจเป็นเพราะ API key หรือเครดิตของ Sphere) ข้อมูลวิเคราะห์ยังใช้ได้ตามปกติ ",
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
              {o.id === "bldg3d" && (
                <div className="small muted">
                  {!bldg?.zoomOk
                    ? t("ซูมเข้าใกล้ (ระดับ 15 ขึ้นไป) เพื่อดูอาคารรายหลัง", "Zoom in (level 15+) to see each building")
                    : bldg.loading
                      ? t("กำลังโหลดอาคาร…", "Loading buildings…")
                      : t(`ซูม 15–16 เฉพาะหลัง ≥ ${BUILDING_LOD.minAreaM2} ตร.ม. หรือ ≥ ${BUILDING_LOD.minHeightM} ม. · 16+ ครบทุกหลัง`, `Zoom 15–16: ${BUILDING_LOD.minAreaM2} m²+ or ${BUILDING_LOD.minHeightM} m+ only · 16+: all`)}
                  {bldg?.failed && bldgSource === "gistda" && <span style={{ color: "var(--warn)" }}>{t(" · โหลดอาคาร GISTDA ไม่ได้บางแผ่น (ตรวจ GISTDA_API_KEY)", " · some GISTDA tiles failed (check GISTDA_API_KEY)")}</span>}
                  <br />{bldgSource === "gistda"
                    ? t("ความสูงจากแบบจำลอง GISTDA มักเกินราว 1 ชั้น", "GISTDA model heights, often ~1 storey high")
                    : t("สีเทา = Overture ไม่มีความสูง (แสดง 1 ชั้น)", "Grey = no height in Overture (drawn as 1 storey)")}
                  {bldgOutline && <><br /><span style={{ color: OUTLINE_COLOR[BLDG_SOURCES.find((x) => x !== bldgSource) ?? "overture"] }}>{t("เส้นขอบ = อาคารจากอีกแหล่ง", "Outlines = buildings from the other source")}</span></>}
                </div>
              )}
              {o.id === "land" && <div className="small" style={{ color: "var(--warn)" }}>{t("ข้อมูลจำลอง ไม่ใช่ราคาจริง · ไม่ได้ใช้คิดคะแนน", "Simulated, not real prices · not used in any score")}</div>}
              {o.id === "height3d" && <div className="small muted">{t("สี = ความสูงเฉลี่ย · ความสูงแท่ง = พื้นที่ใช้สอยในช่อง (ความสูงอาคารเป็นค่าจากแบบจำลองของ GISTDA)", "Colour = mean height · bar height = floor area in the cell (heights are GISTDA model estimates)")}</div>}
            </div>
          ))}
          {overlays.landtrendr && (
            <div>
              <b>{t("พื้นที่สีเขียวที่หายไป: ปีโดยประมาณ (Landtrendr)", "Lost green cover: approximate year (Landtrendr)")}</b>
              {LT_GROUPS.map((g) => (
                <div key={g.id} className="row small" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <span className="ramp many" style={{ width: 56, flex: "none" }} title={t(`กลุ่ม${g.th}`, `${g.en} group`)}>
                    {LT_COLOURS.filter((c) => c.group === g.id).map((c) => <i key={c.rgb.join()} style={{ background: ltCss(c) }} />)}
                  </span>
                  {ltYears(g, lang === "th")}
                </div>
              ))}
              <div className="small muted">
                {t("ต้นไม้หรือพืชหายไป กลายเป็นพื้นโล่งหรือสิ่งปลูกสร้าง (บอกไม่ได้ว่าเป็นอะไร) · ปีโดยประมาณที่ทีมหาเอง (GISTDA ไม่มีคำอธิบายสี) · คลิกจุดเพื่อดูปี · ไม่มีสี = ไม่เปลี่ยน",
                   "Trees or plants gone, now bare ground or buildings (it cannot say which) · approximate years worked out by the team (GISTDA gives no legend) · click a spot for its year · no colour = no change")}
                <br /><span style={{ color: "var(--warn)" }}>{t("GISTDA API ใช้ภายในทีม · Landsat 30 ม. (ซูมเกิน 14 = ขยายภาพเดิม)", "GISTDA API, team only · Landsat 30 m (beyond zoom 14 = enlarged)")}</span>
              </div>
            </div>
          )}
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
