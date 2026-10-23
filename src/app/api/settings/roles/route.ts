import { requireUser } from "@/lib/auth";
import { ALL_PERMISSIONS, createOrgRole, getOrgRoles, getUserEffectivePermissions, hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const roles = await getOrgRoles(user.orgId);
    const userPerms = await getUserEffectivePermissions(user.id, user.orgId);
    const canManageRoles = user.role === "owner" || user.platformRole === "superadmin" || hasPermission(userPerms, "roles:manage");

    return Response.json({
      roles,
      permissions: ALL_PERMISSIONS,
      canManageRoles,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not load roles." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const userPerms = await getUserEffectivePermissions(user.id, user.orgId);
    const canManage = user.role === "owner" || user.platformRole === "superadmin" || hasPermission(userPerms, "roles:manage");
    if (!canManage) {
      return Response.json({ error: "Only organization owners or administrators can create custom roles." }, { status: 403 });
    }

    const body = (await req.json()) as {
      name?: string;
      description?: string;
      color?: string;
      permissions?: string[];
    };

    if (!body.name || !body.name.trim()) {
      return Response.json({ error: "Role name is required." }, { status: 400 });
    }

    const result = await createOrgRole(user.orgId, {
      name: body.name,
      description: body.description,
      color: body.color,
      permissions: body.permissions || [],
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true, role: result.role });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not create role." }, { status: 400 });
  }
}
