import {
  cancelTeamInvite,
  createTeamInvite,
  listOrgMembers,
  listPendingInvites,
  requireUser,
  resendTeamInvite,
  resolveOrgRole,
} from "@/lib/auth";
import { getOrgRoles } from "@/lib/roles";
import { query } from "@/lib/pg";

export const dynamic = "force-dynamic";

function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

export async function GET() {
  try {
    const user = await requireUser();
    const roles = await getOrgRoles(user.orgId);
    return Response.json({
      orgName: user.orgName,
      members: await listOrgMembers(user.orgId),
      invites: await listPendingInvites(user.orgId),
      roles,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not load the team." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "owner" && user.platformRole !== "superadmin") {
      return Response.json({ error: "Only an organization owner can manage the team." }, { status: 403 });
    }
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      role?: string;
      memberId?: string;
      inviteId?: string;
      action?: string;
    };

    if (body.action === "update_role" && body.memberId && body.role) {
      const { role, roleId } = await resolveOrgRole(user.orgId, body.role);
      await query(
        `update app.memberships set role = $1, role_id = $2 where org_id = $3 and user_id = $4`,
        [role, roleId || null, user.orgId, body.memberId],
      );
      return Response.json({ ok: true });
    }

    if (body.action === "resend" && body.inviteId) {
      const result = await resendTeamInvite(user.orgId, body.inviteId, user, requestOrigin(req));
      if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (body.action === "cancel" && body.inviteId) {
      const result = await cancelTeamInvite(user.orgId, body.inviteId, user.id);
      if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true });
    }

    const result = await createTeamInvite({
      orgId: user.orgId,
      orgName: user.orgName,
      invitedBy: user,
      name: body.name,
      email: body.email,
      role: body.role,
      origin: requestOrigin(req),
    });
    if ("error" in result) {
      const status = result.error.includes("already") ? 409 : 400;
      return Response.json({ error: result.error }, { status });
    }
    return Response.json({ invite: result.invite });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not update the team." }, { status: 400 });
  }
}
