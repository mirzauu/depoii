import { fetchPermitContactsOnDemand } from "@/lib/contacts/scraper";
import { readPermitContacts } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  if (!decodedId) return Response.json({ error: "Permit ID is required." }, { status: 400 });

  const recordUrl = new URL(req.url).searchParams.get("recordUrl");
  const cached = readPermitContacts(decodedId);
  if (cached.length > 0) {
    return Response.json({ permitId: decodedId, contacts: cached, source: "cached" });
  }

  const contacts = await fetchPermitContactsOnDemand(decodedId, recordUrl);
  return Response.json({
    permitId: decodedId,
    contacts,
    source: contacts.length > 0 ? "live-scraped" : "none",
  });
}
