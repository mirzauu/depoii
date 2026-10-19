import { describe, expect, test } from "vitest";
import { dedupePermits } from "@/lib/live/load";
import type { Permit } from "@/lib/types";

function permit(over: Partial<Permit> & Pick<Permit, "permitNo">): Permit {
  return {
    id: over.permitNo,
    market: "fort-worth",
    parcelId: null,
    parcelIds: [],
    address: "",
    city: "Fort Worth",
    lat: 0,
    lng: 0,
    contractorId: null,
    contractorName: "Contractor not named on the permit",
    contractorState: "UNKNOWN",
    issued: "2026-03-01",
    valuation: 0,
    scope: "",
    kind: "new-commercial",
    portal: "",
    recordUrl: "",
    ...over,
  };
}

describe("dedupePermits", () => {
  test("keeps one row per permit number and prefers the filing with more detail", () => {
    const rows = dedupePermits([
      permit({ permitNo: "PB26-12548", address: "100 MAIN ST", scope: "New" }),
      permit({ permitNo: "PB26-12548", address: "100 MAIN ST", scope: "New commercial shell", valuation: 4_000_000, contractorId: "ACME" }),
      permit({ permitNo: "PB26-10001", address: "200 SIDE ST", scope: "Warehouse" }),
    ]);
    expect(rows.map((p) => p.permitNo)).toEqual(["PB26-12548", "PB26-10001"]);
    expect(rows[0].valuation).toBe(4_000_000);
    expect(rows[0].scope).toBe("New commercial shell");
  });

  test("does not collapse the same permit number from two cities", () => {
    const rows = dedupePermits([
      permit({ permitNo: "100", address: "1 MAIN ST", scope: "Roof" }),
      permit({ market: "dallas", permitNo: "100", address: "1 ELM ST", scope: "Roof" }),
    ]);
    expect(rows.map((p) => p.market).sort()).toEqual(["dallas", "fort-worth"]);
  });

  test("preserves and merges contacts from duplicate filings", () => {
    const rows = dedupePermits([
      permit({
        permitNo: "PB26-555",
        contacts: [
          {
            id: "PB26-555:applicant:alice",
            permitId: "PB26-555",
            role: "applicant",
            name: "Alice",
            phone: "+18175551111",
            source: "Fort Worth",
          },
        ],
      }),
      permit({
        permitNo: "PB26-555",
        scope: "Detailed reroof scope",
        valuation: 500_000,
        contacts: [
          {
            id: "PB26-555:contractor:bob",
            permitId: "PB26-555",
            role: "contractor",
            name: "Bob",
            phone: "+18175552222",
            source: "Fort Worth",
          },
        ],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].contacts).toHaveLength(2);
    expect(rows[0].contacts?.map((c) => c.name).sort()).toEqual(["Alice", "Bob"]);
  });
});
