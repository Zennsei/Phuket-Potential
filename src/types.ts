import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

/** One row per tambon, produced by data-prep/data_prep.py */
export interface TambonProps {
  id: string;
  tambon_th: string;
  tambon_en: string;
  amphoe_th: string;
  amphoe_en: string;
  area_km2: number;
  buildings: number;
  bldg_per_km2: number;
  roof_cover_pct: number;
  large_bldg: number;
  road_dist_m: number;
  road_main_km: number;
  services: number;
  services_per_km2: number;
  svc_education: number;
  svc_health: number;
  svc_retail: number;
  svc_finance: number;
  lodging: number;
  food: number;
  population: number;
  pop_per_km2: number;
  population_2022: number;
  land_parcels: number;
  land_median: number | null;
  land_mean: number | null;
  /** LDD land use 2563 (2020), % of land area (water excluded) */
  lu_urban_pct: number;
  lu_agri_pct: number;
  lu_forest_pct: number;
  lu_misc_pct: number;
  lu_water_km2: number;
  /** agriculture + miscellaneous land, % of land area */
  developable_pct: number;
}

export type TambonCollection = FeatureCollection<Polygon | MultiPolygon, TambonProps>;

export type FactorKey = "buildings" | "road" | "services" | "population" | "land" | "developable";

/** +1 = higher value is better, -1 = lower value is better, 0 = factor switched off */
export type Direction = 1 | -1 | 0;

export interface FactorSetting {
  weight: number; // 0..100 (relative)
  direction: Direction;
}

export type Weights = Record<FactorKey, FactorSetting>;

export interface Scored {
  props: TambonProps;
  /** normalised 0..100 per factor, after applying direction */
  parts: Record<FactorKey, number>;
  score: number;
  rank: number;
}
