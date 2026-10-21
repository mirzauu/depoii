import { query, queryOne } from "@/lib/pg";

/**
 * Warehouse repositories: Next.js replacements for the FastAPI read
 * endpoints, querying Supabase Postgres (warehouse schema) directly.
 * Return values intentionally match the FastAPI response shapes consumed
 * by the pure mappers in src/lib/engine-api.ts.
 */

type Q = URLSearchParams;
const str = (q: Q, k: string) => q.get(k)?.trim() || "";
const num = (q: Q, k: string, dflt: number) => {
  const v = Number(q.get(k));
  return Number.isFinite(v) && q.get(k) !== null ? v : dflt;
};
const int = (q: Q, k: string, dflt: number) => Math.trunc(num(q, k, dflt));

// Ported from app/science/lead_quality.py ROOFING_PERMIT_SQL (alias p).
export const ROOFING_SQL = `(
  (lower(coalesce(p.raw_description,'')) like '%roof replacement%' or lower(coalesce(p.raw_description,'')) like '%roof repair%'
   or lower(coalesce(p.raw_description,'')) like '%reroof%' or lower(coalesce(p.raw_description,'')) like '%re-roof%'
   or lower(coalesce(p.raw_description,'')) like '%re roof%' or lower(coalesce(p.raw_description,'')) like '%tear-off%'
   or lower(coalesce(p.raw_description,'')) like '%tear off%' or lower(coalesce(p.raw_description,'')) like '%tpo%'
   or lower(coalesce(p.raw_description,'')) like '%epdm%' or lower(coalesce(p.raw_description,'')) like '%shingle%'
   or lower(coalesce(p.raw_description,'')) like '%single-ply%' or lower(coalesce(p.raw_description,'')) like '%single ply%'
   or lower(coalesce(p.raw_description,'')) like '%modified bitumen%' or lower(coalesce(p.raw_description,'')) like '%built-up%'
   or lower(coalesce(p.raw_description,'')) like '%built up roof%' or lower(coalesce(p.raw_description,'')) like '%roof coating%'
   or lower(coalesce(p.raw_description,'')) like '%roofing%')
  and lower(coalesce(p.raw_description,'')) not like '%solar%' and lower(coalesce(p.raw_description,'')) not like '%photovoltaic%'
  and lower(coalesce(p.raw_description,'')) not like '%scaffold%' and lower(coalesce(p.raw_description,'')) not like '%chain link%'
  and lower(coalesce(p.raw_description,'')) not like '%sidewalk shed%' and lower(coalesce(p.raw_description,'')) not like '%hvac%'
  and lower(coalesce(p.raw_description,'')) not like '%multi-family dwelling%' and lower(coalesce(p.raw_description,'')) not like '%core and shell%'
  and lower(coalesce(p.raw_description,'')) not like '%core & shell%' and lower(coalesce(p.raw_description,'')) not like '%detention tank%'
  and not ((p.square_footage is not null and p.square_footage > 0 and p.valuation / p.square_footage > 1000)
    or (p.valuation > 50000000 and (lower(coalesce(p.raw_description,'')) like '%roof%' or lower(coalesce(p.category,'')) like '%roof%')))
)`;

const BASE_WHERE = `lower(coalesce(p.contractor_name,'')) not like '%licensed%' and lower(coalesce(p.contractor_name,'')) not like '%unknown%' and lower(coalesce(p.normalized_address,'')) not like '%commercial corridor%' and ${ROOFING_SQL}`;

function jurisdictionParts(q: Q): { city?: string; state?: string } {
  const j = str(q, "jurisdiction");
  if (!j) return {};
  const m = j.match(/^(.+?),\s*([A-Za-z]{2})$/);
  if (m) return { city: m[1].trim(), state: m[2].toUpperCase() };
  return { city: j };
}

