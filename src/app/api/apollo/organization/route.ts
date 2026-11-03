import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { enrichApolloOrganization } from "@/lib/apollo/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json({ error: "Missing domain query parameter" }, { status: 400 });
    }

    const org = await enrichApolloOrganization(domain);

    if (!org) {
      return NextResponse.json({ success: false, message: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      creditsConsumed: 0,
      organization: org,
    });
  } catch (error: any) {
    console.error("[Apollo Org Route Error]:", error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to fetch organization details" },
      { status: status === 401 ? 401 : 500 }
    );
  }
}

