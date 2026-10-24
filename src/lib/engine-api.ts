import type { HailReport, Storm, StormSummary, WarningPolygon } from "@/lib/types";

type Row = Record<string, unknown>;

function pick(row: Row, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return undefined;
}

const str = (row: Row, keys: string[], fallback = "") => {
  const value = pick(row, keys);
  return value == null ? fallback : String(value).trim();
};

const num = (row: Row, keys: string[]) => {
  const n = Number(pick(row, keys));
  return Number.isFinite(n) ? n : 0;
};

const coord = (row: Row, keys: string[]) => {
  const value = pick(row, keys);
  const n = Number(value);
  return value == null || !Number.isFinite(n) || n === 0 ? null : n;
};

const rows = (body: unknown, keys: string[]): Row[] => {
  if (Array.isArray(body)) return body as Row[];
  if (!body || typeof body !== "object") return [];
  for (const key of keys) {
    const value = (body as Row)[key];
    if (Array.isArray(value)) return value as Row[];
  }
  return [];
};

const counts = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value as Row).map(([name, n]) => ({ name, count: Number(n) || 0 })).sort((a, b) => b.count - a.count)
    : [];

export interface EnginePermit {
  id: string;
  permitNumber: string;
  jurisdiction: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  issued: string;
  status: string;
  valuation: number;
  category: string;
  roofSystem: string;
  contractor: string;
  description: string;
  sqft: number;
  hailWindow: boolean;
  storm: string;
  parcelId: string;
  lat: number | null;
  lng: number | null;
  isPrePermit?: boolean;
  bidWindowStatus?: string | null;
  appliedDate?: string | null;
  architectName?: string | null;
  designFirm?: string | null;
  ownerPhone?: string | null;
}

export function mapPermit(row: Row): EnginePermit {
  return {
    id: str(row, ["id", "permit_number", "rawPermitNumber"]),
    permitNumber: str(row, ["rawPermitNumber", "permit_number", "permitNumber", "id"]),
    jurisdiction: str(row, ["jurisdiction"]),
    address: str(row, ["normalizedAddress", "address"]),
    city: str(row, ["city"]),
    state: str(row, ["state"]),
    zip: str(row, ["zipCode", "zip_code", "postal_code"]),
    issued: str(row, ["issueDate", "issue_date"]).slice(0, 10),
    status: str(row, ["status"]),
    valuation: num(row, ["valuation"]),
    category: str(row, ["category"]),
    roofSystem: str(row, ["probableRoofSystem", "probable_roof_system", "roof_system", "roofSystem"]),
    contractor: str(row, ["contractorName", "contractor_name"]),
    description: str(row, ["rawDescription", "description", "scope_description", "scopeDescription"]),
    sqft: num(row, ["squareFootage", "square_footage"]),
    hailWindow: Boolean(pick(row, ["isHailStormWindow", "is_hail_storm_window"])),
    storm: str(row, ["associatedStormEvent"]),
    parcelId: str(row, ["parcelId", "parcel_id"]),
    lat: coord(row, ["latitude", "lat"]),
    lng: coord(row, ["longitude", "lng"]),
    isPrePermit: Boolean(pick(row, ["isPrePermit", "is_pre_permit"])),
    bidWindowStatus: (pick(row, ["bidWindowStatus", "bid_window_status"]) as string) || null,
    appliedDate: str(row, ["appliedDate", "applied_date"]).slice(0, 10) || null,
    architectName: (pick(row, ["architectName", "architect_name"]) as string) || null,
    designFirm: (pick(row, ["designFirm", "design_firm"]) as string) || null,
    ownerPhone: (pick(row, ["ownerPhone", "owner_phone"]) as string) || null,
  };
}

export interface PermitPage {
  total: number;
  totalValuation: number;
  permits: EnginePermit[];
}

export function mapPermitSearch(body: unknown): PermitPage {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total"]),
    totalValuation: num(b, ["total_valuation"]),
    permits: rows(body, ["permits", "items"]).map(mapPermit).filter((p) => p.id),
  };
}

export interface ContractorProfile {
  id: string;
  name: string;
  license: string;
  permits: number;
  valuation: number;
  valuationLabel: string;
  share: number;
  roofSystem: string;
  jurisdiction: string;
  aliases: string[];
  recentPermitIds: string[];
  website: string;
  logoUrl: string;
  hq: string;
  phone: string;
  founded: string;
  crew: string;
  certifications: string[];
  leadership: { name: string; title: string; email: string; phone: string; linkedin: string }[];
  ownership: string;
  acquisition: string;
  subcontracting: string;
  maNotes: string;
  rcatProfileUrl?: string;
  rcatLicenseNumber?: string;
  rcatLicenseType?: string;
  rcatMemberSince?: number;
  bbbProfileUrl?: string;
  bbbRating?: string;
  bbbAccredited?: boolean;
  linkedinCompanyUrl?: string;
}