function permitFilters(q: Q, params: unknown[]): string {
  const clauses = [BASE_WHERE];
  const { city, state } = jurisdictionParts(q);
  const cityParam = str(q, "city") || city;
  const stateParam = (str(q, "state") || state || "").toUpperCase();
  if (cityParam) { params.push(`%${cityParam.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (stateParam) { params.push(stateParam); clauses.push(`upper(p.state) = $${params.length}`); }
  if (str(q, "contractor")) { params.push(`%${str(q, "contractor").toLowerCase()}%`); clauses.push(`lower(p.contractor_name) like $${params.length}`); }
  if (str(q, "category")) { params.push(`%${str(q, "category").toLowerCase()}%`); clauses.push(`lower(p.category) like $${params.length}`); }
  if (str(q, "probable_roof_system")) { params.push(`%${str(q, "probable_roof_system").toLowerCase()}%`); clauses.push(`lower(p.probable_roof_system) like $${params.length}`); }
  if (str(q, "status_filter") && str(q, "status_filter") !== "all") { params.push(`%${str(q, "status_filter").toLowerCase()}%`); clauses.push(`lower(p.status) like $${params.length}`); }
  const mode = str(q, "intelligence_mode");
  if (mode === "active") clauses.push(`p.status in ('Active','Issued')`);
  else if (mode === "aging") clauses.push(`p.issue_date is not null and p.issue_date >= date '1990-01-01' and (extract(year from current_date) - extract(year from p.issue_date)) >= 10 and p.date_quality = 'source'`);
  else if (mode === "hail") clauses.push(`p.is_hail_storm_window = true`);
  if (q.get("min_valuation") !== null) { params.push(num(q, "min_valuation", 0)); clauses.push(`p.valuation >= $${params.length}`); }
  if (q.get("max_valuation") !== null) { params.push(num(q, "max_valuation", 0)); clauses.push(`p.valuation <= $${params.length}`); }
  if (q.get("is_hail_storm_window") !== null) { params.push(q.get("is_hail_storm_window") === "true"); clauses.push(`p.is_hail_storm_window = $${params.length}`); }
  if (str(q, "search")) {
    params.push(`%${str(q, "search").toLowerCase()}%`);
    const i = params.length;
    clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.contractor_name) like $${i} or lower(p.raw_permit_number) like $${i} or lower(p.city) like $${i} or lower(p.raw_description) like $${i})`);
  }
  return clauses.join(" and ");
}

const permitRow = (r: Record<string, unknown>) => ({
  id: r.id, sourceSystem: r.source_system, rawPermitNumber: r.raw_permit_number, jurisdiction: r.jurisdiction,
  state: r.state, county: null, issueDate: r.date_quality === "source" && r.issue_date ? String(r.issue_date).slice(0, 10) : null,
  appliedDate: null, expirationDate: null, status: r.status || "Active", normalizedAddress: r.normalized_address,
  city: r.city, zipCode: r.zip_code || "", latitude: r.geo_quality === "source_point" || r.geo_quality === "geocoded" ? r.latitude : null,
  longitude: r.geo_quality === "source_point" || r.geo_quality === "geocoded" ? r.longitude : null,
  parcelId: r.geo_quality === "source_point" || r.geo_quality === "geocoded" ? r.parcel_id : null,
  valuation: 0, valuationFormatted: "", category: r.category || "Commercial Re-Roof",
  rawDescription: r.raw_description || "Commercial roofing work.", squareFootage: null,
  probableRoofSystem: r.probable_roof_system || "Unspecified", contractorName: r.contractor_name || "Contractor on File",
  contractorLicense: null, contractorPhone: null, isHailStormWindow: Boolean(r.is_hail_storm_window),
  isCompetitorCapture: Boolean(r.is_competitor_capture), associatedStormEvent: r.associated_storm_id,
  confidenceScore: r.confidence_score ?? 90, normalizedAt: r.normalized_at ? String(r.normalized_at) : "2026-10-07",
});

