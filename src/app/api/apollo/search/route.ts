import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/pg";
import { searchApolloDecisionMakers } from "@/lib/apollo/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    const { domain, organizationName, titles, seniorities, page, perPage } = body;

    if (!domain && !organizationName) {
      return NextResponse.json(
        { error: "At least a company domain or organization name is required to search decision makers." },
        { status: 400 }
      );
    }

    // Call Apollo Search API (0 credits consumed)
    const searchResult = await searchApolloDecisionMakers({
      domain,
      organizationName,
      titles,
      seniorities,
      page,
      perPage,
    });

    // Check which candidates have already been revealed by this organization in our DB
    const personIds = searchResult.candidates.map((c) => c.id).filter(Boolean);

    if (personIds.length > 0) {
      const revealedRows = await query<{
        apollo_person_id: string;
        email: string | null;
        phone: string | null;
      }>(
        `select apollo_person_id, email, phone 
         from app.apollo_revealed_contacts 
         where org_id = $1 and apollo_person_id = any($2::text[])`,
        [user.orgId, personIds]
      );

      const revealedMap = new Map(
        revealedRows.map((r) => [r.apollo_person_id, { email: r.email, phone: r.phone }])
      );

      // Merge revealed state into response
      searchResult.candidates = searchResult.candidates.map((candidate) => {
        const revealed = revealedMap.get(candidate.id);
        if (revealed) {
          return {
            ...candidate,
            isUnlocked: true,
            email: revealed.email || undefined,
            phone: revealed.phone || undefined,
          };
        }
        return candidate;
      });
    }

    return NextResponse.json({
      success: true,
      creditsConsumed: 0,
      isDemoFallback: Boolean(searchResult.isDemoFallback),
      candidates: searchResult.candidates,
      pagination: searchResult.pagination,
    });
  } catch (error: any) {
    console.error("[Apollo Search Error]:", error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to search Apollo decision makers." },
      { status: status === 401 ? 401 : status === 403 ? 403 : 500 }
    );
  }
}

