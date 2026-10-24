import { requireSuperAdmin } from "@/lib/auth";
import { adminResponse } from "@/lib/admin";
import { query } from "@/lib/pg";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (!q) {
      // Return top contractors by permits if no search query provided
      const rows = await query<Record<string, any>>(
        `SELECT id, canonical_name, headquarters_city, headquarters_state, 
                total_permits, total_valuation, primary_roof_system,
                phone_number, website_url, bbb_rating, bbb_accredited
         FROM warehouse.canonical_contractors
         WHERE total_permits > 0
         ORDER BY total_permits DESC, total_valuation DESC
         LIMIT 20`
      );
      return Response.json({
        contractors: rows.map((r) => ({
          id: r.id,
          canonicalName: r.canonical_name,
          headquartersCity: r.headquarters_city,
          headquartersState: r.headquarters_state,
          totalPermits: Number(r.total_permits || 0),
          totalValuation: Number(r.total_valuation || 0),
          primaryRoofSystem: r.primary_roof_system,
          phoneNumber: r.phone_number,
          websiteUrl: r.website_url,
          bbbRating: r.bbb_rating,
          bbbAccredited: Boolean(r.bbb_accredited),
        })),
      });
    }

    const rows = await query<Record<string, any>>(
      `SELECT id, canonical_name, headquarters_city, headquarters_state, 
              total_permits, total_valuation, primary_roof_system,
              phone_number, website_url, bbb_rating, bbb_accredited
       FROM warehouse.canonical_contractors
       WHERE lower(canonical_name) LIKE '%' || lower($1) || '%'
          OR id = $1
          OR lower(coalesce(phone_number, '')) LIKE '%' || lower($1) || '%'
          OR lower(coalesce(hq_address, '')) LIKE '%' || lower($1) || '%'
       ORDER BY 
         CASE 
           WHEN lower(canonical_name) = lower($1) THEN 100
           WHEN lower(canonical_name) LIKE '%dba ' || lower($1) || '%' THEN 95
           WHEN lower(canonical_name) LIKE lower($1) || '%' THEN 80
           ELSE 50
         END DESC,
         total_permits DESC
       LIMIT 25`,
      [q]
    );

    return Response.json({
      contractors: rows.map((r) => ({
        id: r.id,
        canonicalName: r.canonical_name,
        headquartersCity: r.headquarters_city,
        headquartersState: r.headquarters_state,
        totalPermits: Number(r.total_permits || 0),
        totalValuation: Number(r.total_valuation || 0),
        primaryRoofSystem: r.primary_roof_system,
        phoneNumber: r.phone_number,
        websiteUrl: r.website_url,
        bbbRating: r.bbb_rating,
        bbbAccredited: Boolean(r.bbb_accredited),
      })),
    });
  } catch (error) {
    return adminResponse(error);
  }
}
