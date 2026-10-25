import { loadLive } from "@/lib/live/load";
import { getSessionUser } from "@/lib/auth";
import { getOrgTerritories } from "@/lib/territories";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const encoder = new TextEncoder();
  const user = await getSessionUser();
  const isSuperAdmin = user?.platformRole === "superadmin";

  let allowedZips: string[] | null = null;
  if (user && !isSuperAdmin) {
    const territories = await getOrgTerritories(user.orgId);
    allowedZips = territories.flatMap((t) => t.zipCodes || []);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
      try {
        const data = await loadLive(
          { stormId: url.searchParams.get("storm"), refresh: url.searchParams.get("refresh") === "1", jurisdiction: url.searchParams.get("jurisdiction") },
          (done, total) => send({ done, total }),
        );

        if (!user || (!isSuperAdmin && (!allowedZips || allowedZips.length === 0))) {
          // Zero leakage: unauthenticated or unsubscribed organizations receive no out-of-territory lead data
          data.parcels = [];
          data.permits = [];
          data.developments = [];
        } else if (!isSuperAdmin && allowedZips) {
          const zipSet = new Set(allowedZips.map((z) => z.slice(0, 5)));
          data.parcels = data.parcels.filter((p) => {
            if (p.zipCode && zipSet.has(p.zipCode.slice(0, 5))) return true;
            const m = p.address.match(/\b\d{5}\b/);
            if (m && zipSet.has(m[0])) return true;
            return false;
          });
          const allowedParcelIds = new Set(data.parcels.map((p) => p.id));
          data.permits = data.permits.filter((p) => {
            if (p.parcelId && allowedParcelIds.has(p.parcelId)) return true;
            if (p.parcelIds && p.parcelIds.some((id) => allowedParcelIds.has(id))) return true;
            const m = p.address.match(/\b\d{5}\b/);
            if (m && zipSet.has(m[0])) return true;
            return false;
          });
          data.developments = data.developments.filter((p) => {
            if (p.parcelId && allowedParcelIds.has(p.parcelId)) return true;
            if (p.parcelIds && p.parcelIds.some((id) => allowedParcelIds.has(id))) return true;
            const m = p.address.match(/\b\d{5}\b/);
            if (m && zipSet.has(m[0])) return true;
            return false;
          });
        }

        send({ data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The public feeds did not respond.";
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

