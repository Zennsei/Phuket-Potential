import { scoreTambons } from "./scoring";
import { SCENARIOS, applyScenarioRows } from "./scenarios";
import { developableOf } from "./factors";
import type { FactorSetting, Scored, TambonProps, Weights } from "./types";

/**
 * Logic matrix (the decision rule after scoring):
 *   potential score  ≥ scoreCut   and  developable land ≥ landCut  -> promote
 *   potential score  ≥ scoreCut   and  developable land <  landCut  -> upgrade
 *   potential score  <  scoreCut  and  developable land ≥ landCut  -> prepare
 *   potential score  <  scoreCut  and  developable land <  landCut  -> maintain
 * Confidence: the category is re-computed under every stress test; "high" when it never changes.
 */
export type Category = "promote" | "upgrade" | "prepare" | "maintain";

export interface Thresholds {
  score: number;
  land: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { score: 50, land: 20 };

/** people living there per registered person (Kontur ÷ registry) at or above this is flagged */
export const UNREG_FLAG = 3;

export interface CategoryDef {
  id: Category;
  th: string;
  en: string;
  actionTh: string;
  actionEn: string;
  color: string;
}

export const CATEGORIES: Record<Category, CategoryDef> = {
  promote: {
    id: "promote", th: "ส่งเสริมเป็นศูนย์กลางใหม่", en: "Promote as a new centre",
    actionTh: "ศักยภาพสูงและยังมีที่ดินให้ขยาย: วางผังรองรับ ส่งเสริมการลงทุน และกันพื้นที่สำหรับบริการสาธารณะ",
    actionEn: "High potential with land to grow into: plan for growth, promote investment and reserve land for public services",
    color: "var(--cat-promote)",
  },
  upgrade: {
    id: "upgrade", th: "ยกระดับพื้นที่เดิม", en: "Upgrade what is there",
    actionTh: "ศักยภาพสูงแต่ที่ดินเกือบเต็ม: เน้นขนส่งสาธารณะ ลดความแออัด ฟื้นฟูเมือง แทนการขยายพื้นที่",
    actionEn: "High potential but little land left: focus on transit, congestion and renewal rather than expansion",
    color: "var(--cat-upgrade)",
  },
  prepare: {
    id: "prepare", th: "เตรียมโครงสร้างพื้นฐานก่อน", en: "Build infrastructure first",
    actionTh: "มีที่ดินแต่การเข้าถึงและบริการยังไม่พอ: ลงทุนถนนและบริการพื้นฐานก่อนส่งเสริมการลงทุน",
    actionEn: "Land is available but access and services are not yet enough: invest in roads and basic services before promoting investment",
    color: "var(--cat-prepare)",
  },
  maintain: {
    id: "maintain", th: "คงสภาพ / ดูแลสิ่งแวดล้อม", en: "Maintain and protect",
    actionTh: "ศักยภาพต่ำและที่ดินพัฒนาได้น้อย: ดูแลชุมชนเดิมและพื้นที่ป่า ไม่เร่งพัฒนา",
    actionEn: "Lower potential and little developable land: look after existing communities and forest, no push to develop",
    color: "var(--cat-maintain)",
  },
};

export const CATEGORY_ORDER: Category[] = ["promote", "upgrade", "prepare", "maintain"];

export function categoryOf(score: number, p: TambonProps, th: Thresholds, s?: FactorSetting): Category {
  const high = score >= th.score;
  const land = developableOf(p, s) >= th.land;
  return high ? (land ? "promote" : "upgrade") : land ? "prepare" : "maintain";
}

export interface Decision {
  s: Scored;
  category: Category;
  /** stress tests (ids) under which the category changes */
  changesUnder: string[];
  unregFlag: boolean;
}

export function decide(rows: TambonProps[], weights: Weights, th: Thresholds): Decision[] {
  const base = scoreTambons(rows, weights);
  const alt = SCENARIOS.map((sc) => ({
    id: sc.id,
    cat: new Map(scoreTambons(applyScenarioRows(rows, sc), sc.apply(weights)).map((s) => [s.props.id, categoryOf(s.score, s.props, th, sc.apply(weights).developable)])),
  }));
  return base.map((s) => {
    const category = categoryOf(s.score, s.props, th, weights.developable);
    return {
      s,
      category,
      changesUnder: alt.filter((a) => a.cat.get(s.props.id) !== category).map((a) => a.id),
      unregFlag: s.props.unreg_ratio >= UNREG_FLAG,
    };
  });
}
