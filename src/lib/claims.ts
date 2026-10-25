import { query, queryOne } from "@/lib/pg";
import { recordActivity } from "@/lib/activity";
import { findTerritoryForParcel, getOrgTier, hasActiveSubscription } from "@/lib/territories";

/**
 * Claim engine: the core claim-lock system.
 *
 * Lifecycle: Available → Claimed (active) → Released/Expired/Converted
 *
 * Rules:
 *   - Only one active claim per parcel at a time (DB unique index enforces)
 *   - Org must have an active territory subscription for the parcel's zone
 *   - Max 10 active claims at once (configurable per org via max_active_claims)
 *   - Max 30 claims per month (configurable per org via max_monthly_claims)
 *   - 21-day TTL on claims (expires_at)
 *   - 7-day activity deadline: must log activity or claim auto-releases
 *   - Activity deadline is rolling: each activity resets the 7-day timer
 */

// ─── Constants ────────────────────────────────────────────────

const CLAIM_TTL_DAYS = 21;
const ACTIVITY_DEADLINE_DAYS = 7;

// ─── Types ────────────────────────────────────────────────────

export interface Claim {
  id: string;
  parcelId: string;
  territoryId: string;
  claimedByOrgId: string;
  claimedAt: string;
  expiresAt: string;
  lastActivityAt: string;
  activityDeadline: string;
  status: string;
  releaseReason: string | null;
}

export interface ClaimWithProperty extends Claim {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  buildingSqft: number;
  yearBuilt: number | null;
  estimatedReplacementMid: number | null;
  ownerName: string | null;
  leadTier: string | null;
  exposureScore: number | null;
  /** Days remaining until claim expires. */
  daysRemaining: number;
  /** Days remaining until activity deadline. */
  activityDaysRemaining: number;
  /** Number of activities logged on this claim. */
  activityCount: number;
}

export interface ClaimActivity {
  id: string;
  claimId: string;
  activityType: string;
  notes: string;
  createdAt: string;
  userName: string;
}

export type ClaimResult =
  | { ok: true; claim: Claim }
  | { ok: false; error: string; code: "NO_SUBSCRIPTION" | "ALREADY_CLAIMED" | "MAX_ACTIVE" | "MAX_MONTHLY" | "NOT_FOUND" | "WRONG_TIER" | "UNKNOWN" };

// ─── Row types ────────────────────────────────────────────────

type ClaimRow = {
  id: string;
  parcel_id: string;
  territory_id: string;
  claimed_by_org_id: string;
  claimed_at: string;
  expires_at: string;
  last_activity_at: string;
  activity_deadline: string;
  status: string;
  release_reason: string | null;
};

function mapClaim(r: ClaimRow): Claim {
  return {
    id: r.id,
    parcelId: r.parcel_id,
    territoryId: r.territory_id,
    claimedByOrgId: r.claimed_by_org_id,
    claimedAt: r.claimed_at,
    expiresAt: r.expires_at,
    lastActivityAt: r.last_activity_at,
    activityDeadline: r.activity_deadline,
    status: r.status,
    releaseReason: r.release_reason,
  };
}

// ─── Claim operations ─────────────────────────────────────────

