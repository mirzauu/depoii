import { fetchPermitContactsOnDemand } from "@/lib/contacts/scraper";
import { readPermitContacts } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/pg";
import { canOrgAccessParcel } from "@/lib/territories";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    if (!decodedId) return Response.json({ error: "Permit ID is required." }, { status: 400 });

    if (user.platformRole !== "superadmin") {
      const pRow = await queryOne<{ parcel_id: string }>(
        `SELECT parcel_id FROM warehouse.normalized_permits WHERE id = $1 OR raw_permit_number = $1 LIMIT 1`,
        [decodedId]
      );
      if (pRow?.parcel_id) {
        const access = await canOrgAccessParcel(user.orgId, pRow.parcel_id, false);
        if (!access.allowed) {
          return Response.json(
            { error: access.reason || "This permit belongs to a property outside your subscribed territories." },
            { status: 403 }
          );
        }
      }
    }

    const recordUrl = new URL(req.url).searchParams.get("recordUrl");
    const cached = await readPermitContacts(decodedId);
    if (cached.length > 0) {
      return Response.json({ permitId: decodedId, contacts: cached, source: "cached" });
    }

    const contacts = await fetchPermitContactsOnDemand(decodedId, recordUrl);
    return Response.json({
      permitId: decodedId,
      contacts,
      source: contacts.length > 0 ? "live-scraped" : "none",
    });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
