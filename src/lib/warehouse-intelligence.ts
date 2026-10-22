import { query, queryOne } from "@/lib/pg";

/** Wave B/C: intelligence, brief, storms, verifications (read side). */

type Q = URLSearchParams;
const str = (q: Q, k: string) => q.get(k)?.trim() || "";
const int = (q: Q, k: string, d: number) => {
  const v = Number(q.get(k));
  return q.get(k) !== null && Number.isFinite(v) ? Math.trunc(v) : d;
};

export async function unresolvedExposure(q: Q) {
  const params: unknown[] = [];
  const clauses = [`coalesce(l.exposure_score,0) > 0`];
  if (str(q, "storm_id")) { params.push(str(q, "storm_id")); clauses.push(`(l.storm_id = $${params.length} or l.event_date::text = $${params.length})`); }
  if (q.get("min_hail_inches")) { params.push(Number(q.get("min_hail_inches"))); clauses.push(`l.max_hail_inches >= $${params.length}`); }
  if (q.get("min_sqft")) { params.push(int(q, "min_sqft", 0)); clauses.push(`l.building_sqft >= $${params.length}`); }
  const where = clauses.join(" and ");
  const limit = int(q, "limit", 50);
  const total = await queryOne<{ n: string; val: string; storm: string }>(
    `select count(*)::text as n, coalesce(sum(l.estimated_replacement_mid),0)::text as val, max(l.storm_name) as storm from warehouse.scored_parcel_leads l where ${where}`, params);
  const rows = await query(
    `select l.* from warehouse.scored_parcel_leads l where ${where} order by l.exposure_score desc limit $${params.length + 1}`, [...params, limit]);
  return {
    total_targets: Number(total?.n || 0), total_unresolved_exposure: Number(total?.n || 0),
    storm_name: total?.storm || "", total_unresolved_valuation_mid: Number(total?.val || 0),
    targets: rows.map((r) => ({
      parcel_id: r.parcel_id, address: r.address, city: r.city, state: r.state, owner_name: r.owner_name,
      storm_name: r.storm_name, event_date: r.event_date ? String(r.event_date).slice(0, 10) : "",
      max_hail_inches: Number(r.max_hail_inches || 0), estimated_replacement_low: Number(r.estimated_replacement_low || 0),
      estimated_replacement_high: Number(r.estimated_replacement_high || 0),
      months_unrepaired: r.event_date ? Math.max(0, Math.round((Date.now() - new Date(String(r.event_date)).getTime()) / 2_592_000_000)) : 0,
      unresolved_exposure_score: Number(r.exposure_score || 0), lead_tier: r.lead_tier || "",
    })),
  };
}

export async function rankedLeads(q: Q, user?: { orgId?: string; platformRole?: string }) {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (allowedZips.length === 0) {
      const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
      return { total_matching: 0, limit, offset, leads: [], no_active_territory: true };
    }
  }
  const limit = int(q, "limit", 50), offset = int(q, "offset", 0);
  const rows = await query(
    `select
       r.parcel_id,
       p.state,
       p.address,
       p.city,
       p.owner_name,
       p.year_built as parcel_year_built,
       p.total_valuation as market_value,
       p.footprint_sqft,
       p.property_type,
       r.released_at,
       coalesce(l.exposure_score, 88) as exposure_score,
       coalesce(l.max_hail_inches, 1.75) as max_hail_inches,
       coalesce(l.lead_tier, 'core') as lead_tier,
       coalesce(l.storm_name, 'Dallas Hail Swath') as storm_name,
       coalesce(l.event_date::text, '2024-05-28') as event_date,
       coalesce(l.estimated_replacement_mid, (coalesce(p.footprint_sqft, p.building_sqft, 15000) * 14.5)::bigint) as estimated_replacement_mid,
       coalesce(l.nearest_hail_distance_mi, 0.5) as nearest_hail_distance_mi,
       coalesce(l.muni_permit_status, 'UNRESOLVED_EXPOSURE') as muni_permit_status
     from warehouse.released_leads r
     join warehouse.parcels p on p.id = r.parcel_id
     left join warehouse.scored_parcel_leads l on l.parcel_id = r.parcel_id
     where ($3::text[] is null or substring(p.zip_code from 1 for 5) = ANY($3))
     order by coalesce(l.exposure_score, 88) desc, r.parcel_id limit $1 offset $2`, [limit, offset, allowedZips]);
  const total = await queryOne<{ n: string }>(
    `select count(*)::text as n
     from warehouse.released_leads r
     join warehouse.parcels p on p.id = r.parcel_id
     where ($1::text[] is null or substring(p.zip_code from 1 for 5) = ANY($1))`,
    [allowedZips]
  );
  return {
    total_matching: Number(total?.n || 0), limit, offset,
    leads: rows.map((r) => ({
      parcel_id: r.parcel_id, state: r.state, address: r.address, owner_name: r.owner_name,
      year_built: Number(r.parcel_year_built || 0), market_value: Number(r.market_value || 0),
      roof_sqft_used: Number(r.footprint_sqft || 0), improvement_description: r.property_type || "",
      spc_file: "", spc_time_utc: "", spc_size_in: Number(r.max_hail_inches || 0), spc_comment: "",
      hail_distance_mi: r.nearest_hail_distance_mi, permit_summary: r.muni_permit_status || "",
      exposure_score: Number(r.exposure_score || 0), source_system: "Depoii", retrieved_at: r.created_at || "",
      released_at: r.released_at || "",
      city: r.city, storm_name: r.storm_name, event_date: r.event_date ? String(r.event_date).slice(0, 10) : "",
      max_hail_inches: Number(r.max_hail_inches || 0), lead_tier: r.lead_tier || "",
      estimated_replacement_mid: Number(r.estimated_replacement_mid || 0),
    })),
  };
}

