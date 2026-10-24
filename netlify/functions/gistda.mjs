/**
 * Netlify Function: /gistda/* -> GISTDA API Gateway พร้อมเติม key
 * ตั้ง Environment variable GISTDA_API_KEY ใน Netlify (Site configuration > Environment variables)
 * ถ้าไม่ตั้ง ฟังก์ชันตอบ 503 และหน้าเว็บจะขึ้นข้อความว่าโหลดภาพ GISTDA ไม่ได้
 * กติกาว่าอะไรผ่านได้อยู่ใน ../gistda-proxy.mjs (ใช้ร่วมกับ npm run dev)
 */
import { proxyGistda } from "../gistda-proxy.mjs";

export default async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  const url = new URL(req.url);
  return proxyGistda({
    path: url.pathname.replace(/^\/gistda/, ""),
    search: url.search,
    key: process.env.GISTDA_API_KEY,
  });
};

export const config = { path: "/gistda/*" };
