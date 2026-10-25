import { requireUser } from "@/lib/auth";
import {
  getOrgContractor,
  suggestContractorMatches,
  linkOrgContractor,
  unlinkOrgContractor,
} from "@/lib/contractor-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const linked = await getOrgContractor(user.orgId);

    // If not linked, get suggestions
    const url = new URL(req.url);
    const customQuery = url.searchParams.get("query") || user.orgName;
    const emailDomain = user.email ? user.email.split("@")[1] : undefined;

    const suggestions = linked ? [] : await suggestContractorMatches(customQuery, emailDomain);

    return Response.json({
      ok: true,
      orgId: user.orgId,
      orgName: user.orgName,
      linked,
      suggestions,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not load contractor profile." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.platformRole !== "superadmin") {
      return Response.json({ error: "Only Depoii Super Admins can link or verify a contractor profile." }, { status: 403 });
    }

    const body = (await req.json()) as { contractorId?: string; matchedVia?: "auto" | "manual" };
    if (!body.contractorId) {
      return Response.json({ error: "contractorId is required." }, { status: 400 });
    }

    const res = await linkOrgContractor(user.orgId, body.contractorId, body.matchedVia || "manual");
    if (!res.ok) {
      return Response.json({ error: res.error || "Failed to link profile." }, { status: 400 });
    }

    const linked = await getOrgContractor(user.orgId);
    return Response.json({ ok: true, linked });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not link contractor profile." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    if (user.platformRole !== "superadmin") {
      return Response.json({ error: "Only Depoii Super Admins can unlink a contractor profile." }, { status: 403 });
    }

    await unlinkOrgContractor(user.orgId);
    return Response.json({ ok: true });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ error: "Could not unlink contractor profile." }, { status: 400 });
  }
}
