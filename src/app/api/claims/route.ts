import { requireUser } from "@/lib/auth";
import { claimProperty, getOrgActiveClaims, getMonthlyClaimUsage } from "@/lib/claims";

export const dynamic = "force-dynamic";

/** GET /api/claims — get org's active claims + monthly usage stats */
export async function GET() {
  try {
    const user = await requireUser();
    const [claims, usage] = await Promise.all([
      getOrgActiveClaims(user.orgId),
      getMonthlyClaimUsage(user.orgId),
    ]);

    return Response.json({
      claims,
      usage,
    });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}

/** POST /api/claims — claim a property { parcelId } */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { parcelId } = body;

    if (!parcelId || typeof parcelId !== "string") {
      return Response.json({ error: "parcelId is required." }, { status: 400 });
    }

    const result = await claimProperty(user.orgId, parcelId, user.id);

    if (!result.ok) {
      const status =
        result.code === "ALREADY_CLAIMED"
          ? 409
          : result.code === "WRONG_TIER" || result.code === "NO_SUBSCRIPTION"
          ? 403
          : result.code === "MAX_ACTIVE" || result.code === "MAX_MONTHLY"
          ? 429
          : result.code === "NOT_FOUND"
          ? 404
          : 400;

      return Response.json({ error: result.error, code: result.code }, { status });
    }

    return Response.json({ claim: result.claim }, { status: 201 });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