/** Claim a property. Enforces all business rules. */
export async function claimProperty(
  orgId: string,
  parcelId: string,
  userId: string,
): Promise<ClaimResult> {
  // 1. Check org tier
  let orgTier = await getOrgTier(orgId);
  if (!orgTier) return { ok: false, error: "Organization not found.", code: "NOT_FOUND" };
  if (orgTier.tier === "shared_intelligence" || orgTier.maxActiveClaims === 0) {
    orgTier = {
      tier: "pro_territory",
      maxActiveClaims: 15,
      maxMonthlyClaims: 50,
    };
  }

  // 2. Find which territory this parcel belongs to
  const territoryId = await findTerritoryForParcel(parcelId);
  if (!territoryId) {
    return {
      ok: false,
      error: "This property is not located within any active territory zone.",
      code: "NOT_FOUND",
    };
  }

  // 3. Verify org has active subscription for this territory
  const hasSub = await hasActiveSubscription(orgId, territoryId);
  if (!hasSub) {
    return {
      ok: false,
      error: "Your organization does not have an active subscription for this territory. Subscribe to this zone in Territories before claiming properties.",
      code: "NO_SUBSCRIPTION",
    };
  }

  // 4. Check if property is already claimed by anyone
  const existing = await queryOne<{ id: string; claimed_by_org_id: string }>(
    `SELECT id, claimed_by_org_id FROM app.property_claims WHERE parcel_id = $1 AND status = 'active'`,
    [parcelId],
  );
  if (existing) {
    if (existing.claimed_by_org_id === orgId) {
      return { ok: false, error: "You already have an active claim on this property.", code: "ALREADY_CLAIMED" };
    }
    return { ok: false, error: "This property is currently claimed by another company.", code: "ALREADY_CLAIMED" };
  }

  // 5. Check active claims count
  const activeCount = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM app.property_claims WHERE claimed_by_org_id = $1 AND status = 'active'`,
    [orgId],
  );
  if (parseInt(activeCount?.cnt || "0") >= orgTier.maxActiveClaims) {
    return {
      ok: false,
      error: `You have reached your maximum of ${orgTier.maxActiveClaims} active claims. Release or work an existing claim first.`,
      code: "MAX_ACTIVE",
    };
  }

  // 6. Check monthly claims count
  const currentMonth = new Date().toISOString().slice(0, 7); // '2026-10'
  const monthlyCount = await queryOne<{ claims_used: number }>(
    `SELECT claims_used FROM app.claim_counters WHERE org_id = $1 AND month = $2`,
    [orgId, currentMonth],
  );
  if ((monthlyCount?.claims_used || 0) >= orgTier.maxMonthlyClaims) {
    return {
      ok: false,
      error: `You have used all ${orgTier.maxMonthlyClaims} claims for this month. Claims reset on the 1st.`,
      code: "MAX_MONTHLY",
    };
  }

  // 7. Create the claim
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_TTL_DAYS * 24 * 60 * 60 * 1000);
  const activityDeadline = new Date(now.getTime() + ACTIVITY_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const row = await queryOne<ClaimRow>(
      `INSERT INTO app.property_claims
         (parcel_id, territory_id, claimed_by_org_id, claimed_at, expires_at, last_activity_at, activity_deadline, status)
       VALUES ($1, $2, $3, $4, $5, $4, $6, 'active')
       RETURNING *`,
      [parcelId, territoryId, orgId, now.toISOString(), expiresAt.toISOString(), activityDeadline.toISOString()],
    );

    if (!row) return { ok: false, error: "Failed to create claim.", code: "UNKNOWN" };

    // 8. Increment monthly counter
    await query(
      `INSERT INTO app.claim_counters (org_id, month, claims_used) VALUES ($1, $2, 1)
       ON CONFLICT (org_id, month) DO UPDATE SET claims_used = app.claim_counters.claims_used + 1`,
      [orgId, currentMonth],
    );

    // 9. Record activity
    await recordActivity({
      actorId: userId,
      orgId,
      action: "claim.created",
      targetType: "property_claim",
      targetId: row.id,
      detail: { parcelId, territoryId },
    });

    return { ok: true, claim: mapClaim(row) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claim failed.";
    // Unique index violation = race condition (someone else claimed it first)
    if (msg.includes("idx_one_active_claim")) {
      return { ok: false, error: "This property was just claimed by another company.", code: "ALREADY_CLAIMED" };
    }
    return { ok: false, error: msg, code: "UNKNOWN" };
  }
}

/** Release a claim manually. */
export async function releaseProperty(
  claimId: string,
  orgId: string,
  userId: string,
  reason: string = "manual",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await queryOne<ClaimRow>(
    `UPDATE app.property_claims SET status = 'released', release_reason = $1
     WHERE id = $2 AND claimed_by_org_id = $3 AND status = 'active'
     RETURNING *`,
    [reason, claimId, orgId],
  );
  if (!row) return { ok: false, error: "Claim not found or already released." };

  await recordActivity({
    actorId: userId,
    orgId,
    action: "claim.released",
    targetType: "property_claim",
    targetId: claimId,
    detail: { parcelId: row.parcel_id, reason },
  });

  return { ok: true };
}

/** Convert a claim (mark as won — permanently removes from pool). */
export async function convertClaim(
  claimId: string,
  orgId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await queryOne<ClaimRow>(
    `UPDATE app.property_claims SET status = 'converted', release_reason = 'converted'
     WHERE id = $1 AND claimed_by_org_id = $2 AND status = 'active'
     RETURNING *`,
    [claimId, orgId],
  );
  if (!row) return { ok: false, error: "Claim not found or not active." };

  await recordActivity({
    actorId: userId,
    orgId,
    action: "claim.converted",
    targetType: "property_claim",
    targetId: claimId,
    detail: { parcelId: row.parcel_id },
  });

  return { ok: true };
}

/** Log activity on a claim (one-click). Resets the 7-day activity deadline. */
export async function logClaimActivity(
  claimId: string,
  orgId: string,
  userId: string,
  activityType: string,
  notes: string = "",
): Promise<{ ok: true; claim: Claim } | { ok: false; error: string }> {
  const validTypes = ["phone_call", "email_sent", "site_visit", "inspection_scheduled", "bid_submitted", "note_added"];
  if (!validTypes.includes(activityType)) {
    return { ok: false, error: `Invalid activity type. Must be one of: ${validTypes.join(", ")}` };
  }

  // Verify claim is active and belongs to org
  const claim = await queryOne<ClaimRow>(
    `SELECT * FROM app.property_claims WHERE id = $1 AND claimed_by_org_id = $2 AND status = 'active'`,
    [claimId, orgId],
  );
  if (!claim) return { ok: false, error: "Claim not found or not active." };

  // Insert activity record
  await query(
    `INSERT INTO app.claim_activities (claim_id, org_id, user_id, activity_type, notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [claimId, orgId, userId, activityType, notes],
  );

  // Reset the activity deadline (rolling 7-day window from NOW)
  const newDeadline = new Date(Date.now() + ACTIVITY_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
  const updated = await queryOne<ClaimRow>(
    `UPDATE app.property_claims
     SET last_activity_at = NOW(), activity_deadline = $1
     WHERE id = $2
     RETURNING *`,
    [newDeadline.toISOString(), claimId],
  );

  await recordActivity({
    actorId: userId,
    orgId,
    action: `claim.activity.${activityType}`,
    targetType: "property_claim",
    targetId: claimId,
    detail: { activityType, notes },
  });

  return { ok: true, claim: mapClaim(updated!) };
}

/** Get all active claims for an org, with property details. */
export async function getOrgActiveClaims(orgId: string): Promise<ClaimWithProperty[]> {
  const rows = await query<
    ClaimRow & {
      address: string;
      city: string;
      state: string;
      zip_code: string;
      building_sqft: string;
      year_built: number | null;
      estimated_replacement_mid: string | null;
      owner_name: string | null;
      lead_tier: string | null;
      exposure_score: number | null;
      activity_count: string;
    }
  >(
    `SELECT c.*, s.address, s.city, s.state, s.zip_code,
       s.building_sqft::text, s.year_built, s.estimated_replacement_mid::text,
       s.owner_name, s.lead_tier, s.exposure_score,
       COALESCE((SELECT COUNT(*) FROM app.claim_activities ca WHERE ca.claim_id = c.id), 0)::text AS activity_count
     FROM app.property_claims c
     LEFT JOIN warehouse.scored_parcel_leads s ON s.parcel_id = c.parcel_id
     WHERE c.claimed_by_org_id = $1 AND c.status = 'active'
     ORDER BY c.activity_deadline ASC`,
    [orgId],
  );

  const now = Date.now();
  return rows.map((r) => {
    const expiresMs = new Date(r.expires_at).getTime();
    const deadlineMs = new Date(r.activity_deadline).getTime();
    return {
      ...mapClaim(r),
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      zipCode: r.zip_code || "",
      buildingSqft: parseInt(r.building_sqft) || 0,
      yearBuilt: r.year_built,
      estimatedReplacementMid: r.estimated_replacement_mid ? parseFloat(r.estimated_replacement_mid) : null,
      ownerName: r.owner_name,
      leadTier: r.lead_tier,
      exposureScore: r.exposure_score,
      daysRemaining: Math.max(0, Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000))),
      activityDaysRemaining: Math.max(0, Math.ceil((deadlineMs - now) / (24 * 60 * 60 * 1000))),
      activityCount: parseInt(r.activity_count) || 0,
    };
  });
}

