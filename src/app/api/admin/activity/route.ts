import { adminResponse, listActivity } from "@/lib/admin";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") || "50");
    return Response.json(listActivity({
      orgId: url.searchParams.get("orgId") || undefined,
      userId: url.searchParams.get("userId") || undefined,
      action: url.searchParams.get("action") || undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    }));
  } catch (error) {
    return adminResponse(error);
  }
}
