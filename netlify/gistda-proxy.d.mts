// ชนิดข้อมูลของ gistda-proxy.mjs สำหรับ TypeScript (vite.config.ts ใช้ไฟล์นั้น)
export declare const GISTDA_BASE: string;
export declare const AREA: { west: number; south: number; east: number; north: number };
export declare const IMAGERY_LAYERS: string[];
export declare const BUILDING_TILE_Z: number;
export declare function checkGistdaRequest(
  path: string,
  q: URLSearchParams,
): { ok: true; upstreamPath: string; kind: "imagery" | "basemap" | "buildings" } | { ok: false; status: number; reason: string };
export declare function proxyGistda(o: {
  path: string;
  search: string;
  key?: string;
  base?: string;
  fetchImpl?: typeof fetch;
}): Promise<Response>;