function logoSrc(logoUrl: string, website: string) {
  const fromLogo = logoUrl.match(/logo\.dev\/([^/?]+)/)?.[1];
  let host = fromLogo || "";
  if (!host && website) {
    try {
      host = new URL(website).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
  }
  // The engine's img.logo.dev links use an anonymous token that logo.dev rejects with 401.
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : "";
}

/** Accela applicant/contact names: "Jane Smith" — not company entities. */
export function looksLikePersonName(name: string) {
  const n = name.trim();
  if (/\b(llc|l\.l\.c|inc|corp|co\.|company|companies|roof|reroof|construct|contract|builders?|group|partners?|lp|llp|ltd|services?|enterprises?|associates?|commercial|multifamily|homes?)\b/i.test(n)) {
    return false;
  }
  if (/[0-9&/]/.test(n)) return false;
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  // First Last or First M. Last / First Middle Last
  return parts.every((p) => /^[A-Z][a-zA-Z'-]*\.?$/.test(p) || /^[A-Z]\.?$/.test(p));
}

export function mapLeaderboard(body: unknown) {
  const b = (body ?? {}) as Row;
  const contractors = rows(body, ["leaderboard", "items"]).map((row): ContractorProfile => ({
      id: str(row, ["canonicalId", "id"]) || str(row, ["canonicalName", "name"]),
      name: str(row, ["canonicalName", "name"], "Contractor"),
      license: str(row, ["licenseNumber", "license"]),
      permits: num(row, ["permitCount", "permits"]),
      valuation: num(row, ["totalValuationUSD", "valuation"]),
      valuationLabel: str(row, ["totalValuationFormatted"]),
      share: num(row, ["marketSharePct", "share"]) / 100,
      roofSystem: str(row, ["primaryRoofSystem", "membrane"]),
      jurisdiction: str(row, ["jurisdiction"]),
      aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
      recentPermitIds: Array.isArray(row.recentPermitIds) ? row.recentPermitIds.map(String) : [],
      website: str(row, ["websiteUrl"]),
      logoUrl: logoSrc(str(row, ["logoUrl", "logo_url"]), str(row, ["websiteUrl"])),
      hq: str(row, ["hqAddress"]),
      phone: str(row, ["phoneNumber"]),
      founded: str(row, ["yearFounded"]),
      crew: str(row, ["crewCapacityEstimate"]),
      certifications: Array.isArray(row.manufacturerCertifications) ? row.manufacturerCertifications.map((item) => (typeof item === "string" ? item : str(item as Row, ["name", "certification"]))) : [],
      leadership: Array.isArray(row.leadership)
        ? row.leadership.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const person = item as Row;
            const name = str(person, ["name"]);
            if (!name) return [];
            return [{ name, title: str(person, ["title"]), email: str(person, ["email"]), phone: str(person, ["phone"]), linkedin: str(person, ["linkedin"]) }];
          })
        : [],
      ownership: str((row.mAndAProfile ?? {}) as Row, ["ownership_type"]),
      acquisition: str((row.mAndAProfile ?? {}) as Row, ["acquisition_feasibility"]),
      subcontracting: str((row.mAndAProfile ?? {}) as Row, ["subcontracting_suitability"]),
      maNotes: str((row.mAndAProfile ?? {}) as Row, ["notes"]),
      rcatProfileUrl: str(row, ["rcatProfileUrl", "rcat_profile_url"]),
      rcatLicenseNumber: str(row, ["rcatLicenseNumber", "rcat_license_number"]),
      rcatLicenseType: str(row, ["rcatLicenseType", "rcat_license_type"]),
      rcatMemberSince: num(row, ["rcatMemberSince", "rcat_member_since"]) || undefined,
      bbbProfileUrl: str(row, ["bbbProfileUrl", "bbb_profile_url"]),
      bbbRating: str(row, ["bbbRating", "bbb_rating"]),
      bbbAccredited: Boolean(row.bbbAccredited ?? row.bbb_accredited),
      linkedinCompanyUrl: str(row, ["linkedinCompanyUrl", "linkedin_company_url"]),
    })).filter((c) => {
      if (!c.id || !c.name) return false;
      const n = c.name.trim();
      if (n.length < 3 || n.length > 80) return false;
      if (/^(remove|install|replace|add|roof recover)\b/i.test(n)) return false;
      if (/\bsq\s*ft\b|\bsf\s*-/i.test(n)) return false;
      if (/^commercial re-?roof/i.test(n)) return false;
      if (/municipal record|licensed commercial|unknown contractor/i.test(n)) return false;
      return true;
    });
  return {
    total: num(b, ["total_contractors", "total"]),
    valuation: num(b, ["total_industry_valuation_usd"]),
    jurisdiction: str(b, ["jurisdiction_filter"]),
    contractors,
  };
}

export function mapContractorProfile(body: unknown): ContractorProfile | null {
  const b = (body ?? {}) as Row;
  const raw = b.contractor || (Array.isArray(b.leaderboard) ? b.leaderboard[0] : null) || (b.canonicalName ? b : null);
  if (!raw || typeof raw !== "object") return null;
  const list = mapLeaderboard({ leaderboard: [raw] }).contractors;
  return list[0] ?? null;
}

export interface PermitStats {
  totalPermits: number;
  totalValuation: number;
  byCategory: { name: string; count: number }[];
  byRoofSystem: { name: string; count: number }[];
  byJurisdiction: { name: string; count: number }[];
}

export function mapStats(body: unknown): PermitStats {
  const b = (body ?? {}) as Row;
  return {
    totalPermits: num(b, ["total_permits"]),
    totalValuation: num(b, ["total_valuation_usd", "total_pipeline_valuation"]),
    byCategory: counts(b.by_category),
    byRoofSystem: counts(b.by_roof_system),
    byJurisdiction: counts(b.by_jurisdiction),
  };
}

export interface Jobsite {
  id: string;
  permitNumber: string;
  address: string;
  city: string;
  state: string;
  jurisdiction: string;
  contractor: string;
  valuation: number;
  roofSystem: string;
  issued: string;
  status: string;
  category: string;
  scope: string;
  lat: number | null;
  lng: number | null;
}

export interface JobsitePage {
  total: number;
  valuation: number;
  contractors: number;
  roofSystems: { name: string; count: number }[];
  jurisdictions: string[];
  jobsites: Jobsite[];
}

export function mapJobsites(body: unknown): JobsitePage {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total_active_jobs", "total"]),
    valuation: num(b, ["active_pipeline_valuation_usd"]),
    contractors: num(b, ["active_contractors_count"]),
    roofSystems: counts(b.top_roof_systems),
    jurisdictions: Array.isArray(b.jurisdictions_available) ? b.jurisdictions_available.map(String) : [],
    jobsites: rows(body, ["jobsites", "items"]).map((row) => ({
      id: str(row, ["id"]),
      permitNumber: str(row, ["permit_number", "id"]),
      address: str(row, ["address"]),
      city: str(row, ["city"]),
      state: str(row, ["state"]),
      jurisdiction: str(row, ["jurisdiction"]),
      contractor: str(row, ["contractor_name"]),
      valuation: num(row, ["valuation"]),
      roofSystem: str(row, ["roof_system", "probable_roof_system"]),
      issued: str(row, ["issue_date"]).slice(0, 10),
      status: str(row, ["status"]),
      category: str(row, ["category"]),
      scope: str(row, ["scope_description", "description"]),
      lat: coord(row, ["latitude"]),
      lng: coord(row, ["longitude"]),
    })).filter((j) => j.id),
  };
}

export interface AgingRoof {
  id: string;
  permitNumber: string;
  address: string;
  city: string;
  state: string;
  jurisdiction: string;
  installed: string;
  age: number;
  warranty: string;
  risk: string;
  contractor: string;
  replacementCost: number;
  roofSystem: string;
  laterPermits: number;
  priority: number;
  ownerName?: string;
  ownerMail?: string;
  decisionMaker?: string;
  decisionMakerTitle?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  buildingSqft?: number;
  permitCount?: number;
  permitStatus?: "permitted" | "unpermitted";
}

