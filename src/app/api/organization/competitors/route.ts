import { requireUser } from "@/lib/auth";
import { getTrueCompetitors, detectAndGetEncroachments } from "@/lib/competitor-intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [compData, alerts] = await Promise.all([
      getTrueCompetitors(user.orgId, user),
      detectAndGetEncroachments(user.orgId, user),
    ]);

    return Response.json({
      ok: true,
      turf: compData.turf,
      totalMarketVolumeInTurf: compData.totalMarketVolumeInTurf,
      totalMarketJobsInTurf: compData.totalMarketJobsInTurf,
      customerSharePct: compData.customerSharePct,
      rivals: compData.rivals,
      encroachments: alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load competitor intelligence.";
    const status = message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}
