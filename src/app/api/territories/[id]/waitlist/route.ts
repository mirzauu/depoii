import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/pg";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** POST /api/territories/[id]/waitlist — join waitlist for a full territory zone */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: territoryId } = await params;

    // Check if territory exists
    const territory = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM app.territories WHERE id = $1`,
      [territoryId]
    );
    if (!territory) {
      return Response.json({ error: "Territory not found." }, { status: 404 });
    }

    // Check if already subscribed or waitlisted
    const existing = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM app.territory_subscriptions WHERE territory_id = $1 AND org_id = $2`,
      [territoryId, user.orgId]
    );

    if (existing) {
      if (existing.status === "active") {
        return Response.json({ error: "Your organization is already actively subscribed to this zone." }, { status: 400 });
      }
      if (existing.status === "waitlisted") {
        return Response.json({ ok: true, message: "Already on waitlist.", status: "waitlisted" });
      }
      // Re-activate waitlist if previously cancelled
      await query(
        `UPDATE app.territory_subscriptions SET status = 'waitlisted', starts_at = NOW() WHERE id = $1`,
        [existing.id]
      );
    } else {
      await query(
        `INSERT INTO app.territory_subscriptions (territory_id, org_id, tier, status)
         VALUES ($1, $2, 'pro_territory', 'waitlisted')`,
        [territoryId, user.orgId]
      );
    }

    await recordActivity({
      actorId: user.id,
      orgId: user.orgId,
      action: "territory.waitlist.join",
      targetType: "territory",
      targetId: territoryId,
      detail: { territoryName: territory.name },
    });

    return Response.json({ ok: true, status: "waitlisted" });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
