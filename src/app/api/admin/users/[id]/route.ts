import { adminResponse, updateMember, userDetail } from "@/lib/admin";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    return Response.json(await userDetail(id));
  } catch (error) {
    return adminResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = (await req.json()) as { role?: string; orgId?: string; password?: string; disabled?: boolean; platformRole?: string };
    return Response.json(await updateMember(actor.id, id, body));
  } catch (error) {
    return adminResponse(error);
  }
}
