import { FACTORS } from "./factors";
import type { FactorKey, Scored, TambonProps, Weights } from "./types";

/**
 * Min-max normalise each factor across the 17 Phuket tambons (0 = lowest, 100 = highest),
 * flip it when a lower raw value is better (road distance) or when the user sets direction = -1,
 * then take the weighted average. Scores are relative to Phuket only.
 */
export function scoreTambons(rows: TambonProps[], weights: Weights): Scored[] {
  const ranges = Object.fromEntries(
    FACTORS.map((f) => {
      const vals = rows.map((r) => f.value(r, weights[f.key])).filter((v): v is number => v != null);
      return [f.key, { min: Math.min(...vals), max: Math.max(...vals) }];
    }),
  ) as Record<FactorKey, { min: number; max: number }>;

  const totalWeight = FACTORS.reduce(
    (s, f) => s + (weights[f.key].direction === 0 ? 0 : weights[f.key].weight),
    0,
  );

  const scored = rows.map((props) => {
    const parts = {} as Record<FactorKey, number>;
    let sum = 0;
    for (const f of FACTORS) {
      const raw = f.value(props, weights[f.key]);
      const { min, max } = ranges[f.key];
      let n = raw == null || max === min ? 50 : ((raw - min) / (max - min)) * 100;
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
