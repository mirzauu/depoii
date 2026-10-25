import { requireUser } from "@/lib/auth";
import { getCounterStrikeTargets } from "@/lib/competitor-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const permit = url.searchParams.get("permit") || url.searchParams.get("address") || "";

    if (!permit) {
      return Response.json({ ok: false, error: "Permit number or target address is required." }, { status: 400 });
    }

    const targets = await getCounterStrikeTargets(permit, 5, user);
    return Response.json({ ok: true, targets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load counter-strike targets.";
    const status = message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}
