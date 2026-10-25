import { requireUser } from "@/lib/auth";
import { getOrgTerritories } from "@/lib/territories";
import { loadJurisdictionPermits } from "@/lib/live/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const jurisdiction = new URL(req.url).searchParams.get("jurisdiction") ?? "";
    if (!jurisdiction.trim()) return Response.json({ error: "jurisdiction is required." }, { status: 400 });

    const isSuperAdmin = user.platformRole === "superadmin";
    let allowedZips: string[] = [];
    if (!isSuperAdmin) {
      const territories = await getOrgTerritories(user.orgId);
      allowedZips = territories.flatMap((t) => t.zipCodes || []);
      if (allowedZips.length === 0) {
        return Response.json({ jurisdiction, total: 0, permits: [], no_active_territory: true });
      }
    }

    const data = await loadJurisdictionPermits(jurisdiction);
    let permits = data.permits;
    if (!isSuperAdmin) {
      const zipSet = new Set(allowedZips.map((z) => z.slice(0, 5)));
      permits = permits.filter((p) => {
        if (p.zipCode && zipSet.has(p.zipCode.slice(0, 5))) return true;
        const m = p.address.match(/\b\d{5}\b/);
        if (m && zipSet.has(m[0])) return true;
        return false;
      });
    }

    return Response.json({ jurisdiction, total: permits.length, permits });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The data engine did not return permits.";
    const status = message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized") ? 401 : 502;
    return Response.json({ error: message }, { status });
  }
}

