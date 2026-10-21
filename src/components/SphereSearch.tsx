import { useState } from "react";
import { useI18n } from "../i18n";
import { searchPlaces, type SpherePlace } from "../sphere";

interface Props {
  center: { lon: number; lat: number };
  onResults: (r: SpherePlace[]) => void;
  onPick: (p: SpherePlace) => void;
}

/** Keyword search with the GISTDA Sphere Search API, limited to ~40 km around Phuket. */
export default function SphereSearch({ center, onResults, onPick }: Props) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string; results?: SpherePlace[] }>({});

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setState({ busy: true });
    try {
      const r = await searchPlaces(q.trim(), center.lon, center.lat, lang);
      setState({ results: r });
      onResults(r);
    } catch {
      setState({ error: t("ค้นหาไม่สำเร็จ ตรวจ API key หรือเครดิตของ Sphere", "Search failed. Check the Sphere API key or credits.") });
    }
  };

  return (
    <div>
      <form className="searchrow" onSubmit={run}>
        <input
          id="sphere-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("เช่น โรงพยาบาล, ตลาด, โรงเรียน", "e.g. hospital, market, school")}
          aria-label={t("คำค้นหา", "Search keyword")}
        />
        <button className="btn" style={{ padding: "6px 12px" }} disabled={state.busy}>
          {state.busy ? "…" : t("ค้นหา", "Search")}
        </button>
      </form>
      {state.error && <p className="small" style={{ color: "var(--bad)", marginTop: 6 }}>{state.error}</p>}
      {state.results && (
        <div className="results">
          {state.results.length === 0 && <span className="small muted">{t("ไม่พบสถานที่", "No places found")}</span>}
          {state.results.map((r) => (
            <button key={r.id} onClick={() => onPick(r)}>
              <span style={{ fontSize: 14 }}>{r.name}</span>
              {r.address && <div className="small muted">{r.address}</div>}
            </button>
          ))}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 6 }}>
        {t("ค้นหาสดจาก GISTDA Sphere ในรัศมี 40 กม. จากกลางแผนที่", "Live search from GISTDA Sphere within 40 km of the map centre")}
      </p>
    </div>
  );
}