export async function permitsSearch(q: Q) {
  const params: unknown[] = [];
  const where = permitFilters(q, params);
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const agg = await queryOne<{ total: string; val: string }>(`select count(*)::text as total, coalesce(sum(valuation),0)::text as val from warehouse.normalized_permits p where ${where}`, params);
  const order = { valuation_asc: "p.valuation asc nulls last", date_desc: "p.issue_date desc nulls last", date_asc: "p.issue_date asc nulls last" }[str(q, "sort_by")] || "p.valuation desc nulls last";
  const rows = await query(`select p.* from warehouse.normalized_permits p where ${where} order by ${order} limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return { total: Number(agg?.total || 0), count: rows.length, offset, limit, total_valuation: 0, permits: rows.map(permitRow) };
}

export async function permitsStats() {
  const totals = await queryOne<{ n: string; val: string }>(`select count(*)::text as n, coalesce(sum(p.valuation),0)::text as val from warehouse.normalized_permits p where ${BASE_WHERE}`);
  const cats = await query<{ name: string; n: string }>(`select coalesce(p.category,'Unspecified') as name, count(*)::text as n from warehouse.normalized_permits p where ${BASE_WHERE} group by 1`);
  const systems = await query<{ name: string; n: string }>(`select coalesce(nullif(p.probable_roof_system,''),'Unspecified') as name, count(*)::text as n from warehouse.normalized_permits p where ${BASE_WHERE} group by 1`);
  const jurs = await query<{ name: string; n: string }>(`select coalesce(p.jurisdiction,'Unknown') as name, count(*)::text as n from warehouse.normalized_permits p where ${BASE_WHERE} group by 1`);
  const toObj = (rows: { name: string; n: string }[]) => Object.fromEntries(rows.map((r) => [r.name, Number(r.n)]));
  return { total_permits: Number(totals?.n || 0), total_valuation_usd: Number(totals?.val || 0), by_category: toObj(cats), by_roof_system: toObj(systems), by_jurisdiction: toObj(jurs) };
}

export async function permitsCities() {
  const rows = await query<{ city: string }>(`select distinct city from warehouse.normalized_permits where coalesce(city,'') <> '' order by city`);
  return { total_cities: rows.length, cities: rows.map((r) => r.city) };
}

export async function activeJobsites(q: Q) {
  const params: unknown[] = [num(q, "min_valuation", 0)];
  const clauses = [`p.status in ('Active','Issued')`, `p.valuation >= $1`, `lower(p.contractor_name) not like '%licensed%'`, `lower(p.contractor_name) not like '%unknown%'`, `lower(p.contractor_name) not like '%self%contracted%'`, `coalesce(p.contractor_name,'') <> ''`];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  if (str(q, "contractor")) { params.push(`%${str(q, "contractor").toLowerCase()}%`); clauses.push(`lower(p.contractor_name) like $${params.length}`); }
  if (str(q, "roof_system")) { params.push(`%${str(q, "roof_system").toLowerCase()}%`); clauses.push(`lower(p.probable_roof_system) like $${params.length}`); }
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); const i = params.length; clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.raw_permit_number) like $${i} or lower(p.contractor_name) like $${i} or lower(p.city) like $${i})`); }
  const where = clauses.join(" and ");
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const agg = await queryOne<{ total: string; val: string; contractors: string }>(`select count(*)::text as total, coalesce(sum(valuation),0)::text as val, count(distinct contractor_name)::text as contractors from warehouse.normalized_permits p where ${where}`, params);
  const roof = await query<{ name: string; n: string }>(`select probable_roof_system as name, count(*)::text as n from warehouse.normalized_permits p where ${where} group by 1 order by count(*) desc limit 6`, params);
  const jurs = await query<{ jurisdiction: string }>(`select distinct jurisdiction from warehouse.normalized_permits where status in ('Active','Issued') and lower(contractor_name) not like '%licensed%' order by jurisdiction limit 30`);
  const rows = await query(`select p.* from warehouse.normalized_permits p where ${where} order by p.issue_date desc nulls last, p.valuation desc limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  const totalVal = Number(agg?.val || 0);
  return {
    total_active_jobs: Number(agg?.total || 0), active_pipeline_valuation_usd: totalVal,
    active_pipeline_valuation_formatted: totalVal >= 1e9 ? `$${(totalVal / 1e9).toFixed(2)}B` : totalVal >= 1e6 ? `$${(totalVal / 1e6).toFixed(2)}M` : `$${Math.trunc(totalVal).toLocaleString()}`,
    active_contractors_count: Number(agg?.contractors || 0),
    top_roof_systems: Object.fromEntries(roof.filter((r) => r.name).map((r) => [r.name, Number(r.n)])),
    jurisdictions_available: jurs.map((r) => r.jurisdiction),
    jobsites: rows.map((r) => ({
      id: r.id, permit_number: r.raw_permit_number, address: r.normalized_address, city: r.city, state: r.state,
      zip_code: r.zip_code, jurisdiction: r.jurisdiction, contractor_name: r.contractor_name, contractor_id: r.contractor_id,
      contractor_phone: null, contractor_license: null, valuation: 0, valuation_formatted: "",
      roof_system: r.probable_roof_system || "TPO Single-Ply", issue_date: "",
      applied_date: r.applied_date ? String(r.applied_date).slice(0, 10) : null, status: r.status || "Active",
      category: r.category || "Commercial Re-Roof", scope_description: r.raw_description || "Commercial roofing installation and waterproofing.",
      latitude: r.latitude, longitude: r.longitude,
    })),
  };
}

export async function roofAging(q: Q) {
  const params: unknown[] = [int(q, "min_age", 10), num(q, "min_valuation", 0)];
  const age = `(extract(year from current_date) - extract(year from p.issue_date))`;
  const clauses = [`p.date_quality = 'source'`, `p.issue_date is not null`, `p.issue_date >= date '1990-01-01'`, `${age} >= $1`, `p.valuation >= $2`, `lower(coalesce(p.contractor_name,'')) not like '%licensed%'`, `lower(coalesce(p.contractor_name,'')) not like '%unknown%'`];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  const tier = str(q, "risk_tier") || "all";
  if (tier === "critical") clauses.push(`${age} >= 20`);
  else if (tier === "high") clauses.push(`${age} between 15 and 19`);
  else if (tier === "approaching") clauses.push(`${age} between 10 and 14`);
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); const i = params.length; clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.raw_permit_number) like $${i} or lower(p.contractor_name) like $${i} or lower(p.city) like $${i})`); }
  const where = clauses.join(" and ");
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const sum = await queryOne<{ total: string; critical: string; warranty: string; approaching: string }>(
    `select count(*)::text as total, count(case when ${age} >= 20 then 1 end)::text as critical, count(case when ${age} between 15 and 19 then 1 end)::text as warranty, count(case when ${age} between 10 and 14 then 1 end)::text as approaching from warehouse.normalized_permits p where ${where}`, params);
  const jurs = await query<{ jurisdiction: string }>(`select distinct jurisdiction from warehouse.normalized_permits p where p.issue_date is not null and p.issue_date >= date '1990-01-01' and ${age} >= 10 order by jurisdiction`);
  const rows = await query(`select p.*, cast(${age} as integer) as roof_age_years from warehouse.normalized_permits p where ${where} order by roof_age_years desc, p.valuation desc limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return {
    total_aging_roofs: Number(sum?.total || 0), total_replacement_pipeline_usd: 0, total_replacement_pipeline_formatted: "$0",
    critical_expired_count: Number(sum?.critical || 0), end_of_warranty_count: Number(sum?.warranty || 0), approaching_term_count: Number(sum?.approaching || 0),
    jurisdictions_available: jurs.map((r) => r.jurisdiction),
    leads: rows.map((r) => {
      const a = Number(r.roof_age_years || 10);
      const status = a >= 20 ? "Expired Warranty (20+ Yrs)" : a >= 15 ? "Critical End-of-Life (15-19 Yrs)" : "Approaching Term (10-14 Yrs)";
      const risk = a >= 20 ? "CRITICAL" : a >= 15 ? "HIGH" : "ELEVATED";
      const score = a >= 20 ? Math.min(98, 85 + (a - 20) * 2) : a >= 15 ? 75 + (a - 15) * 2 : 55 + (a - 10) * 3;
      const h = Number(r.valuation || 0), repl = h > 0 ? h * 1.65 : 185000;
      const fmt = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v > 0 ? `$${Math.trunc(v).toLocaleString()}` : "$0");
      return {
        id: r.id, permit_number: r.raw_permit_number, address: r.normalized_address, city: r.city, state: r.state, zip_code: r.zip_code,
        jurisdiction: r.jurisdiction, install_date: r.issue_date ? String(r.issue_date).slice(0, 10) : "", roof_age_years: a,
        warranty_status: status, risk_level: risk, historical_contractor: r.contractor_name, historical_contractor_phone: null,
        historical_valuation: h, historical_valuation_formatted: fmt(h), estimated_replacement_cost_usd: repl,
        estimated_replacement_cost_formatted: fmt(repl), roof_system: r.probable_roof_system || "TPO Single-Ply",
        scope_description: r.raw_description || "Commercial roof install.", subsequent_permits_count: 0,
        replacement_priority_score: score, latitude: r.latitude, longitude: r.longitude,
      };
    }),
  };
}

export async function multiphase(q: Q) {
  const params: unknown[] = [int(q, "min_phases", 2), num(q, "min_valuation", 0)];
  const clauses = [`coalesce(p.normalized_address,'') <> ''`];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); const i = params.length; clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.contractor_name) like $${i})`); }
  const where = clauses.join(" and ");
  const limit = int(q, "limit", 30), offset = int(q, "offset", 0);
  const groups = await query<{ key: string; address: string; city: string; state: string; zip_code: string; jurisdiction: string; phases: string; val: string; start: string; end: string; active: string; contractors: string[]; systems: string[] }>(
    `select lower(p.normalized_address)||'|'||lower(p.city) as key, p.normalized_address as address, p.city, p.state, max(p.zip_code) as zip_code, max(p.jurisdiction) as jurisdiction,
            count(*)::text as phases, coalesce(sum(p.valuation),0)::text as val, min(p.issue_date)::text as start, max(p.issue_date)::text as end,
            count(case when p.status in ('Active','Issued') then 1 end)::text as active,
            array_agg(distinct p.contractor_name) as contractors, array_agg(distinct p.probable_roof_system) as systems
     from warehouse.normalized_permits p where ${where}
     group by lower(p.normalized_address), lower(p.city), p.normalized_address, p.city, p.state
     having count(*) >= $1 and coalesce(sum(p.valuation),0) >= $2
     order by count(*) desc, sum(p.valuation) desc limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  const campuses = [];
  for (const g of groups) {
    const phases = await query(`select id, raw_permit_number, issue_date::text as issue_date, valuation, status, probable_roof_system, contractor_name, raw_description from warehouse.normalized_permits where lower(normalized_address)=lower($1) and lower(city)=lower($2) order by issue_date`, [g.address, g.city]);
    const val = Number(g.val || 0);
    campuses.push({
      campus_key: g.key, address: g.address, city: g.city, state: g.state, zip_code: g.zip_code, jurisdiction: g.jurisdiction,
      total_phases: Number(g.phases), total_campus_valuation_usd: val,
      total_campus_valuation_formatted: val >= 1e6 ? `$${(val / 1e6).toFixed(2)}M` : `$${Math.trunc(val).toLocaleString()}`,
      project_span_start: (g.start || "").slice(0, 10), project_span_end: (g.end || "").slice(0, 10),
      active_phases_count: Number(g.active || 0), completed_phases_count: Number(g.phases) - Number(g.active || 0),
      participating_contractors: (g.contractors || []).filter(Boolean), roof_systems_detected: (g.systems || []).filter(Boolean),
      development_status: Number(g.active || 0) > 0 ? "Active Multi-Phase Build" : "Completed Mega-Campus",
      phases: phases.map((p) => ({
        permit_id: p.id, permit_number: p.raw_permit_number, issue_date: (p.issue_date || "").slice(0, 10),
        valuation: Number(p.valuation || 0), valuation_formatted: `$${Math.trunc(Number(p.valuation || 0)).toLocaleString()}`,
        status: p.status || "Active", roof_system: p.probable_roof_system || "", contractor_name: p.contractor_name || "",
        scope_description: p.raw_description || "",
      })),
    });
  }
  const totalVal = campuses.reduce((s, c) => s + c.total_campus_valuation_usd, 0);
  const jurs = await query<{ jurisdiction: string }>(`select distinct jurisdiction from warehouse.normalized_permits order by jurisdiction limit 30`);
  return {
    total_campuses: campuses.length, total_campus_pipeline_usd: totalVal,
    total_campus_pipeline_formatted: totalVal >= 1e6 ? `$${(totalVal / 1e6).toFixed(2)}M` : `$${Math.trunc(totalVal).toLocaleString()}`,
    total_permits_across_campuses: campuses.reduce((s, c) => s + c.total_phases, 0),
    jurisdictions_available: jurs.map((r) => r.jurisdiction), campuses,
  };
}

export async function permitsParcel(parcelId: string) {
  const parcel = await queryOne(`select * from warehouse.parcels where id = $1 or account_number = $1`, [parcelId]);
  if (!parcel) return null;
  const permits = await query(`select * from warehouse.normalized_permits where parcel_id = $1 order by issue_date desc nulls last`, [parcel.id]);
  return {
    ...parcelRowBase(parcel), accountNumber: parcel.account_number || "", jurisdiction: parcel.jurisdiction || "",
    zipCode: parcel.zip_code || "", landSqft: Number(parcel.land_sqft || 0), improvementValuation: Number(parcel.improvement_valuation || 0),
    ownerAddress: parcel.owner_address || "",
    permits: permits.map((p) => ({
      id: p.id, permitNumber: p.raw_permit_number, issueDate: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
      valuationFormatted: p.valuation_formatted || "", status: p.status || "", roofSystem: p.probable_roof_system || "",
      contractorName: p.contractor_name || "", scopeDescription: p.raw_description || "",
    })),
  };
}

function parcelRowBase(r: Record<string, unknown>) {
  return {
    id: r.id, address: r.address, city: r.city, county: r.county || "", state: r.state, zip_code: r.zip_code || "",
    building_sqft: Number(r.building_sqft || 0), land_sqft: Number(r.land_sqft || 0), year_built: Number(r.year_built || 0),
    property_type: r.property_type || "", owner_name: r.owner_name || "", total_valuation: Number(r.total_valuation || 0),
    data_source: r.data_source || "", latitude: r.latitude, longitude: r.longitude,
  };
}

export async function contractors(q: Q) {
  const params: unknown[] = [];
  const clauses = [`lower(coalesce(p.contractor_name,'')) not like '%licensed%'`, `lower(coalesce(p.contractor_name,'')) not like '%unknown%'`, `coalesce(p.contractor_name,'') <> ''`, ROOFING_SQL];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); clauses.push(`lower(p.contractor_name) like $${params.length}`); }
  const where = clauses.join(" and ");
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const totals = await queryOne<{ n: string; val: string }>(`select count(distinct p.contractor_name)::text as n, coalesce(sum(p.valuation),0)::text as val from warehouse.normalized_permits p where ${where}`, params);
  const totalVal = Number(totals?.val || 0);
  const rows = await query(
    `select p.contractor_name as name, count(*)::text as permits, coalesce(sum(p.valuation),0)::text as val,
            (array_agg(p.probable_roof_system order by p.valuation desc))[1] as roof_system,
            (array_agg(p.jurisdiction order by p.valuation desc))[1] as jurisdiction,
            (array_agg(p.contractor_license))[1] as license,
            array_agg(p.id order by p.issue_date desc nulls last) as recent_ids,
            c.id as cid, c.website_url, c.hq_address, c.phone_number, c.year_founded::text as founded,
            c.crew_capacity_estimate, c.manufacturer_certifications, c.leadership, c.m_and_a_profile,
            c.rcat_profile_url, c.rcat_license_number, c.rcat_license_type, c.rcat_member_since,
            c.bbb_profile_url, c.bbb_rating, c.bbb_accredited, c.linkedin_company_url
     from warehouse.normalized_permits p
     left join warehouse.canonical_contractors c on lower(c.canonical_name) = lower(p.contractor_name)
     where ${where} group by p.contractor_name, c.id, c.website_url, c.hq_address, c.phone_number, c.year_founded,
       c.crew_capacity_estimate, c.manufacturer_certifications, c.leadership, c.m_and_a_profile, c.rcat_profile_url,
       c.rcat_license_number, c.rcat_license_type, c.rcat_member_since, c.bbb_profile_url, c.bbb_rating, c.bbb_accredited, c.linkedin_company_url
     order by sum(p.valuation) desc limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  const parse = (v: unknown) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; } };
  return {
    total_contractors: Number(totals?.n || 0), total_industry_valuation_usd: totalVal,
    jurisdiction_filter: str(q, "jurisdiction"),
    leaderboard: rows.map((r) => {
      const val = Number(r.val || 0);
      return {
        canonicalId: r.cid || r.name, canonicalName: r.name, licenseNumber: r.license || "",
        permitCount: Number(r.permits || 0), totalValuationUSD: val,
        totalValuationFormatted: val >= 1e6 ? `$${(val / 1e6).toFixed(2)}M` : `$${Math.trunc(val).toLocaleString()}`,
        marketSharePct: totalVal > 0 ? (val / totalVal) * 100 : 0, primaryRoofSystem: r.roof_system || "",
        jurisdiction: r.jurisdiction || "", aliases: [], recentPermitIds: (r.recent_ids || []).slice(0, 10),
        websiteUrl: r.website_url || "", logoUrl: "", hqAddress: r.hq_address || "", phoneNumber: r.phone_number || "",
        yearFounded: r.founded || "", crewCapacityEstimate: r.crew_capacity_estimate || "",
        manufacturerCertifications: parse(r.manufacturer_certifications) || [], leadership: parse(r.leadership) || [],
        mAndAProfile: parse(r.m_and_a_profile) || {}, rcatProfileUrl: r.rcat_profile_url || "",
        rcatLicenseNumber: r.rcat_license_number || "", rcatLicenseType: r.rcat_license_type || "",
        rcatMemberSince: r.rcat_member_since || 0, bbbProfileUrl: r.bbb_profile_url || "", bbbRating: r.bbb_rating || "",
        bbbAccredited: Boolean(r.bbb_accredited), linkedinCompanyUrl: r.linkedin_company_url || "",
      };
    }),
  };
}

