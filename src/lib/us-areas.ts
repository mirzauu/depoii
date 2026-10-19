import raw from "@/lib/us-counties.json";

export type UsCountyHit = {
  state: string;
  stateName: string;
  county: string;
  label: string;
};

type StateBucket = { name: string; counties: string[] };

const BY_STATE = raw as Record<string, StateBucket>;

/** Live Depoii coverage — only these can be selected. */
export const SERVED_AREAS = [
  { city: "Dallas", state: "TX", label: "Dallas, TX" },
  { city: "Fort Worth", state: "TX", label: "Fort Worth, TX" },
] as const;

export function searchUsCounties(query: string, limit = 120): UsCountyHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const hits: UsCountyHit[] = [];
  for (const [state, bucket] of Object.entries(BY_STATE)) {
    for (const county of bucket.counties) {
      const label = `${county} County, ${state}`;
      const hay = `${county} ${bucket.name} ${state} county`.toLowerCase();
      if (!hay.includes(needle)) continue;
      hits.push({ state, stateName: bucket.name, county, label });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

/** When the box is empty, preview a few counties per popular state so the list feels full. */
export function previewUsCounties(perState = 4, max = 60): UsCountyHit[] {
  const prefer = ["TX", "CA", "FL", "NY", "IL", "GA", "OH", "PA", "NC", "MI"];
  const hits: UsCountyHit[] = [];
  for (const state of prefer) {
    const bucket = BY_STATE[state];
    if (!bucket) continue;
    for (const county of bucket.counties.slice(0, perState)) {
      hits.push({ state, stateName: bucket.name, county, label: `${county} County, ${state}` });
      if (hits.length >= max) return hits;
    }
  }
  return hits;
}

export function allStateNames(): { code: string; name: string }[] {
  return Object.entries(BY_STATE)
    .map(([code, b]) => ({ code, name: b.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
