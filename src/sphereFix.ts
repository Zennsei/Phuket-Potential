/**
 * Fills the empty close-up tiles of the Sphere street map.
 *
 * In some places (seen around Thep Krasattri, Pa Khlok and Mai Khao on 24 Oct 2026) Sphere answers a close-up
 * tile with an almost empty picture: background colour and maybe a land-cover edge, but none of the roads that
 * the next tile up still shows. The street map's tiles therefore go through this "spherefix://" protocol:
 * a tile from zoom 15 up with almost no detail is compared with the same spot in the tile one and two levels up,
 * and when that one clearly has more detail, the matching quarter of it is enlarged and used instead.
 * Tiles with detail, and all tiles below zoom 15, are passed on untouched. Ancestor tiles are fetched once and kept.
 */
import * as maplibregl from "maplibre-gl";

export const SPHERE_FIX = "spherefix";
/** sample size (px) used to measure detail */
const S = 128;
/** brightness step (0–255) between neighbouring pixels that counts as an edge (a road side, a label) */
const EDGE = 8;
/** a tile with fewer edges than this share of neighbouring pixel pairs is "almost empty" */
const EMPTY = 0.01;
const MIN_Z = 15;
const LEVELS_UP = 2;

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function canvas(w: number, h: number): { c: OffscreenCanvas | HTMLCanvasElement; ctx: Canvas2D } {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = c.getContext("2d", { willReadFrequently: true }) as Canvas2D;
  return { c, ctx };
}

/** share of neighbouring pixel pairs that differ by more than EDGE, for a region of an image drawn at S × S */
function detail(img: ImageBitmap, sx: number, sy: number, sw: number, sh: number): number {
  const { ctx } = canvas(S, S);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const lum = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let edges = 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = lum[y * S + x];
      if (x + 1 < S && Math.abs(v - lum[y * S + x + 1]) > EDGE) edges++;
      if (y + 1 < S && Math.abs(v - lum[(y + 1) * S + x]) > EDGE) edges++;
    }
  return edges / (2 * S * (S - 1));
}

const kept = new Map<string, Promise<ImageBitmap | null>>();
function ancestor(url: string): Promise<ImageBitmap | null> {
  let p = kept.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? createImageBitmap(b) : null)).catch(() => null);
    kept.set(url, p);
    if (kept.size > 96) kept.delete(kept.keys().next().value!);
  }
  return p;
}

async function toPng(c: OffscreenCanvas | HTMLCanvasElement): Promise<ArrayBuffer> {
  const blob = "convertToBlob" in c ? await c.convertToBlob({ type: "image/png" }) : await new Promise<Blob>((ok) => (c as HTMLCanvasElement).toBlob((b) => ok(b!), "image/png"));
  return blob.arrayBuffer();
}

let registered = false;
export function registerSphereFix() {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol(SPHERE_FIX, async (params, abort) => {
    const url = params.url.replace(`${SPHERE_FIX}://`, "https://");
    const res = await fetch(url, { signal: abort.signal });
    if (!res.ok) throw new Error(`Sphere tile HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const m = /\/(\d+)\/(\d+)\/(\d+)\.png/.exec(url);
    if (!m || Number(m[1]) < MIN_Z) return { data: buf };
    const [z, x, y] = m.slice(1).map(Number);
    try {
      const img = await createImageBitmap(new Blob([buf]));
      const own = detail(img, 0, 0, img.width, img.height);
      if (own >= EMPTY) return { data: buf };
      for (let k = 1; k <= LEVELS_UP; k++) {
        const f = 2 ** k, ax = x >> k, ay = y >> k;
        const anc = await ancestor(url.replace(`/${z}/${x}/${y}.png`, `/${z - k}/${ax}/${ay}.png`));
        if (!anc) continue;
        const sw = anc.width / f, sh = anc.height / f, sx = (x - ax * f) * sw, sy = (y - ay * f) * sh;
        const d = detail(anc, sx, sy, sw, sh);
        if (d >= EMPTY && d > own * 2) {
          const { c, ctx } = canvas(img.width, img.height);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(anc, sx, sy, sw, sh, 0, 0, img.width, img.height);
          return { data: await toPng(c) };
        }
      }
    } catch {
      /* any problem: show the tile as it came */
    }
    return { data: buf };
  });
}
