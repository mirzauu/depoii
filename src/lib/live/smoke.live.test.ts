import { describe, expect, it } from "vitest";

const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
const key = process.env.DEPOII_ENGINE_KEY || "";

async function get(path: string) {
  const started = Date.now();
  const res = await fetch(`${base}/api/v1/${path}`, {
    headers: { Accept: "application/json", "x-depoii-key": key },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json();
  return { ms: Date.now() - started, status: res.status, body };
}

describe.skipIf(!base)("live engine", () => {
  it("returns Dallas and Fort Worth call lists in under 3 seconds", async () => {
    for (const jurisdiction of ["Dallas, TX", "Fort Worth, TX"]) {
      const brief = await get(`brief?jurisdiction=${encodeURIComponent(jurisdiction)}&limit=20`);
      expect(brief.status).toBe(200);
      expect(brief.ms).toBeLessThan(3000);
      expect(Array.isArray(brief.body.opportunities)).toBe(true);
      expect(brief.body.opportunities.length).toBeGreaterThan(0);
      const scores = new Set(brief.body.opportunities.map((row: { score: number }) => row.score));
      expect(scores.size).toBeGreaterThanOrEqual(1);
      for (const row of brief.body.opportunities) {
        expect(row.city.toLowerCase()).toContain(jurisdiction.split(",")[0].toLowerCase());
        expect(row.storm_id).toBeTruthy();
        expect(row.pipeline_value_usd).toBe(0);
      }
    }
  });

  it("keeps permit city totals inside the warehouse total", async () => {
    const stats = await get("permits/stats");
    expect(stats.status).toBe(200);
    const cities = Object.values(stats.body.by_jurisdiction || {}) as number[];
    const sum = cities.reduce((total, count) => total + count, 0);
    expect(sum).toBe(stats.body.total_permits);
    for (const count of cities) expect(count).toBeLessThanOrEqual(stats.body.total_permits);
  });

  it("ranks roofing contractors and opens one dossier for the same storm", async () => {
    const board = await get("contractors/leaderboard?limit=20");
    expect(board.status).toBe(200);
    const names = (board.body.leaderboard || board.body.items || []) as { canonicalName?: string; canonical_name?: string }[];
    const list = Array.isArray(names) ? names : [];
    expect(list.length).toBeGreaterThan(0);
    const blocked = /homes|homebuilder|general contractor|construction group/i;
    for (const row of list.slice(0, 10)) {
      const name = row.canonicalName || row.canonical_name || "";
      expect(blocked.test(name)).toBe(false);
    }
    const brief = await get("brief?jurisdiction=Dallas,%20TX&limit=1");
    const lead = brief.body.opportunities[0];
    const dossier = await get(`intelligence/leads/${encodeURIComponent(lead.parcel_id)}/dossier?storm_id=${encodeURIComponent(lead.storm_id)}`);
    expect(dossier.status).toBe(200);
    expect(dossier.body.storm_id).toBe(lead.storm_id);
    expect(dossier.body.city).toBe(lead.city);
    expect(dossier.body.max_hail_inches).toBeCloseTo(lead.hail_inches, 1);
  });
});
