import { requireUser } from "@/lib/auth";
import { deleteOrgRole, getUserEffectivePermissions, hasPermission, updateOrgRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const userPerms = await getUserEffectivePermissions(user.id, user.orgId);
    const canManage = user.role === "owner" || user.platformRole === "superadmin" || hasPermission(userPerms, "roles:manage");
    if (!canManage) {
      return Response.json({ error: "Only organization owners or administrators can update roles." }, { status: 403 });
    }

    const { id: roleId } = await context.params;
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      color?: string;
      permissions?: string[];
    };

    const result = await updateOrgRole(user.orgId, roleId, body);
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not update role." }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const userPerms = await getUserEffectivePermissions(user.id, user.orgId);
    const canManage = user.role === "owner" || user.platformRole === "superadmin" || hasPermission(userPerms, "roles:manage");
    if (!canManage) {
      return Response.json({ error: "Only organization owners or administrators can delete roles." }, { status: 403 });
    }

    const { id: roleId } = await context.params;
    const result = await deleteOrgRole(user.orgId, roleId);
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not delete role." }, { status: 400 });
  }
}
