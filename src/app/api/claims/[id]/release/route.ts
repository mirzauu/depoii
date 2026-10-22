import { requireUser } from "@/lib/auth";
import { releaseProperty } from "@/lib/claims";

export const dynamic = "force-dynamic";

/** POST /api/claims/[id]/release — release an active property claim */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: claimId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : "manual";

    const result = await releaseProperty(claimId, user.orgId, user.id, reason);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
