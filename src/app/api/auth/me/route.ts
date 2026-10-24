import { requireUser } from "@/lib/auth";
import { getUserEffectivePermissions } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const permissions = await getUserEffectivePermissions(user.id, user.orgId);
    return Response.json({
      id: user.id,
      email: user.email,
      name: user.name,
      orgId: user.orgId,
      orgName: user.orgName,
      role: user.role,
      platformRole: user.platformRole,
      contractorId: user.contractorId || null,
      permissions,
    });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
