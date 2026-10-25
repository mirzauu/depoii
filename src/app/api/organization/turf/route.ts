import { requireUser } from "@/lib/auth";
import { getOrgTurfProfile } from "@/lib/turf-profiler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const turf = await getOrgTurfProfile(user.orgId);
    return Response.json({ ok: true, turf });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load turf profile.";
    const status = message.toLowerCase().includes("sign in") || message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}