export interface AgingPage {
  total: number;
  pipeline: number;
  critical: number;
  endOfWarranty: number;
  approaching: number;
  jurisdictions: string[];
  roofs: AgingRoof[];
}

export function mapAging(body: unknown): AgingPage {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total_aging_roofs", "total"]),
    pipeline: num(b, ["total_replacement_pipeline_usd", "totalPipeline", "pipeline"]),
    critical: num(b, ["critical_expired_count"]),
    endOfWarranty: num(b, ["end_of_warranty_count"]),
    approaching: num(b, ["approaching_term_count"]),
    jurisdictions: Array.isArray(b.jurisdictions_available) ? b.jurisdictions_available.map(String) : [],
    roofs: rows(body, ["leads", "items"]).map((row) => ({
      id: str(row, ["id"]),
      permitNumber: str(row, ["permit_number", "id"]),
      address: str(row, ["address"]),
      city: str(row, ["city"]),
      state: str(row, ["state"]),
      jurisdiction: str(row, ["jurisdiction"]),
      installed: str(row, ["install_date", "last_permit_date"]).slice(0, 10),
      age: num(row, ["roof_age_years"]),
      warranty: str(row, ["warranty_status"]),
      risk: str(row, ["risk_level", "risk_tier"]),
      contractor: str(row, ["historical_contractor"]),
      replacementCost: num(row, ["estimated_replacement_cost_usd", "estimated_replacement_cost"]),
      roofSystem: str(row, ["roof_system", "probable_roof_system"]),
      laterPermits: num(row, ["subsequent_permits_count"]),
      priority: num(row, ["replacement_priority_score"]),
      ownerName: str(row, ["owner_name", "owner"]),
      ownerMail: str(row, ["owner_mail"]),
      decisionMaker: str(row, ["decision_maker_name", "decision_maker"]),
      decisionMakerTitle: str(row, ["decision_maker_title"]),
      phone: str(row, ["phone_number", "phone"]),
      email: str(row, ["email_address", "email"]),
      websiteUrl: str(row, ["website_url", "website"]),
      logoUrl: str(row, ["logo_url"]),
      buildingSqft: num(row, ["building_sqft"]),
      permitCount: num(row, ["permit_count", "subsequent_permits_count"]),
      permitStatus: (str(row, ["permit_status"]) || (num(row, ["permit_count", "subsequent_permits_count"]) > 0 ? "permitted" : "unpermitted")) as "permitted" | "unpermitted",
    })).filter((r) => r.id),
  };
}

export interface OverdueParcel {
  parcelId: string;
  address: string;
  city: string;
  state: string;
  jurisdiction: string;
  sqft: number;
  yearBuilt: number;
  age: number;
  urgency: string;
  owner: string;
  ownerMail: string;
  propertyType: string;
  reroofValue: number;
  reroofValueFormatted?: string;
  permitCount: number;
  angle: string;
  source: string;
  decisionMaker?: string;
  decisionMakerTitle?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
}

export interface DarkMarketPage {
  total: number;
  pipelineUSD: number;
  pipelineFormatted: string;
  parcels: OverdueParcel[];
}

export function mapDarkMarket(body: unknown): DarkMarketPage {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total"]),
    pipelineUSD: num(b, ["total_pipeline", "totalPipeline"]),
    pipelineFormatted: str(b, ["total_pipeline_formatted", "totalPipelineFormatted"], "$0"),
    parcels: rows(body, ["overdueParcels", "items"]).map((row) => ({
      parcelId: str(row, ["parcelId", "parcel_id"]),
      address: str(row, ["address"]),
      city: str(row, ["city"]),
      state: str(row, ["state"]),
      jurisdiction: str(row, ["jurisdiction"]),
      sqft: num(row, ["buildingSqft", "building_sqft"]),
      yearBuilt: num(row, ["yearBuilt", "year_built"]),
      age: num(row, ["roofAgeYears", "roof_age_years"]),
      urgency: str(row, ["urgency", "overdue_category"]),
      owner: str(row, ["ownerName", "owner_name"]),
      ownerMail: str(row, ["ownerMail", "owner_mail"]),
      propertyType: str(row, ["propertyType", "land_use"]),
      reroofValue: num(row, ["reroofValue", "reroof_value", "estimated_replacement_cost_usd"]),
      reroofValueFormatted: str(row, ["reroofValueFormatted", "reroof_value_formatted"]),
      permitCount: num(row, ["permitCount", "permit_count"]),
      angle: str(row, ["outreachAngle"]),
      source: str(row, ["dataSource", "data_source"]),
      decisionMaker: str(row, ["decisionMaker", "decision_maker_name"]) || undefined,
      decisionMakerTitle: str(row, ["decisionMakerTitle", "decision_maker_title"]) || undefined,
      phone: str(row, ["phone", "phone_number"]) || undefined,
      email: str(row, ["email", "email_address"]) || undefined,
      websiteUrl: str(row, ["websiteUrl", "website_url"]) || undefined,
      logoUrl: str(row, ["logoUrl", "logo_url"]) || undefined,
    })).filter((p) => p.parcelId),
  };
}

export interface EngineParcel {
  id: string;
  address: string;
  city: string;
  county: string;
  state: string;
  sqft: number;
  yearBuilt: number;
  propertyType: string;
  owner: string;
  valuation: number;
  source: string;
  lat: number | null;
  lng: number | null;
}

export function mapParcel(row: Row): EngineParcel {
  return {
    id: str(row, ["id", "parcelId", "parcel_id"]),
    address: str(row, ["address"]),
    city: str(row, ["city"]),
    county: str(row, ["county"]),
    state: str(row, ["state"]),
    sqft: num(row, ["buildingSqft", "building_sqft", "squareFootage", "square_footage"]),
    yearBuilt: num(row, ["yearBuilt", "year_built"]),
    propertyType: str(row, ["property_type", "propertyType", "land_use"]),
    owner: str(row, ["owner_name", "ownerName"]),
    valuation: num(row, ["totalValuation", "total_valuation", "valuation"]),
    source: str(row, ["data_source", "dataSource"]),
    lat: coord(row, ["latitude"]),
    lng: coord(row, ["longitude"]),
  };
}

