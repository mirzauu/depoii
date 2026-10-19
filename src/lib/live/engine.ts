import type { HailReport, MarketId, Parcel, Permit, PermitKind, StormSummary, WarningPolygon } from "@/lib/types";
import type { MultiPolygon, Polygon } from "geojson";
import { extractContactsFromRecord } from "@/lib/contacts/hygiene";

const PORTAL = "Depoii data engine";

export interface EngineCity {
  parcels: Parcel[];
  permits: Permit[];
  developments: Permit[];
  /** True only when the permit search returned. An empty list is still a completed read. */
  permitsOk: boolean;
}

export interface EngineLoad {
  fortWorth: EngineCity | null;
  dallas: EngineCity | null;
  note: string;
}

type Row = Record<string, unknown>;

function pick(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return undefined;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function day(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

export function mapEngineParcel(row: Row, market: MarketId): Parcel | null {
  const address = String(pick(row, ["address", "situs", "situs_address", "street_address", "full_address"]) ?? "").replace(/\s+/g, " ").trim();
  const lat = num(pick(row, ["lat", "latitude", "y"]));
  const lng = num(pick(row, ["lng", "lon", "longitude", "x"]));
  if (!address || !lat || !lng) return null;
  const account = String(pick(row, ["cad_account", "account", "apn", "parcel_id", "id"]) ?? address).trim();
  const year = 0;
  const sqft = 0;
  const city = market === "dallas" ? "Dallas" : "Fort Worth";
  return {
    id: market === "dallas" ? `DCAD:${account}` : `TAD:${account}`,
    market,
    cadAccount: account,
    cad: market === "dallas" ? "DCAD" : "TAD",
    address,
    city: String(pick(row, ["city"]) ?? city).replace(/,?\s*TX$/i, "").trim() || city,
    lat,
    lng,
    use: String(pick(row, ["use", "property_use", "land_use", "property_type"]) ?? "Commercial improvement"),
    sqft,
    yearBuilt: year,
    yearBasis: undefined,
    owner: String(pick(row, ["owner", "owner_name", "ownerName"]) ?? "Owner name blank on the roll"),
    ownerAddress: String(pick(row, ["owner_address", "ownerAddress", "mail_address"]) ?? ""),
    recordUrl: String(pick(row, ["record_url", "recordUrl", "source_url"]) ?? ""),
  };
}

function permitKind(category: string, scope: string): PermitKind | null {
  const text = `${category} ${scope}`.toLowerCase();
  if (/\bnew[\s-]?commercial\b|\bnew construction\b/.test(text)) return "new-commercial";
  if (/\breroof\b|\bre[\s-]?roof\b|\breplacement\b|\btear[\s-]?off\b/.test(text)) return "reroof";
  if (/\broof\b|\brepair\b/.test(text)) return "repair";
  return null;
}

export function mapEnginePermit(row: Row, market: MarketId): Permit | null {
  const permitNo = String(pick(row, ["permit_number", "permitNo", "permit_no", "number"]) ?? "").trim();
  const issued = day(pick(row, ["issued", "issue_date", "issued_date", "file_date", "effective_date"]));
  const scope = String(pick(row, ["scope", "description", "work_description", "permit_type"]) ?? "").replace(/\s+/g, " ").trim();
  const category = String(pick(row, ["category", "permit_category", "kind"]) ?? "");
  const kind = permitKind(category, scope);
  if (!permitNo || !issued || !kind) return null;
  const membrane = String(pick(row, ["probable_roof_system", "membrane", "roof_system"]) ?? "").trim();
  const state = String(pick(row, ["contractor_state", "contractorState"]) ?? "").trim().toUpperCase();
  const city = market === "dallas" ? "Dallas" : "Fort Worth";
  const prefix = market === "dallas" ? "DALLAS" : "FW";
  const id = `${prefix}:${permitNo}`;
  const contacts = extractContactsFromRecord(id, row, PORTAL);
  return {
    id,
    market,
    permitNo,
    parcelId: null,
    parcelIds: [],
    address: String(pick(row, ["address", "street_address"]) ?? "").replace(/\s+/g, " ").trim(),
    city,
    lat: num(pick(row, ["lat", "latitude"])),
    lng: num(pick(row, ["lng", "lon", "longitude"])),
    contractorId: null,
    contractorName: String(pick(row, ["contractor", "contractor_name", "contractorName"]) ?? "").trim() || "Contractor not named on the permit",
    contractorState: /^[A-Z]{2}$/.test(state) ? state : "UNKNOWN",
    issued,
    valuation: Math.round(num(pick(row, ["valuation", "job_value", "value"]))),
    scope: scope || category,
    kind,
    membrane: membrane && !/^(unknown|not stated|n\/a|none)$/i.test(membrane) ? membrane : undefined,
    portal: PORTAL,
    recordUrl: String(pick(row, ["record_url", "recordUrl", "url"]) ?? ""),
    contacts: contacts.length > 0 ? contacts : undefined,
  };
}

async function getJson(base: string, path: string, fetchImpl: typeof fetch) {
  const res = await fetchImpl(`${base}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`engine HTTP ${res.status}`);
  return res.json() as Promise<Row>;
}

async function permitPages(base: string, jurisdiction: string, market: MarketId, fetchImpl: typeof fetch) {
  const permits: Permit[] = [];
  const developments: Permit[] = [];
  const limit = 200;
  for (let offset = 0; offset < limit; offset += limit) {
    const q = new URLSearchParams({ jurisdiction, limit: String(limit), offset: String(offset) });
    const body = await getJson(base, `/api/v1/permits/search?${q}`, fetchImpl);
    const rows = Array.isArray(body.permits) ? (body.permits as Row[]) : [];
    for (const row of rows) {
      const permit = mapEnginePermit(row, market);
      if (!permit) continue;
      if (permit.kind === "new-commercial") developments.push(permit);
      else permits.push(permit);
    }
    const total = num(body.total);
    const count = rows.length;
    if (!count || offset + count >= total) break;
  }
  return { permits, developments, permitsOk: true as const };
}

async function parcelPage(base: string, path: string, market: MarketId, fetchImpl: typeof fetch) {
  const parcels: Parcel[] = [];
  const limit = 200;
  for (let offset = 0; offset < limit; offset += limit) {
    const join = path.includes("?") ? "&" : "?";
    const body = await getJson(base, `${path}${join}min_sqft=25000&limit=${limit}&offset=${offset}`, fetchImpl);
    const rows = Array.isArray(body.parcels) ? (body.parcels as Row[]) : [];
    for (const row of rows) {
      const parcel = mapEngineParcel(row, market);
      if (parcel) parcels.push(parcel);
    }
    const total = num(body.total);
    if (!rows.length || offset + rows.length >= total) break;
  }
  return parcels;
}

export interface EngineCities {
  totalCities: number;
  cities: string[];
}

export interface EngineJurisdiction {
  name: string;
  permits: number;
}

export interface EngineLeader {
  id: string;
  name: string;
  license: string;
  permits: number;
  valuation: number;
  share: number;
  membrane: string;
  jurisdiction: string;
}

export interface EnginePermitRow {
  id: string;
  number: string;
  jurisdiction: string;
  issued: string;
  address: string;
  city: string;
  valuation: number;
  category: string;
  membrane: string;
  contractor: string;
  lat: number;
  lng: number;
}

export interface EngineExposureTarget {
  parcelId: string;
  address: string;
  city: string;
  sqft: number;
  owner: string;
  stormName: string;
  eventDate: string;
  hailInches: number;
  valuationMid: number;
}

export async function loadJurisdictions(fetchImpl: typeof fetch = fetch): Promise<EngineJurisdiction[]> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return [];
  const body = await getJson(base, "/api/v1/permits/stats", fetchImpl);
  const by = body.by_jurisdiction;
  if (!by || typeof by !== "object" || Array.isArray(by)) return [];
  return Object.entries(by as Record<string, unknown>)
    .map(([name, count]) => ({ name, permits: num(count) }))
    .filter((row) => row.name.trim() && row.permits > 0)
    .sort((a, b) => b.permits - a.permits || a.name.localeCompare(b.name));
}

export async function loadLeaderboard(jurisdiction: string, fetchImpl: typeof fetch = fetch): Promise<EngineLeader[]> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base || !jurisdiction.trim()) return [];
  const q = new URLSearchParams({ jurisdiction, limit: "25" });
  const body = await getJson(base, `/api/v1/contractors/leaderboard?${q}`, fetchImpl);
  const rows = Array.isArray(body.leaderboard) ? (body.leaderboard as Row[]) : [];
  return rows.map((row) => ({
    id: String(pick(row, ["canonicalId", "id"]) ?? pick(row, ["canonicalName", "name"]) ?? ""),
    name: String(pick(row, ["canonicalName", "name"]) ?? "Contractor"),
    license: String(pick(row, ["licenseNumber", "license"]) ?? ""),
    permits: num(pick(row, ["permitCount", "permits"])),
    valuation: num(pick(row, ["totalValuationUSD", "valuation"])),
    share: num(pick(row, ["marketSharePct", "share"])) / 100,
    membrane: String(pick(row, ["primaryRoofSystem", "membrane"]) ?? ""),
    jurisdiction: String(pick(row, ["jurisdiction"]) ?? jurisdiction),
  })).filter((row) => row.id);
}

export async function loadJurisdictionPermits(jurisdiction: string, fetchImpl: typeof fetch = fetch): Promise<{ total: number; permits: EnginePermitRow[] }> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base || !jurisdiction.trim()) return { total: 0, permits: [] };
  const permits: EnginePermitRow[] = [];
  const limit = 200;
  let total = 0;
  for (let offset = 0; offset < limit; offset += limit) {
    const q = new URLSearchParams({ jurisdiction, limit: String(limit), offset: String(offset) });
    const body = await getJson(base, `/api/v1/permits/search?${q}`, fetchImpl);
    total = num(body.total) || total;
    const rows = Array.isArray(body.permits) ? (body.permits as Row[]) : [];
    for (const row of rows) {
      const id = String(pick(row, ["id", "rawPermitNumber"]) ?? "");
      if (!id) continue;
      permits.push({
        id,
        number: String(pick(row, ["rawPermitNumber", "id"]) ?? id),
        jurisdiction: String(pick(row, ["jurisdiction"]) ?? jurisdiction),
        issued: day(pick(row, ["issueDate", "issued"])),
        address: String(pick(row, ["normalizedAddress", "address"]) ?? ""),
        city: String(pick(row, ["city"]) ?? ""),
        valuation: num(pick(row, ["valuation"])),
        category: String(pick(row, ["category"]) ?? ""),
        membrane: String(pick(row, ["probableRoofSystem"]) ?? ""),
        contractor: String(pick(row, ["contractorName"]) ?? ""),
        lat: num(pick(row, ["latitude", "lat"])),
        lng: num(pick(row, ["longitude", "lng"])),
      });
    }
    if (!rows.length || offset + rows.length >= total) break;
  }
  return { total, permits };
}

export async function loadUnresolvedExposure(fetchImpl: typeof fetch = fetch): Promise<EngineExposureTarget[]> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return [];
  const body = await getJson(base, "/api/v1/intelligence/unresolved-exposure?min_sqft=1000&min_hail_inches=1", fetchImpl);
  const rows = Array.isArray(body.targets) ? (body.targets as Row[]) : [];
  return rows.map((row) => ({
    parcelId: String(pick(row, ["parcelId"]) ?? ""),
    address: String(pick(row, ["address"]) ?? ""),
    city: String(pick(row, ["city"]) ?? ""),
    sqft: 0,
    owner: String(pick(row, ["ownerName", "owner"]) ?? ""),
    stormName: String(pick(row, ["stormName"]) ?? ""),
    eventDate: day(pick(row, ["eventDate"])),
    hailInches: num(pick(row, ["maxHailInches"])),
    valuationMid: num(pick(row, ["estimatedReplacementMid"])),
  })).filter((row) => row.address);
}

export interface HailCatalog {
  source: string;
  events: StormSummary[];
  centers: Record<string, { lat: number; lng: number }>;
  selected: StormSummary & { reports: HailReport[]; warnings: WarningPolygon[]; maxHailTag: number; center: [number, number] };
}

export async function loadCityParcels(city: string, state: string, fetchImpl: typeof fetch = fetch): Promise<Parcel[]> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base || !city) return [];
  const names = city.toLowerCase().endsWith(" city") ? [city, city.replace(/ city$/i, "")] : [city];
  const market: MarketId = /fort worth/i.test(city) ? "fort-worth" : "dallas";
  const seen = new Set<string>();
  const parcels: Parcel[] = [];
  for (const name of names) {
    const q = new URLSearchParams({ city: name, state, limit: "200" });
    try {
      const body = await getJson(base, `/api/v1/parcels/search?${q}`, fetchImpl);
      for (const item of Array.isArray(body.parcels) ? body.parcels : []) {
        const parcel = mapEngineParcel(item as Row, market);
        if (!parcel || seen.has(parcel.cadAccount)) continue;
        seen.add(parcel.cadAccount);
        parcel.permitSource = "engine";
        parcels.push(parcel);
      }
    } catch {
      return parcels;
    }
  }
  return parcels;
}

export async function loadHailEvents(eventDate?: string | null, fetchImpl: typeof fetch = fetch, state = "TX"): Promise<HailCatalog | null> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return null;
  const q = new URLSearchParams({ state, since: "2024-03-01", min_hail_inches: "1.5" });
  if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) q.set("event_date", eventDate);
  try {
    const body = await getJson(base, `/api/v1/storms/hail-events?${q}`, fetchImpl);
    const events = (Array.isArray(body.events) ? body.events : []).flatMap(mapHailSummary);
    const selectedRow = (body.selected ?? {}) as Row;
    const selected = mapHailSummary(selectedRow)[0];
    if (!events.length || !selected) return null;
    const centers: Record<string, { lat: number; lng: number }> = {};
    for (const item of Array.isArray(body.events) ? body.events : []) {
      const row = item as Row;
      const id = String(pick(row, ["id"]) ?? "");
      const point = (row.center ?? {}) as Row;
      const lat = num(pick(point, ["latitude"]));
      const lng = num(pick(point, ["longitude"]));
      if (id && lat && lng) centers[id] = { lat, lng };
    }
    const reports = (Array.isArray(selectedRow.reports) ? selectedRow.reports : []).flatMap((item): HailReport[] => {
      const row = item as Row;
      const id = String(pick(row, ["id"]) ?? "");
      const lat = num(pick(row, ["latitude", "lat"]));
      const lng = num(pick(row, ["longitude", "lng"]));
      if (!id || !lat || !lng) return [];
      const qualifier = String(pick(row, ["qualifier"]) ?? "");
      return [{
        id,
        valid: String(pick(row, ["valid"]) ?? ""),
        lat,
        lng,
        inches: num(pick(row, ["hail_inches", "inches"])),
        qualifier: qualifier === "M" || qualifier === "E" ? qualifier : "",
        city: String(pick(row, ["city"]) ?? ""),
        county: String(pick(row, ["county"]) ?? ""),
        source: String(pick(row, ["source"]) ?? ""),
        remark: String(pick(row, ["remark"]) ?? ""),
      }];
    });
    const warnings = (Array.isArray(selectedRow.warnings) ? selectedRow.warnings : []).flatMap((item): WarningPolygon[] => {
      const row = item as Row;
      const geometry = row.geometry as Polygon | MultiPolygon | undefined;
      if (!geometry?.type) return [];
      const tier = String(pick(row, ["tier"]) ?? "");
      return [{
        eventId: num(pick(row, ["event_id", "eventId"])),
        hailTag: num(pick(row, ["hail_tag_inches", "hailTag"])),
        windTag: num(pick(row, ["wind_tag_mph", "windTag"])),
        issue: String(pick(row, ["issued", "issue"]) ?? ""),
        expire: String(pick(row, ["expires", "expire"]) ?? ""),
        href: "",
        tier: tier === "core" ? "core" : "envelope",
        basis: String(pick(row, ["basis"]) ?? ""),
        geometry,
      }];
    });
    const center = (selectedRow.center ?? {}) as Row;
    return {
      source: String(pick(body, ["source"]) ?? "Depoii data engine"),
      events,
      centers,
      selected: {
        ...selected,
        reports,
        warnings,
        maxHailTag: num(pick(selectedRow, ["max_warning_hail_inches"])),
        center: [num(pick(center, ["longitude"])), num(pick(center, ["latitude"]))],
      },
    };
  } catch {
    return null;
  }
}

function mapHailSummary(row: Row): StormSummary[] {
  const date = day(pick(row, ["event_date", "id"]));
  if (!date) return [];
  return [{
    id: String(pick(row, ["id"]) ?? date),
    date,
    name: String(pick(row, ["name"]) ?? date),
    shortName: String(pick(row, ["short_name", "shortName"]) ?? date),
    maxHail: num(pick(row, ["max_hail_inches", "maxHail"])),
    reportCount: num(pick(row, ["report_count", "reportCount"])),
  }];
}

export async function loadPermitCities(fetchImpl: typeof fetch = fetch): Promise<EngineCities> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return { totalCities: 0, cities: [] };
  const body = await getJson(base, "/api/v1/permits/cities", fetchImpl);
  const cities = Array.isArray(body.cities) ? body.cities.map((city) => String(city).trim()).filter(Boolean) : [];
  const totalCities = num(body.total_cities) || cities.length;
  return { totalCities, cities };
}

export async function loadEngine(fetchImpl: typeof fetch = fetch, only?: MarketId): Promise<EngineLoad> {
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return { fortWorth: null, dallas: null, note: "" };
  try {
    const health = await getJson(base, "/api/v1/health", fetchImpl);
    const status = String(health.status ?? "");
    if (status !== "healthy" && status !== "degraded") {
      return { fortWorth: null, dallas: null, note: "Depoii data engine did not report a usable status, so public records are shown instead." };
    }
  } catch {
    return { fortWorth: null, dallas: null, note: "Depoii data engine was not reached, so public records are shown instead." };
  }

  async function city(market: MarketId, parcelPath: string, jurisdiction: string): Promise<EngineCity | null> {
    try {
      const [parcels, permitBody] = await Promise.all([
        parcelPage(base, parcelPath, market, fetchImpl),
        permitPages(base, jurisdiction, market, fetchImpl),
      ]);
      if (market === "dallas" && permitBody.permitsOk) {
        for (const parcel of parcels) parcel.permitSource = "engine";
      }
      return { parcels, ...permitBody };
    } catch {
      return null;
    }
  }

  const [fortWorth, dallas] = await Promise.all([
    !only || only === "fort-worth" ? city("fort-worth", "/api/v1/parcels/tarrant?city=Fort%20Worth", "Fort Worth, TX") : Promise.resolve(null),
    !only || only === "dallas" ? city("dallas", "/api/v1/parcels/search?city=Dallas", "Dallas, TX") : Promise.resolve(null),
  ]);
  const used = [fortWorth ? "Fort Worth" : "", dallas ? "Dallas" : ""].filter(Boolean).join(" and ");
  const note = used
    ? `${used} parcels and permits were read from the Depoii data engine.`
    : "Depoii data engine did not return city records, so public records are shown instead.";
  return { fortWorth, dallas, note };
}