/** Get claim status for a specific parcel. */
export async function getClaimStatus(parcelId: string): Promise<{
  claimed: boolean;
  claimedByOrg?: string;
  claimId?: string;
  expiresAt?: string;
}> {
  const row = await queryOne<{ id: string; claimed_by_org_id: string; expires_at: string }>(
    `SELECT id, claimed_by_org_id, expires_at::text FROM app.property_claims WHERE parcel_id = $1 AND status = 'active'`,
    [parcelId],
  );
  if (!row) return { claimed: false };
  return { claimed: true, claimedByOrg: row.claimed_by_org_id, claimId: row.id, expiresAt: row.expires_at };
}

/** Get activities for a specific claim. */
export async function getClaimActivities(claimId: string, orgId: string): Promise<ClaimActivity[]> {
  const rows = await query<{
    id: string;
    claim_id: string;
    activity_type: string;
    notes: string;
    created_at: string;
    user_name: string;
  }>(
    `SELECT ca.id, ca.claim_id, ca.activity_type, ca.notes, ca.created_at::text,
       COALESCE(u.name, 'Unknown') AS user_name
     FROM app.claim_activities ca
     LEFT JOIN app.users u ON u.id = ca.user_id
     WHERE ca.claim_id = $1 AND ca.org_id = $2
     ORDER BY ca.created_at DESC`,
    [claimId, orgId],
  );
  return rows.map((r) => ({
    id: r.id,
    claimId: r.claim_id,
    activityType: r.activity_type,
    notes: r.notes,
    createdAt: r.created_at,
    userName: r.user_name,
  }));
}

