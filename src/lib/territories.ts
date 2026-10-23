import { query, queryOne } from "@/lib/pg";

/**
 * Territory data layer.
 *
 * Queries app.territories, app.territory_subscriptions, and
 * warehouse.scored_parcel_leads to serve territory-scoped lead data
 * with personalized ranking per org.
 */

// ─── Types ────────────────────────────────────────────────────

export interface Territory {
  id: string;
  market: string;
  name: string;
  description: string;
  zipCodes: string[];
  maxSubscribers: number;
  totalParcels: number;
  totalPipelineValue: number;
  totalSqft: number;
  status: string;
  createdAt: string;
}

export interface TerritoryWithAvailability extends Territory {
  activeSubscribers: number;
  availableSlots: number;
}

export interface TerritorySubscription {
  id: string;
  territoryId: string;
  orgId: string;
  tier: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
}

export interface TerritoryLead {
  parcelId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName: string | null;
  propertyType: string | null;
  buildingSqft: number;
  yearBuilt: number | null;
  estimatedReplacementMid: number | null;
  estimatedReplacementFormatted: string | null;
  leadTier: string | null;
  exposureScore: number | null;
  stormName: string | null;
  maxHailInches: number | null;
  whyStrongSummary: string | null;
  /** Personalized ranking score (higher = better fit for this org). */
  rankScore: number;
  /** Claim status relative to the requesting org. */
  claimStatus: "available" | "claimed_by_you" | "claimed_by_other";
  claimExpiresAt: string | null;
}

// ─── Row types ────────────────────────────────────────────────

type TerritoryRow = {
  id: string;
  market: string;
  name: string;
  description: string;
  zip_codes: string[];
  max_subscribers: number;
  total_parcels: number;
  total_pipeline_value: string;
  total_sqft: string;
  status: string;
  created_at: string;
};

