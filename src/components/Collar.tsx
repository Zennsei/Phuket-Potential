import type { MapViewport } from "./MapView";

/** Degrees → 98°20′ style label (minutes with one decimal when the step is finer than a minute). */
export function dm(value: number, fine: boolean): string {
  const deg = Math.floor(value + 1e-9);
  const min = (value - deg) * 60;
  const m = fine ? min.toFixed(1) : String(Math.round(min)).padStart(2, "0");
  return `${deg}°${m}′`;
}

const STEPS = [1, 0.5, 0.25, 1 / 6, 0.1, 1 / 12, 0.05, 1 / 30, 1 / 60, 0.01, 0.005, 1 / 600];

function ticks(min: number, max: number, target = 5) {
  const span = max - min;
  const step = STEPS.find((s) => span / s >= target - 1) ?? STEPS[STEPS.length - 1];
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Number(v.toFixed(6)));
  return { out, fine: step < 1 / 60 };
}

/**
 * The printed-map frame around the live map: longitude ticks on the top and bottom edges,
 * latitude ticks on the sides, positioned with the map's own projection so they stay true while panning.
 */
export default function Collar({ view, note }: { view?: MapViewport; note: string }) {
  if (!view) return null;
  const lon = ticks(view.west, view.east, view.width > 600 ? 6 : 4);
  const lat = ticks(view.south, view.north, view.height > 500 ? 6 : 4);
  const midLat = (view.south + view.north) / 2;
  const midLon = (view.west + view.east) / 2;
  return (
    <div className="collar" aria-hidden="true">
      {lon.out.map((v) => {
        const x = view.project(v, midLat).x;
        if (x < 18 || x > view.width - 18) return null;
        const clearOfNote = x < view.width - 260; // the sheet note sits in the bottom-right margin
        return [
          <span key={`t${v}`} className="tk top" style={{ left: view.ox + x }}>{dm(v, lon.fine)}E</span>,
          clearOfNote && <span key={`b${v}`} className="tk bottom" style={{ left: view.ox + x }}>{dm(v, lon.fine)}E</span>,
        ];
      })}
      {lat.out.map((v) => {
        const y = view.project(midLon, v).y;
        if (y < 18 || y > view.height - 18) return null;
        return [
          <span key={`l${v}`} className="tk left" style={{ top: view.oy + y }}>{dm(v, lat.fine)}N</span>,
          <span key={`r${v}`} className="tk right" style={{ top: view.oy + y }}>{dm(v, lat.fine)}N</span>,
        ];
      })}
      <span className="sheet-note">{note}</span>
    </div>
  );
}
