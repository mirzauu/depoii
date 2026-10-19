import type { FieldOutcome, ScoreWeights } from "@/lib/types";

export const isPositive = (o: FieldOutcome) => o.moistureVerified || o.scope !== "none";

export interface Calibration {
  sample: number;
  hitRate: number;
  bands: { band: string; inspections: number; hitRate: number }[];
  suggested: ScoreWeights;
  lift: Record<keyof ScoreWeights, number>;
}

const FACTORS: (keyof ScoreWeights)[] = ["severity", "age", "footprint", "permitAbsence"];

/**
 * Closed-loop preview: nudge each weight by how much better that factor separated
 * verified-damage outcomes from no-damage outcomes. Deliberately conservative.
 */
export function calibrate(outcomes: FieldOutcome[], weights: ScoreWeights, learningRate = 0.5): Calibration {
  const pos = outcomes.filter(isPositive);
  const neg = outcomes.filter((o) => !isPositive(o));
  const mean = (xs: FieldOutcome[], f: keyof ScoreWeights) => (xs.length ? xs.reduce((s, o) => s + o.factors[f], 0) / xs.length : 0);

  const lift = Object.fromEntries(
    FACTORS.map((f) => [f, pos.length && neg.length ? (mean(pos, f) - mean(neg, f)) / 100 : 0]),
  ) as Record<keyof ScoreWeights, number>;
  const raw = FACTORS.map((f) => Math.max(0.02, weights[f] * (1 + learningRate * lift[f])));
  const total = raw.reduce((a, b) => a + b, 0);
  const suggested = Object.fromEntries(FACTORS.map((f, i) => [f, +(raw[i] / total).toFixed(3)])) as unknown as ScoreWeights;

  const bandOf = (s: number) => (s >= 80 ? "80–100" : s >= 60 ? "60–79" : s >= 40 ? "40–59" : "0–39");
  const bands = ["80–100", "60–79", "40–59", "0–39"].map((band) => {
    const xs = outcomes.filter((o) => bandOf(o.predictedScore) === band);
    return { band, inspections: xs.length, hitRate: xs.length ? xs.filter(isPositive).length / xs.length : 0 };
  });

  return { sample: outcomes.length, hitRate: outcomes.length ? pos.length / outcomes.length : 0, bands, suggested, lift };
}
