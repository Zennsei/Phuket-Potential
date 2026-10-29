import { developableOf } from "./factors";
import { CATEGORIES, DEFAULT_THRESHOLDS, categoryOf, type Category } from "./decision";
import { regHouse, regPop } from "./years";
import type { FactorKey, Scored, TambonProps, Weights } from "./types";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

/**
 * Province / district / sub-district views.
 * Scores are always worked out for the 17 sub-districts (tambons). A district (amphoe) or the province gets:
 *  - its own figures, added up from its tambons the same way as for one tambon (total ÷ total area), e.g.
 *    buildings per km² = all buildings ÷ all area, not the average of the tambons' densities;
 *  - a score = the tambons' scores averaged by area (a big tambon counts more than a small one), so it reads
 *    "the score of a typical piece of land in this district";
 *  - a rank 1–3 among the districts by that score, and a count of its tambons in each decision group.
 */
export type Level = "province" | "amphoe" | "tambon";
export const LEVELS: { id: Level; th: string; en: string }[] = [
  { id: "province", th: "จังหวัด", en: "Province" },
  { id: "amphoe", th: "อำเภอ", en: "District" },
  { id: "tambon", th: "ตำบล", en: "Sub-district" },
];

export interface AdminProps {
  id: string;
  amphoe_th?: string;
  amphoe_en?: string;
  province_th?: string;
  province_en?: string;
  tambons: string[];
}
export type AdminCollection = FeatureCollection<Polygon | MultiPolygon, AdminProps>;

export interface UnitSummary {
  id: string;
  th: string;
  en: string;
  members: Scored[];
  area_km2: number;
  buildings: number;
  road_km: number;
  services: number;
  population: number;
  reg_pop_2568: number;
  house_2559: number;
  house_2568: number;
  /** factor values in the same units as for one tambon */
  values: Record<FactorKey, number>;
  /** area-weighted mean of the tambon scores */
  score: number;
  /** rank among units of the same level (1 = highest score) */
  rank: number;
  groups: Record<Category, number>;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** land area used to weight developable % (the % is of land, so water is left out) */
const landKm2 = (p: TambonProps) => Math.max(0, p.area_km2 - (p.lu_water_km2 ?? 0));

export function summarise(id: string, th: string, en: string, members: Scored[], weights: Weights): UnitSummary {
  const P = members.map((s) => s.props);
  const area = sum(P.map((p) => p.area_km2));
  const land = sum(P.map(landKm2));
  const buildings = sum(P.map((p) => p.buildings));
  const road_km = sum(P.map((p) => p.road_km));
  const services = sum(P.map((p) => p.services));
  const population = sum(P.map((p) => p.population));
  const house_2559 = sum(P.map((p) => regHouse(p, 2559)));
  const house_2568 = sum(P.map((p) => regHouse(p, 2568)));
  const floorPct = sum(P.map((p) => p.floor_to_land_pct * p.area_km2)) / area;
  const groups = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, 0])) as Record<Category, number>;
  members.forEach((s) => groups[categoryOf(s.score, s.props, DEFAULT_THRESHOLDS, weights.developable)]++);
  return {
    id, th, en, members, area_km2: area, buildings, road_km, services, population, house_2559, house_2568,
    reg_pop_2568: sum(P.map((p) => regPop(p, 2568))),
    values: {
      buildings: weights.buildings.measure === "floor" ? floorPct : buildings / area,
      road: road_km / area,
      services: services / area,
      population: population / area,
      developable: sum(P.map((p) => developableOf(p, weights.developable) * landKm2(p))) / land,
      growth: (house_2568 / house_2559 - 1) * 100,
    },
    score: sum(members.map((s) => s.score * s.props.area_km2)) / area,
    rank: 1,
    groups,
  };
}

/** the three districts, best first */
export function amphoeSummaries(scored: Scored[], weights: Weights): UnitSummary[] {
  const by = new Map<string, Scored[]>();
  scored.forEach((s) => by.set(s.props.amphoe_th, [...(by.get(s.props.amphoe_th) ?? []), s]));
  const out = [...by.entries()].map(([th, m]) => summarise(amphoeId(m[0].props.amphoe_en), th, m[0].props.amphoe_en, m, weights));
  out.sort((a, b) => b.score - a.score);
  out.forEach((u, i) => (u.rank = i + 1));
  return out;
}


/** map feature id of a district, e.g. "amphoe:kathu" (kept apart from tambon ids) */
export const amphoeId = (en: string) => `amphoe:${en.toLowerCase().replace(/\s+/g, "-")}`;
export const PROVINCE_ID = "province:phuket";
export const provinceSummary = (scored: Scored[], weights: Weights) => summarise(PROVINCE_ID, "ภูเก็ต", "Phuket", scored, weights);

/** outlines for the map at a level, with the name fields the map's labels read */
export function unitFeatures(level: Level, tambons: FeatureCollection<Polygon | MultiPolygon, TambonProps>, amphoe?: AdminCollection, province?: AdminCollection) {
  if (level === "tambon" || !amphoe || !province) return tambons;
  const src = level === "amphoe" ? amphoe : province;
  const features = src.features.map((f): Feature<Polygon | MultiPolygon, TambonProps> => {
    const p = f.properties;
    const isA = level === "amphoe";
    return {
      ...f,
      properties: {
        id: isA ? amphoeId(p.amphoe_en!) : PROVINCE_ID,
        tambon_th: isA ? `อ.${p.amphoe_th}` : `จ.${p.province_th}`,
        tambon_en: isA ? `${p.amphoe_en} District` : `${p.province_en} Province`,
      } as unknown as TambonProps,
    };
  });
  return { type: "FeatureCollection" as const, features };
}
