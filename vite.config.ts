import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// /gistda/* during `npm run dev` / `npm run preview`: adds the GISTDA key on this computer (see the file for details)
import { gistdaProxy } from "./netlify/gistda-dev-server.mjs";

export default defineConfig(({ mode }) => {
  // "" = read every variable in .env, also those without VITE_; they stay here on the server side and never reach the browser
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), gistdaProxy(env.GISTDA_API_KEY, env.GISTDA_API_BASE)],
    base: "./",
    worker: { format: "es" },
  };
});
