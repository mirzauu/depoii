import { loadJurisdictionPermits } from "@/lib/live/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jurisdiction = new URL(req.url).searchParams.get("jurisdiction") ?? "";
  if (!jurisdiction.trim()) return Response.json({ error: "jurisdiction is required." }, { status: 400 });
  try {
    const data = await loadJurisdictionPermits(jurisdiction);
    return Response.json({ jurisdiction, total: data.total, permits: data.permits });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The data engine did not return permits.";
    return Response.json({ error: message }, { status: 502 });
  }
}
