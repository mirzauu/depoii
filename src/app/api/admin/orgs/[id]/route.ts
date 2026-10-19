import { adminResponse, organizationDetail, updateOrganization } from "@/lib/admin";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    return Response.json(organizationDetail(id));
  } catch (error) {
    return adminResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = (await req.json()) as { name?: string; disabled?: boolean };
    return Response.json(updateOrganization(actor.id, id, body));
  } catch (error) {
    return adminResponse(error);
  }
}
