import type { AppData } from "./data";
import type { Scored, Weights } from "./types";

export interface PageProps {
  data: AppData;
  scored: Scored[];
  weights: Weights;
  setWeights: (w: Weights) => void;
}
