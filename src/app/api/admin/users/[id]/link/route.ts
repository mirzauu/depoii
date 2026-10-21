import { recordActivity } from "@/lib/activity";
import { adminResponse } from "@/lib/admin";
import { createLoginLink, requireSuperAdmin, revokeLoginLink } from "@/lib/auth";
import { queryOne } from "@/lib/pg";

export const dynamic = "force-dynamic";

async function account(id: string) {
  return queryOne<{ email: string; org_id: string }>(
    `select u.email, (select m.org_id from app.memberships m where m.user_id = u.id limit 1) as org_id from app.users u where u.id = $1`,
    [id],
  );
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const created = await createLoginLink(id);
    if ("error" in created) return Response.json({ error: created.error }, { status: 400 });
    const acct = await account(id);
    await recordActivity({
      actorId: actor.id,
      orgId: acct?.org_id,
      action: "user.login_link",
      targetType: "user",
      targetId: id,
      detail: { email: acct?.email || "", expiresAt: created.expiresAt },
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
    const acct = await account(id);
    await revokeLoginLink(id);
    await recordActivity({
      actorId: actor.id,
      orgId: acct?.org_id,
      action: "user.login_link_revoke",
      targetType: "user",
      targetId: id,
      detail: { email: acct?.email || "" },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return adminResponse(error);
  }
}
