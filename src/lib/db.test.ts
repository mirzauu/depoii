import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, persistLive, readPermitContacts } from "@/lib/db";
import { accountCard } from "@/lib/intelligence";
import type { LivePayload } from "@/lib/types";

const file = path.join(os.tmpdir(), `depoii-test-${process.pid}.sqlite`);
process.env.DEPOII_DB = file;

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

beforeEach(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
});

afterEach(() => closeDb());

describe("market intelligence store", () => {
  it("updates a parcel in place instead of inserting a second row", () => {
    persistLive(payload("2026-10-06T12:00:00.000Z", "FIRST OWNER"));
    persistLive(payload("2026-10-06T18:00:00.000Z", "SECOND OWNER"));
    const db = getDb();
    const parcels = db.prepare(`SELECT account, owner FROM parcels ORDER BY account`).all() as { account: string; owner: string }[];
    expect(parcels).toEqual([
      { account: "A1", owner: "SECOND OWNER" },
      { account: "A2", owner: "OUTSIDE OWNER" },
    ]);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM hail_reports`).get() as { n: number }).n).toBe(1);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM warnings`).get() as { n: number }).n).toBe(1);
  });

  it("writes one score snapshot per building per storm per day, then another the next day", () => {
    persistLive(payload("2026-10-06T12:00:00.000Z"));
    persistLive(payload("2026-10-06T18:00:00.000Z"));
    const db = getDb();
    expect((db.prepare(`SELECT COUNT(*) AS n FROM score_snapshots`).get() as { n: number }).n).toBe(1);
    persistLive(payload("2026-10-07T12:00:00.000Z"));
    const rows = db.prepare(`SELECT account, scored_on FROM score_snapshots ORDER BY scored_on`).all() as { account: string; scored_on: string }[];
    expect(rows).toEqual([
      { account: "A1", scored_on: "2026-10-06" },
      { account: "A1", scored_on: "2026-10-07" },
    ]);
  });

  it("builds an account card from stored facts and leaves out contact fields the roll does not have", () => {
    persistLive(payload("2026-10-06T12:00:00.000Z"));
    const card = accountCard("A1", "2026-04-26");
    expect(card?.card).toContain("FIRST OWNER");
    expect(card?.card).toContain("Tarrant Appraisal District");
    expect(card?.card).toContain("TPO");
    expect(card?.card.toLowerCase()).not.toContain("email");
    expect(card?.card.toLowerCase()).not.toContain("phone");
    expect(accountCard("missing")).toBeNull();
  });

  it("stores and retrieves permit contacts", () => {
    persistLive(payload("2026-10-06T12:00:00.000Z"));
    const contacts = readPermitContacts("PB1");
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