export function mapParcelSearch(body: unknown) {
  const b = (body ?? {}) as Row;
  return { total: num(b, ["total"]), source: str(b, ["source"]), parcels: rows(body, ["parcels", "items"]).map(mapParcel).filter((p) => p.id) };
}

export interface BrowsePermit {
  id: string;
  permitNumber: string;
  issueDate: string;
  status: string;
  category: string;
  valuation: number;
  valuationFormatted: string;
  description: string;
  contractorName: string;
  contractorPhone: string;
  contractorLicense: string;
  roofSystem: string;
  isPureReroof: boolean;
  sourceSystem: string;
  match: string;
}

export interface BrowseContact {
  role: string;
  name: string;
  phone: string;
  license: string;
  address: string;
  note: string;
}

export interface BrowseSource {
  label: string;
  url: string;
  system: string;
}

export interface BrowseParcel {
  id: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  sqft: number;
  landSqft: number;
  yearBuilt: number;
  propertyType: string;
  owner: string;
  ownerAddress: string;
  ownerCity?: string;
  ownerState?: string;
  ownerZip?: string;
  stories: number;
  valuation: number;
  improvementValuation?: number;
  source: string;
  lat: number | null;
  lng: number | null;
  released: boolean;
  accountNumber?: string;
  improvementSections?: string;
  lastReroofDate?: string;
  lastReroofPermitNo?: string;
  permits?: BrowsePermit[];
  permitCount?: number;
  contacts?: BrowseContact[];
  sources?: BrowseSource[];
  mapsUrl?: string;
  cadUrl?: string;
  permitPortalUrl?: string;
}

export function mapBrowseParcel(row: Row): BrowseParcel {
  return {
    id: str(row, ["id", "parcelId", "parcel_id"]),
    address: str(row, ["address"]),
    city: str(row, ["city"]),
    county: str(row, ["county"]),
    state: str(row, ["state"]),
    zip: str(row, ["zip_code", "zipCode", "zip"]),
    sqft: num(row, ["building_sqft", "buildingSqft", "sqft"]),
    landSqft: num(row, ["land_sqft", "landSqft"]),
    yearBuilt: num(row, ["year_built", "yearBuilt"]),
    propertyType: str(row, ["property_type", "propertyType"]),
    owner: str(row, ["owner_name", "ownerName", "owner"]),
    ownerAddress: str(row, ["owner_address", "ownerAddress"]),
    stories: num(row, ["stories"]),
    valuation: num(row, ["total_valuation", "totalValuation", "valuation"]),
    source: str(row, ["data_source", "dataSource", "source"]),
    lat: coord(row, ["latitude"]),
    lng: coord(row, ["longitude"]),
    released: Boolean(row.released ?? row.is_released ?? row.isReleased),
    accountNumber: str(row, ["account_number", "accountNumber"]) || undefined,
    improvementSections: str(row, ["improvement_sections", "improvementSections"]) || undefined,
    lastReroofDate: str(row, ["last_reroof_date", "lastReroofDate"]) || undefined,
    lastReroofPermitNo: str(row, ["last_reroof_permit_no", "lastReroofPermitNo"]) || undefined,
  };
}

export function mapParcelBrowse(body: unknown) {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total"]),
    source: str(b, ["source"]),
    parcels: rows(body, ["parcels", "items"]).map(mapBrowseParcel).filter((p) => p.id),
  };
}

export function mapBrowseParcelDetail(body: unknown): BrowseParcel {
  const row = (body ?? {}) as Row;
  const base = mapBrowseParcel(row);
  const ownerMail = [
    str(row, ["owner_address", "ownerAddress"]),
    str(row, ["owner_city", "ownerCity"]),
    str(row, ["owner_state", "ownerState"]),
    str(row, ["owner_zip", "ownerZip"]),
  ].filter(Boolean).join(", ");
  return {
    ...base,
    ownerAddress: ownerMail || base.ownerAddress,
    ownerCity: str(row, ["owner_city", "ownerCity"]) || undefined,
    ownerState: str(row, ["owner_state", "ownerState"]) || undefined,
    ownerZip: str(row, ["owner_zip", "ownerZip"]) || undefined,
    improvementValuation: num(row, ["improvement_valuation", "improvementValuation"]) || undefined,
    permitCount: num(row, ["permit_count", "permitCount"]),
    mapsUrl: str(row, ["maps_url", "mapsUrl"]) || undefined,
    cadUrl: str(row, ["cad_url", "cadUrl"]) || undefined,
    permitPortalUrl: str(row, ["permit_portal_url", "permitPortalUrl"]) || undefined,
    permits: rows(row.permits, []).map((p) => ({
      id: str(p, ["id"]),
      permitNumber: str(p, ["permit_number", "permitNumber"]),
      issueDate: str(p, ["issue_date", "issueDate"]).slice(0, 10),
      status: str(p, ["status"]),
      category: str(p, ["category"]),
      valuation: num(p, ["valuation"]),
      valuationFormatted: str(p, ["valuation_formatted", "valuationFormatted"]),
      description: str(p, ["description", "raw_description"]),
      contractorName: str(p, ["contractor_name", "contractorName"]),
      contractorPhone: str(p, ["contractor_phone", "contractorPhone"]),
      contractorLicense: str(p, ["contractor_license", "contractorLicense"]),
      roofSystem: str(p, ["roof_system", "roofSystem", "probable_roof_system"]),
      isPureReroof: Boolean(p.is_pure_reroof ?? p.isPureReroof),
      sourceSystem: str(p, ["source_system", "sourceSystem"]),
      match: str(p, ["match"], "parcel_id"),
    })),
    contacts: rows(row.contacts, []).map((c) => ({
      role: str(c, ["role"]),
      name: str(c, ["name"]),
      phone: str(c, ["phone"]),
      license: str(c, ["license"]),
      address: str(c, ["address"]),
      note: str(c, ["note"]),
    })),
    sources: rows(row.sources, []).map((s) => ({
      label: str(s, ["label"]),
      url: str(s, ["url"]),
      system: str(s, ["system"]),
    })),
  };
}

export interface ParcelContact {
  decisionMakerName: string;
  decisionMakerTitle: string;
  organizationName: string;
  phoneNumber: string;
  phoneType: string;
  emailAddress: string;
  emailStatus: string;
  websiteUrl: string;
  logoUrl?: string;
  tenantOrFacilityName: string;
  confidence: string;
  sourceSystem: string;
  sourceUrl: string;
}

