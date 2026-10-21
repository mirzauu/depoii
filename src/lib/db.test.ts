import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { persistLive, readPermitContacts } from "@/lib/db";
import { accountCard } from "@/lib/intelligence";
import { closePool, query, queryOne } from "@/lib/pg";
import type { LivePayload } from "@/lib/types";

function payload(fetchedAt: string, owner = "FIRST OWNER"): LivePayload {
  return {
    fetchedAt,
    coverage: "test",
    permitFeeds: { "fort-worth": "ok", dallas: "ok" },
    storms: [],
    storm: {
      id: "2026-04-26",
      name: "April 26, 2026",
      shortName: "Apr 26",
      date: "2026-04-26",
      region: "Fort Worth",
      maxHail: 2.5,
      reportCount: 1,
      maxHailTag: 2.5,
      center: [-97.3, 32.75],
      source: "NWS",
      reports: [{ id: "r1", valid: "2026-04-26T22:00:00Z", lat: 32.75, lng: -97.3, inches: 2.5, qualifier: "E", city: "Fort Worth", county: "Tarrant", source: "Public", remark: "" }],
      warnings: [{ eventId: 9, hailTag: 2.5, windTag: 60, issue: "2026-04-26T21:00:00Z", expire: "2026-04-26T22:00:00Z", href: "https://example.test/w", tier: "core", basis: "NWS warning 9 hail tag 2.5\"", geometry: { type: "Polygon", coordinates: [] } }],
    },
    parcels: [
      {
        id: "A1", market: "fort-worth", cadAccount: "A1", cad: "TAD", address: "100 MAIN ST", city: "Fort Worth", lat: 32.75, lng: -97.3,
        use: "Improved building", sqft: 40000, yearBuilt: 1998, owner, ownerAddress: "1 MAIL ST", recordUrl: "https://example.test/a1",
        tier: "core", hailInches: 2.5, hailBasis: "Largest NWS hail report within 8 km: 2.5\" (estimated).", hailProvenance: "source-record",
      },
      {
        id: "A2", market: "fort-worth", cadAccount: "A2", cad: "TAD", address: "200 SIDE ST", city: "Fort Worth", lat: 32.9, lng: -97.5,
        use: "Improved building", sqft: 30000, yearBuilt: 2010, owner: "OUTSIDE OWNER", ownerAddress: "", recordUrl: "",
        tier: "outside", hailInches: 0, hailBasis: "Outside the warning polygons.", hailProvenance: "source-record",
      },
    ],
    permits: [{
      id: "PB1", market: "fort-worth", permitNo: "PB1", parcelId: "A1", parcelIds: ["A1"], address: "100 MAIN ST", city: "Fort Worth",
      lat: 32.75, lng: -97.3, contractorId: "acme", contractorName: "ACME ROOFING", contractorState: "TX",
      issued: "2026-05-01", valuation: 120000, scope: "Re-roof with TPO", kind: "reroof", membrane: "TPO", portal: "Fort Worth", recordUrl: "",
      contacts: [{
        id: "PB1:applicant:john",
        permitId: "PB1",
        role: "applicant",
        name: "John Filer",
        phone: "+18175553333",
        phoneFormatted: "(817) 555-3333",
        email: "john@northlogistics.com",
        source: "Fort Worth",
      }],
    }],
    developments: [],
  };
}

beforeEach(async () => {
  if (process.env.DATABASE_URL) {
    await query(`delete from warehouse.score_snapshots`);
    await query(`delete from warehouse.warnings`);
    await query(`delete from warehouse.hail_reports`);
    await query(`delete from warehouse.permit_contacts`);
    await query(`delete from warehouse.live_permits`);
    await query(`delete from warehouse.live_parcels`);
  }
});

afterEach(async () => {
  await closePool();
});

describe("market intelligence store", () => {
  it("updates a parcel in place instead of inserting a second row", async () => {
    await persistLive(payload("2026-10-06T12:00:00.000Z", "FIRST OWNER"));
    await persistLive(payload("2026-10-06T18:00:00.000Z", "SECOND OWNER"));
    const parcels = await query<{ account: string; owner: string }>(
      `SELECT account, owner FROM warehouse.live_parcels ORDER BY account`,
    );
    expect(parcels).toEqual([
      { account: "A1", owner: "SECOND OWNER" },
      { account: "A2", owner: "OUTSIDE OWNER" },
    ]);
    const hailCount = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM warehouse.hail_reports`);
    const warnCount = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM warehouse.warnings`);
    expect(Number(hailCount?.n)).toBe(1);
    expect(Number(warnCount?.n)).toBe(1);
  });

  it("writes one score snapshot per building per storm per day, then another the next day", async () => {
    await persistLive(payload("2026-10-06T12:00:00.000Z"));
    await persistLive(payload("2026-10-06T18:00:00.000Z"));
    const count1 = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM warehouse.score_snapshots`);
    expect(Number(count1?.n)).toBe(1);
    await persistLive(payload("2026-10-07T12:00:00.000Z"));
    const rows = await query<{ account: string; scored_on: string }>(
      `SELECT account, scored_on FROM warehouse.score_snapshots ORDER BY scored_on`,
    );
    expect(rows).toEqual([
      { account: "A1", scored_on: "2026-10-06" },
      { account: "A1", scored_on: "2026-10-07" },
    ]);
  });

  it("builds an account card from stored facts and leaves out contact fields the roll does not have", async () => {
    await persistLive(payload("2026-10-06T12:00:00.000Z"));
    const card = await accountCard("A1", "2026-04-26");
    expect(card?.card).toContain("FIRST OWNER");
    expect(card?.card).toContain("Tarrant Appraisal District");
    expect(card?.card).toContain("TPO");
    expect(card?.card.toLowerCase()).not.toContain("email");
    expect(card?.card.toLowerCase()).not.toContain("phone");
    expect(await accountCard("missing")).toBeNull();
  });

  it("stores and retrieves permit contacts", async () => {
    await persistLive(payload("2026-10-06T12:00:00.000Z"));
    const contacts = await readPermitContacts("PB1");
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      permitId: "PB1",
      role: "applicant",
      name: "John Filer",
      phone: "+18175553333",
      email: "john@northlogistics.com",
    });
  });
});
