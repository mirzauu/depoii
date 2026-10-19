import { adminResponse, createMember, listUsers } from "@/lib/admin";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperAdmin();
    return Response.json(listUsers());
  } catch (error) {
    return adminResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireSuperAdmin();
    const body = (await req.json()) as { email?: string; password?: string; name?: string; orgId?: string; role?: string };
    return Response.json(createMember(actor.id, body), { status: 201 });
  } catch (error) {
    return adminResponse(error);
  }
}
