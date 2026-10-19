import { booleanPointInPolygon, distance, point } from "@turf/turf";
import type { Parcel, Storm, SwathTier } from "@/lib/types";

export interface SwathExposure {
  tier: SwathTier;
  hailInches: number;
}

/** Miles from a parcel to the nearest hail report on the storm (DFW metro scale). */
export const REPORT_PROXIMITY_MILES = 40;

function inside(lng: number, lat: number, geometry: Storm["warnings"][number]["geometry"]) {
  try {
    return booleanPointInPolygon(point([lng, lat]), geometry);
  } catch {
    return false;
  }
}

/** Parcel against the official NWS warning polygons on the storm. */
export function swathExposure(parcel: Pick<Parcel, "lng" | "lat">, storm: Pick<Storm, "warnings" | "maxHail">): SwathExposure {
  if (storm.warnings.some((w) => w.tier === "core" && inside(parcel.lng, parcel.lat, w.geometry))) {
    return { tier: "core", hailInches: storm.maxHail };
  }
  if (storm.warnings.some((w) => inside(parcel.lng, parcel.lat, w.geometry))) {
    return { tier: "envelope", hailInches: storm.maxHail };
  }
  return { tier: "outside", hailInches: 0 };
}

/** When a hail day has reports but no warning polygons, expose buildings near a report. */
export function reportProximityExposure(
  parcel: Pick<Parcel, "lng" | "lat">,
  storm: Pick<Storm, "reports" | "maxHail">,
  maxMiles = REPORT_PROXIMITY_MILES,
): SwathExposure {
  if (!Number.isFinite(parcel.lat) || !Number.isFinite(parcel.lng) || parcel.lat === 0 || parcel.lng === 0) {
    return { tier: "outside", hailInches: 0 };
  }
  const origin = point([parcel.lng, parcel.lat]);
  let nearestMiles = Infinity;
  let nearestHail = 0;
  for (const report of storm.reports) {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) continue;
    try {
      const miles = distance(origin, point([report.lng, report.lat]), { units: "miles" });
      if (miles < nearestMiles) {
        nearestMiles = miles;
        nearestHail = report.inches || storm.maxHail;
      }
    } catch {
      /* skip bad report geometry */
    }
  }
  if (nearestMiles <= maxMiles) {
    return { tier: nearestHail >= 1.75 ? "core" : "envelope", hailInches: nearestHail || storm.maxHail };
  }
  return { tier: "outside", hailInches: 0 };
}

/**
 * Classify a parcel for a selected hail-day catalog storm.
 * Inside an NWS warning OR within report proximity counts as exposed
 * (statewide catalog days often have polygons far from Dallas).
 */
export function dayExposure(
  parcel: Pick<Parcel, "lng" | "lat">,
  storm: Pick<Storm, "warnings" | "reports" | "maxHail">,
): SwathExposure {
  if (!Number.isFinite(parcel.lat) || !Number.isFinite(parcel.lng) || parcel.lat === 0 || parcel.lng === 0) {
    return { tier: "outside", hailInches: 0 };
  }
  const poly = storm.warnings.length ? swathExposure(parcel, storm) : { tier: "outside" as const, hailInches: 0 };
  const prox = storm.reports.length ? reportProximityExposure(parcel, storm) : { tier: "outside" as const, hailInches: 0 };
  if (poly.tier === "outside" && prox.tier === "outside") {
    return { tier: "outside", hailInches: 0 };
  }
  if (poly.tier === "core" || prox.tier === "core") {
    return { tier: "core", hailInches: Math.max(poly.hailInches, prox.hailInches, storm.maxHail) };
  }
  return { tier: "envelope", hailInches: Math.max(poly.hailInches, prox.hailInches, storm.maxHail) };
}
