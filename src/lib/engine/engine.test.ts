import { describe, expect, it } from "vitest";
import type { Contractor, Parcel, Permit, Storm } from "@/lib/types";
import { probableArchetype } from "./archetype";
import { competitorStats } from "./competitors";
import { swathExposure } from "./intersect";
import { calibrate } from "./outcomes";
import { DEFAULT_WEIGHTS, scoreParcel } from "./score";
import { tdiWindow } from "./tdi";

const box = (w: number, s: number, e: number, n: number) => ({
  type: "Polygon" as const,
  coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
});

const storm: Storm = {
  id: "2024-05-28",
  name: "Test storm",
  shortName: "Test",
  date: "2024-05-28",
  region: "Test",
  maxHail: 2.5,
  reportCount: 2,
  maxHailTag: 2.5,
  center: [-97.3, 32.75],
  source: "fixture",
  reports: [],
  warnings: [
    { eventId: 1, hailTag: 1.5, windTag: 60, issue: "", expire: "", href: "", tier: "envelope", basis: "tag", geometry: box(-97.5, 32.6, -97.1, 32.9) },
    { eventId: 2, hailTag: 2.5, windTag: 60, issue: "", expire: "", href: "", tier: "core", basis: "tag", geometry: box(-97.35, 32.7, -97.25, 32.8) },
  ],
};

const parcel: Parcel = {
  id: "1",
  market: "fort-worth",
  cadAccount: "1",
  cad: "TAD",
  address: "100 MAIN ST",
  city: "Fort Worth",
  lat: 32.75,
  lng: -97.3,
  use: "Improved building",
  sqft: 40000,
  yearBuilt: 2004,
  owner: "EXAMPLE OWNER",
  ownerAddress: "",
  recordUrl: "",
};

const NOW = new Date("2026-10-06T12:00:00Z");

describe("warning polygon intersection", () => {
  it("places a point in the core, the envelope, or outside", () => {
    expect(swathExposure({ lng: -97.3, lat: 32.75 }, storm).tier).toBe("core");
    expect(swathExposure({ lng: -97.45, lat: 32.65 }, storm).tier).toBe("envelope");
    expect(swathExposure({ lng: -95.3, lat: 29.7 }, storm).tier).toBe("outside");
  });
});

describe("opportunity score", () => {
  it("scores an exposed parcel with no later permit as unresolved", () => {
    const o = scoreParcel(parcel, storm, [], DEFAULT_WEIGHTS, NOW);
    expect(o.tier).toBe("core");
    expect(o.unresolved).toBe(true);
    expect(o.roofAge).toBe(22);
    expect(o.pipelineValue).toBe(560_000);
    expect(o.archetype.label).toBe("Not stated");
  });

  it("uses a precomputed exposure and a permit matched on parcelIds", () => {
    const tagged: Parcel = { ...parcel, tier: "envelope", hailInches: 1.75 };
    const filed: Permit = {
      id: "PB", market: "fort-worth", permitNo: "PB1", parcelId: null, parcelIds: [parcel.id], address: parcel.address, city: "Fort Worth",
      lat: 0, lng: 0, contractorId: "a", contractorName: "A", contractorState: "TX", issued: "2024-08-01",
      valuation: 1000, scope: "Re-roof with TPO", kind: "reroof", membrane: "TPO", portal: "", recordUrl: "",
    };
    const o = scoreParcel(tagged, storm, [filed], DEFAULT_WEIGHTS, NOW);
    expect(o.tier).toBe("envelope");
    expect(o.hailInches).toBe(1.75);
    expect(o.unresolved).toBe(false);
    expect(o.factors.permitAbsence).toBe(0);
    expect(o.archetype).toMatchObject({ label: "TPO", provenance: "source-record" });
  });

  it("does not treat a failed permit fetch as an unresolved building", () => {
    const dallas: Parcel = { ...parcel, id: "DCAD:9", market: "dallas", city: "Dallas", cad: "DCAD" };
    const o = scoreParcel(dallas, storm, [], DEFAULT_WEIGHTS, NOW, { "fort-worth": "ok", dallas: "failed" });
    expect(o.permitKnown).toBe(false);
    expect(o.unresolved).toBe(false);
    expect(o.factors.permitAbsence).toBe(0);
    const scored = scoreParcel(parcel, storm, [], DEFAULT_WEIGHTS, NOW, { "fort-worth": "ok", dallas: "failed" });
    expect(scored.unresolved).toBe(true);
    expect(scored.factors.permitAbsence).toBe(100);
    const staleExtract = scoreParcel(dallas, storm, [], DEFAULT_WEIGHTS, NOW, { "fort-worth": "ok", dallas: "ok" });
    expect(staleExtract.permitKnown).toBe(false);
    expect(staleExtract.unresolved).toBe(false);
    const fromAttom = scoreParcel({ ...dallas, permitSource: "attom" }, storm, [], DEFAULT_WEIGHTS, NOW);
    expect(fromAttom.permitKnown).toBe(true);
    expect(fromAttom.unresolved).toBe(true);
  });

  it("caps parcels outside the warnings", () => {
    const o = scoreParcel({ ...parcel, lng: -95.3, lat: 29.7 }, storm, [], DEFAULT_WEIGHTS, NOW);
    expect(o.score).toBeLessThanOrEqual(25);
  });
});