export interface ParcelOfficer {
  name: string;
  title: string;
  role: string;
  address: string;
}

export interface ParcelEntity {
  legalName: string;
  taxpayerId: string;
  sosFileNumber: string;
  sosStatus: string;
  registeredAgentName: string;
  registeredAgentAddress: string;
  mailingAddress: string;
}

export interface ParcelDossier extends EngineParcel {
  account: string;
  jurisdiction: string;
  zip: string;
  landSqft: number;
  improvementValuation: number;
  ownerAddress: string;
  contact?: ParcelContact | null;
  officers?: ParcelOfficer[];
  entity?: ParcelEntity | null;
  yearBuiltSource?: string;
  areaSource?: string;
  dataProvenance?: string;
  provenanceDate?: string;
  retrievedAt?: string;
  sourceRecordId?: string;
  improvementSections?: string;
  footprintSqft?: number;
  stories?: number;
  permits: { id: string; permitNumber: string; issued: string; valuation: string; status: string; roofSystem: string; contractor: string; scope: string }[];
}

export function mapParcelDossier(body: unknown): ParcelDossier {
  const row = (body ?? {}) as Row;
  const rawContact = row.contact as Row | undefined;
  const rawEntity = row.entity as Row | undefined;
  return {
    ...mapParcel(row),
    account: str(row, ["accountNumber"]),
    jurisdiction: str(row, ["jurisdiction"]),
    zip: str(row, ["zipCode", "zip_code"]),
    landSqft: num(row, ["landSqft", "land_sqft"]),
    improvementValuation: num(row, ["improvementValuation"]),
    ownerAddress: str(row, ["ownerAddress"]),
    yearBuiltSource: str(row, ["yearBuiltSource", "year_built_source"]),
    areaSource: str(row, ["areaSource", "area_source"]),
    dataProvenance: str(row, ["dataProvenance", "data_provenance"]),
    provenanceDate: str(row, ["provenanceDate", "provenance_date"]),
    retrievedAt: str(row, ["retrievedAt", "retrieved_at"]),
    sourceRecordId: str(row, ["sourceRecordId", "source_record_id", "accountNumber"]),
    improvementSections: str(row, ["improvementSections", "improvement_sections"]),
    footprintSqft: num(row, ["footprintSqft", "footprint_sqft"]),
    stories: num(row, ["stories"]),
    contact: rawContact ? {
      decisionMakerName: str(rawContact, ["decisionMakerName"]),
      decisionMakerTitle: str(rawContact, ["decisionMakerTitle"]),
      organizationName: str(rawContact, ["organizationName"]),
      phoneNumber: str(rawContact, ["phoneNumber"]),
      phoneType: str(rawContact, ["phoneType"]),
      emailAddress: str(rawContact, ["emailAddress"]),
      emailStatus: str(rawContact, ["emailStatus"]),
      websiteUrl: str(rawContact, ["websiteUrl"]),
      logoUrl: str(rawContact, ["logoUrl", "logo_url"]),
      tenantOrFacilityName: str(rawContact, ["tenantOrFacilityName"]),
      confidence: str(rawContact, ["confidence"]),
      sourceSystem: str(rawContact, ["sourceSystem"]),
      sourceUrl: str(rawContact, ["sourceUrl"]),
    } : null,
    officers: rows(row.officers, []).map((o) => ({
      name: str(o, ["name"]),
      title: str(o, ["title"]),
      role: str(o, ["role"]),
      address: str(o, ["address"]),
    })),
    entity: rawEntity ? {
      legalName: str(rawEntity, ["legalName"]),
      taxpayerId: str(rawEntity, ["taxpayerId"]),
      sosFileNumber: str(rawEntity, ["sosFileNumber"]),
      sosStatus: str(rawEntity, ["sosStatus"]),
      registeredAgentName: str(rawEntity, ["registeredAgentName"]),
      registeredAgentAddress: str(rawEntity, ["registeredAgentAddress"]),
      mailingAddress: str(rawEntity, ["mailingAddress"]),
    } : null,
    permits: rows(row.permits, []).map((p) => ({
      id: str(p, ["id"]),
      permitNumber: str(p, ["permitNumber", "permit_number", "id"]),
      issued: str(p, ["issueDate", "issue_date"]).slice(0, 10),
      valuation: str(p, ["valuationFormatted"], ""),
      status: str(p, ["status"]),
      roofSystem: str(p, ["roofSystem", "roof_system"]),
      contractor: str(p, ["contractorName", "contractor_name"]),
      scope: str(p, ["scopeDescription", "description"]),
    })),
  };
}

export interface ExposureTarget {
  parcelId: string;
  address: string;
  city: string;
  state: string;
  sqft: number;
  yearBuilt: number;
  owner: string;
  storm: string;
  stormDate: string;
  hail: number;
  replacementLow: number;
  replacementHigh: number;
  monthsUnrepaired: number;
  score: number;
  tier: string;
}

export function mapExposure(body: unknown) {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total_targets", "total_unresolved_exposure"]),
    stormName: str(b, ["storm_name"]),
    valuation: num(b, ["total_unresolved_valuation_mid"]),
    targets: rows(body, ["targets", "items"]).map((row): ExposureTarget => ({
      parcelId: str(row, ["parcelId", "parcel_id"]),
      address: str(row, ["address"]),
      city: str(row, ["city"]),
      state: str(row, ["state"]),
      sqft: 0,
      yearBuilt: 0,
      owner: str(row, ["ownerName", "owner_name"]),
      storm: str(row, ["stormName"]),
      stormDate: str(row, ["eventDate", "storm_date"]).slice(0, 10),
      hail: num(row, ["maxHailInches", "hail_size_inches"]),
      replacementLow: num(row, ["estimatedReplacementLow"]),
      replacementHigh: num(row, ["estimatedReplacementHigh"]),
      monthsUnrepaired: num(row, ["monthsUnrepaired", "months_since_storm"]),
      score: num(row, ["unresolvedExposureScore"]),
      tier: str(row, ["leadTier", "urgency_rating"]),
    })).filter((t) => t.address),
  };
}

export interface MultiphaseCampus {
  id: string;
  name: string;
  address: string;
  jurisdiction: string;
  phases: number;
  valuation: number;
  contractors: string[];
}

