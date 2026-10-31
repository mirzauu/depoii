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

const memCache = new Map<string, { exp: number; val: unknown }>();
const inflightCache = new Map<string, Promise<unknown>>();

export function withCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = memCache.get(key);
  if (hit && hit.exp > Date.now()) {
    return Promise.resolve(hit.val as T);
  }
  const pending = inflightCache.get(key);
  if (pending) {
    return pending as Promise<T>;
  }
  const promise = fetcher()
    .then((val) => {
      memCache.set(key, { exp: Date.now() + ttlMs, val });
      inflightCache.delete(key);
      return val;
    })
    .catch((err) => {
      inflightCache.delete(key);
      throw err;
    });
  inflightCache.set(key, promise);
  return promise;
}

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
  else if (mode === "pre_permit") clauses.push(`(
    p.is_pre_permit = true
    or p.status in ('Under Review','Plan Review','Payment Due',
                     'Application Accepted','Pre-Permit','Architect Registered',
                     'In Review','INRVW','Inrvw','NEW','New','Revisions Required',
                     'Additional Info Required','Document Received','Pending','APPRVD')
    or (p.applied_date is not null and p.issue_date is null)
    or p.source_system = 'TDLR_TABS'
  )`);
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

const toIsoDate = (d: unknown): string | null => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s.slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const permitRow = (r: Record<string, unknown>) => ({
  id: r.id, sourceSystem: r.source_system, rawPermitNumber: r.raw_permit_number, jurisdiction: r.jurisdiction,
  state: r.state, county: null, issueDate: r.date_quality === "source" && r.issue_date ? toIsoDate(r.issue_date) : null,
  appliedDate: toIsoDate(r.applied_date),
  expirationDate: toIsoDate(r.expiration_date),
  status: r.status || "Active", normalizedAddress: r.normalized_address,
  city: r.city, zipCode: r.zip_code || "", latitude: r.geo_quality === "source_point" || r.geo_quality === "geocoded" ? r.latitude : null,
  longitude: r.geo_quality === "source_point" || r.geo_quality === "geocoded" ? r.longitude : null,
  parcelId: r.geo_quality === "source_point" || r.geo_quality === "geocoded" ? r.parcel_id : null,
  valuation: r.valuation != null ? Number(r.valuation) : 0, valuationFormatted: (r.valuation_formatted as string) || "",
  category: r.category || "Commercial Re-Roof",
  rawDescription: r.raw_description || "Commercial roofing work.", squareFootage: r.square_footage != null ? Number(r.square_footage) : null,
  probableRoofSystem: r.probable_roof_system || "Unspecified", contractorName: r.contractor_name || "Contractor on File",
  contractorLicense: r.contractor_license || null, contractorPhone: r.contractor_phone || null, isHailStormWindow: Boolean(r.is_hail_storm_window),
  isCompetitorCapture: Boolean(r.is_competitor_capture), associatedStormEvent: r.associated_storm_id,
  confidenceScore: r.confidence_score ?? 90, normalizedAt: toIsoDate(r.normalized_at) || "2026-10-07",
  isPrePermit: Boolean(r.is_pre_permit),
  bidWindowStatus: (r.bid_window_status as string) || null,
  architectName: (r.architect_name as string) || null,
  designFirm: (r.design_firm as string) || null,
  ownerPhone: (r.owner_phone as string) || null,
});

export async function permitsSearch(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
      return { total: 0, count: 0, offset, limit, total_valuation: 0, permits: [], no_active_territory: true };
    }
  }

  const params: unknown[] = [];
  const whereClauses: string[] = [];
  const baseWhere = permitFilters(q, params);
  if (baseWhere) whereClauses.push(baseWhere);
  if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    params.push(allowedZips.map((z) => z.slice(0, 5)));
    whereClauses.push(`substring(coalesce(p.zip_code, '') from 1 for 5) = ANY($${params.length})`);
  }
  const where = whereClauses.join(" and ");
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const agg = await queryOne<{ total: string; val: string }>(`select count(*)::text as total, coalesce(sum(valuation),0)::text as val from warehouse.normalized_permits p where ${where}`, params);
  const order = { valuation_asc: "p.valuation asc nulls last", date_desc: "p.issue_date desc nulls last", date_asc: "p.issue_date asc nulls last" }[str(q, "sort_by")] || "p.valuation desc nulls last";
  const rows = await query(`select p.* from warehouse.normalized_permits p where ${where} order by ${order} limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return { total: Number(agg?.total || 0), count: rows.length, offset, limit, total_valuation: Number(agg?.val || 0), permits: rows.map(permitRow) };
}

export async function permitsStats() {
  return withCache("permitsStats", 5 * 60 * 1000, async () => {
    const [totals, cats, systems, jurs] = await Promise.all([
      queryOne<{ n: string; val: string }>(`select count(*)::text as n, coalesce(sum(p.valuation),0)::text as val from warehouse.normalized_permits p where ${BASE_WHERE}`),
      query<{ name: string; n: string }>(`select coalesce(p.category,'Unspecified') as name, count(*)::text as n from warehouse.normalized_permits p where ${BASE_WHERE} group by 1`),
      query<{ name: string; n: string }>(`select coalesce(nullif(p.probable_roof_system,''),'Unspecified') as name, count(*)::text as n from warehouse.normalized_permits p where ${BASE_WHERE} group by 1`),
      query<{ name: string; n: string }>(`select coalesce(p.jurisdiction,'Unknown') as name, count(*)::text as n from warehouse.normalized_permits p where ${BASE_WHERE} group by 1`),
    ]);
    const toObj = (rows: { name: string; n: string }[]) => Object.fromEntries(rows.map((r) => [r.name, Number(r.n)]));
    return {
      total_permits: Number(totals?.n || 0),
      total_valuation_usd: Number(totals?.val || 0),
      by_category: toObj(cats),
      by_roof_system: toObj(systems),
      by_jurisdiction: toObj(jurs),
    };
  });
}

export async function prePermitStats(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      return { total_pre_permit: 0, total_valuation: 0, by_status: {}, by_source: {}, no_active_territory: true };
    }
  }

  const params: unknown[] = [];
  const prePermitCondition = `(
    p.is_pre_permit = true
    or p.status in ('Under Review','Plan Review','Payment Due','Application Accepted','Pre-Permit','Architect Registered','In Review','INRVW','Inrvw','NEW','New','Revisions Required','Additional Info Required','Document Received','Pending','APPRVD')
    or (p.applied_date is not null and p.issue_date is null)
    or p.source_system = 'TDLR_TABS'
  )`;
  const clauses = [BASE_WHERE, prePermitCondition];
  const { city, state } = jurisdictionParts(q);
  const cityParam = str(q, "city") || city;
  const stateParam = (str(q, "state") || state || "").toUpperCase();
  if (cityParam) { params.push(`%${cityParam.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (stateParam) { params.push(stateParam); clauses.push(`upper(p.state) = $${params.length}`); }
  if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    params.push(allowedZips.map((z) => z.slice(0, 5)));
    clauses.push(`substring(coalesce(p.zip_code, '') from 1 for 5) = ANY($${params.length})`);
  }
  const where = clauses.join(" and ");

  const agg = await queryOne<{ n: string; val: string }>(`
    select count(*)::text as n, coalesce(sum(p.valuation),0)::text as val
    from warehouse.normalized_permits p where ${where}
  `, params);

  const byStatus = await query<{ status: string; n: string }>(`
    select coalesce(p.bid_window_status, p.status, 'Under Review') as status, count(*)::text as n
    from warehouse.normalized_permits p where ${where}
    group by 1 order by count(*) desc limit 10
  `, params);

  const bySource = await query<{ source: string; n: string }>(`
    select coalesce(p.source_system, 'DallasNow') as source, count(*)::text as n
    from warehouse.normalized_permits p where ${where}
    group by 1 order by count(*) desc
  `, params);

  return {
    total_pre_permit: Number(agg?.n || 0),
    total_valuation: Number(agg?.val || 0),
    by_status: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    by_source: Object.fromEntries(bySource.map((r) => [r.source, Number(r.n)])),
  };
}

