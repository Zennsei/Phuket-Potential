/**
 * /gistda/* while running `npm run dev` or `npm run preview`: the same rules as the Netlify Function
 * (netlify/functions/gistda.mjs), with GISTDA_API_KEY read from .env on this computer only.
 * Pictures are also kept in node_modules/.cache/gistda-tiles, so looking at the same place again costs no credits.
 * The terminal shows how many requests went to GISTDA.
 * (Plain JavaScript so the project does not need @types/node.)
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { proxyGistda } from "./gistda-proxy.mjs";

/** @param {string | undefined} key  @param {string | undefined} base  @returns {import("vite").Plugin} */
export function gistdaProxy(key, base) {
  const dir = join(process.cwd(), "node_modules", ".cache", "gistda-tiles");
  let fromGistda = 0, fromCache = 0;
  /** @type {import("vite").Connect.NextHandleFunction} */
  const handler = async (req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    const file = join(dir, createHash("sha1").update(url.pathname + url.search).digest("hex"));
    try {
      const [body, type] = await Promise.all([readFile(file), readFile(file + ".type", "utf8")]);
      fromCache++;
      res.writeHead(200, { "content-type": type, "cache-control": "public, max-age=604800" });
      res.end(body);
      return;
    } catch {
      /* not cached yet */
    }
    const r = await proxyGistda({ path: url.pathname, search: url.search, key, base });
    const body = Buffer.from(await r.arrayBuffer());
    if (r.status === 200) {
      fromGistda++;
      await mkdir(dir, { recursive: true });
      await Promise.all([writeFile(file, body), writeFile(file + ".type", r.headers.get("content-type") ?? "image/jpeg")]);
    }
    if (r.status !== 200 || (fromGistda + fromCache) % 50 === 0)
      console.log(`[gistda] ${r.status} ${url.pathname} · requests to GISTDA so far: ${fromGistda} · from cache: ${fromCache}`);
    /** @type {Record<string, string>} */
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(r.status, headers);
    res.end(body);
  };
  return {
    name: "gistda-proxy",
    configureServer(server) { server.middlewares.use("/gistda", handler); },
    configurePreviewServer(server) { server.middlewares.use("/gistda", handler); },
  };
}
