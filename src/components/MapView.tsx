import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
// MapLibre builds its worker path at runtime, which the bundler cannot see; bundle the worker explicitly.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { BASEMAPS } from "../sphere";
import { LANDUSE_COLORS, OVERLAYS, POI_COLORS, type OverlayId } from "../layers";
import { useI18n } from "../i18n";
import type { TambonCollection, TambonProps, TravelDest } from "../types";
import { TRAVEL_DESTS } from "../factors";

interface Props {
  tambons: TambonCollection;
  /** fill colour per tambon id */
  fills: Record<string, string>;
  tambonOpacity: number;
  /** show the sub-district colour fill (outlines stay) */
  showTambonFill: boolean;
  overlays: Record<OverlayId, boolean>;
  basemap: string;
  showLabels: boolean;
  selectedId?: string;
  /** a click on the map: the tambon under the cursor (if any) and the clicked point */
  onMapClick: (hit: { id?: string; lon: number; lat: number }) => void;
  onBaseError: (failed: boolean) => void;
  /** places to mark on the map, e.g. Sphere search results */
  pins: { id: string; lon: number; lat: number; label: string }[];
  /** move the map here when `key` changes */
  focus?: { key: string; lon: number; lat: number; zoom: number };
  /** last clicked point */
  clickPoint?: { lon: number; lat: number };
  /** reports the visible area so the collar can draw coordinate ticks */
  onView?: (v: MapViewport) => void;
  /** destination shown by the travel-time layer */
  travelDest?: TravelDest;
}

export interface MapViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  /** position of the map canvas inside its frame */
  ox: number;
  oy: number;
  project: (lng: number, lat: number) => { x: number; y: number };
}

maplibregl.setWorkerUrl(workerUrl);

const BEFORE_BASE = "overlay-landuse";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function labelPoint(f: Feature<Polygon | MultiPolygon>): [number, number] {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best: [number, number] = [0, 0];
  let bestArea = 0;
  for (const poly of polys) {
    const r = poly[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const k = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
      a += k; cx += (r[i][0] + r[i + 1][0]) * k; cy += (r[i][1] + r[i + 1][1]) * k;
    }
    if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
  }
  return best;
}

function step(prop: string, breaks: number[], ramp: string[]): maplibregl.ExpressionSpecification {
  const e: unknown[] = ["step", ["get", prop], ramp[0]];
  breaks.forEach((b, i) => e.push(b, ramp[i + 1]));
  return e as maplibregl.ExpressionSpecification;
}

