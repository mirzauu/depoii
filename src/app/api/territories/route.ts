import { requireUser } from "@/lib/auth";
import { getTerritoriesForMarket, getOrgTerritories } from "@/lib/territories";

export const dynamic = "force-dynamic";

/** GET /api/territories?market=dallas  — list territories with availability */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const market = url.searchParams.get("market") || "dallas";

    const territories = await getTerritoriesForMarket(market);
    const orgTerritories = await getOrgTerritories(user.orgId);
    const subscribedIds = new Set(orgTerritories.map((t) => t.id));

    return Response.json({
      market,
      territories: territories.map((t) => ({
        ...t,
        isSubscribed: subscribedIds.has(t.id),
      })),
    });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
