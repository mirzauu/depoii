import { requireUser } from "@/lib/auth";
import * as intel from "@/lib/warehouse-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const data = await intel.unresolvedExposure(url.searchParams, user);
    return Response.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "The data engine did not return exposure targets.";
    return Response.json({ error: message }, { status: 500 });
  }
}
