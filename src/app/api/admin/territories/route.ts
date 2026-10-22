import { requireSuperAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/pg";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireSuperAdmin();

    // 1. Territories with aggregate stats
    const territories = await query<{
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
    }>(`SELECT * FROM app.territories ORDER BY market, name`);

    // 2. Subscriptions with Org Names
    const subscriptions = await query<{
      id: string;
      territory_id: string;
      org_id: string;
      org_name: string;
      tier: string;
      starts_at: string;
      ends_at: string | null;
      status: string;
      is_trial: boolean;
      trial_days_left: number | null;
    }>(`
      SELECT ts.id, ts.territory_id, ts.org_id, o.name AS org_name, ts.tier,
             ts.starts_at::text, ts.ends_at::text, ts.status,
             (ts.ends_at IS NOT NULL AND ts.ends_at > NOW()) AS is_trial,
             CASE WHEN ts.ends_at IS NOT NULL THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (ts.ends_at - NOW())) / 86400))::int ELSE NULL END AS trial_days_left
      FROM app.territory_subscriptions ts
      JOIN app.orgs o ON o.id = ts.org_id
      ORDER BY ts.created_at ASC
    `);

    // 3. Active Claims with Parcel and Org Names
    const claims = await query<{
      id: string;
      parcel_id: string;
      territory_id: string;
      claimed_by_org_id: string;
      org_name: string;
      address: string;
      claimed_at: string;
      expires_at: string;
      activity_deadline: string;
      status: string;
    }>(`
      SELECT c.id, c.parcel_id, c.territory_id, c.claimed_by_org_id, o.name AS org_name,
             COALESCE(s.address, c.parcel_id) AS address,
             c.claimed_at::text, c.expires_at::text, c.activity_deadline::text, c.status
      FROM app.property_claims c
      JOIN app.orgs o ON o.id = c.claimed_by_org_id
      LEFT JOIN warehouse.scored_parcel_leads s ON s.parcel_id = c.parcel_id
      WHERE c.status = 'active'
      ORDER BY c.activity_deadline ASC
    `);

    // 4. All organizations for assign dropdown
    const orgs = await query<{
      id: string;
      name: string;
      subscription_tier: string;
      max_active_claims: number;
      max_monthly_claims: number;
      active_zones: number;
    }>(`
      SELECT o.id, o.name, o.subscription_tier, o.max_active_claims, o.max_monthly_claims,
             (SELECT count(*) FROM app.territory_subscriptions ts WHERE ts.org_id = o.id AND ts.status = 'active' AND (ts.ends_at IS NULL OR ts.ends_at > NOW()))::int AS active_zones
      FROM app.orgs o ORDER BY name ASC
    `);

    return Response.json({
      territories: territories.map((t) => ({
        ...t,
        total_pipeline_value: parseFloat(t.total_pipeline_value) || 0,
        total_sqft: parseInt(t.total_sqft) || 0,
        subscribers: subscriptions.filter((s) => s.territory_id === t.id && s.status === "active" && (!s.ends_at || new Date(s.ends_at) > new Date())),
        waitlist: subscriptions.filter((s) => s.territory_id === t.id && s.status === "waitlisted"),
        activeClaims: claims.filter((c) => c.territory_id === t.id),
      })),
      allClaims: claims,
      allOrgs: orgs,
    });
  } catch {
    return Response.json({ error: "Unauthorized: Superadmin access required." }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireSuperAdmin();
    const body = await req.json();
    const { action } = body;

    if (action === "grant_trial") {
      const {
        orgId,
        territoryId = "dallas-central-uptown",
        trialDays = 14,
        maxActiveClaims = 3,
        maxMonthlyClaims = 10,
      } = body;

      if (!orgId) {
        return Response.json({ error: "orgId is required." }, { status: 400 });
      }

      const days = Math.max(1, Math.min(Number(trialDays) || 14, 90));
      const activeClaims = Math.max(1, Number(maxActiveClaims) || 3);
      const monthlyClaims = Math.max(activeClaims, Number(maxMonthlyClaims) || 10);

      // Update org tier and limits for the trial period
      await query(
        `UPDATE app.orgs
         SET subscription_tier = 'pro_territory',
             max_active_claims = $1,
             max_monthly_claims = $2
         WHERE id = $3`,
        [activeClaims, monthlyClaims, orgId]
      );

      // Insert or update territory subscription with ends_at set to trial expiry
      await query(
        `INSERT INTO app.territory_subscriptions (territory_id, org_id, tier, starts_at, ends_at, status)
         VALUES ($1, $2, 'pro_territory', NOW(), NOW() + ($3 || ' days')::interval, 'active')
         ON CONFLICT (territory_id, org_id) DO UPDATE SET
           tier = 'pro_territory',
           status = 'active',
           starts_at = NOW(),
           ends_at = NOW() + ($3 || ' days')::interval`,
        [territoryId, orgId, days]
      );

      const sub = await queryOne<{ id: string; starts_at: string; ends_at: string }>(
        `SELECT id, starts_at::text, ends_at::text FROM app.territory_subscriptions
         WHERE territory_id = $1 AND org_id = $2`,
        [territoryId, orgId]
      );

      await recordActivity({
        actorId: actor.id,
        orgId,
        action: "admin.trial.grant",
        targetType: "territory",
        targetId: territoryId,
        detail: { trialDays: days, endsAt: sub?.ends_at, maxActiveClaims: activeClaims },
      });

      return Response.json({ ok: true, subscription: sub, trialDays: days });
    }

    if (action === "assign_subscription") {
      const { territoryId, orgId, tier = "pro_territory" } = body;
      if (!territoryId || !orgId) {
        return Response.json({ error: "territoryId and orgId are required." }, { status: 400 });
      }

      await query(
        `INSERT INTO app.territory_subscriptions (territory_id, org_id, tier, starts_at, ends_at, status)
         VALUES ($1, $2, $3, NOW(), NULL, 'active')
         ON CONFLICT (territory_id, org_id) DO UPDATE SET tier = $3, status = 'active', starts_at = NOW(), ends_at = NULL`,
        [territoryId, orgId, tier]
      );

      // Also ensure org tier is updated
      await query(
        `UPDATE app.orgs SET subscription_tier = $1,
         max_active_claims = CASE WHEN max_active_claims = 0 THEN 10 ELSE max_active_claims END,
         max_monthly_claims = CASE WHEN max_monthly_claims = 0 THEN 30 ELSE max_monthly_claims END
         WHERE id = $2`,
        [tier, orgId]
      );

      await recordActivity({
        actorId: actor.id,
        orgId,
        action: "admin.territory.assign",
        targetType: "territory",
        targetId: territoryId,
        detail: { tier },
      });

      return Response.json({ ok: true });
    }

    if (action === "remove_subscription") {
      const { territoryId, orgId } = body;
      await query(
        `UPDATE app.territory_subscriptions SET status = 'cancelled', ends_at = NOW()
         WHERE territory_id = $1 AND org_id = $2`,
        [territoryId, orgId]
      );

      // If org has no other active subscriptions, reset tier to shared_intelligence
      const otherActive = await queryOne<{ n: string }>(
        `SELECT count(*)::text as n FROM app.territory_subscriptions
         WHERE org_id = $1 AND status = 'active' AND (ends_at IS NULL OR ends_at > NOW())`,
        [orgId]
      );
      if (Number(otherActive?.n || 0) === 0) {
        await query(
          `UPDATE app.orgs SET subscription_tier = 'shared_intelligence', max_active_claims = 0 WHERE id = $1`,
          [orgId]
        );
      }

      await recordActivity({
        actorId: actor.id,
        orgId,
        action: "admin.territory.remove",
        targetType: "territory",
        targetId: territoryId,
      });

      return Response.json({ ok: true });
    }

    if (action === "override_release_claim") {
      const { claimId, reason = "admin_override" } = body;
      const row = await queryOne<{ parcel_id: string; claimed_by_org_id: string }>(
        `UPDATE app.property_claims
         SET status = 'released', release_reason = $1
         WHERE id = $2 AND status = 'active'
         RETURNING parcel_id, claimed_by_org_id`,
        [reason, claimId]
      );

      if (!row) {
        return Response.json({ error: "Active claim not found." }, { status: 404 });
      }

      await recordActivity({
        actorId: actor.id,
        orgId: row.claimed_by_org_id,
        action: "admin.claim.override_release",
        targetType: "property_claim",
        targetId: claimId,
        detail: { parcelId: row.parcel_id, reason },
      });

      return Response.json({ ok: true });
    }

    if (action === "update_org_tier") {
      const { orgId, subscriptionTier, maxActiveClaims, maxMonthlyClaims } = body;
      if (!orgId) return Response.json({ error: "orgId is required." }, { status: 400 });

      await query(
        `UPDATE app.orgs
         SET subscription_tier = COALESCE($1, subscription_tier),
             max_active_claims = COALESCE($2, max_active_claims),
             max_monthly_claims = COALESCE($3, max_monthly_claims)
         WHERE id = $4`,
        [subscriptionTier, maxActiveClaims, maxMonthlyClaims, orgId]
      );

      await recordActivity({
        actorId: actor.id,
        orgId,
        action: "admin.org.tier_update",
        targetType: "org",
        targetId: orgId,
        detail: { subscriptionTier, maxActiveClaims, maxMonthlyClaims },
      });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch {
    return Response.json({ error: "Admin request failed." }, { status: 500 });
  }
}