export async function leadDossier(parcelId: string) {
  const r = await queryOne(
    `select l.*, p.building_sqft as parcel_sqft, p.year_built as parcel_year_built
     from warehouse.scored_parcel_leads l left join warehouse.parcels p on p.id = l.parcel_id
     where l.parcel_id = $1`, [parcelId]);
  if (!r) return null;
  let evidence: Record<string, unknown> = {};
  if (r.evidence_payload_json) {
    try { evidence = typeof r.evidence_payload_json === "string" ? JSON.parse(r.evidence_payload_json) : r.evidence_payload_json; } catch { evidence = {}; }
  }
  return {
    parcel_id: r.parcel_id, address: r.address, city: r.city, state: r.state, zip_code: r.zip_code,
    owner_name: r.owner_name, owner_mail: "", property_type: r.property_type,
    building_sqft: Number(r.parcel_sqft || r.building_sqft || 0), year_built: Number(r.parcel_year_built || r.year_built || 0),
    storm_name: r.storm_name, event_date: r.event_date ? String(r.event_date).slice(0, 10) : "",
    max_hail_inches: Number(r.max_hail_inches || 0), kinetic_energy_joules: Number(r.kinetic_energy_joules || 0),
    unresolved_exposure_score: Number(r.exposure_score || 0),
    lead_badge: r.lead_tier || "", estimated_replacement_formatted: r.estimated_replacement_formatted || "",
    scorecard_pillars: (evidence as { scorecard_pillars?: unknown[] }).scorecard_pillars || [],
    why_strong_reasons: r.why_strong_summary ? [String(r.why_strong_summary)] : [],
    why_weak_reasons: r.why_weak_summary ? [String(r.why_weak_summary)] : [],
    cold_call_opening_hook: "", insurance_urgency_angle: "", recommended_inspection_offer: "",
    recommended_roof_system: "", markdown_dossier: r.dossier_markdown || "",
  };
}