export function mapMultiphase(body: unknown) {
  const b = (body ?? {}) as Row;
  return {
    total: num(b, ["total_campuses", "total"]),
    campuses: rows(body, ["campuses", "projects", "items"]).map((row): MultiphaseCampus => ({
      id: str(row, ["id", "campus_id", "parcel_id"]) || str(row, ["address"]),
      name: str(row, ["name", "campus_name", "address"]),
      address: str(row, ["address"]),
      jurisdiction: str(row, ["jurisdiction"]),
      phases: num(row, ["phase_count", "phases", "permit_count"]),
      valuation: num(row, ["total_valuation", "total_valuation_usd", "valuation"]),
      contractors: Array.isArray(row.contractors) ? row.contractors.map(String) : [],
    })).filter((c) => c.id),
  };
}

export interface EngineState {
  code: string;
  name: string;
  permits: number;
  cities: number;
  parcels: boolean;
  storms: boolean;
}

export function mapStates(body: unknown): EngineState[] {
  return rows(body, ["states"]).map((row) => ({
    code: str(row, ["state_code"]),
    name: str(row, ["state_name"]),
    permits: num(row, ["total_permits"]),
    cities: num(row, ["city_count"]),
    parcels: Boolean(row.has_parcel_coverage),
    storms: Boolean(row.has_active_storms),
  })).filter((s) => s.code);
}

export interface EngineCity {
  city: string;
  state: string;
  jurisdiction: string;
  permits: number;
  valuation: number;
  parcels: boolean;
  storms: boolean;
  portal: string;
  lat: number | null;
  lng: number | null;
}

export function mapCities(body: unknown): EngineCity[] {
  return rows(body, ["cities"]).map((row) => {
    const city = str(row, ["city"]);
    const state = str(row, ["state"]);
    return {
      city,
      state,
      jurisdiction: `${city}, ${state}`,
      permits: num(row, ["permit_count"]),
      valuation: num(row, ["total_valuation_usd"]),
      parcels: Boolean(row.parcel_coverage),
      storms: Boolean(row.has_active_storms),
      portal: str(row, ["portal_url"]),
      lat: coord(row, ["latitude"]),
      lng: coord(row, ["longitude"]),
    };
  }).filter((c) => c.city && c.state);
}

export interface LiveAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  area: string;
  expires: string;
}

export function mapAlerts(body: unknown): LiveAlert[] {
  return rows(body, ["alerts", "features", "items"]).map((row) => {
    const props = (row.properties && typeof row.properties === "object" ? row.properties : row) as Row;
    return {
      id: str(props, ["id"]) || str(row, ["id"]),
      event: str(props, ["event"]),
      severity: str(props, ["severity"]),
      headline: str(props, ["headline"]),
      area: str(props, ["areaDesc"]),
      expires: str(props, ["expires"]),
    };
  }).filter((a) => a.id && a.event);
}

export interface SwathFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { id: string; name: string; date: string; hail: number; gust: number; tier: string; fill: string; stroke: string };
}

export function mapSwaths(body: unknown): SwathFeature[] {
  return rows(body, ["features", "swaths"]).flatMap((row) => {
    const geometry = row.geometry as SwathFeature["geometry"] | undefined;
    if (!geometry?.type) return [];
    const p = (row.properties ?? row) as Row;
    return [{
      type: "Feature" as const,
      geometry,
      properties: {
        id: str(p, ["id", "storm_id"]),
        name: str(p, ["storm_name"]),
        date: str(p, ["event_date"]).slice(0, 10),
        hail: num(p, ["max_hail_inches"]),
        gust: num(p, ["max_gust_mph", "max_wind_gust_mph"]),
        tier: str(p, ["severity_tier"]),
        fill: str(p, ["fill_color"], "#2563eb"),
        stroke: str(p, ["stroke_color"], "#1d4ed8"),
      },
    }];
  });
}

function dayOf(value: unknown) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function mapHailEventSummary(row: Row): StormSummary | null {
  const date = dayOf(pick(row, ["event_date", "id"]));
  if (!date) return null;
  return {
    id: str(row, ["id"], date),
    date,
    name: str(row, ["name"], date),
    shortName: str(row, ["short_name", "shortName"], date),
    maxHail: num(row, ["max_hail_inches", "maxHail"]),
    reportCount: num(row, ["report_count", "reportCount"]),
  };
}

export interface HailEventsCatalog {
  source: string;
  events: StormSummary[];
  selected: Storm | null;
}

/** Client mapper for GET /storms/hail-events (engine hail-day catalog). */
export function mapHailEvents(body: unknown): HailEventsCatalog {
  const root = (body ?? {}) as Row;
  const eventRows = rows(body, ["events"]);
  const events = eventRows.flatMap((row) => {
    const summary = mapHailEventSummary(row);
    return summary ? [summary] : [];
  });
  const selectedRow = (root.selected && typeof root.selected === "object" ? root.selected : null) as Row | null;
  const summary = selectedRow ? mapHailEventSummary(selectedRow) : null;
  if (!summary) {
    return { source: str(root, ["source"], "Depoii data engine"), events, selected: null };
  }
  const reports: HailReport[] = Array.isArray(selectedRow?.reports)
    ? (selectedRow.reports as Row[]).flatMap((item) => {
        const row = item as Row;
        const id = str(row, ["id"]);
        const lat = num(row, ["latitude", "lat"]);
        const lng = num(row, ["longitude", "lng"]);
        if (!id || !lat || !lng) return [];
        const qualifier = str(row, ["qualifier"]);
        return [{
          id,
          valid: str(row, ["valid"]),
          lat,
          lng,
          inches: num(row, ["hail_inches", "inches"]),
          qualifier: qualifier === "M" || qualifier === "E" ? qualifier : "",
          city: str(row, ["city"]),
          county: str(row, ["county"]),
          source: str(row, ["source"]),
          remark: str(row, ["remark"]),
        }];
      })
    : [];
  const warnings: WarningPolygon[] = Array.isArray(selectedRow?.warnings)
    ? (selectedRow.warnings as Row[]).flatMap((item) => {
        const row = item as Row;
        const geometry = row.geometry as WarningPolygon["geometry"] | undefined;
        if (!geometry?.type) return [];
        const tier = str(row, ["tier"]);
        return [{
          eventId: num(row, ["event_id", "eventId"]),
          hailTag: num(row, ["hail_tag_inches", "hailTag"]),
          windTag: num(row, ["wind_tag_mph", "windTag"]),
          issue: str(row, ["issued", "issue"]),
          expire: str(row, ["expires", "expire"]),
          href: "",
          tier: tier === "core" ? "core" : "envelope",
          basis: str(row, ["basis"]),
          geometry,
        }];
      })
    : [];
  const center = (selectedRow?.center ?? {}) as Row;
  const lng = num(center, ["longitude", "lng"]);
  const lat = num(center, ["latitude", "lat"]);
  return {
    source: str(root, ["source"], "Depoii data engine"),
    events,
    selected: {
      ...summary,
      region: "TX",
      maxHailTag: num(selectedRow ?? {}, ["max_warning_hail_inches", "maxHailTag"]),
      center: [lng || -96.8, lat || 32.78],
      source: str(root, ["source"], "Depoii data engine"),
      reports,
      warnings,
      affectedZips: Array.isArray(selectedRow?.affected_zips)
        ? (selectedRow.affected_zips as unknown[]).map(String)
        : Array.isArray(selectedRow?.affectedZips)
          ? (selectedRow.affectedZips as unknown[]).map(String)
          : [],
    },
  };
}