export default function MapView(p: Props) {
  const { t, lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const latest = useRef(p);
  latest.current = p;
  const langRef = useRef(lang);
  langRef.current = lang;

  // create the map once
  useEffect(() => {
    const base = BASEMAPS.find((b) => b.id === p.basemap) ?? BASEMAPS[0];
    const style: StyleSpecification = {
      version: 8,
      sources: { base: { type: "raster", tiles: base.tiles, tileSize: 256, attribution: base.attribution, maxzoom: 19 } },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#dfe7e5" } },
        { id: "base", type: "raster", source: "base" },
      ],
    };
    const m = new maplibregl.Map({ container: box.current!, style, center: [98.34, 7.95], zoom: 9.6, attributionControl: { compact: true } });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    let baseErrors = 0;
    m.on("error", (e) => {
      const src = (e as unknown as { sourceId?: string }).sourceId;
      if (src === "base" && ++baseErrors >= 3) latest.current.onBaseError(true);
    });

    // "style.load" fires as soon as the style is parsed; "load" would wait for base-map tiles,
    // so a slow or failing Sphere server would otherwise hide all analysis layers.
    m.once("style.load", async () => {
      // overlay files are fetched only when a layer is first switched on (see the effect below)
      OVERLAYS.forEach((o) => m.addSource(`ov-${o.id}`, { type: "geojson", data: EMPTY, attribution: o.attr }));
      m.addLayer({ id: "overlay-landuse", type: "fill", source: "ov-landuse", layout: { visibility: "none" },
        paint: {
          "fill-color": ["match", ["get", "cls"], ...Object.entries(LANDUSE_COLORS).flatMap(([k, v]) => [k, v.c]), "#cccccc"] as unknown as maplibregl.ExpressionSpecification,
          "fill-opacity": 0.75,
        } });
      const fillOverlay = (id: OverlayId) => {
        const o = OVERLAYS.find((x) => x.id === id)!;
        m.addLayer({ id: `overlay-${id}`, type: "fill", source: `ov-${id}`, layout: { visibility: "none" },
          paint: { "fill-color": step(o.prop!, o.breaks!, o.ramp!), "fill-opacity": 0.72 } });
      };
      fillOverlay("land");
      fillOverlay("travel");
      {
        const o = OVERLAYS.find((x) => x.id === "height3d")!;
        // bar height follows floor area per cell (far_pct = floor area ÷ cell area × 100); colour = mean building height
        m.addLayer({ id: "overlay-height3d", type: "fill-extrusion", source: "ov-height3d", layout: { visibility: "none" },
          paint: {
            "fill-extrusion-color": step(o.prop!, o.breaks!, o.ramp!),
            "fill-extrusion-height": ["*", ["min", ["get", "far_pct"], 200], 20],
            "fill-extrusion-opacity": 0.85,
          } });
      }
      fillOverlay("population");
      fillOverlay("buildings");

      m.addSource("tambons", { type: "geojson", data: latest.current.tambons, promoteId: "id" });
      m.addLayer({ id: "tambon-fill", type: "fill", source: "tambons", paint: { "fill-color": ["coalesce", ["get", "_fill"], "#cccccc"], "fill-opacity": 0.7 } });
      m.addLayer({ id: "tambon-line", type: "line", source: "tambons", paint: { "line-color": "#ffffff", "line-width": 1 } });
      m.addLayer({ id: "tambon-sel", type: "line", source: "tambons", filter: ["==", ["get", "id"], ""], paint: { "line-color": "#b0186e", "line-width": 3 } });

      m.addLayer({ id: "overlay-roads", type: "line", source: "ov-roads", layout: { visibility: "none", "line-cap": "round" },
        paint: {
          // topographic-map road colours: they stay readable over the blue score colours
          "line-color": ["match", ["get", "hw"], ["primary", "primary_link"], "#c4511c", ["secondary", "secondary_link"], "#e0873a", "#c9a27a"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "hw"], ["primary"], 2.2, ["secondary"], 1.4, 0.6], 14, ["match", ["get", "hw"], ["primary"], 6, ["secondary"], 4, 2]],
        } });
      m.addLayer({ id: "overlay-pois", type: "circle", source: "ov-pois", layout: { visibility: "none" },
        paint: {
          "circle-color": ["match", ["get", "cat"], ...Object.entries(POI_COLORS).flatMap(([k, v]) => [k, v.c]), "#888888"] as unknown as maplibregl.ExpressionSpecification,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2, 14, 6],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 0.8,
        } });

      // labels as HTML markers (no font server needed)
      markers.current = latest.current.tambons.features.map((f) => {
        const el = document.createElement("div");
        el.className = "tlabel";
        return new maplibregl.Marker({ element: el }).setLngLat(labelPoint(f));
      });

      // fit to Phuket main island
      m.fitBounds([[98.255, 7.75], [98.47, 8.2]], { padding: 20, duration: 0 });

      m.on("click", (e) => {
        // one popup listing what every visible layer says about this spot
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]];
        const html: string[] = [];
        const th = langRef.current === "th";
        const nf = (n: number) => Math.round(n).toLocaleString(th ? "th-TH" : "en-US");
        const row = (title: string, body: string) => html.push(`<div class="pp-row"><div class="pp-title">${escapeHtml(title)}</div><div>${body}</div></div>`);
        const first = (layer: string, pt: maplibregl.PointLike | [maplibregl.PointLike, maplibregl.PointLike] = e.point) =>
          m.getLayer(layer) && m.getLayoutProperty(layer, "visibility") !== "none"
            ? (m.queryRenderedFeatures(pt, { layers: [layer] })[0]?.properties as Record<string, string | number> | undefined)
            : undefined;
        const ov = (id: OverlayId) => OVERLAYS.find((o) => o.id === id)!;
        const label = (id: OverlayId) => (th ? ov(id).th : ov(id).en);

        const poi = first("overlay-pois", box);
        if (poi) {
          const cat = POI_COLORS[String(poi.cat)];
          const name = (!th && poi.name_en) || poi.name || poi.kind;
          row(label("pois"), `<b>${escapeHtml(String(name))}</b> <span class="pp-muted">${escapeHtml(cat ? (th ? cat.th : cat.en) : String(poi.kind))}</span>`);
        }
        const road = first("overlay-roads", box);
        if (road) {
          const cls: Record<string, [string, string]> = { primary: ["ถนนสายหลัก", "primary road"], secondary: ["ถนนสายรอง", "secondary road"], tertiary: ["ถนนท้องถิ่น", "tertiary road"] };
          const c = cls[String(road.hw).replace("_link", "")] ?? [String(road.hw), String(road.hw)];
          const name = [road.name, road.ref ? `(${road.ref})` : ""].filter(Boolean).join(" ") || (th ? "ไม่มีชื่อ" : "unnamed");
          row(label("roads"), `<b>${escapeHtml(String(name))}</b> <span class="pp-muted">${th ? c[0] : c[1]}</span>`);
        }
        const b = first("overlay-buildings");
        if (b) row(label("buildings"), th ? `<b>${nf(Number(b.n))}</b> หลัง หลังคาคลุม ${b.cover}% ของช่อง` : `<b>${nf(Number(b.n))}</b> buildings, roofs cover ${b.cover}% of the cell`);
        const pop = first("overlay-population");
        if (pop) row(label("population"), th ? `<b>${nf(Number(pop.population))}</b> คน หนาแน่น ${nf(Number(pop.density))} คน/ตร.กม.` : `<b>${nf(Number(pop.population))}</b> people, ${nf(Number(pop.density))} per km²`);
        const lv = first("overlay-land");
        if (lv) row(label("land"), th ? `ค่ากลาง <b>${nf(Number(lv.median_price))}</b> บาท/ตร.ว. จาก ${nf(Number(lv.parcels))} แปลง` : `median <b>${nf(Number(lv.median_price))}</b> THB/sq.wah from ${nf(Number(lv.parcels))} parcels`);
        const tv = first("overlay-travel");
        if (tv) {
          const d = TRAVEL_DESTS.find((x) => x.id === (latest.current.travelDest ?? "oldtown"))!;
          row(label("travel"), th ? `ประมาณ <b>${tv[d.key]}</b> นาที ถึง${d.th}` : `about <b>${tv[d.key]}</b> min to ${d.en.toLowerCase()}`);
        }
        const h3 = first("overlay-height3d");
        if (h3) row(label("height3d"), th
          ? `<b>${nf(Number(h3.n))}</b> หลัง สูงเฉลี่ย ${h3.h_mean} ม. (สูงสุด ${h3.h_max} ม.) พื้นที่ใช้สอย ${h3.far_pct}% ของช่อง`
          : `<b>${nf(Number(h3.n))}</b> buildings, mean height ${h3.h_mean} m (max ${h3.h_max} m), floor area ${h3.far_pct}% of the cell`);
        const lu = first("overlay-landuse");
        if (lu) row(label("landuse"), `<b>${escapeHtml(String(th ? lu.th : lu.en))}</b>`);

        if (html.length) new maplibregl.Popup({ closeButton: true, maxWidth: "300px" }).setLngLat(e.lngLat).setHTML(html.join("")).addTo(m);

        const f = m.queryRenderedFeatures(e.point, { layers: ["tambon-fill"] })[0];
        latest.current.onMapClick({
          id: f ? String((f.properties as TambonProps).id) : undefined,
          lon: Number(e.lngLat.lng.toFixed(6)),
          lat: Number(e.lngLat.lat.toFixed(6)),
        });
      });
      m.on("mousemove", (e) => {
        const layers = ["tambon-fill", ...OVERLAYS.map((o) => `overlay-${o.id}`)].filter((l) => m.getLayer(l));
        const hit = m.queryRenderedFeatures(e.point, { layers }).length > 0;
        m.getCanvas().style.cursor = hit ? "pointer" : "";
      });
      // report the viewport for the coordinate collar (at most once per frame)
      let raf = 0;
      const report = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const b = m.getBounds();
          const c = m.getCanvas();
          latest.current.onView?.({
            west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(),
            width: c.clientWidth, height: c.clientHeight,
            ox: box.current?.offsetLeft ?? 0, oy: box.current?.offsetTop ?? 0,
            project: (lng, lat) => m.project([lng, lat]),
          });
        });
      };
      m.on("move", report);
      m.on("resize", report);
      report();
      setReady(true);
    });
    return () => {
      markers.current.forEach((mk) => mk.remove());
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tambon colours
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const data: TambonCollection = {
      ...p.tambons,
      features: p.tambons.features.map((f) => ({ ...f, properties: { ...f.properties, _fill: p.fills[f.properties.id] } })),
    };
    (m.getSource("tambons") as GeoJSONSource).setData(data);
    // fade the sub-district colour when zoomed in, so the base map / satellite image shows through
    m.setPaintProperty(
      "tambon-fill",
      "fill-opacity",
      p.showTambonFill ? ["interpolate", ["linear"], ["zoom"], 11, p.tambonOpacity, 14, Math.min(p.tambonOpacity, 0.12)] : 0,
    );
  }, [ready, p.fills, p.tambons, p.tambonOpacity, p.showTambonFill]);

  // overlays on/off (load each file the first time its layer is shown)
  const loaded = useRef(new Set<OverlayId>());
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const o of OVERLAYS) {
      const on = p.overlays[o.id];
      if (on && !loaded.current.has(o.id)) {
        loaded.current.add(o.id);
        fetch(o.file)
          .then((r) => r.json())
          .then((data) => (m.getSource(`ov-${o.id}`) as GeoJSONSource | undefined)?.setData(data))
          .catch(() => loaded.current.delete(o.id));
      }
      m.setLayoutProperty(`overlay-${o.id}`, "visibility", on ? "visible" : "none");
    }
    // tilt the map for the 3D layer, flatten it again when the layer is off
    const want = p.overlays.height3d ? 55 : 0;
    if (Math.abs(m.getPitch() - want) > 1)
      m.easeTo(p.overlays.height3d
        ? { pitch: want, bearing: -15, zoom: Math.max(m.getZoom(), 10.6), center: [98.36, 7.9], duration: 900 }
        : { pitch: 0, bearing: 0, duration: 800 });
  }, [ready, p.overlays]);

  // travel layer: colour by the chosen destination
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !m.getLayer("overlay-travel")) return;
    const o = OVERLAYS.find((x) => x.id === "travel")!;
    const key = TRAVEL_DESTS.find((d) => d.id === (p.travelDest ?? "oldtown"))!.key;
    m.setPaintProperty("overlay-travel", "fill-color", step(key, o.breaks!, o.ramp!));
  }, [ready, p.travelDest]);

  // selection
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setFilter("tambon-sel", ["==", ["get", "id"], p.selectedId ?? ""]);
  }, [ready, p.selectedId]);

  // labels
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    markers.current.forEach((mk, i) => {
      const pr = p.tambons.features[i].properties;
      mk.getElement().textContent = lang === "th" ? pr.tambon_th : pr.tambon_en;
      if (p.showLabels) mk.addTo(m);
      else mk.remove();
    });
  }, [ready, p.showLabels, lang, p.tambons]);

  // pins (Sphere search results)
  const pinMarkers = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    pinMarkers.current.forEach((mk) => mk.remove());
    pinMarkers.current = p.pins.map((pin) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.title = pin.label;
      return new maplibregl.Marker({ element: el })
        .setLngLat([pin.lon, pin.lat])
        .setPopup(new maplibregl.Popup({ closeButton: false, offset: 10 }).setText(pin.label))
        .addTo(m);
    });
  }, [ready, p.pins]);

  // clicked point
  const clickMarker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    clickMarker.current?.remove();
    clickMarker.current = null;
    if (p.clickPoint) {
      const el = document.createElement("div");
      el.className = "clickdot";
      clickMarker.current = new maplibregl.Marker({ element: el }).setLngLat([p.clickPoint.lon, p.clickPoint.lat]).addTo(m);
    }
  }, [ready, p.clickPoint]);

  // fly to a place
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !p.focus) return;
    m.flyTo({ center: [p.focus.lon, p.focus.lat], zoom: p.focus.zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, p.focus?.key]);

  // basemap switch
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const base = BASEMAPS.find((b) => b.id === p.basemap) ?? BASEMAPS[0];
    p.onBaseError(false);
    m.removeLayer("base");
    m.removeSource("base");
    m.addSource("base", { type: "raster", tiles: base.tiles, tileSize: 256, attribution: base.attribution, maxzoom: 19 });
    m.addLayer({ id: "base", type: "raster", source: "base" }, BEFORE_BASE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, p.basemap]);

  return <div ref={box} className="maplibre-host" aria-label={t("แผนที่ภูเก็ต", "Map of Phuket")} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
