/**
 * One 3D box per building, from the GISTDA API Gateway (buildings with modelled height, 2024 / 2567), loaded live.
 *
 * The map asks our proxy for 600 m tiles (zoom-16 tiles: /gistda/buildings/16/{x}/{y}.json) only while it is
 * zoomed in (zoom 15+), and only for tiles in view. The proxy adds the key and returns footprint, height and
 * storeys only. Tiles already seen are kept here (and in the browser / Netlify cache), so looking around the
 * same place does not ask GISTDA again. Like the yearly imagery, this needs VITE_GISTDA_IMAGERY=1 (team only).
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { AREA, BUILDING_TILE_Z } from "../netlify/gistda-proxy.mjs";

/** the layer appears from this zoom; tiles are not loaded below it */
export const BLDG_MIN_ZOOM = 15;
/** most tiles fetched for one view (a tilted map can see far towards the horizon) */
const MAX_TILES_IN_VIEW = 40;
/** tiles kept in memory; the oldest ones out of view are dropped first */
const MAX_TILES_KEPT = 160;
const PARALLEL = 6;

/** height classes (m): about 1–2, 3–4, 5–6, 7–13 storeys and 14+ */
export const BLDG_BREAKS = [6, 12, 20, 40];
export const BLDG_RAMP = ["#f3e7c8", "#eebd78", "#e08a45", "#c4512e", "#7d2418"];

export type BuildingFeature = Feature<Polygon | MultiPolygon, { id: string; h: number | null; s: number | null }>;

export interface BuildingStatus {
  /** zoomed in far enough to show buildings */
  zoomOk: boolean;
  loading: number;
  failed: number;
  buildings: number;
}

const lonToX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** zoom-16 tiles covering a box, limited to Phuket, nearest to `center` first */
export function tilesFor(b: { west: number; south: number; east: number; north: number }, center: [number, number]): string[] {
  const z = BUILDING_TILE_Z;
  const w = Math.max(b.west, AREA.west), e = Math.min(b.east, AREA.east);
  const s = Math.max(b.south, AREA.south), n = Math.min(b.north, AREA.north);
  if (w >= e || s >= n) return [];
  const x0 = lonToX(w, z), x1 = lonToX(e, z), y0 = latToY(n, z), y1 = latToY(s, z);
  const cx = lonToX(center[0], z), cy = latToY(center[1], z);
  const out: [number, number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y, (x - cx) ** 2 + (y - cy) ** 2]);
  return out.sort((a, b2) => a[2] - b2[2]).slice(0, MAX_TILES_IN_VIEW).map(([x, y]) => `${z}/${x}/${y}`);
}

/** fetches tiles through the proxy, keeps them, and hands back one merged collection (each building once) */
export class BuildingLoader {
  private tiles = new Map<string, BuildingFeature[]>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private queue: string[] = [];
  private active = 0;
  private wanted = new Set<string>();
  private zoomOk = false;

  constructor(private onData: (fc: FeatureCollection) => void, private onStatus: (s: BuildingStatus) => void) {}

  /** call when the view changes; an empty list (zoomed out) only updates the status */
  show(keys: string[], zoomOk: boolean) {
    this.zoomOk = zoomOk;
    this.wanted = new Set(keys);
    // a tile that failed before is tried again when it comes back into view
    for (const k of keys) if (this.failed.has(k)) this.failed.delete(k);
    this.queue = keys.filter((k) => !this.tiles.has(k) && !this.pending.has(k));
    for (const k of keys) {
      // mark as recently used
      const v = this.tiles.get(k);
      if (v) { this.tiles.delete(k); this.tiles.set(k, v); }
    }
    this.pump();
    this.status();
  }

  private pump() {
    while (this.active < PARALLEL && this.queue.length) {
      const k = this.queue.shift()!;
      if (!this.wanted.has(k)) continue;
      this.active++;
      this.pending.add(k);
      this.status();
      fetch(new URL(`gistda/buildings/${k}.json`, document.baseURI).href)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((fc: FeatureCollection) => {
          this.tiles.set(k, (fc.features ?? []) as BuildingFeature[]);
          this.trim();
          this.emit();
        })
        .catch(() => this.failed.add(k))
        .finally(() => {
          this.active--;
          this.pending.delete(k);
          this.status();
          this.pump();
        });
    }
  }

  private trim() {
    if (this.tiles.size <= MAX_TILES_KEPT) return;
    for (const k of this.tiles.keys()) {
      if (this.tiles.size <= MAX_TILES_KEPT) break;
      if (!this.wanted.has(k)) this.tiles.delete(k);
    }
  }

  private merged(): BuildingFeature[] {
    const seen = new Set<string>();
    const out: BuildingFeature[] = [];
    for (const list of this.tiles.values())
      for (const f of list) {
        // a building on a tile edge comes back with both tiles
        const id = f.properties.id;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        out.push(f);
      }
    return out;
  }

  private emit() {
    this.onData({ type: "FeatureCollection", features: this.merged() });
  }

  private status() {
    let n = 0;
    for (const k of this.wanted) n += this.tiles.get(k)?.length ?? 0;
    this.onStatus({ zoomOk: this.zoomOk, loading: this.pending.size + this.queue.length, failed: [...this.wanted].filter((k) => this.failed.has(k)).length, buildings: n });
  }
}
