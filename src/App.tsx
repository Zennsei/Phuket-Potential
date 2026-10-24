import { lazy, Suspense, useMemo, useState } from "react";
import { useAppData } from "./data";
import { useI18n } from "./i18n";
import { href, useRoute, type Route } from "./router";
import { scoreTambons } from "./scoring";
import { DEFAULT_WEIGHTS } from "./factors";
import type { Weights } from "./types";
import Home from "./pages/Home";
import Ranking from "./pages/Ranking";
import Compare from "./pages/Compare";
import Mission from "./pages/Mission";
import Method from "./pages/Method";
import Vision from "./pages/Vision";

// the map page pulls in MapLibre (~1 MB), so load it only when needed
const MapPage = lazy(() => import("./pages/MapPage"));

export default function App() {
  const { t, lang, setLang } = useI18n();
  const { route, param } = useRoute();
  const { data, error } = useAppData();
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  const rows = useMemo(() => data?.tambons.features.map((f) => f.properties) ?? [], [data]);
  const scored = useMemo(() => scoreTambons(rows, weights), [rows, weights]);

  const nav: { r: Route; th: string; en: string }[] = [
    { r: "home", th: "หน้าแรก", en: "Home" },
    { r: "map", th: "แผนที่วิเคราะห์", en: "Map" },
    { r: "ranking", th: "จัดอันดับ", en: "Ranking" },
    { r: "compare", th: "เทียบข้อมูล", en: "Compare" },
    { r: "mission", th: "ภารกิจ", en: "Mission" },
    { r: "vision", th: "วิสัยทัศน์", en: "Vision" },
    { r: "method", th: "วิธีคิดและแหล่งข้อมูล", en: "Method & data" },
  ];

  let body: React.ReactNode;
  if (error)
    body = (
      <div className="page">
        <p>{t("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง", "Could not load the data. Refresh the page to try again.")}</p>
        <p className="mono small muted">{error}</p>
      </div>
    );
  else if (!data) body = <div className="page muted">{t("กำลังโหลดข้อมูล…", "Loading data…")}</div>;
  else {
    const common = { data, scored, weights, setWeights };
    body =
      route === "map" ? (
        <Suspense fallback={<div className="page muted">{t("กำลังโหลดแผนที่…", "Loading map…")}</div>}>
          <MapPage {...common} selectedId={param} />
        </Suspense>
      ) :
      route === "ranking" ? <Ranking {...common} /> :
      route === "compare" ? <Compare {...common} param={param} /> :
      route === "mission" ? <Mission {...common} /> :
      route === "method" ? <Method data={data} /> :
      route === "vision" ? <Vision /> :
      <Home scored={scored} data={data} />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href={href("home")}>
          <svg className="brand-mark" viewBox="0 0 26 26" aria-hidden="true">
            <rect x="3" y="3" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9 0v3M17 0v3M9 23v3M17 23v3M0 9h3M0 17h3M23 9h3M23 17h3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M11 7c2 1 1 3 3 4s1 3 0 5-1 3-2 3-2-2-2-4 0-3 0-5 0-3 1-3z" fill="var(--overprint)" />
          </svg>
          <span>
          <b>{t("ศักยภาพพื้นที่ภูเก็ต", "Phuket Potential Map")}</b>
          <span>{t("แผนที่ศักยภาพรายตำบล จากข้อมูล GISTDA", "Sub-district potential from GISTDA data")}</span>
          </span>
        </a>
        <nav className="nav" aria-label={t("เมนูหลัก", "Main menu")}>
          {nav.map((n) => (
            <a key={n.r} href={href(n.r)} aria-current={route === n.r ? "page" : undefined}>
              {t(n.th, n.en)}
            </a>
          ))}
        </nav>
        <div className="seg" role="group" aria-label="Language">
          <button aria-pressed={lang === "th"} onClick={() => setLang("th")}>ไทย</button>
          <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
        </div>
      </header>
      <main className="main">{body}</main>
    </div>
  );
}
