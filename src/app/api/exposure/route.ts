import { loadUnresolvedExposure } from "@/lib/live/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const targets = await loadUnresolvedExposure();
    return Response.json({ total_targets: targets.length, targets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The data engine did not return exposure targets.";
    return Response.json({ error: message }, { status: 502 });
  }
}
