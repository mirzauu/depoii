import { describe, expect, it } from "vitest";
import { parseAttomBuilding } from "./attom";
import type { Parcel } from "@/lib/types";

const parcel: Parcel = {
  id: "DCAD:1",
  market: "dallas",
  cadAccount: "1",
  cad: "DCAD",
  address: "2220 MAIL AVE",
  city: "Dallas",
  lat: 32.83,
  lng: -96.85,
  use: "Commercial",
  sqft: 1000,
  yearBuilt: 1990,
  owner: "Owner",
  ownerAddress: "",
  recordUrl: "",
};

describe("ATTOM parse", () => {
  it("keeps stated year, roof cover, and roofing permits", () => {
    const detail = {
      property: [{
        summary: { yearbuilt: 2024 },
        building: { size: { universalsize: 27018 }, construction: { roofcover: "COMPOSITION SHINGLE" } },
      }],
    };
    const permits = {
      property: [{
        buildingPermits: [
          { effectiveDate: "2025-12-19", permitNumber: "ELC-1", type: "Electrical permit", description: "Electrical rework" },
          { effectiveDate: "2026-03-02", permitNumber: "RF-9", type: "Building permit", description: "Commercial reroof with TPO", businessName: "North Texas Roofing" },
        ],
      }],
    };
    const parsed = parseAttomBuilding(detail, permits, parcel);
    expect(parsed.yearBuilt).toBe(2024);
    expect(parsed.sqft).toBe(27018);
    expect(parsed.roofCover).toBe("COMPOSITION SHINGLE");
    expect(parsed.permits).toHaveLength(1);
    expect(parsed.permits[0]).toMatchObject({ permitNo: "RF-9", kind: "reroof", contractorName: "North Texas Roofing", market: "dallas" });
  });
});