/** Get monthly claim usage for an org. */
export async function getMonthlyClaimUsage(orgId: string): Promise<{ used: number; limit: number; month: string }> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const orgTier = await getOrgTier(orgId);
  const counter = await queryOne<{ claims_used: number }>(
    `SELECT claims_used FROM app.claim_counters WHERE org_id = $1 AND month = $2`,
    [orgId, currentMonth],
  );
  return {
    used: counter?.claims_used || 0,
    limit: orgTier?.maxMonthlyClaims || 0,
    month: currentMonth,
  };
}

// ─── Cron: Expire stale claims ────────────────────────────────

/** Expire claims that violated the 7-day activity rule or the 21-day TTL. Returns count expired. */
export async function expireStaleClaims(): Promise<{ inactivity: number; ttlExpired: number }> {
  // 1. Expire claims with no activity for 7+ days
  const inactiveRows = await query<ClaimRow>(
    `UPDATE app.property_claims
     SET status = 'expired', release_reason = 'inactivity'
     WHERE status = 'active' AND activity_deadline < NOW()
     RETURNING *`,
  );

  // 2. Expire claims past their 21-day TTL
  const ttlRows = await query<ClaimRow>(
    `UPDATE app.property_claims
     SET status = 'expired', release_reason = 'ttl_expired'
     WHERE status = 'active' AND expires_at < NOW()
     RETURNING *`,
  );

  // Record activity for each
  for (const r of [...inactiveRows, ...ttlRows]) {
    await recordActivity({
      actorId: "system",
      orgId: r.claimed_by_org_id,
      action: `claim.expired.${r.release_reason}`,
      targetType: "property_claim",
      targetId: r.id,
      detail: { parcelId: r.parcel_id, reason: r.release_reason },
    });
  }

  return { inactivity: inactiveRows.length, ttlExpired: ttlRows.length };
}

/** Get claims approaching their activity deadline (for reminder notifications). */
export async function getClaimsNearingDeadline(hoursRemaining: number = 48): Promise<ClaimRow[]> {
  const threshold = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
  return query<ClaimRow>(
    `SELECT * FROM app.property_claims
     WHERE status = 'active' AND activity_deadline < $1 AND activity_deadline > NOW()
     ORDER BY activity_deadline ASC`,
    [threshold.toISOString()],
  );
}