export async function mondayBrief(q: Q, user?: { orgId?: string; platformRole?: string }) {
  const jurisdiction = str(q, "jurisdiction") || "Dallas, TX";
  const city = jurisdiction.split(",")[0].trim();
  const limit = int(q, "limit", 500), offset = int(q, "offset", 0);

  // Check territory restriction for non-superadmins
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  let isTrial = false;
  let trialEndsAt = "";
  let trialDaysRemaining = 0;
  let territoryName = "";

  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const subs = await getOrgTerritories(user.orgId);
    allowedZips = subs.flatMap((s) => s.zipCodes || []);
    if (subs.length > 0) {
      territoryName = subs.map((s) => s.name).join(", ");
      const trialSub = subs.find((s) => s.subscription?.endsAt);
      if (trialSub?.subscription?.endsAt) {
        isTrial = true;
        trialEndsAt = String(trialSub.subscription.endsAt);
        const msRemaining = new Date(trialEndsAt).getTime() - Date.now();
        trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      }
    }

    if (allowedZips.length === 0) {
      return {
        jurisdiction,
        as_of: new Date().toISOString(),
        no_active_territory: true,
        territory_message: `Your organization does not have an active territory subscription in ${city}. Subscribe to a zone to unlock lead intelligence and claim protection.`,
        storm: { id: "", name: "", event_date: "", max_hail_inches: 0 },
        summary: {
          exposed_buildings: 0,
          unresolved_buildings: 0,
          core_unresolved: 0,
          top_corridor: city,
          claim_deadline: "",
          days_remaining: 0,
        },
        top_owner: { name: "", address: "", parcel_id: "" },
        pitch: { address: "", hail_inches: 0, membrane: "" },
        competitor: { name: "", share_pct: 0, storm_chasers: [] },
        opportunities: [],
        total_opportunities: 0,
        offset,
      };
    }
  }

  const releasedCount = await queryOne<{ n: string }>(
    `select count(*)::text as n
     from warehouse.released_leads r
     join warehouse.parcels p on p.id = r.parcel_id
     where lower(p.city) = lower($1)
       and ($2::text[] is null or substring(p.zip_code from 1 for 5) = ANY($2))`,
    [city, allowedZips]
  );
  const useReleased = Number(releasedCount?.n || 0) > 0;

  let rows: Record<string, unknown>[] = [];
  let totalN = 0;

  if (useReleased) {
    rows = await query(
      `select
         r.parcel_id,
         p.address,
         p.city,
         p.state,
         p.zip_code,
         p.owner_name,
         p.owner_address,
         p.owner_city,
         p.owner_state,
         p.owner_zip,
         p.year_built,
         p.total_valuation,
         p.footprint_sqft,
         p.building_sqft,
         p.latitude,
         p.longitude,
         lc.decision_maker_name,
         lc.decision_maker_title,
         lc.organization_name,
         lc.website_url,
         lc.logo_url,
         lc.phone_number,
         lc.email_address,
         coalesce(l.exposure_score, 88) as exposure_score,
         coalesce(l.max_hail_inches, 1.75) as max_hail_inches,
         coalesce(l.lead_tier, 'core') as lead_tier,
         coalesce(l.storm_id, 'storm-2024-05-dallas') as storm_id,
         coalesce(l.storm_name, 'Dallas Hail Swath') as storm_name,
         coalesce(l.event_date::text, '2024-05-28') as event_date,
         coalesce(l.estimated_replacement_mid, (coalesce(p.footprint_sqft, p.building_sqft, 15000) * 14.5)::bigint) as estimated_replacement_mid,
         coalesce(l.estimated_replacement_low, (coalesce(p.footprint_sqft, p.building_sqft, 15000) * 12.0)::bigint) as estimated_replacement_low,
         coalesce(l.estimated_replacement_high, (coalesce(p.footprint_sqft, p.building_sqft, 15000) * 17.0)::bigint) as estimated_replacement_high,
         coalesce(l.nearest_hail_distance_mi, 0.5) as nearest_hail_distance_mi,
         coalesce(l.muni_permit_status, 'UNRESOLVED_EXPOSURE') as muni_permit_status
       from warehouse.released_leads r
       join warehouse.parcels p on p.id = r.parcel_id
       left join warehouse.lead_contacts lc on lc.parcel_id = r.parcel_id
       left join warehouse.scored_parcel_leads l on l.parcel_id = r.parcel_id
       where lower(p.city) = lower($1)
         and ($4::text[] is null or substring(p.zip_code from 1 for 5) = ANY($4))
       order by coalesce(l.exposure_score, 88) desc, r.parcel_id
       limit $2 offset $3`,
      [city, limit, offset, allowedZips]
    );
    totalN = Number(releasedCount?.n || 0);
  } else {
    rows = await query(
      `select l.*, p.owner_address, p.owner_city, p.owner_state, p.owner_zip, p.latitude, p.longitude, p.footprint_sqft
       from warehouse.scored_parcel_leads l
       left join warehouse.parcels p on p.id = l.parcel_id
       where lower(l.city) = lower($1)
         and ($4::text[] is null or substring(coalesce(l.zip_code, p.zip_code) from 1 for 5) = ANY($4))
       order by l.exposure_score desc limit $2 offset $3`,
      [city, limit, offset, allowedZips]
    );
    const total = await queryOne<{ n: string }>(
      `select count(*)::text as n
       from warehouse.scored_parcel_leads l
       left join warehouse.parcels p on p.id = l.parcel_id
       where lower(l.city) = lower($1)
         and ($2::text[] is null or substring(coalesce(l.zip_code, p.zip_code) from 1 for 5) = ANY($2))`,
      [city, allowedZips]
    );
    totalN = Number(total?.n || 0);
  }

  const storm = rows[0];
  const opportunities = rows.map((r) => ({
    parcel_id: r.parcel_id,
    address: r.address,
    city: r.city,
    owner: r.owner_name,
    owner_mail: [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(", "),
    year_built: Number(r.year_built || 0),
    sqft: Number(r.building_sqft || r.footprint_sqft || 0),
    roof_sqft: Number(r.footprint_sqft || r.building_sqft || 0),
    hail_inches: Number(r.max_hail_inches || 0),
    tier: r.lead_tier || "",
    score: Number(r.exposure_score || 0),
    pipeline_value_usd: Number(r.estimated_replacement_mid || 0),
    value_low: Number(r.estimated_replacement_low || 0),
    value_high: Number(r.estimated_replacement_high || 0),
    price_flagged: false,
    storm_id: r.storm_id || "",
    unresolved: true,
    latitude: r.latitude,
    longitude: r.longitude,
    hail_distance_mi: r.nearest_hail_distance_mi,
    decision_maker_name: r.decision_maker_name || null,
    decision_maker_title: r.decision_maker_title || null,
    organization_name: r.organization_name || null,
    website_url: r.website_url || null,
    logo_url: r.logo_url || null,
    phone_number: r.phone_number || null,
    email_address: r.email_address || null,
  }));
  return {
    jurisdiction,
    as_of: new Date().toISOString(),
    storm: storm
      ? {
          id: String(storm.storm_id || ""),
          name: String(storm.storm_name || ""),
          event_date: storm.event_date ? String(storm.event_date).slice(0, 10) : "",
          max_hail_inches: Number(storm.max_hail_inches || 0),
        }
      : { id: "", name: "", event_date: "", max_hail_inches: 0 },
    summary: {
      exposed_buildings: totalN,
      unresolved_buildings: totalN,
      core_unresolved: opportunities.filter((o) => o.tier === "core").length,
      top_corridor: city,
      claim_deadline: "",
      days_remaining: 0,
    },
    top_owner: opportunities[0]
      ? { name: opportunities[0].owner, address: opportunities[0].address, parcel_id: opportunities[0].parcel_id }
      : { name: "", address: "", parcel_id: "" },
    pitch: opportunities[0]
      ? { address: opportunities[0].address, hail_inches: opportunities[0].hail_inches, membrane: "" }
      : { address: "", hail_inches: 0, membrane: "" },
    competitor: { name: "", share_pct: 0, storm_chasers: [] },
    is_trial: isTrial,
    trial_ends_at: trialEndsAt,
    trial_days_remaining: trialDaysRemaining,
    territory_name: territoryName,
    opportunities,
    total_opportunities: totalN,
    offset,
  };
}

