import { requireSuperAdmin } from "@/lib/auth";
import { query } from "@/lib/pg";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperAdmin();

    // 1. Zone Utilization
    const zoneUtilization = await query<{
      id: string;
      name: string;
      total_parcels: number;
      total_pipeline_value: string;
      active_subscribers: string;
      active_claims: string;
    }>(`
      SELECT t.id, t.name, t.total_parcels, t.total_pipeline_value::text,
        (SELECT COUNT(*) FROM app.territory_subscriptions ts WHERE ts.territory_id = t.id AND ts.status = 'active')::text AS active_subscribers,
        (SELECT COUNT(*) FROM app.property_claims c WHERE c.territory_id = t.id AND c.status = 'active')::text AS active_claims
      FROM app.territories t
      WHERE t.market = 'dallas'
      ORDER BY t.name
    `);

    // 2. Conversion Funnel from app.leads and app.property_claims
    const funnelStages = await query<{ stage: string; count: string; value: string }>(`
      SELECT stage, COUNT(*)::text as count, COALESCE(SUM(price), 0)::text as value
      FROM app.leads
      GROUP BY stage
    `);

    const totalClaimsAllTime = await query<{ total_claims: string; converted: string }>(`
      SELECT
        COUNT(*)::text AS total_claims,
        COUNT(*) FILTER (WHERE status = 'converted')::text AS converted
      FROM app.property_claims
    `);

    // 3. Activity Health (last 7 days vs 30 days)
    const activityStats = await query<{
      activities_7d: string;
      activities_30d: string;
      phone_calls: string;
      site_visits: string;
      bids_submitted: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS activities_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS activities_30d,
        COUNT(*) FILTER (WHERE activity_type = 'phone_call')::text AS phone_calls,
        COUNT(*) FILTER (WHERE activity_type = 'site_visit')::text AS site_visits,
        COUNT(*) FILTER (WHERE activity_type = 'bid_submitted')::text AS bids_submitted
      FROM app.claim_activities
    `);

    // 4. MRR calculation based on active subscriptions
    const subTiers = await query<{ tier: string; count: string }>(`
      SELECT tier, COUNT(*)::text as count
      FROM app.territory_subscriptions
      WHERE status = 'active'
      GROUP BY tier
    `);

    let mrr = 0;
    for (const st of subTiers) {
      const cnt = parseInt(st.count) || 0;
      if (st.tier === "pro_territory") mrr += cnt * 1199;
      if (st.tier === "exclusive_zone") mrr += cnt * 2499;
      if (st.tier === "shared_intelligence") mrr += cnt * 499;
    }

    return Response.json({
      zones: zoneUtilization.map((z) => ({
        id: z.id,
        name: z.name,
        totalParcels: z.total_parcels,
        totalPipelineValue: parseFloat(z.total_pipeline_value) || 0,
        activeSubscribers: parseInt(z.active_subscribers) || 0,
        activeClaims: parseInt(z.active_claims) || 0,
        utilizationPct: z.total_parcels > 0 ? Math.round(((parseInt(z.active_claims) || 0) / z.total_parcels) * 100) : 0,
      })),
      funnel: {
        totalClaims: parseInt(totalClaimsAllTime[0]?.total_claims || "0"),
        convertedClaims: parseInt(totalClaimsAllTime[0]?.converted || "0"),
        pipelineByStage: funnelStages.map((f) => ({
          stage: f.stage,
          count: parseInt(f.count) || 0,
          value: parseFloat(f.value) || 0,
        })),
      },
      activity: {
        last7Days: parseInt(activityStats[0]?.activities_7d || "0"),
        last30Days: parseInt(activityStats[0]?.activities_30d || "0"),
        phoneCalls: parseInt(activityStats[0]?.phone_calls || "0"),
        siteVisits: parseInt(activityStats[0]?.site_visits || "0"),
        bidsSubmitted: parseInt(activityStats[0]?.bids_submitted || "0"),
      },
      revenue: {
        mrr,
        arr: mrr * 12,
        activeSubscriptions: subTiers.reduce((acc, st) => acc + (parseInt(st.count) || 0), 0),
      },
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
}
