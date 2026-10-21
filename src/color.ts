/** potential score ramp: pale sea-glass to deep Andaman blue */
export const RAMP = ["#e7f0ec", "#b7d6ce", "#6bafb2", "#2c7a98", "#133d66"];

/** class breaks at the 20/40/60/80th percentiles of the values */
export function quantileBreaks(values: number[]): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [0, 0, 0, 0];
  return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
}

export function classOf(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

export const scoreColor = (score: number) => RAMP[Math.min(4, Math.floor(score / 20))];
