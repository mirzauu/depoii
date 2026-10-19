import { recordActivity } from "@/lib/activity";
import { adminResponse } from "@/lib/admin";
import { createLoginLink, requireSuperAdmin, revokeLoginLink } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const created = createLoginLink(id);
    if ("error" in created) return Response.json({ error: created.error }, { status: 400 });
    const account = getDb().prepare(`SELECT email, (SELECT org_id FROM memberships WHERE user_id = ? LIMIT 1) AS org_id FROM users WHERE id = ?`).get(id, id) as { email: string; org_id: string } | undefined;
    recordActivity({
      actorId: actor.id,
      orgId: account?.org_id,
      action: "user.login_link",
      targetType: "user",
      targetId: id,
      detail: { email: account?.email || "", expiresAt: created.expiresAt },
    });
    return Response.json({ token: created.token, expiresAt: created.expiresAt });
  } catch (error) {
    return adminResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const account = getDb().prepare(`SELECT email, (SELECT org_id FROM memberships WHERE user_id = ? LIMIT 1) AS org_id FROM users WHERE id = ?`).get(id, id) as { email: string; org_id: string } | undefined;
    revokeLoginLink(id);
    recordActivity({
      actorId: actor.id,
      orgId: account?.org_id,
      action: "user.login_link_revoke",
      targetType: "user",
      targetId: id,
      detail: { email: account?.email || "" },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return adminResponse(error);
  }
}