type SubRow = {
  id: string;
  territory_id: string;
  org_id: string;
  tier: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

type LeadRow = {
  parcel_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  owner_name: string | null;
  property_type: string | null;
  building_sqft: string;
  year_built: number | null;
  estimated_replacement_mid: string | null;
  estimated_replacement_formatted: string | null;
  lead_tier: string | null;
  exposure_score: number | null;
  storm_name: string | null;
  max_hail_inches: number | null;
  why_strong_summary: string | null;
  claim_id: string | null;
  claim_org_id: string | null;
  claim_expires_at: string | null;
};

// ─── Mappers ──────────────────────────────────────────────────

function mapTerritory(r: TerritoryRow): Territory {
  return {
    id: r.id,
    market: r.market,
    name: r.name,
    description: r.description,
    zipCodes: r.zip_codes,
    maxSubscribers: r.max_subscribers,
    totalParcels: r.total_parcels,
    totalPipelineValue: parseFloat(r.total_pipeline_value) || 0,
    totalSqft: parseInt(r.total_sqft) || 0,
    status: r.status,
    createdAt: r.created_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────

/** List all territories for a market, with live availability counts. */
export async function getTerritoriesForMarket(market: string): Promise<TerritoryWithAvailability[]> {
  const rows = await query<TerritoryRow & { active_subscribers: string }>(
    `SELECT t.*,
       COALESCE((
         SELECT COUNT(*)::integer FROM app.territory_subscriptions ts
         WHERE ts.territory_id = t.id AND ts.status = 'active'
       ), 0)::text AS active_subscribers
     FROM app.territories t
     WHERE t.market = $1 AND t.status != 'retired'
     ORDER BY t.total_pipeline_value DESC`,
    [market],
  );
  return rows.map((r) => {
    const base = mapTerritory(r);
    const active = parseInt(r.active_subscribers) || 0;
    return {
      ...base,
      activeSubscribers: active,
      availableSlots: Math.max(0, base.maxSubscribers - active),
    };
  });
}

/** Get territories an org is subscribed to. */
export async function getOrgTerritories(orgId: string): Promise<(Territory & { subscription: TerritorySubscription })[]> {
  const rows = await query<TerritoryRow & SubRow & { sub_id: string; sub_status: string }>(
    `SELECT t.*, ts.id AS sub_id, ts.territory_id, ts.org_id, ts.tier, ts.starts_at, ts.ends_at, ts.status AS sub_status
     FROM app.territories t
     JOIN app.territory_subscriptions ts ON ts.territory_id = t.id
     WHERE ts.org_id = $1 AND ts.status = 'active'
       AND (ts.ends_at IS NULL OR ts.ends_at > NOW())
     ORDER BY t.name`,
    [orgId],
  );
  return rows.map((r) => ({
    ...mapTerritory(r),
    subscription: {
      id: r.sub_id || r.id,
      territoryId: r.territory_id,
      orgId: r.org_id,
      tier: r.tier,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      status: (r as Record<string, unknown>).sub_status as string,
    },
  }));
}

/** Get availability for a specific territory. */
export async function getTerritoryAvailability(territoryId: string): Promise<{ total: number; taken: number; available: number }> {
  const row = await queryOne<{ max_subscribers: number; active_count: string }>(
    `SELECT t.max_subscribers,
       COALESCE((SELECT COUNT(*) FROM app.territory_subscriptions ts WHERE ts.territory_id = t.id AND ts.status = 'active' AND (ts.ends_at IS NULL OR ts.ends_at > NOW())), 0)::text AS active_count
     FROM app.territories t WHERE t.id = $1`,
    [territoryId],
  );
  if (!row) return { total: 0, taken: 0, available: 0 };
  const taken = parseInt(row.active_count) || 0;
  return { total: row.max_subscribers, taken, available: Math.max(0, row.max_subscribers - taken) };
}

/** Subscribe an org to a territory. Enforces max_subscribers. */
export async function subscribeOrgToTerritory(
  orgId: string,
  territoryId: string,
  tier: "pro_territory" | "exclusive_zone",
): Promise<{ ok: true; subscriptionId: string } | { ok: false; error: string }> {
  const avail = await getTerritoryAvailability(territoryId);
  if (avail.available <= 0) {
    return { ok: false, error: "No slots available in this territory. Join the waitlist." };
  }
  if (tier === "exclusive_zone" && avail.taken > 0) {
    return { ok: false, error: "Exclusive zone requires no existing subscribers. Territory already has active subscribers." };
  }
  try {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO app.territory_subscriptions (territory_id, org_id, tier, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (territory_id, org_id) DO UPDATE SET tier = $3, status = 'active', starts_at = NOW()
       RETURNING id`,
      [territoryId, orgId, tier],
    );
    return { ok: true, subscriptionId: row!.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Subscription failed.";
    return { ok: false, error: msg };
  }
}

/** Get leads in a territory for a specific org, with claim status and personalized ranking. */
export async function getLeadsForTerritory(
  territoryId: string,
  orgId: string,
  options?: { limit?: number; offset?: number; search?: string },
): Promise<{ leads: TerritoryLead[]; total: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  // Get the territory's ZIP codes
  const territory = await queryOne<{ zip_codes: string[] }>(
    `SELECT zip_codes FROM app.territories WHERE id = $1`,
    [territoryId],
  );
  if (!territory) return { leads: [], total: 0 };

  // Get org's ranking profile for personalization
  const profile = await queryOne<{
    crew_lat: number | null;
    crew_lng: number | null;
    min_roof_sqft: string;
    max_roof_sqft: string;
    preferred_sectors: string[];
  }>(
    `SELECT * FROM app.org_ranking_profiles WHERE org_id = $1`,
    [orgId],
  );

  const params: unknown[] = [territory.zip_codes];
  let searchClause = "";
  if (options?.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    searchClause = ` AND (lower(s.address) LIKE $${params.length} OR lower(s.owner_name) LIKE $${params.length} OR s.zip_code LIKE $${params.length})`;
  }

  // Count total
  const countRow = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM warehouse.scored_parcel_leads s
     WHERE s.zip_code = ANY($1)${searchClause}`,
    params,
  );
  const total = parseInt(countRow?.cnt || "0");

  // Fetch leads with claim overlay
  const leadParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const rows = await query<LeadRow>(
    `SELECT s.parcel_id, s.address, s.city, s.state, s.zip_code, s.owner_name, s.property_type,
       s.building_sqft::text, s.year_built, s.estimated_replacement_mid::text,
       s.estimated_replacement_formatted, s.lead_tier, s.exposure_score,
       s.storm_name, s.max_hail_inches, s.why_strong_summary,
       c.id AS claim_id, c.claimed_by_org_id AS claim_org_id, c.expires_at::text AS claim_expires_at
     FROM warehouse.scored_parcel_leads s
     LEFT JOIN app.property_claims c ON c.parcel_id = s.parcel_id AND c.status = 'active'
     WHERE s.zip_code = ANY($1)${searchClause}
     ORDER BY s.exposure_score DESC NULLS LAST, s.estimated_replacement_mid DESC NULLS LAST
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    leadParams,
  );

  const leads: TerritoryLead[] = rows.map((r) => {
    let claimStatus: TerritoryLead["claimStatus"] = "available";
    let claimExpiresAt: string | null = null;
    if (r.claim_id) {
      claimStatus = r.claim_org_id === orgId ? "claimed_by_you" : "claimed_by_other";
      claimExpiresAt = r.claim_expires_at;
    }

    // Personalized rank score (0–100)
    let rankScore = 50; // base
    const sqft = parseInt(r.building_sqft) || 0;
    if (r.exposure_score) rankScore += Math.min(r.exposure_score / 2, 20);
    if (profile) {
      const minSqft = parseInt(profile.min_roof_sqft) || 0;
      const maxSqft = parseInt(profile.max_roof_sqft) || 999999999;
      if (sqft >= minSqft && sqft <= maxSqft) rankScore += 15;
      if (profile.preferred_sectors?.length && r.property_type) {
        if (profile.preferred_sectors.some((s) => r.property_type?.toLowerCase().includes(s.toLowerCase()))) {
          rankScore += 10;
        }
      }
      // Crew proximity bonus (if lat/lng available — simplified for now)
      if (profile.crew_lat && profile.crew_lng) {
        rankScore += 5; // placeholder until we add distance calc
      }
    }
    rankScore = Math.min(100, Math.max(0, rankScore));

    return {
      parcelId: r.parcel_id,
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      zipCode: r.zip_code || "",
      ownerName: r.owner_name,
      propertyType: r.property_type,
      buildingSqft: sqft,
      yearBuilt: r.year_built,
      estimatedReplacementMid: r.estimated_replacement_mid ? parseFloat(r.estimated_replacement_mid) : null,
      estimatedReplacementFormatted: r.estimated_replacement_formatted,
      leadTier: r.lead_tier,
      exposureScore: r.exposure_score,
      stormName: r.storm_name,
      maxHailInches: r.max_hail_inches,
      whyStrongSummary: r.why_strong_summary,
      rankScore,
      claimStatus,
      claimExpiresAt,
    };
  });

  // Sort by personalized rank score descending
  leads.sort((a, b) => b.rankScore - a.rankScore);

  return { leads, total };
}

/** Check if an org has an active subscription for a given territory. */
export async function hasActiveSubscription(orgId: string, territoryId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM app.territory_subscriptions
     WHERE org_id = $1 AND territory_id = $2 AND status = 'active'
       AND (ends_at IS NULL OR ends_at > NOW())`,
    [orgId, territoryId],
  );
  return !!row;
}

/** Find which territory a parcel belongs to (by ZIP code). */
export async function findTerritoryForParcel(parcelId: string): Promise<string | null> {
  const row = await queryOne<{ territory_id: string }>(
    `SELECT t.id AS territory_id
     FROM app.territories t
     JOIN (
       SELECT parcel_id, zip_code FROM warehouse.scored_parcel_leads WHERE parcel_id = $1
       UNION
       SELECT id AS parcel_id, zip_code FROM warehouse.parcels WHERE id = $1
     ) s ON substring(s.zip_code from 1 for 5) = ANY(t.zip_codes)
     LIMIT 1`,
    [parcelId],
  );
  return row?.territory_id || null;
}

/** Check if an organization has permission to access a parcel's dossier/contacts. */
export async function canOrgAccessParcel(
  orgId: string,
  parcelId: string,
  isSuperAdmin = false,
): Promise<{ allowed: boolean; reason?: string; territoryId?: string }> {
  if (isSuperAdmin) return { allowed: true };

  // 1. Is it currently claimed by this org?
  const claimRow = await queryOne<{ id: string }>(
    `SELECT id FROM app.property_claims
     WHERE parcel_id = $1 AND claimed_by_org_id = $2 AND status = 'active'`,
    [parcelId, orgId],
  );
  if (claimRow) return { allowed: true };

  // 2. Which territory does it belong to?
  const territoryId = await findTerritoryForParcel(parcelId);
  if (!territoryId) {
    // Property not in any partitioned market territory
    return { allowed: true };
  }

  // 3. Does org have active subscription to this territory?
  const subscribed = await hasActiveSubscription(orgId, territoryId);
  if (subscribed) {
    return { allowed: true, territoryId };
  }

  // Auto-subscribe pro/pilot orgs to unlock territory dossier
  const orgTier = await getOrgTier(orgId);
  if (orgTier && (orgTier.tier === "pro_territory" || orgTier.tier === "exclusive_zone")) {
    try {
      await query(
        `INSERT INTO app.territory_subscriptions (territory_id, org_id, tier, status)
         VALUES ($1, $2, 'pro_territory', 'active')
         ON CONFLICT (territory_id, org_id) DO UPDATE SET tier = 'pro_territory', status = 'active', starts_at = NOW()`,
        [territoryId, orgId],
      );
      return { allowed: true, territoryId };
    } catch {
      return { allowed: true, territoryId };
    }
  }

  return {
    allowed: false,
    reason: "This property belongs to a territory your organization is not subscribed to. Subscribe to this zone in Territories to unlock the full dossier and contact intelligence.",
    territoryId,
  };
}

/** Get org's subscription tier. */
export async function getOrgTier(orgId: string): Promise<{
  tier: string;
  maxActiveClaims: number;
  maxMonthlyClaims: number;
} | null> {
  const row = await queryOne<{
    subscription_tier: string;
    max_active_claims: number;
    max_monthly_claims: number;
  }>(
    `SELECT subscription_tier, max_active_claims, max_monthly_claims FROM app.orgs WHERE id = $1`,
    [orgId],
  );
  if (!row) return null;
  let tier = row.subscription_tier || "pro_territory";
  let maxActive = Number(row.max_active_claims) || 0;
  let maxMonthly = Number(row.max_monthly_claims) || 0;

  // Auto-upgrade for pilot access so claims are active out-of-the-box
  if (tier === "shared_intelligence" || maxActive === 0) {
    tier = "pro_territory";
    maxActive = 15;
    maxMonthly = 50;
  }

  return {
    tier,
    maxActiveClaims: maxActive,
    maxMonthlyClaims: maxMonthly,
  };
}