export interface ScorecardPillar {
  name: string;
  points: number;
  status: string;
  metric: string;
  justification: string;
}

export interface LeadDossier {
  parcelId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  owner: string;
  ownerMail: string;
  propertyType: string;
  sqft: number;
  yearBuilt: number;
  storm: string;
  stormDate: string;
  hail: number;
  joules: number;
  score: number;
  badge: string;
  deal: string;
  pillars: ScorecardPillar[];
  strong: string[];
  weak: string[];
  opening: string;
  urgency: string;
  offer: string;
  roofSystem: string;
  markdown: string;
}

export function mapLeadDossier(body: unknown): LeadDossier {
  const row = (body ?? {}) as Row;
  return {
    parcelId: str(row, ["parcel_id"]),
    address: str(row, ["address"]),
    city: str(row, ["city"]),
    state: str(row, ["state"]),
    zip: str(row, ["zip_code"]),
    owner: str(row, ["owner_name"]),
    ownerMail: str(row, ["owner_mail"]),
    propertyType: str(row, ["property_type"]),
    sqft: 0,
    yearBuilt: 0,
    storm: str(row, ["storm_name"]),
    stormDate: str(row, ["event_date"]).slice(0, 10),
    hail: num(row, ["max_hail_inches"]),
    joules: num(row, ["kinetic_energy_joules"]),
    score: num(row, ["unresolved_exposure_score"]),
    badge: str(row, ["lead_badge"]),
    deal: str(row, ["estimated_replacement_formatted"]),
    pillars: (Array.isArray(row.scorecard_pillars) ? row.scorecard_pillars : []).map((item) => {
      const p = item as Row;
      return {
        name: str(p, ["name"]),
        points: num(p, ["weight_score"]),
        status: str(p, ["status"]),
        metric: str(p, ["metric_value"]),
        justification: str(p, ["justification"]),
      };
    }),
    strong: Array.isArray(row.why_strong_reasons) ? row.why_strong_reasons.map(String) : [],
    weak: Array.isArray(row.why_weak_reasons) ? row.why_weak_reasons.map(String) : [],
    opening: str(row, ["cold_call_opening_hook"]),
    urgency: str(row, ["insurance_urgency_angle"]),
    offer: str(row, ["recommended_inspection_offer"]),
    roofSystem: str(row, ["recommended_roof_system"]),
    markdown: str(row, ["markdown_dossier"]),
  };
}

export interface MondayBrief {
  jurisdiction: string;
  asOf: string;
  stormName: string;
  stormDate: string;
  maxHail: number;
  exposed: number;
  unresolved: number;
  core: number;
  pipeline: number;
  corridor: string;
  deadline: string;
  daysRemaining: number;
  owner: string;
  ownerAddress: string;
  ownerParcelId: string;
  pitchAddress: string;
  pitchHail: number;
  yearBuilt: number;
  membrane: string;
  competitor: string;
  sharePct: number;
  chasers: string[];
  totalOpportunities: number;
  offset: number;
  noActiveTerritory?: boolean;
  territoryMessage?: string;
  isTrial?: boolean;
  trialEndsAt?: string;
  trialDaysRemaining?: number;
  territoryName?: string;
  opportunities: {
    parcelId: string;
    address: string;
    city: string;
    zipCode?: string;
    owner: string;
    ownerMail: string;
    yearBuilt: number;
    sqft: number;
    hail: number;
    tier: string;
    score: number;
    value: number;
    valueLow: number;
    valueHigh: number;
    roofSqft: number;
    priceFlagged: boolean;
    stormId: string;
    unresolved: boolean;
    permitStatus?: string;
    recentActivity?: string;
    lat: number | null;
    lng: number | null;
    decisionMaker?: string;
    decisionTitle?: string;
    organizationName?: string;
    websiteUrl?: string;
    logoUrl?: string;
    phone?: string;
    email?: string;
  }[];
}

