import { useEffect, useState } from "react";
import type { TambonCollection } from "./types";
import type { AdminCollection } from "./levels";

export interface Sources {
  generated: string;
  notes: Record<string, string>;
}

export interface AppData {
  tambons: TambonCollection;
  /** district and province outlines (data-prep/admin_levels.py) */
  amphoe: AdminCollection;
  province: AdminCollection;
  sources: Sources;
}

let cache: Promise<AppData> | null = null;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadData(): Promise<AppData> {
  cache ??= Promise.all([
    getJson<TambonCollection>("data/tambons.geojson"),
    getJson<Sources>("data/sources.json"),
    getJson<AdminCollection>("data/amphoe.geojson"),
    getJson<AdminCollection>("data/province.geojson"),
  ]).then(([tambons, sources, amphoe, province]) => ({ tambons, sources, amphoe, province }));
  return cache;
}

export function useAppData() {
  const [state, setState] = useState<{ data?: AppData; error?: string }>({});
  useEffect(() => {
    loadData().then(
      (data) => setState({ data }),
      (e: unknown) => setState({ error: String(e) }),
    );
  }, []);
  return state;
}