export async function permitsCities() {
  const rows = await query<{ city: string }>(`select distinct city from warehouse.normalized_permits where coalesce(city,'') <> '' order by city`);
  return { total_cities: rows.length, cities: rows.map((r) => r.city) };
}

export async function activeJobsites(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      return {
        total_active_jobs: 0,
        active_pipeline_valuation_usd: 0,
        active_pipeline_valuation_formatted: "$0",
        active_contractors_count: 0,
        top_roof_systems: {},
        jurisdictions_available: [],
        jobsites: [],
        no_active_territory: true,
      };
    }
  }

  const params: unknown[] = [num(q, "min_valuation", 0)];
  const clauses = [`p.status in ('Active','Issued')`, `p.valuation >= $1`, `lower(p.contractor_name) not like '%licensed%'`, `lower(p.contractor_name) not like '%unknown%'`, `lower(p.contractor_name) not like '%self%contracted%'`, `coalesce(p.contractor_name,'') <> ''`];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  if (str(q, "contractor")) { params.push(`%${str(q, "contractor").toLowerCase()}%`); clauses.push(`lower(p.contractor_name) like $${params.length}`); }
  if (str(q, "roof_system")) { params.push(`%${str(q, "roof_system").toLowerCase()}%`); clauses.push(`lower(p.probable_roof_system) like $${params.length}`); }
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); const i = params.length; clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.raw_permit_number) like $${i} or lower(p.contractor_name) like $${i} or lower(p.city) like $${i})`); }
  if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    params.push(allowedZips.map(z => z.slice(0, 5)));
    clauses.push(`substring(coalesce(p.zip_code, '') from 1 for 5) = ANY($${params.length})`);
  }
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

export async function roofAging(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const zone = str(q, "zone");
  const limit = int(q, "limit", 100), offset = int(q, "offset", 0);
  const search = str(q, "search");
  const tier = str(q, "risk_tier") || "all";
  const permitStatus = str(q, "permit_status") || "all";
  const minAgeParam = int(q, "min_age", 10);
  const minValParam = num(q, "min_valuation", 0);

  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  let subscribedTerritories: { id: string; name: string; zipCodes: string[] }[] = [];

  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    subscribedTerritories = subs.map((s) => ({
      id: s.id,
      name: s.name,
      zipCodes: s.zipCodes || [],
    }));

    if (subscribedTerritories.length === 0) {
      return {
        total_aging_roofs: 0,
        total_replacement_pipeline_usd: 0,
        total_replacement_pipeline_formatted: "$0",
        critical_expired_count: 0,
        end_of_warranty_count: 0,
        approaching_term_count: 0,
        jurisdictions_available: ["Dallas, TX", "Fort Worth, TX"],
        no_active_territory: true,
        unauthorized_zone: false,
        territory_message: "Your organization does not have an active territory subscription. Subscribe to a zone in Territories to unlock lead intelligence.",
        leads: [],
      };
    }

    if (zone && zone !== "all") {
      const match = subscribedTerritories.find((t) => t.id === zone);
      if (!match) {
        return {
          total_aging_roofs: 0,
          total_replacement_pipeline_usd: 0,
          total_replacement_pipeline_formatted: "$0",
          critical_expired_count: 0,
          end_of_warranty_count: 0,
          approaching_term_count: 0,
          jurisdictions_available: ["Dallas, TX", "Fort Worth, TX"],
          no_active_territory: false,
          unauthorized_zone: true,
          territory_message: `Your organization is not subscribed to ${zone}. Subscribe in Territories to access lead intelligence for this zone.`,
          leads: [],
        };
      }
    }

    allowedZips = subscribedTerritories.flatMap((t) => t.zipCodes);
  }

  // If a specific territory zone is selected (e.g. 'dallas-central-uptown' or any zone):
  if (zone && zone !== "all") {
    let zips: string[] = [];
    const match = subscribedTerritories.find((t) => t.id === zone);
    if (match?.zipCodes?.length) {
      zips = match.zipCodes;
    } else {
      const terr = await queryOne<{ zip_codes: string[] }>(`SELECT zip_codes FROM app.territories WHERE id = $1`, [zone]);
      if (terr?.zip_codes?.length) zips = terr.zip_codes;
    }
    if (zips.length === 0 && (zone === "dallas-central-uptown" || zone.includes("central") || zone.includes("uptown"))) {
      zips = ["75201", "75204", "75205", "75206", "75219", "75225"];
    }

    if (zips.length > 0) {
      const zClauses = [
        `s.zip_code = ANY($1)`,
        `(2026 - coalesce(s.year_built, 1995)) >= $2`,
      ];
      const zParams: unknown[] = [zips, minAgeParam];

      if (permitStatus === "permitted") {
        zClauses.push(`exists (select 1 from warehouse.normalized_permits np where np.parcel_id = s.parcel_id)`);
      } else if (permitStatus === "unpermitted" || permitStatus === "no_permit") {
        zClauses.push(`not exists (select 1 from warehouse.normalized_permits np where np.parcel_id = s.parcel_id)`);
      }

      if (minValParam > 0) {
        zParams.push(minValParam);
        zClauses.push(`coalesce(s.estimated_replacement_mid, (coalesce(s.building_sqft, 25000) * 14.5)::bigint) >= $${zParams.length}`);
      }

      if (tier === "critical") {
        zClauses.push(`(2026 - coalesce(s.year_built, 1995)) >= 20`);
      } else if (tier === "high") {
        zClauses.push(`(2026 - coalesce(s.year_built, 1995)) between 15 and 19`);
      } else if (tier === "approaching") {
        zClauses.push(`(2026 - coalesce(s.year_built, 1995)) between 10 and 14`);
      }

      if (search) {
        zParams.push(`%${search.toLowerCase()}%`);
        const idx = zParams.length;
        zClauses.push(`(lower(s.address) like $${idx} or lower(coalesce(s.owner_name,'')) like $${idx} or lower(s.city) like $${idx} or lower(s.parcel_id) like $${idx})`);
      }

      const zWhere = zClauses.join(" and ");

      const sumKey = `roof_aging_sum_${JSON.stringify(zParams)}_${zWhere}`;
      const sumPromise = withCache(sumKey, 60 * 1000, () =>
        queryOne<{ total: string; pipeline: string; critical: string; warranty: string; approaching: string }>(
          `SELECT
             COUNT(*)::text AS total,
             COALESCE(SUM(coalesce(s.estimated_replacement_mid, (coalesce(s.building_sqft, 25000) * 14.5)::bigint)), 0)::text AS pipeline,
             COUNT(CASE WHEN (2026 - coalesce(s.year_built, 1995)) >= 20 THEN 1 END)::text AS critical,
             COUNT(CASE WHEN (2026 - coalesce(s.year_built, 1995)) BETWEEN 15 AND 19 THEN 1 END)::text AS warranty,
             COUNT(CASE WHEN (2026 - coalesce(s.year_built, 1995)) BETWEEN 10 AND 14 THEN 1 END)::text AS approaching
           FROM warehouse.scored_parcel_leads s
           WHERE ${zWhere}`,
          zParams
        )
      );

      const rowsPromise = query<any>(
        `WITH top_leads AS (
           SELECT s.*
           FROM warehouse.scored_parcel_leads s
           WHERE ${zWhere}
           ORDER BY s.exposure_score DESC NULLS LAST, s.estimated_replacement_mid DESC NULLS LAST
           LIMIT $${zParams.length + 1} OFFSET $${zParams.length + 2}
         )
         SELECT
           s.parcel_id as id,
           s.parcel_id as permit_number,
           s.address,
           s.city,
           s.state,
           s.zip_code,
           'Dallas, TX' as jurisdiction,
           coalesce(p.last_reroof_date, (s.year_built || '-06-01')) as install_date,
           (2026 - coalesce(s.year_built, p.year_built, 1995)) as roof_age_years,
           s.building_sqft,
           coalesce(lc.organization_name, s.owner_name, p.owner_name) as owner_name,
           s.property_type,
           coalesce(s.estimated_replacement_mid, (coalesce(s.building_sqft, p.footprint_sqft, 25000) * 14.5)::bigint) as estimated_replacement_cost_usd,
           coalesce(s.exposure_score, 82) as replacement_priority_score,
           p.latitude,
           p.longitude,
           p.owner_address,
           p.owner_city,
           p.owner_state,
           p.owner_zip,
           lc.decision_maker_name,
           lc.decision_maker_title,
           lc.phone_number,
           lc.email_address,
           lc.website_url,
           lc.logo_url,
           (SELECT COUNT(*) FROM warehouse.normalized_permits np WHERE np.parcel_id = s.parcel_id) AS permit_count
         FROM top_leads s
         LEFT JOIN warehouse.parcels p ON p.id = s.parcel_id
         LEFT JOIN warehouse.lead_contacts lc ON lc.parcel_id = s.parcel_id`,
        [...zParams, limit, offset]
      );

      const [sum, rows] = await Promise.all([sumPromise, rowsPromise]);

      const totalPipe = Number(sum?.pipeline || 0);
      const fmtPipe = totalPipe >= 1e6 ? `$${(totalPipe / 1e6).toFixed(2)}M` : `$${Math.trunc(totalPipe).toLocaleString()}`;

      return {
        total_aging_roofs: Number(sum?.total || 0),
        total_replacement_pipeline_usd: totalPipe,
        total_replacement_pipeline_formatted: fmtPipe,
        critical_expired_count: Number(sum?.critical || 0),
        end_of_warranty_count: Number(sum?.warranty || 0),
        approaching_term_count: Number(sum?.approaching || 0),
        jurisdictions_available: ["Dallas, TX", "Fort Worth, TX"],
        no_active_territory: false,
        unauthorized_zone: false,
        leads: rows.map((r: any) => {
          const a = Number(r.roof_age_years || 25);
          const status = a >= 20 ? "Expired Warranty (20+ Yrs)" : a >= 15 ? "Critical End-of-Life (15-19 Yrs)" : "Approaching Term (10-14 Yrs)";
          const risk = a >= 20 ? "CRITICAL" : a >= 15 ? "HIGH" : "ELEVATED";
          const repl = Number(r.estimated_replacement_cost_usd || 185000);
          const fmt = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v > 0 ? `$${Math.trunc(v).toLocaleString()}` : "$0");
          const ownerMail = [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(", ");
          return {
            id: r.id,
            permit_number: r.permit_number,
            address: r.address,
            city: r.city,
            state: r.state,
            zip_code: r.zip_code,
            jurisdiction: r.jurisdiction,
            install_date: r.install_date ? String(r.install_date).slice(0, 10) : "",
            roof_age_years: a,
            warranty_status: status,
            risk_level: risk,
            historical_contractor: r.owner_name || "Commercial Building Owner",
            historical_contractor_phone: r.phone_number || null,
            historical_valuation: repl,
            historical_valuation_formatted: fmt(repl),
            estimated_replacement_cost_usd: repl,
            estimated_replacement_cost_formatted: fmt(repl),
            roof_system: r.property_type ? `${r.property_type} (Low-Slope Membrane)` : "Commercial Low-Slope Membrane",
            scope_description: `Building constructed ${String(r.install_date || "1980").slice(0, 4)} (${a} yrs old). Prime candidate for commercial roof membrane replacement.`,
            subsequent_permits_count: Number(r.permit_count || 0),
            permit_count: Number(r.permit_count || 0),
            permit_status: Number(r.permit_count || 0) > 0 ? "permitted" : "unpermitted",
            replacement_priority_score: Number(r.replacement_priority_score || 80),
            latitude: r.latitude,
            longitude: r.longitude,
            owner_name: r.owner_name || null,
            owner_mail: ownerMail || null,
            decision_maker_name: r.decision_maker_name || null,
            decision_maker_title: r.decision_maker_title || null,
            phone_number: r.phone_number || null,
            email_address: r.email_address || null,
            website_url: r.website_url || null,
            logo_url: r.logo_url || null,
            building_sqft: Number(r.building_sqft || 0),
          };
        }),
      };
    }
  }

  const params: unknown[] = [int(q, "min_age", 10), num(q, "min_valuation", 0)];
  const age = `(extract(year from current_date) - extract(year from p.issue_date))`;
  const clauses = [
    `p.date_quality in ('source', 'public_record', 'substituted')`,
    `p.issue_date is not null`,
    `p.issue_date >= date '1990-01-01'`,
    `${age} >= $1`,
    `p.valuation >= $2`,
    `lower(coalesce(p.contractor_name,'')) not like '%licensed%'`,
    `lower(coalesce(p.contractor_name,'')) not like '%unknown%'`
  ];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    params.push(allowedZips.map(z => z.slice(0, 5)));
    clauses.push(`substring(coalesce(p.zip_code, '') from 1 for 5) = ANY($${params.length})`);
  }
  if (tier === "critical") clauses.push(`${age} >= 20`);
  else if (tier === "high") clauses.push(`${age} between 15 and 19`);
  else if (tier === "approaching") clauses.push(`${age} between 10 and 14`);
  if (search) { params.push(`%${search.toLowerCase()}%`); const i = params.length; clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.raw_permit_number) like $${i} or lower(p.contractor_name) like $${i} or lower(p.city) like $${i})`); }
  const where = clauses.join(" and ");
  const sum = await queryOne<{ total: string; critical: string; warranty: string; approaching: string }>(
    `select count(*)::text as total, count(case when ${age} >= 20 then 1 end)::text as critical, count(case when ${age} between 15 and 19 then 1 end)::text as warranty, count(case when ${age} between 10 and 14 then 1 end)::text as approaching from warehouse.normalized_permits p where ${where}`, params);
  const jurs = await query<{ jurisdiction: string }>(`select distinct jurisdiction from warehouse.normalized_permits p where p.issue_date is not null and p.issue_date >= date '1990-01-01' and ${age} >= 10 order by jurisdiction`);
  const rows = await query(`
    select 
      p.*, 
      cast(${age} as integer) as roof_age_years,
      coalesce(lc.organization_name, par.owner_name) as enriched_owner_name,
      par.owner_address,
      par.owner_city,
      par.owner_state,
      par.owner_zip,
      lc.decision_maker_name,
      lc.decision_maker_title,
      lc.phone_number,
      lc.email_address,
      lc.website_url,
      lc.logo_url
    from warehouse.normalized_permits p 
    left join warehouse.parcels par on par.id = p.parcel_id
    left join warehouse.lead_contacts lc on lc.parcel_id = p.parcel_id
    where ${where} 
    order by roof_age_years desc, p.valuation desc 
    limit ${params.length + 1} offset ${params.length + 2}
  `, [...params, limit, offset]);

  return {
    total_aging_roofs: Number(sum?.total || 0), total_replacement_pipeline_usd: 0, total_replacement_pipeline_formatted: "$0",
    critical_expired_count: Number(sum?.critical || 0), end_of_warranty_count: Number(sum?.warranty || 0), approaching_term_count: Number(sum?.approaching || 0),
    jurisdictions_available: jurs.map((r) => r.jurisdiction),
    no_active_territory: false,
    unauthorized_zone: false,
    leads: rows.map((r: any) => {
      const a = Number(r.roof_age_years || 10);
      const status = a >= 20 ? "Expired Warranty (20+ Yrs)" : a >= 15 ? "Critical End-of-Life (15-19 Yrs)" : "Approaching Term (10-14 Yrs)";
      const risk = a >= 20 ? "CRITICAL" : a >= 15 ? "HIGH" : "ELEVATED";
      const score = a >= 20 ? Math.min(98, 85 + (a - 20) * 2) : a >= 15 ? 75 + (a - 15) * 2 : 55 + (a - 10) * 3;
      const h = Number(r.valuation || 0), repl = h > 0 ? h * 1.65 : 185000;
      const fmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v > 0 ? `${Math.trunc(v).toLocaleString()}` : "$0");
      const ownerMail = [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(", ");
      return {
        id: r.id, permit_number: r.raw_permit_number, address: r.normalized_address, city: r.city, state: r.state, zip_code: r.zip_code,
        jurisdiction: r.jurisdiction, install_date: r.issue_date ? String(r.issue_date).slice(0, 10) : "", roof_age_years: a,
        warranty_status: status, risk_level: risk, historical_contractor: r.contractor_name, historical_contractor_phone: r.phone_number || null,
        historical_valuation: h, historical_valuation_formatted: fmt(h), estimated_replacement_cost_usd: repl,
        estimated_replacement_cost_formatted: fmt(repl), roof_system: r.probable_roof_system || "TPO Single-Ply",
        scope_description: r.raw_description || "Commercial roof install.",
        subsequent_permits_count: 1,
        permit_count: 1,
        permit_status: "permitted",
        replacement_priority_score: score, latitude: r.latitude, longitude: r.longitude,
        owner_name: r.enriched_owner_name || null,
        owner_mail: ownerMail || null,
        decision_maker_name: r.decision_maker_name || null,
        decision_maker_title: r.decision_maker_title || null,
        phone_number: r.phone_number || null,
        email_address: r.email_address || null,
        website_url: r.website_url || null,
        logo_url: r.logo_url || null,
      };
    }),
  };
}

