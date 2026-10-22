import { requireUser } from "@/lib/auth";
import { getLeadsForTerritory, hasActiveSubscription, getOrgTier } from "@/lib/territories";

export const dynamic = "force-dynamic";

/** GET /api/territories/[id]/leads — ranked leads for org's subscribed territory */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: territoryId } = await params;
    const url = new URL(req.url);

    // Check org tier — shared_intelligence can view but without contacts
    const orgTier = await getOrgTier(user.orgId);
    const isSubscribed = await hasActiveSubscription(user.orgId, territoryId);
    const isPaidTier = orgTier && orgTier.tier !== "shared_intelligence";

    const isSuperAdmin = user.platformRole === "superadmin";
    const canViewFull = isSuperAdmin || (Boolean(isPaidTier) && Boolean(isSubscribed));

    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search") || undefined;

    const result = await getLeadsForTerritory(territoryId, user.orgId, { limit, offset, search });

    // Mask owner info if contractor is not actively subscribed to this zone
    if (!canViewFull) {
      result.leads = result.leads.map((lead) => ({
        ...lead,
        ownerName: null,
        claimStatus: "available" as const,
        claimExpiresAt: null,
      }));
    }

    return Response.json({
      territoryId,
      isSubscribed: Boolean(isSubscribed),
      tier: orgTier?.tier || "shared_intelligence",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load territory leads.";
    const isAuthError = message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized");
    return Response.json({ error: message }, { status: isAuthError ? 401 : 500 });
  }
}
