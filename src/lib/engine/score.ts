import type { Parcel, Permit, PermitFeeds, ScoreWeights, Storm, SwathTier } from "@/lib/types";
import { probableArchetype, roofBaseline, type Archetype } from "./archetype";
import { swathExposure } from "./intersect";
import { tdiWindow, type TdiWindow } from "./tdi";

export const DEFAULT_WEIGHTS: ScoreWeights = { severity: 0.35, age: 0.25, footprint: 0.15, permitAbsence: 0.25 };
export const REPLACEMENT_COST_PER_SQFT = 14;

export const FACTOR_LABELS: Record<keyof ScoreWeights, string> = {
  severity: "Hail report size",
  age: "Estimated roof age",
  footprint: "Building footprint",
  permitAbsence: "Permit absence",
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const factorScores = {
  severity: (hail: number) => clamp((hail / 2.65) * 100),
  age: (years: number) => clamp(((years - 5) / 20) * 100),
  footprint: (sqft: number) => clamp((Math.log10(Math.max(sqft, 1) / 10_000) / Math.log10(40)) * 100),
};

export interface Opportunity {
  parcel: Parcel;
  storm: Storm;
  tier: SwathTier;
  hailInches: number;
  roofAge: number;
  roofBaselineBasis: string;
  archetype: Archetype;
  resolvingPermit: Permit | null;
  /** False when that city's permit site did not return. Absence is then not scored. */
  permitKnown: boolean;
  unresolved: boolean;
  factors: Record<keyof ScoreWeights, number>;
  score: number;
  pipelineValue: number;
  tdi: TdiWindow;
  permits: Permit[];
}

export function vulnerabilityRating(age: number) {
  return age >= 20 ? "High Vulnerability" : age >= 12 ? "Elevated Vulnerability" : "Moderate Vulnerability";
}

const FEEDS_OK: PermitFeeds = { "fort-worth": "ok", dallas: "ok" };

export function scoreParcel(
  parcel: Parcel,
  storm: Storm,
  allPermits: Permit[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  now: Date = new Date(),
  feeds: PermitFeeds = FEEDS_OK,
): Opportunity {
  const parcelPermits = allPermits.filter((p) => p.parcelId === parcel.id || p.parcelIds?.includes(parcel.id));
  const exposure = parcel.tier
    ? { tier: parcel.tier, hailInches: parcel.hailInches ?? 0 }
    : swathExposure(parcel, storm);
  const { tier, hailInches } = exposure;
  const baseline = roofBaseline(parcel, parcelPermits, storm.date);
  const roofAge = now.getUTCFullYear() - baseline.year;
  const resolvingPermit =
    parcelPermits.filter((p) => p.kind !== "new-commercial" && p.issued >= storm.date).sort((a, b) => a.issued.localeCompare(b.issued))[0] ?? null;

  const permitKnown = parcel.market === "dallas"
    ? parcel.permitSource === "attom" || parcel.permitSource === "engine"
    : (feeds[parcel.market] ?? "ok") === "ok";
  const factors = {
    severity: Math.round(factorScores.severity(hailInches)),
    age: Math.round(factorScores.age(roofAge)),
    footprint: Math.round(factorScores.footprint(parcel.sqft)),
    permitAbsence: permitKnown && !resolvingPermit ? 100 : 0,
  };
  const weighted = [
    [weights.severity, factors.severity],
    [weights.age, factors.age],
    [weights.footprint, factors.footprint],
    ...(permitKnown ? [[weights.permitAbsence, factors.permitAbsence]] : []),
  ];
  const totalW = weighted.reduce((s, [w]) => s + w, 0) || 1;
  let score = weighted.reduce((s, [w, v]) => s + w * v, 0) / totalW;
  // A parcel outside the warning polygons is not a storm opportunity, whatever the other factors say.
  if (tier === "outside") score = Math.min(score, 25);

  return {
    parcel,
    storm,
    tier,
    hailInches,
    roofAge,
    roofBaselineBasis: baseline.basis,
    archetype: probableArchetype(parcel, parcelPermits, storm.date),
    resolvingPermit,
    permitKnown,
    unresolved: permitKnown && tier !== "outside" && !resolvingPermit,
    factors,
    score: Math.round(score),
    pipelineValue: parcel.sqft * REPLACEMENT_COST_PER_SQFT,
    tdi: tdiWindow(storm.date, now),
    permits: parcelPermits,
  };
}

export function rankOpportunities(parcels: Parcel[], storm: Storm, permits: Permit[], weights?: ScoreWeights, now?: Date, feeds?: PermitFeeds) {
  return parcels.map((p) => scoreParcel(p, storm, permits, weights, now, feeds)).sort((a, b) => b.score - a.score);
}
