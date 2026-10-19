import { adminResponse, overview } from "@/lib/admin";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperAdmin();
    return Response.json(overview());
  } catch (error) {
    return adminResponse(error);
  }
}
