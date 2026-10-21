import { adminResponse, createOrganization, listOrgs } from "@/lib/admin";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSuperAdmin();
    return Response.json(await listOrgs());
  } catch (error) {
    return adminResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireSuperAdmin();
    const body = (await req.json()) as { name?: string; ownerName?: string; ownerEmail?: string; ownerPassword?: string };
    return Response.json(await createOrganization(actor.id, body), { status: 201 });
  } catch (error) {
    return adminResponse(error);
  }
}