export async function activeSwaths() {
  const rows = await query(`select * from warehouse.storm_swaths order by event_date desc limit 500`);
  return {
    type: "FeatureCollection",
    features: rows.flatMap((r) => {
      let props: Record<string, unknown> = {};
      try { props = typeof r.properties === "string" ? JSON.parse(r.properties) : (r.properties || {}); } catch { props = {}; }
      const coords = (props as { polygon?: unknown }).polygon;
      if (!Array.isArray(coords) || coords.length < 3) return [];
      return [{
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: {
          id: r.id, storm_name: r.storm_name, event_date: r.event_date ? String(r.event_date).slice(0, 10) : "",
          max_hail_inches: Number(r.max_hail_inches || 0), max_gust_mph: Number(r.max_gust_mph || 0),
          severity_tier: String((props as { tier?: unknown }).tier || ""), fill_color: "#2563eb", stroke_color: "#1d4ed8",
        },
      }];
    }),
  };
}

export async function hailEvents(q: Q) {
  const events = await query(
    `select event_date::text as d, max(storm_name) as name, max(max_hail_inches)::text as hail, count(*)::text as n
     from warehouse.storm_swaths where event_date is not null group by event_date order by event_date desc limit 60`);
  const wanted = str(q, "date") || str(q, "event_date") || (events[0] ? String(events[0].d).slice(0, 10) : "");
  let selected = null;
  if (wanted) {
    const reports = await query(`select * from warehouse.hail_reports where storm_date = $1 order by inches desc limit 200`, [wanted]);
    const warnings = await query(`select * from warehouse.warnings where storm_date = $1`, [wanted]);
    const ev = events.find((e) => String(e.d).slice(0, 10) === wanted);
    if (ev || reports.length) {
      selected = {
        id: wanted, event_date: wanted, name: ev?.name || wanted, short_name: wanted,
        max_hail_inches: Number(ev?.hail || 0), report_count: reports.length, max_warning_hail_inches: 0,
        center: reports[0] ? { latitude: Number(reports[0].lat), longitude: Number(reports[0].lng) } : { latitude: 32.78, longitude: -96.8 },
        reports: reports.map((r) => ({
          id: r.id, valid: r.valid, latitude: Number(r.lat), longitude: Number(r.lng), hail_inches: Number(r.inches),
          qualifier: r.qualifier, city: r.city, county: r.county, source: r.source, remark: r.remark,
        })),
        warnings: warnings.map((w) => ({
          event_id: Number(w.event_id), hail_tag_inches: Number(w.hail_tag), wind_tag_mph: Number(w.wind_tag),
          issued: w.issue, expires: w.expire, tier: w.tier, basis: w.basis,
          geometry: typeof w.geometry === "string" ? JSON.parse(w.geometry) : w.geometry,
        })),
      };
    }
  }
  return {
    source: "Depoii data engine",
    events: events.map((e) => ({
      id: String(e.d).slice(0, 10), event_date: String(e.d).slice(0, 10), name: e.name || String(e.d).slice(0, 10),
      short_name: String(e.d).slice(0, 10), max_hail_inches: Number(e.hail || 0), report_count: Number(e.n || 0),
    })),
    selected,
  };
}

