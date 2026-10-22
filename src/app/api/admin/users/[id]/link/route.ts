import { recordActivity } from "@/lib/activity";
import { adminResponse } from "@/lib/admin";
import { createLoginLink, loginLinkStatus, requireSuperAdmin, revokeLoginLink, updateLoginLink } from "@/lib/auth";
import { queryOne } from "@/lib/pg";

export const dynamic = "force-dynamic";

async function account(id: string) {
  return queryOne<{ email: string; org_id: string }>(
    `select u.email, (select m.org_id from app.memberships m where m.user_id = u.id limit 1) as org_id from app.users u where u.id = $1`,
    [id],
  );
}

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const status = await loginLinkStatus(id);
    return Response.json({ link: status }, { headers: noCacheHeaders });
  } catch (error) {
    return adminResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      expiresInDays?: number;
      maxUses?: number | null;
    };
    const created = await createLoginLink(id, {
      expiresInDays: body.expiresInDays,
      maxUses: body.maxUses,
      createdBy: actor.id,
    });
    if ("error" in created) return Response.json({ error: created.error }, { status: 400 });
    const acct = await account(id);
    await recordActivity({
      actorId: actor.id,
      orgId: acct?.org_id,
      action: "user.login_link",
      targetType: "user",
      targetId: id,
      detail: {
        email: acct?.email || "",
        expiresAt: created.expiresAt,
        maxUses: created.maxUses === null ? "unlimited" : created.maxUses,
      },
    });
    const status = await loginLinkStatus(id);
    return Response.json(
      {
        token: created.token,
        expiresAt: created.expiresAt,
        maxUses: created.maxUses,
        useCount: created.useCount,
        isActive: created.isActive,
        link: status,
      },
      { headers: noCacheHeaders },
    );
  } catch (error) {
    return adminResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      isActive?: boolean;
      expiresInDays?: number;
      expiresAt?: string;
      maxUses?: number | null;
      resetUses?: boolean;
    };
    const updated = await updateLoginLink(id, body);
    if ("error" in updated) return Response.json({ error: updated.error }, { status: 400 });

    const acct = await account(id);
    const action =
      body.isActive === false
        ? "user.login_link_deactivate"
        : body.isActive === true
          ? "user.login_link_reactivate"
          : "user.login_link_update";

    await recordActivity({
      actorId: actor.id,
      orgId: acct?.org_id,
      action,
      targetType: "user",
      targetId: id,
      detail: {
        email: acct?.email || "",
        isActive: updated.status.isActive,
        expiresAt: updated.status.expiresAt,
        maxUses: updated.status.maxUses === null ? "unlimited" : updated.status.maxUses,
        useCount: updated.status.useCount,
      },
    });
    return Response.json({ ok: true, link: updated.status }, { headers: noCacheHeaders });
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
