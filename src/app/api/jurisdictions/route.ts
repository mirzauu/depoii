import { loadJurisdictions } from "@/lib/live/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jurisdictions = await loadJurisdictions();
    return Response.json({ jurisdictions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The data engine did not return jurisdictions.";
    return Response.json({ error: message }, { status: 502 });
  }
}