export async function multiphase(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      return {
        total_campuses: 0,
        total_campus_pipeline_usd: 0,
        total_campus_pipeline_formatted: "$0",
        total_permits_across_campuses: 0,
        jurisdictions_available: [],
        campuses: [],
        no_active_territory: true,
      };
    }
  }

  const params: unknown[] = [int(q, "min_phases", 2), num(q, "min_valuation", 0)];
  const clauses = [`coalesce(p.normalized_address,'') <> ''`];
  const { city, state } = jurisdictionParts(q);
  if (city) { params.push(`%${city.toLowerCase()}%`); clauses.push(`lower(p.city) like $${params.length}`); }
  if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
  if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); const i = params.length; clauses.push(`(lower(p.normalized_address) like $${i} or lower(p.contractor_name) like $${i})`); }
  if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    params.push(allowedZips.map(z => z.slice(0, 5)));
    clauses.push(`substring(coalesce(p.zip_code, '') from 1 for 5) = ANY($${params.length})`);
  }
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
  const rawId = parcelId;
  const strippedId = parcelId.replace(/^DCAD-PARCEL-/i, "");
  const prefixedId = parcelId.startsWith("DCAD-PARCEL-") ? parcelId : `DCAD-PARCEL-${parcelId}`;

  const parcel = await queryOne(
    `select * from warehouse.parcels
     where id = $1 or id = $2 or id = $3
        or account_number = $1 or account_number = $2 or account_number = $3
     limit 1`,
    [rawId, strippedId, prefixedId]
  );
  if (!parcel) return null;
  const permits = await query(
    `select * from warehouse.normalized_permits
     where parcel_id = $1 or parcel_id = $2 or parcel_id = $3
     order by issue_date desc nulls last`,
    [parcel.id, parcel.account_number || parcel.id, strippedId]
  );
  const contact = await queryOne<{
    decision_maker_name: string;
    decision_maker_title: string;
    organization_name: string;
    phone_number: string;
    phone_type: string;
    email_address: string;
    email_status: string;
    website_url: string;
    logo_url: string;
    tenant_or_facility_name: string;
    confidence: string;
    source_system: string;
    source_url: string;
  }>(
    `select * from warehouse.lead_contacts where parcel_id = $1 or account_number = $2 or parcel_id = $3 limit 1`,
    [parcel.id, parcel.account_number, parcelId]
  );
  const officers = await query<{
    person_name: string;
    title_raw: string;
    person_role: string;
    address: string;
  }>(
    `select person_name, title_raw, person_role, address from warehouse.owner_persons where lower(owner_name_normalized) = lower($1) limit 5`,
    [parcel.owner_name]
  );
  const entity = await queryOne<{
    entity_legal_name: string;
    taxpayer_id: string;
    sos_file_number: string;
    sos_status: string;
    registered_agent_name: string;
    registered_agent_address: string;
    mailing_address: string;
  }>(
    `select * from warehouse.owner_entities where lower(owner_name_normalized) = lower($1)`,
    [parcel.owner_name]
  );

  return {
    ...parcelRowBase(parcel),
    accountNumber: parcel.account_number || "",
    jurisdiction: parcel.jurisdiction || "",
    zipCode: parcel.zip_code || "",
    landSqft: Number(parcel.land_sqft || 0),
    improvementValuation: Number(parcel.improvement_valuation || 0),
    ownerAddress: parcel.owner_address || "",
    contact: contact ? {
      decisionMakerName: contact.decision_maker_name || "",
      decisionMakerTitle: contact.decision_maker_title || "",
      organizationName: contact.organization_name || "",
      phoneNumber: contact.phone_number || "",
      phoneType: contact.phone_type || "",
      emailAddress: contact.email_address || "",
      emailStatus: contact.email_status || "",
      websiteUrl: contact.website_url || "",
      logoUrl: contact.logo_url || "",
      tenantOrFacilityName: contact.tenant_or_facility_name || "",
      confidence: contact.confidence || "",
      sourceSystem: contact.source_system || "",
      sourceUrl: contact.source_url || "",
    } : null,
    officers: officers.map((o) => ({
      name: o.person_name,
      title: o.title_raw || "",
      role: o.person_role || "",
      address: o.address || "",
    })),
    entity: entity ? {
      legalName: entity.entity_legal_name || "",
      taxpayerId: entity.taxpayer_id || "",
      sosFileNumber: entity.sos_file_number || "",
      sosStatus: entity.sos_status || "",
      registeredAgentName: entity.registered_agent_name || "",
      registeredAgentAddress: entity.registered_agent_address || "",
      mailingAddress: entity.mailing_address || "",
    } : null,
    yearBuiltSource: parcel.year_built_source || "",
    areaSource: parcel.area_source || "",
    dataProvenance: parcel.data_provenance || "",
    provenanceDate: parcel.provenance_date ? String(parcel.provenance_date) : "",
    retrievedAt: parcel.retrieved_at ? String(parcel.retrieved_at) : "",
    sourceRecordId: parcel.source_record_id || parcel.account_number || parcel.id,
    improvementSections: parcel.improvement_sections ? String(parcel.improvement_sections) : "",
    footprintSqft: Number(parcel.footprint_sqft || 0),
    stories: Number(parcel.stories || 0),
    permits: permits.map((p) => ({
      id: p.id,
      permitNumber: p.raw_permit_number,
      issueDate: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
      valuationFormatted: p.valuation_formatted || "",
      status: p.status || "",
      roofSystem: p.probable_roof_system || "",
      contractorName: p.contractor_name || "",
      scopeDescription: p.raw_description || "",
      sourceSystem: p.source_system || p.data_source || "",
      sourceUrl: p.source_url || "",
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
  const cacheKey = `contractors_${q.toString()}`;
  return withCache(cacheKey, 10 * 60 * 1000, async () => {
    const params: unknown[] = [];
    const clauses = [
      `lower(coalesce(p.contractor_name,'')) not like '%licensed%'`,
      `lower(coalesce(p.contractor_name,'')) not like '%unknown%'`,
      `lower(coalesce(p.contractor_name,'')) not like '%municipal record%'`,
      `lower(coalesce(p.contractor_name,'')) not like 'pending %'`,
      `lower(coalesce(p.contractor_name,'')) not like 'commercial re-roof%'`,
      `lower(coalesce(p.contractor_name,'')) not like 'roof recover%'`,
      `lower(coalesce(p.contractor_name,'')) not like 'tear off%'`,
      `length(trim(p.contractor_name)) between 3 and 80`,
      `coalesce(p.contractor_name,'') <> ''`,
      ROOFING_SQL,
    ];
    const { city, state } = jurisdictionParts(q);
    if (city) {
      if (city.includes("%")) {
        params.push(city.toLowerCase());
        clauses.push(`lower(p.city) like $${params.length}`);
      } else {
        params.push(city.toLowerCase());
        clauses.push(`lower(p.city) = $${params.length}`);
      }
    }
    if (state) { params.push(state); clauses.push(`upper(p.state) = $${params.length}`); }
    if (str(q, "search")) { params.push(`%${str(q, "search").toLowerCase()}%`); clauses.push(`lower(p.contractor_name) like $${params.length}`); }
    if (str(q, "roof_system")) { params.push(`%${str(q, "roof_system").toLowerCase()}%`); clauses.push(`lower(coalesce(p.probable_roof_system,'')) like $${params.length}`); }

    const havingClauses: string[] = [];
    const minP = num(q, "min_permits", 0);
    if (minP > 0) {
      params.push(int(q, "min_permits", 0));
      havingClauses.push(`count(*) >= $${params.length}`);
    }
    const minV = num(q, "min_valuation", 0);
    if (minV > 0) {
      params.push(minV);
      havingClauses.push(`coalesce(sum(p.valuation),0) >= $${params.length}`);
    }
    const having = havingClauses.length ? `having ${havingClauses.join(" and ")}` : "";

    const where = clauses.join(" and ");
    const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
    const hasContact = str(q, "has_contact") === "true";

    const totalsSql = having || hasContact
      ? `with base as (
           select p.contractor_name, coalesce(sum(p.valuation),0) as val
           from warehouse.normalized_permits p
           ${hasContact ? "inner join warehouse.canonical_contractors c on lower(c.canonical_name) = lower(p.contractor_name) and ((c.phone_number is not null and trim(c.phone_number) <> '') or (c.website_url is not null and trim(c.website_url) <> ''))" : ""}
           where ${where}
           group by p.contractor_name
           ${having}
         )
         select count(*)::text as n, coalesce(sum(val),0)::text as val from base`
      : `select count(distinct p.contractor_name)::text as n, coalesce(sum(p.valuation),0)::text as val
         from warehouse.normalized_permits p
         where ${where}`;

    const totalsCacheKey = `totals_${where}_${hasContact}_${having}_${params.map(String).join("_")}`;
    const totalsPromise = withCache(totalsCacheKey, 30 * 60 * 1000, () => queryOne<{ n: string; val: string }>(totalsSql, params));

    const sortBy = str(q, "sort_by");
    let orderSql = "order by sum(p.valuation) desc nulls last";
    if (sortBy === "permits_desc") orderSql = "order by count(*) desc, sum(p.valuation) desc nulls last";
    else if (sortBy === "name_asc") orderSql = "order by p.contractor_name asc";

    const rowsPromise = query(
      `with top_contractors as (
         select p.contractor_name as name,
                count(*)::text as permits,
                coalesce(sum(p.valuation),0)::text as val,
                coalesce((array_agg(p.probable_roof_system) filter (where p.probable_roof_system is not null and p.probable_roof_system <> ''))[1], max(p.probable_roof_system)) as roof_system,
                coalesce((array_agg(p.jurisdiction) filter (where p.jurisdiction is not null and p.jurisdiction <> ''))[1], max(p.jurisdiction)) as jurisdiction,
                coalesce((array_agg(p.contractor_license) filter (where p.contractor_license is not null and p.contractor_license <> ''))[1], max(p.contractor_license)) as license
         from warehouse.normalized_permits p
         ${hasContact ? "inner join warehouse.canonical_contractors c on lower(c.canonical_name) = lower(p.contractor_name) and ((c.phone_number is not null and trim(c.phone_number) <> '') or (c.website_url is not null and trim(c.website_url) <> ''))" : ""}
         where ${where}
         group by p.contractor_name
         ${having}
         ${orderSql}
         limit $${params.length + 1} offset $${params.length + 2}
       )
       select tc.*,
              (select array_agg(p2.id) from (
                 select id from warehouse.normalized_permits p2
                 where p2.contractor_name = tc.name
                 order by p2.issue_date desc nulls last
                 limit 10
              ) p2) as recent_ids,
              c.id as cid, c.website_url, c.hq_address, c.phone_number, c.year_founded::text as founded,
              c.crew_capacity_estimate, c.manufacturer_certifications, c.leadership, c.m_and_a_profile,
              c.rcat_profile_url, c.rcat_license_number, c.rcat_license_type, c.rcat_member_since,
              c.bbb_profile_url, c.bbb_rating, c.bbb_accredited, c.linkedin_company_url
       from top_contractors tc
       ${hasContact ? "inner" : "left"} join warehouse.canonical_contractors c on lower(c.canonical_name) = lower(tc.name)`,
      [...params, limit, offset],
    );

    const [totals, rows] = await Promise.all([totalsPromise, rowsPromise]);
    const totalVal = Number(totals?.val || 0);

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
  });
}

export async function contractorProfile(q: Q) {
  const target = str(q, "name") || str(q, "id");
  if (!target) return { contractor: null };

  const parse = (v: unknown) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; } };

  // 1. Look up in canonical_contractors
  const canonicalRow = await queryOne<Record<string, any>>(
    `select c.*
     from warehouse.canonical_contractors c
     where lower(c.canonical_name) = lower($1)
        or c.id = $1
        or lower(c.canonical_name) like lower($1) || ' %'
        or lower($1) like lower(c.canonical_name) || ' %'
        or lower(c.canonical_name) like lower(split_part($1, ' (', 1)) || '%'
     order by 
       case 
         when lower(c.canonical_name) = lower($1) then 0 
         when c.id = $1 then 1
         else 2 
       end
     limit 1`,
    [target]
  );

  const matchedName = canonicalRow?.canonical_name || target;

  // 2. Aggregate permits metrics for this contractor across permits
  const pAgg = await queryOne<Record<string, any>>(
    `select count(*)::text as permits,
            coalesce(sum(p.valuation),0)::text as val,
            (array_agg(p.probable_roof_system order by p.valuation desc))[1] as roof_system,
            (array_agg(p.jurisdiction order by p.valuation desc))[1] as jurisdiction,
            (array_agg(p.contractor_license))[1] as license,
            (select array_agg(p2.id) from (
               select id from warehouse.normalized_permits p2
               where lower(p2.contractor_name) = lower($1)
                  or lower(p2.contractor_name) = lower($2)
                  or lower(p2.contractor_name) like lower(split_part($1, ' (', 1)) || '%'
               order by p2.issue_date desc nulls last
               limit 10
            ) p2) as recent_ids
     from warehouse.normalized_permits p
     where lower(p.contractor_name) = lower($1)
        or lower(p.contractor_name) = lower($2)
        or lower(p.contractor_name) like lower(split_part($1, ' (', 1)) || '%'`,
    [matchedName, target]
  );

  const val = Number(pAgg?.val || 0) || Number(canonicalRow?.total_valuation || 0);
  const permitCount = Number(pAgg?.permits || 0) || Number(canonicalRow?.total_permits || 0);

  const profile = {
    canonicalId: canonicalRow?.id || target,
    canonicalName: canonicalRow?.canonical_name || target,
    licenseNumber: canonicalRow?.primary_license || pAgg?.license || "",
    permitCount,
    totalValuationUSD: val,
    totalValuationFormatted: val >= 1e6 ? `$${(val / 1e6).toFixed(2)}M` : `$${Math.trunc(val).toLocaleString()}`,
    marketSharePct: 0,
    primaryRoofSystem: pAgg?.roof_system || canonicalRow?.primary_roof_system || "",
    jurisdiction: pAgg?.jurisdiction || "Dallas, TX",
    aliases: [],
    recentPermitIds: (pAgg?.recent_ids || []).slice(0, 10),
    websiteUrl: canonicalRow?.website_url || "",
    logoUrl: "",
    hqAddress: canonicalRow?.hq_address || (canonicalRow?.headquarters_city ? `${canonicalRow.headquarters_city}, ${canonicalRow.headquarters_state || "TX"}` : ""),
    phoneNumber: canonicalRow?.phone_number || "",
    yearFounded: canonicalRow?.year_founded ? String(canonicalRow.year_founded) : (canonicalRow?.founded || ""),
    crewCapacityEstimate: canonicalRow?.crew_capacity_estimate || "",
    manufacturerCertifications: parse(canonicalRow?.manufacturer_certifications) || [],
    leadership: parse(canonicalRow?.leadership) || [],
    mAndAProfile: parse(canonicalRow?.m_and_a_profile) || {},
    rcatProfileUrl: canonicalRow?.rcat_profile_url || "",
    rcatLicenseNumber: canonicalRow?.rcat_license_number || "",
    rcatLicenseType: canonicalRow?.rcat_license_type || "",
    rcatMemberSince: canonicalRow?.rcat_member_since || 0,
    bbbProfileUrl: canonicalRow?.bbb_profile_url || "",
    bbbRating: canonicalRow?.bbb_rating || "",
    bbbAccredited: Boolean(canonicalRow?.bbb_accredited),
    linkedinCompanyUrl: canonicalRow?.linkedin_company_url || "",
  };

  return { contractor: profile, leaderboard: [profile] };
}

export async function locations(kind: "hierarchy" | "states" | "cities") {
  return withCache(`locations_${kind}`, 10 * 60 * 1000, async () => {
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
  });
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

export async function parcelsSearch(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      return { total: 0, source: "Depoii data engine", parcels: [], no_active_territory: true };
    }
  }

  const params: unknown[] = [];
  const baseWhere = parcelFilters(q, params);
  const clauses = [baseWhere];
  if (allowedZips && allowedZips.length > 0) {
    params.push(allowedZips);
    clauses.push(`substring(coalesce(p.zip_code,''), 1, 5) = ANY($${params.length})`);
  }
  const where = clauses.join(" and ");

  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const total = await queryOne<{ n: string }>(`select count(*)::text as n from warehouse.parcels p where ${where}`, params);
  const rows = await query(`select p.* from warehouse.parcels p where ${where} order by p.building_sqft desc nulls last limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return { total: Number(total?.n || 0), source: "Depoii data engine", parcels: rows.map(parcelRowBase), no_active_territory: false };
}

export async function parcelsBrowse(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      return { total: 0, source: "Depoii data engine", parcels: [], no_active_territory: true };
    }
  }

  const params: unknown[] = [];
  const baseWhere = parcelFilters(q, params);
  const clauses = [baseWhere];
  if (allowedZips && allowedZips.length > 0) {
    params.push(allowedZips);
    clauses.push(`substring(coalesce(p.zip_code,''), 1, 5) = ANY($${params.length})`);
  }
  const where = clauses.join(" and ");

  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const total = await queryOne<{ n: string }>(`select count(*)::text as n from warehouse.parcels p where ${where}`, params);
  const rows = await query(
    `select p.*, owner_address, stories, 
            exists(select 1 from warehouse.released_leads r where r.parcel_id = p.id) as released,
            exists(select 1 from warehouse.lead_contacts lc where (lc.parcel_id = p.id or lc.account_number = p.account_number) and lc.email_status = 'VERIFIED' and lc.confidence = 'HIGH') as has_contact
     from warehouse.parcels p where ${where} order by p.building_sqft desc nulls last limit $${params.length + 1} offset $${params.length + 2}`, [...params, limit, offset]);
  return {
    total: Number(total?.n || 0), source: "Depoii data engine",
    parcels: rows.map((r) => ({ 
      ...parcelRowBase(r), 
      owner_address: r.owner_address || "", 
      stories: Number(r.stories || 0), 
      released: Boolean(r.released),
      has_contact: Boolean(r.has_contact),
    })),
    no_active_territory: false,
  };
}

export async function parcelBrowseDetail(id: string) {
  const r = await queryOne(`select p.*, exists(select 1 from warehouse.released_leads rl where rl.parcel_id = p.id) as released from warehouse.parcels p where p.id = $1 or p.account_number = $1`, [id]);
  if (!r) return null;
  const permits = await query(`select * from warehouse.normalized_permits where parcel_id = $1 order by issue_date desc nulls last`, [r.id]);
  const evidence = await query<{ field_name: string; stored_value: string }>(`select field_name, stored_value from warehouse.lead_evidence where parcel_id = $1`, [r.id]);
  const ev = Object.fromEntries(evidence.map((e) => [e.field_name, e.stored_value]));

  const contact = await queryOne<{
    decision_maker_name: string;
    decision_maker_title: string;
    organization_name: string;
    phone_number: string;
    phone_type: string;
    email_address: string;
    email_status: string;
    website_url: string;
    logo_url: string;
    tenant_or_facility_name: string;
    confidence: string;
    source_system: string;
    source_url: string;
  }>(
    `select * from warehouse.lead_contacts where parcel_id = $1 or account_number = $2 or parcel_id = $3 limit 1`,
    [r.id, r.account_number, id]
  );

  const officers = r.owner_name ? await query<{
    person_name: string;
    title_raw: string;
    person_role: string;
    address: string;
  }>(
    `select person_name, title_raw, person_role, address from warehouse.owner_persons where lower(trim(owner_name_normalized)) = lower(trim($1)) limit 5`,
    [r.owner_name]
  ) : [];

  const entity = r.owner_name ? await queryOne<{
    entity_legal_name: string;
    taxpayer_id: string;
    sos_file_number: string;
    sos_status: string;
    registered_agent_name: string;
    registered_agent_address: string;
    mailing_address: string;
  }>(
    `select * from warehouse.owner_entities where lower(trim(owner_name_normalized)) = lower(trim($1)) limit 1`,
    [r.owner_name]
  ) : null;

  const contactsList: Array<{
    role: string;
    name: string;
    organization?: string;
    phone?: string;
    phone_type?: string;
    email?: string;
    email_status?: string;
    website?: string;
    facility?: string;
    license?: string;
    address?: string;
    note?: string;
    confidence?: string;
  }> = [];

  if (contact) {
    contactsList.push({
      role: contact.decision_maker_title || "Primary Decision Maker",
      name: contact.decision_maker_name || contact.organization_name || "Executive Contact",
      organization: contact.organization_name || "",
      phone: contact.phone_number || "",
      phone_type: contact.phone_type || "Direct Desk / Corporate Main",
      email: contact.email_address || "",
      email_status: contact.email_status || "UNVERIFIED",
      website: contact.website_url || "",
      facility: contact.tenant_or_facility_name || "",
      license: "",
      address: r.owner_address || "",
      note: contact.email_status === "VERIFIED" 
        ? (contact.source_system ? `Verified source: ${contact.source_system}` : "Verified Corporate Contact")
        : "Staged Lead (Procedural record pending primary MX verification)",
      confidence: contact.confidence || "UNVERIFIED",
    });
  }

  for (const o of officers) {
    contactsList.push({
      role: o.title_raw || o.person_role || "Corporate Officer",
      name: o.person_name,
      organization: r.owner_name || "",
      phone: "",
      email: "",
      license: "",
      address: o.address || "",
      note: "Texas Secretary of State / Comptroller PIR Public Filing",
    });
  }

  if (entity && !contact && officers.length === 0) {
    contactsList.push({
      role: "Registered Agent / Entity",
      name: entity.registered_agent_name || entity.entity_legal_name,
      organization: entity.entity_legal_name,
      phone: "",
      email: "",
      license: entity.sos_file_number ? `SOS #${entity.sos_file_number}` : "",
      address: entity.registered_agent_address || entity.mailing_address || "",
      note: `SOS Status: ${entity.sos_status || "Active"}`,
    });
  }

  return {
    ...parcelRowBase(r), owner_address: r.owner_address || "", owner_city: r.owner_city || "", owner_state: r.owner_state || "",
    owner_zip: r.owner_zip || "", stories: Number(r.stories || 0), improvement_valuation: Number(r.improvement_valuation || 0),
    account_number: r.account_number || "", improvement_sections: r.improvement_sections || "",
    last_reroof_date: r.last_reroof_date || "", last_reroof_permit_no: r.last_reroof_permit_no || "",
    permit_count: permits.length, released: Boolean(r.released),
    has_contact: contactsList.length > 0,
    maps_url: r.latitude && r.longitude ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}` : "",
    permits: permits.map((p) => ({
      id: p.id, permit_number: p.raw_permit_number, issue_date: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
      status: p.status || "", category: p.category || "", valuation: Number(p.valuation || 0),
      valuation_formatted: p.valuation_formatted || "", description: p.raw_description || "",
      contractor_name: p.contractor_name || "", contractor_phone: p.contractor_phone || "",
      contractor_license: p.contractor_license || "", roof_system: p.probable_roof_system || "",
      is_pure_reroof: Boolean(p.is_pure_reroof), source_system: p.source_system || "", match: "parcel_id",
      source_url: p.source_url || "",
    })),
    contacts: contactsList, sources: Object.keys(ev).length ? [{ label: "Lead evidence", url: "", system: "Depoii" }] : [],
  };
}

export async function darkMarket(q: Q, user?: { id?: string; orgId?: string; platformRole?: string }) {
  const minAgeParam = int(q, "min_age", 15);
  const minSqftParam = int(q, "min_sqft", 0);
  const zone = str(q, "zone");
  const search = str(q, "search");
  const limit = int(q, "limit", 100), offset = int(q, "offset", 0);

  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  let subscribedTerritories: { id: string; name: string; zipCodes: string[] }[] = [];

  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    subscribedTerritories = subs.map((s) => ({
      id: s.id,
      name: s.name,
      zipCodes: s.zipCodes || [],
    }));

    if (subscribedTerritories.length === 0) {
      return {
        total: 0,
        total_pipeline: 0,
        total_pipeline_formatted: "$0",
        count: 0,
        minAge: minAgeParam,
        minSqft: minSqftParam,
        limit,
        offset,
        no_active_territory: true,
        unauthorized_zone: false,
        territory_message: "Your organization does not have an active territory subscription. Subscribe to a zone in Territories to unlock dark market lead intelligence.",
        overdueParcels: [],
      };
    }

    if (zone && zone !== "all") {
      const match = subscribedTerritories.find((t) => t.id === zone);
      if (!match) {
        return {
          total: 0,
          total_pipeline: 0,
          total_pipeline_formatted: "$0",
          count: 0,
          minAge: minAgeParam,
          minSqft: minSqftParam,
          limit,
          offset,
          no_active_territory: false,
          unauthorized_zone: true,
          territory_message: `Your organization is not subscribed to ${zone}. Subscribe in Territories to access lead intelligence for this zone.`,
          overdueParcels: [],
        };
      }
    }

    allowedZips = subscribedTerritories.flatMap((t) => t.zipCodes);
  }

  const params: unknown[] = [minAgeParam, minSqftParam];
  const clauses = [
    `p.year_built > 0`,
    `(extract(year from current_date) - p.year_built) >= $1`,
    `coalesce(p.building_sqft, 0) >= $2`,
    `coalesce(p.is_mock,false)=false`,
    `not exists (select 1 from warehouse.normalized_permits np where np.parcel_id = p.id)`,
  ];

  // Zone filter
  if (zone && zone !== "all") {
    let zips: string[] = [];
    const match = subscribedTerritories.find((t) => t.id === zone);
    if (match?.zipCodes?.length) {
      zips = match.zipCodes;
    } else {
      const terr = await queryOne<{ zip_codes: string[] }>(`SELECT zip_codes FROM app.territories WHERE id = $1`, [zone]);
      if (terr?.zip_codes?.length) zips = terr.zip_codes;
    }
    if (zips.length === 0 && (zone === "dallas-central-uptown" || zone.includes("central") || zone.includes("uptown"))) {
      zips = ["75201", "75204", "75205", "75206", "75219", "75225"];
    }
    if (zips.length > 0) {
      params.push(zips);
      clauses.push(`p.zip_code = ANY($${params.length})`);
    }
  } else if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    params.push(allowedZips);
    clauses.push(`p.zip_code = ANY($${params.length})`);
  }

  // Jurisdiction (city, state)
  const { city, state } = jurisdictionParts(q);
  if (city) {
    params.push(`%${city.toLowerCase()}%`);
    clauses.push(`lower(p.city) like $${params.length}`);
  }
  if (state) {
    params.push(state);
    clauses.push(`upper(p.state) = $${params.length}`);
  }

  // Server-side search filter across full database
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    const sIdx = params.length;
    clauses.push(`(lower(p.address) like $${sIdx} or lower(coalesce(p.owner_name,'')) like $${sIdx} or lower(coalesce(lc.organization_name,'')) like $${sIdx} or lower(coalesce(lc.decision_maker_name,'')) like $${sIdx} or lower(p.id) like $${sIdx})`);
  }

  const where = clauses.join(" and ");

  // Total count and replacement pipeline summary
  const summary = await queryOne<{ n: string; total_pipeline: string }>(
    `select count(*)::text as n,
            coalesce(sum((coalesce(p.building_sqft, 25000) * 14.5)::bigint), 0)::text as total_pipeline
     from warehouse.parcels p
     left join warehouse.lead_contacts lc on lc.parcel_id = p.id
     where ${where}`,
    params
  );

  const totalPipe = Number(summary?.total_pipeline || 0);
  const fmtPipe = totalPipe >= 1e6 ? `$${(totalPipe / 1e6).toFixed(2)}M` : `$${Math.trunc(totalPipe).toLocaleString()}`;

  const rows = await query(
    `select 
       p.*,
       0 as permit_count,
       (coalesce(p.building_sqft, 25000) * 14.5)::bigint as estimated_replacement_cost_usd,
       lc.decision_maker_name,
       lc.decision_maker_title,
       lc.phone_number,
       lc.email_address,
       lc.website_url,
       lc.logo_url,
       coalesce(lc.organization_name, p.owner_name) as enriched_owner_name
     from warehouse.parcels p
     left join warehouse.lead_contacts lc on lc.parcel_id = p.id
     where ${where}
     order by (extract(year from current_date) - p.year_built) desc, coalesce(p.building_sqft,0) desc
     limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    total: Number(summary?.n || 0),
    total_pipeline: totalPipe,
    total_pipeline_formatted: fmtPipe,
    count: rows.length,
    minAge: params[0],
    minSqft: params[1],
    limit,
    offset,
    no_active_territory: false,
    unauthorized_zone: false,
    overdueParcels: rows.map((r: any) => {
      const age = new Date().getFullYear() - Number(r.year_built || 0);
      const repl = Number(r.estimated_replacement_cost_usd || (Number(r.building_sqft || 25000) * 14.5));
      const fmt = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v > 0 ? `$${Math.trunc(v).toLocaleString()}` : "$0");
      return {
        parcelId: r.id,
        address: r.address,
        city: r.city,
        state: r.state,
        zip_code: r.zip_code || "",
        zipCode: r.zip_code || "",
        jurisdiction: r.jurisdiction || `${r.city}, ${r.state}`,
        buildingSqft: Number(r.building_sqft || 0),
        yearBuilt: Number(r.year_built || 0),
        roofAgeYears: age,
        urgency: age >= 30 ? "CRITICAL" : age >= 25 ? "HIGH" : "ELEVATED",
        overdue_category: age >= 30 ? "CRITICAL" : age >= 25 ? "HIGH" : "ELEVATED",
        ownerName: r.enriched_owner_name || r.owner_name || "Commercial Building Owner",
        ownerMail: [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(", "),
        propertyType: r.property_type || "Commercial Structure",
        permitCount: 0,
        outreachAngle: "Zero permits on file with city — overdue original roof candidate",
        dataSource: r.data_source || "County Appraisal District",
        reroofValue: repl,
        reroofValueFormatted: fmt(repl),
        decisionMaker: r.decision_maker_name || null,
        decisionMakerTitle: r.decision_maker_title || null,
        phone: r.phone_number || null,
        email: r.email_address || null,
        websiteUrl: r.website_url || null,
        logoUrl: r.logo_url || null,
      };
    }),
  };
}
