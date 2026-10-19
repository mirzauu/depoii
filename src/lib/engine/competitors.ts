import type { Contractor, Permit } from "@/lib/types";

export interface CompetitorStats {
  contractor: Contractor;
  permits: number;
  filingValue: number;
  shareByVolume: number;
  shareByValue: number;
  postStormShare: number;
  stormChaser: boolean;
  monthly: { month: string; permits: number }[];
}

const DAY = 86_400_000;

export function monthKeys(from: string, to: string) {
  const keys: string[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  while (d.toISOString().slice(0, 7) <= to.slice(0, 7)) {
    keys.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return keys;
}

/** Share of a contractor's filings that land within 90 days after a named hail event. */
function postStormFraction(ps: Permit[], storms: { date: string }[]) {
  if (!ps.length) return 0;
  const hits = ps.filter((p) =>
    storms.some((s) => {
      const delta = (new Date(p.issued).getTime() - new Date(s.date).getTime()) / DAY;
      return delta >= 0 && delta <= 90;
    }),
  ).length;
  return hits / ps.length;
}

export function competitorStats(
  permits: Permit[],
  contractors: Contractor[],
  storms: { date: string }[],
  range: { from: string; to: string },
): CompetitorStats[] {
  const roofing = permits.filter((p) => p.kind !== "new-commercial" && p.contractorId && p.issued >= range.from && p.issued <= range.to);
  const totalCount = roofing.length || 1;
  const totalValue = roofing.reduce((s, p) => s + p.valuation, 0) || 1;
  const months = monthKeys(range.from, range.to);

  return contractors
    .map((c) => {
      const ps = roofing.filter((p) => p.contractorId === c.id);
      const value = ps.reduce((s, p) => s + p.valuation, 0);
      const postStormShare = postStormFraction(ps, storms);
      return {
        contractor: c,
        permits: ps.length,
        filingValue: value,
        shareByVolume: ps.length / totalCount,
        shareByValue: value / totalValue,
        postStormShare,
        stormChaser: c.homeState !== "TX" && c.homeState !== "UNKNOWN" && ps.length > 0 && postStormShare >= 0.5,
        monthly: months.map((m) => ({ month: m, permits: ps.filter((p) => p.issued.startsWith(m)).length })),
      };
    })
    .sort((a, b) => b.permits - a.permits);
}
