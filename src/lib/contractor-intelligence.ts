import { query, queryOne } from "@/lib/pg";

export interface LinkedContractorProfile {
  id: string;
  canonicalName: string;
  headquartersCity: string | null;
  headquartersState: string | null;
  hqAddress: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  totalPermits: number;
  totalValuation: number;
  totalValuationFormatted: string;
  primaryRoofSystem: string | null;
  bbbRating: string | null;
  bbbAccredited: boolean;
  bbbProfileUrl: string | null;
  verifiedAt: string | null;
  matchedVia: string | null;
  recentPermits: Array<{
    id: string;
    permitNumber: string;
    address: string;
    city: string;
    valuation: number;
    issueDate: string;
    probableRoofSystem: string;
  }>;
}

export interface ContractorMatchCandidate {
  id: string;
  canonicalName: string;
  headquartersCity: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
  totalPermits: number;
  totalValuation: number;
  primaryRoofSystem: string | null;
  confidenceScore: number;
  matchReason: string;
}

/**
 * Retrieves the linked canonical contractor profile for an organization,
 * including verified municipal permit totals and recent filings.
 */
export async function getOrgContractor(orgId: string): Promise<LinkedContractorProfile | null> {
  const org = await queryOne<{
    contractor_id: string | null;
    contractor_verified_at: string | null;
    contractor_matched_via: string | null;
  }>(
    `SELECT contractor_id, contractor_verified_at, contractor_matched_via 
     FROM app.orgs 
     WHERE id = $1`,
    [orgId],
  );

  if (!org || !org.contractor_id) return null;

  const contractor = await queryOne<Record<string, any>>(
    `SELECT c.*,
            coalesce((SELECT count(*) FROM warehouse.normalized_permits p WHERE p.contractor_id = c.id OR lower(p.contractor_name) = lower(c.canonical_name)), c.total_permits, 0) as live_permit_count,
            coalesce((SELECT sum(p.valuation) FROM warehouse.normalized_permits p WHERE p.contractor_id = c.id OR lower(p.contractor_name) = lower(c.canonical_name)), c.total_valuation, 0) as live_total_val
     FROM warehouse.canonical_contractors c
     WHERE c.id = $1`,
    [org.contractor_id],
  );

  if (!contractor) return null;

  // Fetch recent permits
  const recentPermits = await query<Record<string, any>>(
    `SELECT id, raw_permit_number, normalized_address, city, valuation, issue_date, probable_roof_system
     FROM warehouse.normalized_permits
     WHERE contractor_id = $1 OR lower(contractor_name) = lower($2)
     ORDER BY issue_date DESC NULLS LAST
     LIMIT 10`,
    [contractor.id, contractor.canonical_name],
  );

  const val = Number(contractor.live_total_val || contractor.total_valuation || 0);

  return {
    id: contractor.id,
    canonicalName: contractor.canonical_name,
    headquartersCity: contractor.headquarters_city,
    headquartersState: contractor.headquarters_state,
    hqAddress: contractor.hq_address,
    phoneNumber: contractor.phone_number,
    websiteUrl: contractor.website_url,
    totalPermits: Number(contractor.live_permit_count || contractor.total_permits || 0),
    totalValuation: val,
    totalValuationFormatted: val >= 1e6 ? `$${(val / 1e6).toFixed(2)}M` : `$${Math.trunc(val).toLocaleString()}`,
    primaryRoofSystem: contractor.primary_roof_system,
    bbbRating: contractor.bbb_rating,
    bbbAccredited: Boolean(contractor.bbb_accredited),
    bbbProfileUrl: contractor.bbb_profile_url,
    verifiedAt: org.contractor_verified_at ? String(org.contractor_verified_at) : null,
    matchedVia: org.contractor_matched_via || "manual",
    recentPermits: recentPermits.map((p) => ({
      id: p.id,
      permitNumber: p.raw_permit_number,
      address: p.normalized_address,
      city: p.city,
      valuation: Number(p.valuation || 0),
      issueDate: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
      probableRoofSystem: p.probable_roof_system || "Commercial Re-Roof",
    })),
  };
}

/**
 * Searches and suggests canonical contractor profile candidates based on organization name or domain.
 * Supports DBA parsing (e.g. "New View Roofing" matches "Mob Home Solutions Inc Dba New View Roofing").
 */
