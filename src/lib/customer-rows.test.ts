import { describe, expect, it } from "vitest";
import { filterCustomerPayload, keepCustomerLead, normalizeParcelId } from "./customer-rows";

describe("a new account sees only released rows", () => {
  it("keeps released Dallas accounts under either parcel id form", () => {
    expect(normalizeParcelId("DCAD-PARCEL-00000799950250000")).toBe("00000799950250000");
    expect(keepCustomerLead({ parcel_id: "DCAD-PARCEL-00000799950250000", city: "Dallas", hail_distance_mi: 2.1 })).toBe(true);
    expect(keepCustomerLead({ parcelId: "00000799950250000", city: "Dallas", hail_distance_mi: "2.1" })).toBe(true);
    expect(keepCustomerLead({ parcel_id: "DCAD-PARCEL-00000108733000000", city: "Dallas" })).toBe(true);
  });

  it("drops New York and Seattle rows, unreleased parcels, and rows farther than a few miles", () => {
    const raw = {
      opportunities: [
        { parcel_id: "ny-1", city: "New York", address: "105 Duane Street" },
        { parcel_id: "sea-1", city: "Seattle", address: "400 Broad St" },
        { parcel_id: "DCAD-PARCEL-00000799950250000", city: "Dallas", address: "16850 DALLAS PKWY", hail_distance_mi: 2.1 },
        { parcel_id: "DCAD-PARCEL-00000108733000000", city: "Dallas", address: "PILOT AGING ROW" },
        { parcel_id: "00000799950250000", city: "Dallas", address: "16850 DALLAS PKWY", hail_distance_mi: 50 },
        { parcel_id: "DCAD-PARCEL-UNRELEASED999", city: "Dallas", address: "NOT RELEASED" },
      ],
      leads: [
        { parcel_id: "ny-1", city: "New York" },
        { parcel_id: "DCAD-PARCEL-00000799950250000", city: "Dallas", hail_distance_mi: 3.1 },
        { parcel_id: "DCAD-PARCEL-00000108733000000", city: "Dallas" },
      ],
    };
    const view = filterCustomerPayload(raw) as {
      opportunities: { address: string }[];
      total_opportunities: number;
      leads: { parcel_id: string }[];
      total_matching: number;
    };
    expect(view.opportunities.map((row) => row.address)).toEqual(["16850 DALLAS PKWY", "PILOT AGING ROW"]);
    expect(view.total_opportunities).toBe(2);
    expect(view.leads).toHaveLength(2);
    expect(view.total_matching).toBe(2);
    expect(keepCustomerLead({ parcel_id: "ny-1", city: "New York" })).toBe(false);
  });
});
