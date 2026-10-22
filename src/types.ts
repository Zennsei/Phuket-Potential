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
  /** DOPA civil registry (house register), December of each year */
  reg_pop_2565: number;
  reg_pop_2568: number;
  reg_house_2568: number;
  /** registered people per km², 2568 */
  reg_pop_per_km2: number;
  /** % change 2559 -> 2568 */
  reg_pop_growth_pct: number;
  house_growth_pct: number;
  /** Kontur 2566 estimate ÷ registered 2565: people living there per registered person */
  unreg_ratio: number;
  /** road travel time, median minutes over the sub-district's buildings (OSM network) */
  tt_airport_min: number;
  tt_oldtown_min: number;
  tt_hospital_min: number;
  tt_school_min: number;
  tt_pier_min: number;
}

export type TambonCollection = FeatureCollection<Polygon | MultiPolygon, TambonProps>;

export type FactorKey = "buildings" | "road" | "services" | "population" | "land" | "developable" | "growth" | "travel";

export type TravelDest = "airport" | "oldtown" | "hospital" | "school" | "pier";

/** +1 = higher value is better, -1 = lower value is better, 0 = factor switched off */
export type Direction = 1 | -1 | 0;

export interface FactorSetting {
  weight: number; // 0..100 (relative)
  direction: Direction;
  /** travel factor only: which destination */
  dest?: TravelDest;
}

export type Weights = Record<FactorKey, FactorSetting>;

export interface Scored {
  props: TambonProps;
  /** normalised 0..100 per factor, after applying direction */
  parts: Record<FactorKey, number>;
  score: number;
  rank: number;
}
