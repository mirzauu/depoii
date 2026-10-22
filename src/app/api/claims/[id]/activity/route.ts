import { requireUser } from "@/lib/auth";
import { logClaimActivity, getClaimActivities } from "@/lib/claims";

export const dynamic = "force-dynamic";

/** GET /api/claims/[id]/activity — get audit log of activities for a claim */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: claimId } = await params;
    const activities = await getClaimActivities(claimId, user.orgId);
    return Response.json({ activities });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}

/** POST /api/claims/[id]/activity — log an activity on an active claim */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: claimId } = await params;
    const body = await req.json().catch(() => ({}));
    const { activityType, notes = "" } = body;

    if (!activityType || typeof activityType !== "string") {
      return Response.json({ error: "activityType is required." }, { status: 400 });
    }

    const result = await logClaimActivity(claimId, user.orgId, user.id, activityType, notes);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true, claim: result.claim });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
