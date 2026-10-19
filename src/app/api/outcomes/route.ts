import { recordActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { clearOutcomes, listOutcomes, saveOutcomes } from "@/lib/db";
import type { FieldOutcome } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(listOutcomes(user.orgId));
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as FieldOutcome | { outcomes?: FieldOutcome[] };
    const outcomes = "outcomes" in body && Array.isArray(body.outcomes) ? body.outcomes : [body as FieldOutcome];
    if (outcomes.some((o) => !o?.parcelId || !o.stormId)) {
      return Response.json({ error: "Each outcome needs a parcelId and a stormId." }, { status: 400 });
    }
    saveOutcomes(outcomes, user.orgId);
    for (const outcome of outcomes) {
      recordActivity({
        actorId: user.id,
        orgId: user.orgId,
        action: "outcome.save",
        targetType: "outcome",
        targetId: outcome.id,
        detail: { parcelId: outcome.parcelId, stormId: outcome.stormId, scope: outcome.scope },
      });
    }
    return Response.json(listOutcomes(user.orgId));
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    clearOutcomes(user.orgId);
    return Response.json([]);
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
