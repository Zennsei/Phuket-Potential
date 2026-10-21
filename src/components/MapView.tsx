import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
// MapLibre builds its worker path at runtime, which the bundler cannot see; bundle the worker explicitly.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { BASEMAPS } from "../sphere";
import { LANDUSE_COLORS, OVERLAYS, POI_COLORS, type OverlayId } from "../layers";
import { useI18n } from "../i18n";
import type { TambonCollection, TambonProps } from "../types";

interface Props {
  tambons: TambonCollection;
  /** fill colour per tambon id */
  fills: Record<string, string>;
  tambonOpacity: number;
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
      OVERLAYS.forEach((o) => m.addSource(`ov-${o.id}`, { type: "geojson", data: EMPTY }));
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
      fillOverlay("population");
      fillOverlay("buildings");

      m.addSource("tambons", { type: "geojson", data: latest.current.tambons, promoteId: "id" });
      m.addLayer({ id: "tambon-fill", type: "fill", source: "tambons", paint: { "fill-color": ["coalesce", ["get", "_fill"], "#cccccc"], "fill-opacity": 0.7 } });
      m.addLayer({ id: "tambon-line", type: "line", source: "tambons", paint: { "line-color": "#ffffff", "line-width": 1.2 } });
      m.addLayer({ id: "tambon-sel", type: "line", source: "tambons", filter: ["==", ["get", "id"], ""], paint: { "line-color": "#14232b", "line-width": 3 } });

      m.addLayer({ id: "overlay-roads", type: "line", source: "ov-roads", layout: { visibility: "none", "line-cap": "round" },
        paint: {
          "line-color": ["match", ["get", "hw"], ["primary", "primary_link"], "#1d4f7a", ["secondary", "secondary_link"], "#2b6f9e", "#6d9cc0"],
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
        const poi = m.queryRenderedFeatures(e.point, { layers: ["overlay-pois"] })[0] as MapGeoJSONFeature | undefined;
        if (poi) {
          const pr = poi.properties as Record<string, string>;
          const cat = POI_COLORS[pr.cat];
          const name = (langRef.current === "en" && pr.name_en) || pr.name || pr.kind;
          new maplibregl.Popup({ closeButton: false })
            .setLngLat(e.lngLat)
            .setHTML(`<b>${escapeHtml(name)}</b><br><span style="color:#5b6b70">${escapeHtml(cat ? (langRef.current === "th" ? cat.th : cat.en) : pr.kind)}</span>`)
            .addTo(m);
          return;
        }
        const lu = m.queryRenderedFeatures(e.point, { layers: ["overlay-landuse"] })[0];
        if (lu) {
          const pr = lu.properties as Record<string, string>;
          new maplibregl.Popup({ closeButton: false })
            .setLngLat(e.lngLat)
            .setHTML(`<b>${escapeHtml(langRef.current === "th" ? pr.th : pr.en)}</b><br><span style="color:#5b6b70">${langRef.current === "th" ? "การใช้ที่ดิน ปี 2563 (กรมพัฒนาที่ดิน)" : "Land use 2020 (LDD)"}</span>`)
            .addTo(m);
        }
        const f = m.queryRenderedFeatures(e.point, { layers: ["tambon-fill"] })[0];
        latest.current.onMapClick({
          id: f ? String((f.properties as TambonProps).id) : undefined,
          lon: Number(e.lngLat.lng.toFixed(6)),
          lat: Number(e.lngLat.lat.toFixed(6)),
        });
      });
      m.on("mousemove", (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: ["tambon-fill", "overlay-pois"] }).length > 0;
        m.getCanvas().style.cursor = hit ? "pointer" : "";
      });
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
    m.setPaintProperty("tambon-fill", "fill-opacity", ["interpolate", ["linear"], ["zoom"], 11, p.tambonOpacity, 14, Math.min(p.tambonOpacity, 0.12)]);
  }, [ready, p.fills, p.tambons, p.tambonOpacity]);

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
  }, [ready, p.overlays]);

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

  return <div ref={box} className="maplibre-host" style={{ position: "absolute", inset: 0 }} aria-label={t("แผนที่ภูเก็ต", "Map of Phuket")} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
