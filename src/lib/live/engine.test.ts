import { afterEach, describe, expect, it } from "vitest";
import { loadEngine, loadPermitCities, mapEngineParcel, mapEnginePermit } from "./engine";

const prev = process.env.DEPOII_ENGINE_URL;

afterEach(() => {
  if (prev == null) delete process.env.DEPOII_ENGINE_URL;
  else process.env.DEPOII_ENGINE_URL = prev;
});

describe("engine mapper", () => {
  it("keeps a stated roof system and drops a permit with no issued date", () => {
    const permit = mapEnginePermit(
      { permit_number: "RF-1", issued: "2026-02-01", description: "Commercial reroof", probable_roof_system: "", contractor: "North Texas Roofing" },
      "dallas",
    );
    expect(permit).toMatchObject({ kind: "reroof", membrane: undefined, contractorName: "North Texas Roofing", portal: "Depoii data engine" });
    expect(mapEnginePermit({ permit_number: "RF-2", description: "Commercial reroof" }, "dallas")).toBeNull();
    expect(mapEnginePermit({ permit_number: "RF-3", issued: "2026-03-01", probable_roof_system: "TPO", description: "reroof" }, "fort-worth")?.membrane).toBe("TPO");
  });

  it("extracts contacts from engine permit rows", () => {
    const permit = mapEnginePermit(
      {
        permit_number: "RF-4",
        issued: "2026-02-15",
        description: "Commercial reroof",
        contractor: "Dallas Master Roofing",
        contractor_phone: "214-555-8899",
        applicant_name: "Marcus Vance",
        applicant_phone: "972-555-4321",
        applicant_email: "mvance@prologis.com",
      },
      "dallas",
    );
    expect(permit?.contacts).toBeDefined();
    expect(permit?.contacts).toHaveLength(2);
    expect(permit?.contacts?.find((c) => c.role === "applicant")).toMatchObject({
      name: "Marcus Vance",
      phone: "+19725554321",
      email: "mvance@prologis.com",
    });
    expect(permit?.contacts?.find((c) => c.role === "contractor")).toMatchObject({
      name: "Dallas Master Roofing",
      phone: "+12145558899",
    });
  });

  it("drops a parcel with no coordinates", () => {
    expect(mapEngineParcel({ address: "1 MAIN ST", year_built: 2001, sqft: 30000 }, "dallas")).toBeNull();
    expect(mapEngineParcel({ address: "1 MAIN ST", lat: 32.7, lng: -96.8, year_built: 2001, sqft: 30000, owner: "Owner" }, "dallas")).toMatchObject({
      market: "dallas",
      yearBuilt: 0,
      sqft: 0,
      yearBasis: undefined,
    });
  });
});

describe("permit cities", () => {
  it("returns the warehouse city list", async () => {
    process.env.DEPOII_ENGINE_URL = "http://engine.test";
    const load = await loadPermitCities(async () => {
      return new Response(JSON.stringify({ total_cities: 2, cities: ["Austin", "Dallas"] }), { status: 200 });
    });
    expect(load).toEqual({ totalCities: 2, cities: ["Austin", "Dallas"] });
  });

  it("returns an empty list when the engine URL is unset", async () => {
    delete process.env.DEPOII_ENGINE_URL;
    await expect(loadPermitCities()).resolves.toEqual({ totalCities: 0, cities: [] });
  });
});

describe("engine fetch", () => {
  it("leaves both cities empty when the engine cannot be reached", async () => {
    process.env.DEPOII_ENGINE_URL = "http://engine.test";
    const load = await loadEngine(async () => {
      throw new Error("down");
    });
    expect(load.fortWorth).toBeNull();
    expect(load.dallas).toBeNull();
    expect(load.note).toMatch(/not reached/);
  });

  it("reads Dallas and Fort Worth when health is usable", async () => {
    process.env.DEPOII_ENGINE_URL = "http://engine.test";
    const load = await loadEngine(async (input) => {
      const url = String(input);
      const body = url.includes("/health")
        ? { status: "healthy" }
        : url.includes("/parcels/")
          ? { total: 1, parcels: [{ address: "100 MAIN ST", lat: 32.75, lng: -97.33, year_built: 1999, sqft: 40000, owner: "Owner", id: "A1" }] }
          : { total: 1, count: 1, offset: 0, limit: 200, permits: [{ permit_number: "P1", issued: "2026-01-02", description: "Commercial reroof", probable_roof_system: "TPO" }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    expect(load.fortWorth?.parcels).toHaveLength(1);
    expect(load.fortWorth?.permits[0]?.membrane).toBe("TPO");
    expect(load.dallas?.parcels[0]?.permitSource).toBe("engine");
    expect(load.note).toMatch(/Depoii data engine/);
  });
});