export async function locations(kind: "hierarchy" | "states" | "cities") {
  const states = await query<{ state: string; n: string; val: string; cities: string }>(
    `select upper(state) as state, count(*)::text as n, coalesce(sum(valuation),0)::text as val, count(distinct city)::text as cities from warehouse.normalized_permits group by upper(state) order by count(*) desc`);
  const cityRows = await query<{ city: string; state: string; n: string; val: string; parcels: string }>(
    `select p.city, upper(p.state) as state, count(*)::text as n, coalesce(sum(p.valuation),0)::text as val,
            coalesce(pa.n, '0') as parcels
     from warehouse.normalized_permits p
     left join (select lower(city) as c, upper(state) as s, count(*)::text as n from warehouse.parcels group by lower(city), upper(state)) pa
       on pa.c = lower(p.city) and pa.s = upper(p.state)
     where coalesce(p.city,'') <> '' group by p.city, upper(p.state), pa.n order by count(*) desc`);
  const stateNames: Record<string, string> = { TX: "Texas", OH: "Ohio", WA: "Washington", FL: "Florida", NY: "New York", CA: "California", IL: "Illinois", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland" };
  const cities = cityRows.map((r) => ({
    city: r.city, state: r.state, permit_count: Number(r.n), total_valuation_usd: Number(r.val),
    roof_categories: {}, top_contractors: [], parcel_coverage: Number(r.parcels) > 0,
    parcel_source: Number(r.parcels) > 0 ? "County CAD" : "", storm_coverage: false,
  }));
  if (kind === "cities") return cities;
  const stateList = states.map((s) => ({
    state_code: s.state, state_name: stateNames[s.state] || s.state, total_permits: Number(s.n),
    total_valuation_usd: Number(s.val), city_count: Number(s.cities),
    has_parcel_coverage: cities.some((c) => c.state === s.state && c.parcel_coverage), has_active_storms: false,
    cities: cities.filter((c) => c.state === s.state),
  }));
  if (kind === "states") return stateList;
  return {
    total_states: stateList.length, total_cities: cities.length,
    total_permits: stateList.reduce((s, x) => s + x.total_permits, 0),
    total_valuation_usd: stateList.reduce((s, x) => s + x.total_valuation_usd, 0), states: stateList,
  };
}

function parcelFilters(q: Q, params: unknown[], alias = "p"): string {
  const clauses = [`coalesce(${alias}.is_mock,false) = false`];
  const city = str(q, "city"), state = str(q, "state");
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(${alias}.city) like $${params.length}`); }
  if (state) { params.push(state.toUpperCase()); clauses.push(`upper(${alias}.state) = $${params.length}`); }
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); const i = params.length; clauses.push(`(lower(${alias}.address) like $${i} or lower(${alias}.owner_name) like $${i} or lower(${alias}.id) like $${i} or lower(coalesce(${alias}.account_number,'')) like $${i})`); }
  if (q.get("min_sqft")) { params.push(int(q, "min_sqft", 0)); clauses.push(`${alias}.building_sqft >= $${params.length}`); }
  if (q.get("min_age")) { params.push(int(q, "min_age", 0)); clauses.push(`${alias}.year_built > 0 and (extract(year from current_date) - ${alias}.year_built) >= $${params.length}`); }
  return clauses.join(" and ");
}

export async function parcelsSearch(q: Q) {
  const params: unknown[] = [];
  const where = parcelFilters(q, params);
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const total = await queryOne<{ n: string }>(`select count(*)::text as n from warehouse.parcels p where ${where}`, params);
  const rows = await query(`select p.* from warehouse.parcels p where ${where} order by p.building_sqft desc nulls last limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return { total: Number(total?.n || 0), source: "Depoii data engine", parcels: rows.map(parcelRowBase) };
}

export async function parcelsBrowse(q: Q) {
  const params: unknown[] = [];
  const where = parcelFilters(q, params);
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const total = await queryOne<{ n: string }>(`select count(*)::text as n from warehouse.parcels p where ${where}`, params);
  const rows = await query(
    `select p.*, owner_address, stories, exists(select 1 from warehouse.released_leads r where r.parcel_id = p.id) as released
     from warehouse.parcels p where ${where} order by p.building_sqft desc nulls last limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return {
    total: Number(total?.n || 0), source: "Depoii data engine",
    parcels: rows.map((r) => ({ ...parcelRowBase(r), owner_address: r.owner_address || "", stories: Number(r.stories || 0), released: Boolean(r.released) })),
  };
}

export async function parcelBrowseDetail(id: string) {
  const r = await queryOne(`select p.*, exists(select 1 from warehouse.released_leads rl where rl.parcel_id = p.id) as released from warehouse.parcels p where p.id = $1 or p.account_number = $1`, [id]);
  if (!r) return null;
  const permits = await query(`select * from warehouse.normalized_permits where parcel_id = $1 order by issue_date desc nulls last`, [r.id]);
  const evidence = await query<{ field_name: string; stored_value: string }>(`select field_name, stored_value from warehouse.lead_evidence where parcel_id = $1`, [r.id]);
  const ev = Object.fromEntries(evidence.map((e) => [e.field_name, e.stored_value]));
  return {
    ...parcelRowBase(r), owner_address: r.owner_address || "", owner_city: r.owner_city || "", owner_state: r.owner_state || "",
    owner_zip: r.owner_zip || "", stories: Number(r.stories || 0), improvement_valuation: Number(r.improvement_valuation || 0),
    account_number: r.account_number || "", improvement_sections: r.improvement_sections || "",
    last_reroof_date: r.last_reroof_date || "", last_reroof_permit_no: r.last_reroof_permit_no || "",
    permit_count: permits.length, released: Boolean(r.released),
    maps_url: r.latitude && r.longitude ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : "",
    permits: permits.map((p) => ({
      id: p.id, permit_number: p.raw_permit_number, issue_date: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
      status: p.status || "", category: p.category || "", valuation: Number(p.valuation || 0),
      valuation_formatted: p.valuation_formatted || "", description: p.raw_description || "",
      contractor_name: p.contractor_name || "", contractor_phone: p.contractor_phone || "",
      contractor_license: p.contractor_license || "", roof_system: p.probable_roof_system || "",
      is_pure_reroof: Boolean(p.is_pure_reroof), source_system: p.source_system || "", match: "parcel_id",
    })),
    contacts: [], sources: Object.keys(ev).length ? [{ label: "Lead evidence", url: "", system: "Depoii" }] : [],
  };
}

export async function darkMarket(q: Q) {
  const params: unknown[] = [int(q, "min_age", 20), int(q, "min_sqft", 0)];
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const where = `p.year_built > 0 and (extract(year from current_date) - p.year_built) >= $1 and p.building_sqft >= $2 and coalesce(p.is_mock,false)=false
    and not exists (select 1 from warehouse.normalized_permits np where np.parcel_id = p.id and np.is_pure_reroof = true and np.issue_date > current_date - interval '15 years')`;
  const total = await queryOne<{ n: string }>(`select count(*)::text as n from warehouse.parcels p where ${where}`, params);
  const rows = await query(
    `select p.*, (select count(*)::text from warehouse.normalized_permits np where np.parcel_id = p.id) as permit_count
     from warehouse.parcels p where ${where} order by (extract(year from current_date) - p.year_built) desc, p.building_sqft desc
     limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return {
    total: Number(total?.n || 0), count: rows.length, minAge: params[0], minSqft: params[1], limit, offset,
    overdueParcels: rows.map((r) => {
      const age = new Date().getFullYear() - Number(r.year_built || 0);
      return {
        parcelId: r.id, address: r.address, city: r.city, state: r.state, jurisdiction: r.jurisdiction || `${r.city}, ${r.state}`,
        buildingSqft: Number(r.building_sqft || 0), yearBuilt: Number(r.year_built || 0), roofAgeYears: age,
        urgency: age >= 30 ? "CRITICAL" : age >= 25 ? "HIGH" : "ELEVATED", overdue_category: age >= 30 ? "CRITICAL" : age >= 25 ? "HIGH" : "ELEVATED",
        ownerName: r.owner_name || "", ownerMail: [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(", "),
        propertyType: r.property_type || "", permitCount: Number(r.permit_count || 0),
        outreachAngle: "No re-roof permit in 15+ years", dataSource: r.data_source || "",
      };
    }),
  };
}