export async function suggestContractorMatches(
  orgName: string,
  domain?: string,
): Promise<ContractorMatchCandidate[]> {
  const cleanOrg = (orgName || "").trim();
  if (!cleanOrg && !domain) return [];

  // Normalize search tokens
  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() : "";

  const results = await query<Record<string, any>>(
    `SELECT c.id, c.canonical_name, c.headquarters_city, c.phone_number, c.website_url, 
            c.total_permits, c.total_valuation, c.primary_roof_system
     FROM warehouse.canonical_contractors c
     WHERE lower(c.canonical_name) = lower($1)
        OR lower(c.canonical_name) LIKE '%' || lower($1) || '%'
        OR lower($1) LIKE '%' || lower(c.canonical_name) || '%'
        OR (length($2) > 3 AND lower(coalesce(c.website_url, '')) LIKE '%' || lower($2) || '%')
     ORDER BY 
       CASE 
         WHEN lower(c.canonical_name) = lower($1) THEN 100
         WHEN lower(c.canonical_name) LIKE '%dba ' || lower($1) || '%' THEN 95
         WHEN lower(c.canonical_name) LIKE '%' || lower($1) || '%' THEN 80
         WHEN length($2) > 3 AND lower(coalesce(c.website_url, '')) LIKE '%' || lower($2) || '%' THEN 75
         ELSE 50
       END DESC,
       c.total_permits DESC
     LIMIT 5`,
    [cleanOrg, cleanDomain],
  );

  return results.map((r) => {
    let score = 60;
    let reason = "Partial name match";
    const cName = (r.canonical_name || "").toLowerCase();
    const target = cleanOrg.toLowerCase();

    if (cName === target) {
      score = 98;
      reason = "Exact business name match";
    } else if (cName.includes(`dba ${target}`)) {
      score = 95;
      reason = "Verified DBA registered entity match";
    } else if (cName.includes(target)) {
      score = 85;
      reason = "Contractor name substring match";
    } else if (cleanDomain && (r.website_url || "").toLowerCase().includes(cleanDomain)) {
      score = 90;
      reason = "Verified website domain match";
    }

    return {
      id: r.id,
      canonicalName: r.canonical_name,
      headquartersCity: r.headquarters_city,
      phoneNumber: r.phone_number,
      websiteUrl: r.website_url,
      totalPermits: Number(r.total_permits || 0),
      totalValuation: Number(r.total_valuation || 0),
      primaryRoofSystem: r.primary_roof_system,
      confidenceScore: score,
      matchReason: reason,
    };
  });
}

/**
 * Links an organization to a verified canonical contractor profile.
 */
export async function linkOrgContractor(
  orgId: string,
  contractorId: string,
  matchedVia: "auto" | "manual" = "manual",
): Promise<{ ok: boolean; error?: string }> {
  const contractor = await queryOne<{ id: string }>(
    `SELECT id FROM warehouse.canonical_contractors WHERE id = $1`,
    [contractorId],
  );

  if (!contractor) {
    return { ok: false, error: "Contractor profile not found." };
  }

  await query(
    `UPDATE app.orgs 
     SET contractor_id = $1, 
         contractor_verified_at = NOW(), 
         contractor_matched_via = $2 
     WHERE id = $3`,
    [contractorId, matchedVia, orgId],
  );

  // Compute and cache turf profile immediately
  const { computeOrgTurfProfile } = await import("@/lib/turf-profiler");
  await computeOrgTurfProfile(orgId).catch(() => null);

  return { ok: true };
}

/**
 * Unlinks an organization's contractor profile.
 */
export async function unlinkOrgContractor(orgId: string): Promise<{ ok: boolean }> {
  await query(
    `UPDATE app.orgs 
     SET contractor_id = NULL, 
         contractor_verified_at = NULL, 
         contractor_matched_via = NULL 
     WHERE id = $1`,
    [orgId],
  );
  await query(`DELETE FROM app.org_turf_profiles WHERE org_id = $1`, [orgId]).catch(() => null);
  return { ok: true };
}

/**
 * Checks if a specific parcel/address was installed/permitted by the given organization's linked contractor.
 */
export async function checkOrgInstalledParcel(
  orgId: string,
  parcelIdOrAddress: string,
): Promise<{ isOwnInstallation: boolean; permitNumber?: string; issueDate?: string; valuation?: number }> {
  const org = await queryOne<{ contractor_id: string }>(
    `SELECT contractor_id FROM app.orgs WHERE id = $1`,
    [orgId],
  );

  if (!org?.contractor_id) {
    return { isOwnInstallation: false };
  }

  const match = await queryOne<Record<string, any>>(
    `SELECT p.raw_permit_number, p.issue_date, p.valuation
     FROM warehouse.normalized_permits p
     WHERE (p.contractor_id = $1 OR lower(p.contractor_name) = (SELECT lower(canonical_name) FROM warehouse.canonical_contractors WHERE id = $1))
       AND (p.parcel_id = $2 OR lower(p.normalized_address) = lower($2))
     ORDER BY p.issue_date DESC NULLS LAST
     LIMIT 1`,
    [org.contractor_id, parcelIdOrAddress],
  );

  if (match) {
    return {
      isOwnInstallation: true,
      permitNumber: match.raw_permit_number,
      issueDate: match.issue_date ? String(match.issue_date).slice(0, 10) : undefined,
      valuation: Number(match.valuation || 0),
    };
  }

  return { isOwnInstallation: false };
}