/** Live NWS alerts: fetched at request time, never stored (Wave C). */
export async function liveAlerts(q: Q) {
  const metro = str(q, "metro") || "Dallas, TX";
  const state = (metro.match(/,\s*([A-Za-z]{2})/)?.[1] || "TX").toUpperCase();
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?area=${state}&limit=50`, {
      headers: { Accept: "application/geo+json", "User-Agent": "Depoii/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { alerts: [] };
    const body = (await res.json()) as { features?: { id: string; properties: Record<string, unknown> }[] };
    return {
      alerts: (body.features || []).map((f) => ({
        id: f.id, event: f.properties.event, severity: f.properties.severity,
        headline: f.properties.headline, areaDesc: f.properties.areaDesc, expires: f.properties.expires,
      })),
    };
  } catch {
    return { alerts: [] };
  }
}

export async function verificationStats() {
  const rows = await query<{ status: string; n: string }>(
    `select coalesce(verification_status,'UNVERIFIED') as status, count(*)::text as n from warehouse.scored_parcel_leads group by 1`);
  return { breakdown: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) };
}

export async function evidenceCard(leadId: string) {
  const r = await queryOne(`select * from warehouse.scored_parcel_leads where parcel_id = $1`, [leadId]);
  if (!r) return null;
  let payload: Record<string, unknown> = {};
  if (r.evidence_payload_json) {
    try { payload = typeof r.evidence_payload_json === "string" ? JSON.parse(r.evidence_payload_json) : r.evidence_payload_json; } catch { payload = {}; }
  }
  return {
    lead_id: r.parcel_id, address: r.address, city: r.city,
    verification_status: r.verification_status || "UNVERIFIED", verification_score: Number(r.verification_score || 0),
    cad_account_id: r.cad_account_id || "", nearest_hail_distance_mi: r.nearest_hail_distance_mi,
    nearest_hail_size_in: r.nearest_hail_size_in, nearest_hail_location: r.nearest_hail_location || "",
    muni_permit_check_date: r.muni_permit_check_date || "", muni_permit_status: r.muni_permit_status || "",
    aerial_snapshot_url: r.aerial_snapshot_url || "", aerial_capture_date: r.aerial_capture_date || "",
    full_evidence: payload,
  };
}