describe("archetype", () => {
  it("does not invent a membrane from year built", () => {
    expect(probableArchetype({ ...parcel, yearBuilt: 2010 }, [], "2026-01-01").label).toBe("Not stated");
  });
});

describe("TDI advisory window", () => {
  it("computes a 24-month deadline and status", () => {
    expect(tdiWindow("2024-05-28", NOW)).toMatchObject({ deadline: "2026-05-28", status: "closed" });
    expect(tdiWindow("2026-04-02", NOW)).toMatchObject({ deadline: "2028-04-02", status: "open" });
    expect(tdiWindow("2024-12-01", NOW).status).toBe("urgent");
  });
});

describe("competitor aggregation", () => {
  const contractors: Contractor[] = [
    { id: "local", name: "Local Roofing", hq: "Fort Worth", homeState: "TX", color: "#fff" },
    { id: "chase", name: "Out of State", hq: "FL", homeState: "FL", color: "#000" },
  ];
  const permits: Permit[] = [
    { id: "1", market: "fort-worth", permitNo: "1", parcelId: null, parcelIds: [], address: "", city: "Fort Worth", lat: 0, lng: 0, contractorId: "local", contractorName: "Local Roofing", contractorState: "TX", issued: "2024-01-15", valuation: 100, scope: "", kind: "reroof", portal: "", recordUrl: "" },
    { id: "2", market: "fort-worth", permitNo: "2", parcelId: null, parcelIds: [], address: "", city: "Fort Worth", lat: 0, lng: 0, contractorId: "chase", contractorName: "Out of State", contractorState: "FL", issued: "2024-06-01", valuation: 100, scope: "", kind: "repair", portal: "", recordUrl: "" },
  ];

  it("flags only an out-of-state firm whose filings follow a hail day", () => {
    const stats = competitorStats(permits, contractors, [storm], { from: "2023-01-01", to: "2026-10-01" });
    expect(stats.find((s) => s.contractor.id === "chase")?.stormChaser).toBe(true);
    expect(stats.find((s) => s.contractor.id === "local")?.stormChaser).toBe(false);
    expect(stats.reduce((s, c) => s + c.shareByVolume, 0)).toBeCloseTo(1, 5);
  });
});

describe("closed-loop calibration", () => {
  it("shifts weight toward factors that separate verified damage", () => {
    const mk = (age: number, positive: boolean) => ({
      id: String(age) + positive, parcelId: "x", stormId: "s", loggedAt: "", predictedScore: 70, notes: "",
      factors: { severity: 80, age, footprint: 50, permitAbsence: 100 },
      moistureVerified: positive, scope: positive ? "replacement" as const : "none" as const, contractValue: 0,
    });
    const c = calibrate([mk(90, true), mk(85, true), mk(20, false)], DEFAULT_WEIGHTS);
    expect(c.suggested.age).toBeGreaterThan(DEFAULT_WEIGHTS.age);
    expect(c.hitRate).toBeCloseTo(2 / 3);
  });
});
