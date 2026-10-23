/**
 * GISTDA Sphere settings and API helpers. The key comes from .env (VITE_SPHERE_KEY).
 * A Sphere key is always visible to visitors in the browser, so restrict it to
 * this website's domain in the Sphere key settings.
 *
 * Endpoints were checked on 22 Oct 2026 against Sphere's own map library
 * (https://api.sphere.gistda.or.th/map/). All of them allow browser calls (CORS: *).
 * Terms of use: call them only when a user asks (no bulk downloading of results).
 */
export const SPHERE_KEY: string = import.meta.env.VITE_SPHERE_KEY ?? "";
const API = "https://api.sphere.gistda.or.th/services";
const TILES = "https://basemap.sphere.gistda.or.th/tiles";

export interface Basemap {
  id: string;
  th: string;
  en: string;
  tiles: string[];
  attribution: string;
  gistda?: boolean;
  /** tiles come through our GISTDA API Gateway proxy (/gistda/…), see src/gistda.ts */
  gistdaApi?: boolean;
  /** only ask for tiles inside [west, south, east, north] */
  bounds?: [number, number, number, number];
  /** highest zoom with its own tiles (default 19) */
  maxzoom?: number;
}

// Sphere's terms ask for the GISTDA sphere credit and for third-party data inside it (OpenStreetMap, ODbL) to be credited too.
const SPHERE_ATTR =
  '© <a href="https://sphere.gistda.or.th/" target="_blank" rel="noopener">GISTDA sphere</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';

export const BASEMAPS: Basemap[] = [
  {
    id: "sphere_streets",
    th: "Sphere แผนที่ถนน",
    en: "Sphere streets",
    tiles: [`${TILES}/sphere_streets/EPSG3857/{z}/{x}/{y}.png?key=${SPHERE_KEY}`],
    attribution: SPHERE_ATTR,
    gistda: true,
  },
  {
    // same layer as sphere.Layers.IMAGES in the Sphere map library
    id: "thailand_images",
    th: "Sphere ภาพดาวเทียม",
    en: "Sphere satellite imagery",
    tiles: [`${TILES}/thailand_images/EPSG3857/{z}/{x}/{y}.jpeg?key=${SPHERE_KEY}`],
    attribution: SPHERE_ATTR,
    gistda: true,
  },
  {
    id: "carto",
    th: "แผนที่สำรอง (CARTO)",
    en: "Backup map (CARTO)",
    tiles: ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`),
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  },
];

export interface SpherePlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  tag?: string[];
  /** degrees, only for nearby search */
  distance?: number;
}

export interface SphereAddress {
  geocode?: number;
  province?: string;
  district?: string;
  subdistrict?: string;
  postcode?: number;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sphere HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Keyword search around a point (span in km). */
export async function searchPlaces(keyword: string, lon: number, lat: number, lang: "th" | "en", spanKm = 40, limit = 10) {
  const url = `${API}/search/search?keyword=${encodeURIComponent(keyword)}&lon=${lon}&lat=${lat}&span=${spanKm}km&limit=${limit}&locale=${lang}&key=${SPHERE_KEY}`;
  const r = await get<{ data?: SpherePlace[] }>(url);
  return r.data ?? [];
}

/** Places of interest nearest to a point. */
export async function nearbyPlaces(lon: number, lat: number, lang: "th" | "en", limit = 8) {
  const url = `${API}/poi/search?lon=${lon}&lat=${lat}&span=0.01&limit=${limit}&locale=${lang}&status=A&key=${SPHERE_KEY}`;
  const r = await get<{ data?: SpherePlace[] }>(url);
  return r.data ?? [];
}

/** Province / district / sub-district of a point. */
export function addressAt(lon: number, lat: number, lang: "th" | "en") {
  return get<SphereAddress>(`${API}/geo/address?lon=${lon}&lat=${lat}&locale=${lang}&key=${SPHERE_KEY}`);
}
