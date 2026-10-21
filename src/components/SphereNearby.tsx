import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { addressAt, nearbyPlaces, type SphereAddress, type SpherePlace } from "../sphere";

/** On request, ask Sphere what is at and around the clicked point. One click = 2 API calls. */
export default function SphereNearby({ point }: { point: { lon: number; lat: number } }) {
  const { t, lang, num } = useI18n();
  const [state, setState] = useState<{ busy?: boolean; error?: string; addr?: SphereAddress; places?: SpherePlace[] }>({});

  // reset when the user clicks somewhere else
  useEffect(() => setState({}), [point.lon, point.lat]);

  const load = async () => {
    setState({ busy: true });
    try {
      const [addr, places] = await Promise.all([addressAt(point.lon, point.lat, lang), nearbyPlaces(point.lon, point.lat, lang)]);
      setState({ addr, places });
    } catch {
      setState({ error: t("เรียก Sphere ไม่สำเร็จ ตรวจ API key หรือเครดิต", "Sphere request failed. Check the API key or credits.") });
    }
  };

  // distance in metres from degrees (good enough near the equator)
  const metres = (deg: number) => deg * 111_320;

  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b style={{ fontSize: 14 }}>{t("จุดที่คลิก", "Clicked point")}</b>
        <span className="mono small muted">{point.lat.toFixed(5)}, {point.lon.toFixed(5)}</span>
      </div>
      {!state.addr && !state.busy && (
        <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 13 }} onClick={load}>
          {t("ดูที่อยู่และสถานที่ใกล้เคียงจาก Sphere", "Look up address and nearby places in Sphere")}
        </button>
      )}
      {state.busy && <span className="small muted">{t("กำลังถาม Sphere…", "Asking Sphere…")}</span>}
      {state.error && <span className="small" style={{ color: "var(--bad)" }}>{state.error}</span>}
      {state.addr && (
        <span className="small">
          {[state.addr.subdistrict, state.addr.district, state.addr.province].filter(Boolean).join(", ")}
          {state.addr.postcode ? ` ${state.addr.postcode}` : ""}
        </span>
      )}
      {state.places && (
        <div style={{ display: "grid", gap: 4 }}>
          {state.places.map((p) => (
            <div key={p.id} className="row small" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <span style={{ minWidth: 0 }}>{p.name}{p.tag?.[0] ? <span className="muted"> ({p.tag[lang === "th" ? 0 : 1] ?? p.tag[0]})</span> : null}</span>
              {p.distance != null && <span className="mono muted" style={{ flex: "none" }}>{num(metres(p.distance))} {t("ม.", "m")}</span>}
            </div>
          ))}
          <span className="small muted">{t("ข้อมูลจาก GISTDA Sphere", "Data: GISTDA Sphere")}</span>
        </div>
      )}
    </div>
  );
}
