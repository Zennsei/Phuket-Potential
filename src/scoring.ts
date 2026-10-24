import { FACTORS } from "./factors";
import type { FactorKey, Scored, TambonProps, Weights } from "./types";

/**
 * How raw values become 0–100 factor scores.
 * - "minmax" (used everywhere on the site): lowest = 0, highest = 100, the rest in proportion to the distance.
 * - "rank" (compare page only): order the 17 tambons, lowest = 0, highest = 100, equal steps; ties share the average.
 * Missing values, or a factor where every tambon has the same value, get 50 in both.
 */
export type Normalise = "minmax" | "rank";

function minMaxScale(vals: (number | null)[]): number[] {
  const xs = vals.filter((v): v is number => v != null);
  const min = Math.min(...xs), max = Math.max(...xs);
  return vals.map((v) => (v == null || max === min ? 50 : ((v - min) / (max - min)) * 100));
}

function rankScale(vals: (number | null)[]): number[] {
  const xs = vals.filter((v): v is number => v != null);
  const n = xs.length;
  return vals.map((v) => {
    if (v == null || n < 2) return 50;
    const below = xs.filter((x) => x < v).length;
    const same = xs.filter((x) => x === v).length;
    return ((below + (same - 1) / 2) / (n - 1)) * 100;
  });
}

/**
 * Normalise each factor across the 17 Phuket tambons (Min-Max by default: 0 = lowest, 100 = highest),
 * flip it when a lower raw value is better (road distance) or when the user sets direction = -1,
 * then take the weighted average. Scores are relative to Phuket only.
 */
export function scoreTambons(rows: TambonProps[], weights: Weights, normalise: Normalise = "minmax"): Scored[] {
  const scale = normalise === "rank" ? rankScale : minMaxScale;
  const norm = Object.fromEntries(
    FACTORS.map((f) => [f.key, scale(rows.map((r) => f.value(r, weights[f.key])))]),
  ) as Record<FactorKey, number[]>;

  const totalWeight = FACTORS.reduce(
    (s, f) => s + (weights[f.key].direction === 0 ? 0 : weights[f.key].weight),
    0,
  );

  const scored = rows.map((props, i) => {
    const parts = {} as Record<FactorKey, number>;
    let sum = 0;
    for (const f of FACTORS) {
      let n = norm[f.key][i];
      if (!f.higherIsBetter) n = 100 - n;
      const set = weights[f.key];
      if (set.direction === -1) n = 100 - n;
      parts[f.key] = n;
      if (set.direction !== 0) sum += n * set.weight;
    }
    return { props, parts, score: totalWeight ? sum / totalWeight : 0, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}

export function effectiveShare(weights: Weights, key: FactorKey): number {
  const total = FACTORS.reduce(
    (s, f) => s + (weights[f.key].direction === 0 ? 0 : weights[f.key].weight),
    0,
  );
  const set = weights[key];
  return total && set.direction !== 0 ? (set.weight / total) * 100 : 0;
}
