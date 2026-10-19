import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({
      email: user.email,
      name: user.name,
      orgId: user.orgId,
      orgName: user.orgName,
      role: user.role,
      platformRole: user.platformRole,
    });
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
}