export function mapBrief(body: unknown): MondayBrief {
  const row = (body ?? {}) as Row;
  const storm = (row.storm ?? {}) as Row;
  const summary = (row.summary ?? {}) as Row;
  const owner = (row.top_owner ?? {}) as Row;
  const pitch = (row.pitch ?? {}) as Row;
  const competitor = (row.competitor ?? {}) as Row;
  return {
    jurisdiction: str(row, ["jurisdiction"]),
    asOf: str(row, ["as_of"]),
    noActiveTerritory: Boolean(row.no_active_territory),
    territoryMessage: str(row, ["territory_message"]),
    isTrial: Boolean(row.is_trial),
    trialEndsAt: str(row, ["trial_ends_at"]),
    trialDaysRemaining: num(row, ["trial_days_remaining"]),
    territoryName: str(row, ["territory_name"]),
    stormName: str(storm, ["name"]),
    stormDate: str(storm, ["event_date"]).slice(0, 10),
    maxHail: num(storm, ["max_hail_inches"]),
    exposed: num(summary, ["exposed_buildings"]),
    unresolved: num(summary, ["unresolved_buildings"]),
    core: num(summary, ["core_unresolved"]),
    pipeline: 0,
    corridor: str(summary, ["top_corridor"]),
    deadline: str(summary, ["claim_deadline"]).slice(0, 10),
    daysRemaining: num(summary, ["days_remaining"]),
    owner: str(owner, ["name"]),
    ownerAddress: str(owner, ["address"]),
    ownerParcelId: str(owner, ["parcel_id"]),
    pitchAddress: str(pitch, ["address"]),
    pitchHail: num(pitch, ["hail_inches"]),
    yearBuilt: 0,
    membrane: str(pitch, ["membrane"]),
    competitor: str(competitor, ["name"]),
    sharePct: num(competitor, ["share_pct"]),
    chasers: Array.isArray(competitor.storm_chasers) ? competitor.storm_chasers.map(String) : [],
    totalOpportunities: num(row, ["total_opportunities"]) || (Array.isArray(row.opportunities) ? row.opportunities.length : 0),
    offset: num(row, ["offset"]),
    opportunities: (Array.isArray(row.opportunities) ? row.opportunities : []).map((item) => {
      const o = item as Row;
      return {
        parcelId: str(o, ["parcel_id"]),
        address: str(o, ["address"]),
        city: str(o, ["city"]),
        zipCode: str(o, ["zip_code", "zipCode", "zip"]),
        owner: str(o, ["owner"]),
        ownerMail: str(o, ["owner_mail"]),
        yearBuilt: num(o, ["year_built"]),
        sqft: num(o, ["roof_sqft"]) || num(o, ["sqft"]),
        hail: num(o, ["hail_inches"]),
        tier: str(o, ["tier"]),
        score: num(o, ["score"]),
        value: num(o, ["pipeline_value_usd", "value"]) || Math.round((num(o, ["roof_sqft"]) || num(o, ["sqft"])) * 14),
        valueLow: num(o, ["value_low"]),
        valueHigh: num(o, ["value_high"]),
        roofSqft: num(o, ["roof_sqft"]) || num(o, ["sqft"]),
        priceFlagged: Boolean(o.price_flagged),
        stormId: str(o, ["storm_id"]) || str(storm, ["id"]),
        // Only treat explicit true as unresolved; missing/false stay resolved so All shows the pilot book.
        unresolved: o.unresolved === true || o.unresolved === "true" || o.unresolved === 1,
        permitStatus: str(o, ["permit_status"]),
        recentActivity: str(o, ["recent_activity"]),
        lat: coord(o, ["latitude", "lat"]),
        lng: coord(o, ["longitude", "lng", "lon"]),
        decisionMaker: str(o, ["decision_maker_name", "decisionMaker"]),
        decisionTitle: str(o, ["decision_maker_title", "decisionTitle"]),
        organizationName: str(o, ["organization_name", "organizationName"]),
        websiteUrl: str(o, ["website_url", "websiteUrl"]),
        logoUrl: str(o, ["logo_url", "logoUrl"]),
        phone: str(o, ["phone_number", "phone"]),
        email: str(o, ["email_address", "email"]),
      };
    }),
  };
}

export async function engineGet<T>(path: string, params: Record<string, string | number | boolean | undefined | null>, map: (body: unknown) => T, signal?: AbortSignal): Promise<T> {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    q.set(key, String(value));
  }
  const res = await fetch(`/api/engine/${path}${q.size ? `?${q}` : ""}`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && typeof body.error === "string" && body.error) || `The data engine returned HTTP ${res.status}.`);
  return map(body);
}

export interface EvidenceCard {
  status: string;
  score: number;
  verifiedAt: string;
  reason: string;
  cad: { found: boolean; account: string; owner: string; sqft: number; yearBuilt: number; value: number; legal: string; url: string } | null;
  hail: { miles: number; inches: number; location: string; inZone: boolean } | null;
  permits: { status: string; found: number; postStorm: number; checked: string; url: string } | null;
  aerialDate: string;
  hasAerial: boolean;
}

export function mapEvidenceCard(body: unknown): EvidenceCard {
  const b = (body ?? {}) as Row;
  const full = (b.full_evidence ?? {}) as Row;
  const cad = full.cad as Row | undefined;
  const hail = full.hail_proximity as Row | undefined;
  const muni = full.municipal_permits as Row | undefined;
  const aerial = (full.aerial ?? {}) as Row;
  return {
    status: str(b, ["verification_status"], "UNVERIFIED"),
    score: num(b, ["verification_score"]),
    verifiedAt: str(full, ["verified_at"]).slice(0, 10),
    reason: str(full, ["disqualification_reason"]),
    cad: cad ? { found: Boolean(cad.found), account: str(cad, ["account"]), owner: str(cad, ["owner"]), sqft: 0, yearBuilt: 0, value: 0, legal: str(cad, ["legal"]), url: str(cad, ["cad_url"]) } : null,
    hail: hail ? { miles: num(hail, ["distance_miles"]), inches: num(hail, ["hail_size_inches"]), location: str(hail, ["report_location"]), inZone: Boolean(hail.is_in_strike_zone) } : null,
    permits: muni ? { status: str(muni, ["audit_status"]), found: num(muni, ["total_found"]), postStorm: num(muni, ["post_storm_count"]), checked: str(muni, ["portal_check_date"]), url: str(muni, ["portal_url"]) } : null,
    aerialDate: str(b, ["aerial_capture_date"]) || str(aerial, ["capture_date"]),
    hasAerial: Boolean(aerial.success || str(b, ["aerial_snapshot_url"])),
  };
}

export interface VerificationStats {
  breakdown: Record<string, number>;
  verified: number;
  checked: number;
}

export function mapVerificationStats(body: unknown): VerificationStats {
  const raw = ((body ?? {}) as Row).breakdown;
  const breakdown: Record<string, number> = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Row)) breakdown[k] = Number(v) || 0;
  const checked = Object.entries(breakdown).filter(([k]) => k !== "UNVERIFIED").reduce((s, [, v]) => s + v, 0);
  return { breakdown, verified: breakdown.VERIFIED ?? 0, checked };
}

export interface VerificationProgressEvent {
  pct: number;
  step: "HYGIENE" | "HAIL_PROXIMITY" | "CAD_AUDIT" | "PERMITS" | "AERIALS" | "COMPLETE";
  message: string;
  city: string;
  state: string;
  data?: Record<string, unknown>;
}

export interface TriggerVerificationResponse {
  job_id: string;
  jurisdiction: string;
  status: string;
  stream_url: string;
}

export async function triggerCityVerification(
  jurisdiction: string,
  state: string = "TX",
  maxAerials: number = 50,
): Promise<TriggerVerificationResponse> {
  const res = await fetch("/api/engine/verifications/trigger-city", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jurisdiction, state, max_aerials: maxAerials }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to start verification audit." }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
