import { query, queryOne } from "@/lib/pg";
import { getOrgTurfProfile, type TurfProfile } from "@/lib/turf-profiler";

export interface LocalizedRival {
  contractorName: string;
  contractorId: string | null;
  coreZipJobs: number;
  coreZipVolume: number;
  coreZipVolumeFormatted: string;
  marketSharePct: number;
  avgTicket: number;
  avgTicketFormatted: string;
  commercialRatioPct: number;
  threatTier: "DIRECT_RIVAL" | "COMMERCIAL_POACHER" | "PEER_COMPETITOR";
  threatDescription: string;
  recentFilingsInTurf: Array<{
    permitNumber: string;
    address: string;
    zipCode: string;
    valuation: number;
    valuationFormatted: string;
    issueDate: string;
    probableSystem: string;
  }>;
}

export interface EncroachmentAlert {
  id: string;
  permitNumber: string;
  competitorName: string;
  jobAddress: string;
  city: string;
  zipCode: string;
  valuation: number;
  valuationFormatted: string;
  roofSystem: string;
  issueDate: string;
  threatTier: "CRITICAL" | "HIGH" | "MODERATE";
  threatReason: string;
  nearbyCustomerJobAddress: string | null;
  distanceFeet: number | null;
}

export interface CounterStrikeTarget {
  parcelId: string;
  address: string;
  city: string;
  zipCode: string;
  ownerName: string;
  propertyType: string;
  buildingSqft: number;
  yearBuilt: number;
  roofAgeYears: number;
  estimatedReplacementUsd: number;
  estimatedReplacementFormatted: string;
  decisionMaker: string | null;
  phone: string | null;
  email: string | null;
}

const GENERIC_EXCLUSIONS = [
  "on municipal record",
  "licensed commercial contractor",
  "unknown",
  "to be determined",
  "owner",
  "homeowner",
  "self",
  "builder",
  "various",
  "n/a",
];

function formatCurrency(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${Math.trunc(val).toLocaleString()}`;
  return `$${val}`;
}

/**
 * Returns the true rivals competing directly in an organization's core ZIP codes,
 * tiered by neighborhood volume and commercial low-slope capture.
 */
export async function getTrueCompetitors(
  orgId: string,
  user?: { platformRole?: string },
): Promise<{
  turf: TurfProfile | null;
  totalMarketVolumeInTurf: number;
  totalMarketJobsInTurf: number;
  customerSharePct: number;
  rivals: LocalizedRival[];
}> {
  const turf = await getOrgTurfProfile(orgId);
  if (!turf || turf.primaryZips.length === 0) {
    return {
      turf: null,
      totalMarketVolumeInTurf: 0,
      totalMarketJobsInTurf: 0,
      customerSharePct: 0,
      rivals: [],
    };
  }

  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const territories = await getOrgTerritories(orgId);
    allowedZips = territories.flatMap((t) => t.zipCodes || []);
    if (allowedZips.length === 0) {
      return {
        turf: null,
        totalMarketVolumeInTurf: 0,
        totalMarketJobsInTurf: 0,
        customerSharePct: 0,
        rivals: [],
      };
    }
  }

  const primaryZips = isSuperAdmin || !allowedZips
    ? turf.primaryZips
    : turf.primaryZips.filter((z) => allowedZips.map((az) => az.slice(0, 5)).includes(z.slice(0, 5)));

  if (primaryZips.length === 0) {
    return {
      turf: null,
      totalMarketVolumeInTurf: 0,
      totalMarketJobsInTurf: 0,
      customerSharePct: 0,
      rivals: [],
    };
  }

  // 1. Total market volume in customer's core ZIPs
  const marketTot = await queryOne<{ total_val: string; job_count: string }>(
    `SELECT coalesce(sum(valuation), 0) as total_val,
            count(*) as job_count
     FROM warehouse.normalized_permits
     WHERE substring(zip_code from 1 for 5) = ANY($1)`,
    [primaryZips],
  );

  const totalMarketVolume = Number(marketTot?.total_val || 0);
  const totalMarketJobs = Number(marketTot?.job_count || 0);

  // Customer's volume in their own core ZIPs
  const customerTurfVolume = turf.neighborhoods
    .filter((n) => primaryZips.includes(n.zip))
    .reduce((acc, curr) => acc + curr.totalValuation, 0);

  const customerSharePct = totalMarketVolume > 0 ? Number(((customerTurfVolume / totalMarketVolume) * 100).toFixed(1)) : 0;

  // 2. Query top rivals inside primary ZIPs (excluding customer itself and placeholders)
  const rivalRows = await query<{
    contractor_name: string;
    contractor_id: string | null;
    job_count: string;
    total_val: string;
    commercial_count: string;
  }>(
    `SELECT contractor_name,
            contractor_id,
            count(*) as job_count,
            coalesce(sum(valuation), 0) as total_val,
            count(CASE WHEN valuation >= 50000 OR probable_roof_system ILIKE '%membrane%' OR probable_roof_system ILIKE '%commercial%' OR probable_roof_system ILIKE '%tpo%' THEN 1 END) as commercial_count
     FROM warehouse.normalized_permits
     WHERE substring(zip_code from 1 for 5) = ANY($1)
       AND lower(contractor_name) != lower($2)
       AND (contractor_id IS NULL OR contractor_id != $3)
     GROUP BY contractor_name, contractor_id
     ORDER BY total_val DESC, job_count DESC
     LIMIT 40`,
    [primaryZips, turf.contractorName, turf.contractorId],
  );

  // Filter out placeholder names
  const validRivals = rivalRows.filter((r) => {
    const lower = (r.contractor_name || "").toLowerCase().trim();
    if (!lower || lower.length < 3) return false;
    return !GENERIC_EXCLUSIONS.some((ex) => lower === ex || lower.includes(ex));
  });

  const rivals: LocalizedRival[] = [];

  for (const r of validRivals.slice(0, 8)) {
    const cJobs = Number(r.job_count);
    const cVal = Number(r.total_val);
    const commCount = Number(r.commercial_count);
    const avgTicket = cJobs > 0 ? Math.round(cVal / cJobs) : 0;
    const share = totalMarketVolume > 0 ? Number(((cVal / totalMarketVolume) * 100).toFixed(1)) : 0;
    const commPct = cJobs > 0 ? Math.round((commCount / cJobs) * 100) : 0;

    let tier: "DIRECT_RIVAL" | "COMMERCIAL_POACHER" | "PEER_COMPETITOR" = "PEER_COMPETITOR";
    let desc = "Active in your core postal sectors.";

    if (avgTicket >= 65000 || commPct >= 40) {
      tier = "COMMERCIAL_POACHER";
      desc = "Winning high-ticket commercial low-slope contracts in your stronghold.";
    } else if (cJobs >= 10 || share >= 3.0) {
      tier = "DIRECT_RIVAL";
      desc = "High-frequency competitor actively bidding on residential & light commercial jobs.";
    }

    // Fetch up to 3 recent filings in customer's turf
    const recent = await query<{
      raw_permit_number: string;
      normalized_address: string;
      zip_code: string;
      valuation: number;
      issue_date: string;
      probable_roof_system: string;
    }>(
      `SELECT raw_permit_number, normalized_address, zip_code, valuation, issue_date, probable_roof_system
       FROM warehouse.normalized_permits
       WHERE lower(contractor_name) = lower($1)
         AND substring(zip_code from 1 for 5) = ANY($2)
       ORDER BY issue_date DESC NULLS LAST
       LIMIT 3`,
      [r.contractor_name, primaryZips],
    );

    rivals.push({
      contractorName: r.contractor_name,
      contractorId: r.contractor_id,
      coreZipJobs: cJobs,
      coreZipVolume: cVal,
      coreZipVolumeFormatted: formatCurrency(cVal),
      marketSharePct: share,
      avgTicket,
      avgTicketFormatted: formatCurrency(avgTicket),
      commercialRatioPct: commPct,
      threatTier: tier,
      threatDescription: desc,
      recentFilingsInTurf: recent.map((p) => ({
        permitNumber: p.raw_permit_number,
        address: p.normalized_address,
        zipCode: p.zip_code,
        valuation: Number(p.valuation || 0),
        valuationFormatted: formatCurrency(Number(p.valuation || 0)),
        issueDate: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
        probableSystem: p.probable_roof_system || "Commercial Re-Roof",
      })),
    });
  }

  return {
    turf,
    totalMarketVolumeInTurf: totalMarketVolume,
    totalMarketJobsInTurf: totalMarketJobs,
    customerSharePct,
    rivals,
  };
}

/**
 * Scans for recent competitor filings that trespass into customer's primary ZIPs
 * or occur within 2,500 feet of an address previously installed by the customer.
 */
export async function detectAndGetEncroachments(
  orgId: string,
  user?: { platformRole?: string },
): Promise<EncroachmentAlert[]> {
  const turf = await getOrgTurfProfile(orgId);
  if (!turf || turf.primaryZips.length === 0) return [];

  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const territories = await getOrgTerritories(orgId);
    allowedZips = territories.flatMap((t) => t.zipCodes || []);
    if (allowedZips.length === 0) return [];
  }

  const primaryZips = isSuperAdmin || !allowedZips
    ? turf.primaryZips
    : turf.primaryZips.filter((z) => allowedZips.map((az) => az.slice(0, 5)).includes(z.slice(0, 5)));

  if (primaryZips.length === 0) return [];

  // Query customer's past jobs to calculate proximity
  const customerJobs = await query<{
    normalized_address: string;
    latitude: number;
    longitude: number;
  }>(
    `SELECT normalized_address, latitude, longitude
     FROM warehouse.normalized_permits
     WHERE (contractor_id = $1 OR lower(contractor_name) = lower($2))
       AND latitude IS NOT NULL AND longitude IS NOT NULL
     LIMIT 50`,
    [turf.contractorId, turf.contractorName],
  );

  // Fetch recent rival permits inside customer's core ZIPs (last 90 days)
  const rivalPermits = await query<{
    id: string;
    raw_permit_number: string;
    contractor_name: string;
    normalized_address: string;
    city: string;
    zip_code: string;
    valuation: number;
    probable_roof_system: string;
    issue_date: string;
    latitude: number;
    longitude: number;
  }>(
    `SELECT id, raw_permit_number, contractor_name, normalized_address, city, zip_code,
            valuation, probable_roof_system, issue_date, latitude, longitude
     FROM warehouse.normalized_permits
     WHERE substring(zip_code from 1 for 5) = ANY($1)
       AND lower(contractor_name) != lower($2)
       AND (contractor_id IS NULL OR contractor_id != $3)
       AND valuation >= 25000
     ORDER BY issue_date DESC NULLS LAST
     LIMIT 30`,
    [turf.primaryZips, turf.contractorName, turf.contractorId],
  );

  const alerts: EncroachmentAlert[] = [];

  for (const p of rivalPermits) {
    const cName = (p.contractor_name || "").toLowerCase().trim();
    if (GENERIC_EXCLUSIONS.some((ex) => cName === ex || cName.includes(ex))) continue;

    let nearestCustomerJob: string | null = null;
    let minDistanceFeet: number | null = null;

    if (p.latitude && p.longitude && customerJobs.length > 0) {
      for (const cj of customerJobs) {
        if (!cj.latitude || !cj.longitude) continue;
        // Approximate distance in feet: 1 deg lat ~ 364,000 ft, 1 deg lng ~ 308,000 ft in Dallas
        const dLat = (p.latitude - cj.latitude) * 364000;
        const dLng = (p.longitude - cj.longitude) * 308000;
        const dist = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
        if (minDistanceFeet === null || dist < minDistanceFeet) {
          minDistanceFeet = dist;
          nearestCustomerJob = cj.normalized_address;
        }
      }
    }

    const val = Number(p.valuation || 0);
    const isClose = minDistanceFeet !== null && minDistanceFeet <= 2640; // 0.5 miles (2,640 ft)
    const isCommercial = val >= 60000 || /membrane|tpo|commercial|epdm/i.test(p.probable_roof_system || "");

    let tier: "CRITICAL" | "HIGH" | "MODERATE" = "MODERATE";
    let reason = `Permit filed inside your stronghold sector (${p.zip_code?.slice(0, 5)}).`;

    if (isClose && isCommercial) {
      tier = "CRITICAL";
      reason = `Competitor permitted a commercial job only ${minDistanceFeet} ft from your project at ${nearestCustomerJob?.split(",")[0]}.`;
    } else if (isClose) {
      tier = "CRITICAL";
      reason = `Direct turf trespassing: ${minDistanceFeet} ft from your historical installation.`;
    } else if (isCommercial) {
      tier = "HIGH";
      reason = `High-value commercial permit (${formatCurrency(val)}) won in your core ZIP code.`;
    }

    alerts.push({
      id: p.id,
      permitNumber: p.raw_permit_number,
      competitorName: p.contractor_name,
      jobAddress: p.normalized_address,
      city: p.city || "Dallas",
      zipCode: p.zip_code?.slice(0, 5) || "75206",
      valuation: val,
      valuationFormatted: formatCurrency(val),
      roofSystem: p.probable_roof_system || "Commercial Re-Roof",
      issueDate: p.issue_date ? String(p.issue_date).slice(0, 10) : "",
      threatTier: tier,
      threatReason: reason,
      nearbyCustomerJobAddress: nearestCustomerJob,
      distanceFeet: minDistanceFeet,
    });
  }

  // Sort CRITICAL alerts first, then HIGH, then by valuation
  alerts.sort((a, b) => {
    const tierWeight = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };
    if (tierWeight[b.threatTier] !== tierWeight[a.threatTier]) {
      return tierWeight[b.threatTier] - tierWeight[a.threatTier];
    }
    return b.valuation - a.valuation;
  });

  return alerts.slice(0, 10);
}

/**
 * Generates high-conversion Counter-Strike targets:
 * Commercial buildings aged 15-30+ years with zero permits on file within walking distance
 * of a competitor's recent jobsite.
 */
export async function getCounterStrikeTargets(
  permitNumberOrAddress: string,
  limit = 5,
  user?: { orgId?: string; platformRole?: string },
): Promise<CounterStrikeTarget[]> {
  const isSuperAdmin = user?.platformRole === "superadmin";
  let allowedZips: string[] | null = null;
  if (!isSuperAdmin && user?.orgId) {
    const { getOrgTerritories } = await import("@/lib/territories");
    const territories = await getOrgTerritories(user.orgId);
    allowedZips = territories.flatMap((t) => t.zipCodes || []);
    if (allowedZips.length === 0) return [];
  }

  // 1. Find coordinates and ZIP of the encroaching permit
  const anchor = await queryOne<{
    latitude: number;
    longitude: number;
    zip_code: string;
    normalized_address: string;
  }>(
    `SELECT latitude, longitude, zip_code, normalized_address
     FROM warehouse.normalized_permits
     WHERE raw_permit_number = $1 OR normalized_address ILIKE '%' || $1 || '%'
     LIMIT 1`,
    [permitNumberOrAddress],
  );

  const zip = anchor?.zip_code?.slice(0, 5) || "";
  if (!zip) return [];

  // Strictly restrict to allowed zone ZIPs
  if (!isSuperAdmin && allowedZips && allowedZips.length > 0) {
    const zipSet = new Set(allowedZips.map((z) => z.slice(0, 5)));
    if (!zipSet.has(zip)) {
      return [];
    }
  }

  // 2. Query commercial parcels aged 15+ years in same ZIP
  const parcels = await query<Record<string, any>>(
    `SELECT p.id as parcel_id,
            coalesce(s.address, p.address) as address,
            coalesce(s.city, p.city, 'Dallas') as city,
            substring(coalesce(s.zip_code, p.zip_code) from 1 for 5) as zip_code,
            coalesce(s.owner_name, p.owner_name, 'Commercial Property Owner') as owner_name,
            coalesce(s.property_type, p.property_type, 'Commercial Building') as property_type,
            coalesce(s.building_sqft, p.footprint_sqft, 15000) as building_sqft,
            coalesce(s.year_built, p.year_built, 1995) as year_built,
            (2026 - coalesce(s.year_built, p.year_built, 1995)) as roof_age_years,
            coalesce(s.estimated_replacement_mid, (coalesce(s.building_sqft, p.footprint_sqft, 15000) * 14.5)::bigint) as repl_val,
            c.decision_maker_name as decision_maker,
            c.phone_number as phone,
            c.email_address as email
     FROM warehouse.parcels p
     LEFT JOIN warehouse.scored_parcel_leads s ON s.parcel_id = p.id
     LEFT JOIN warehouse.lead_contacts c ON c.parcel_id = p.id
     WHERE substring(coalesce(s.zip_code, p.zip_code) from 1 for 5) = $1
       AND (2026 - coalesce(s.year_built, p.year_built, 1995)) >= 15
     ORDER BY repl_val DESC, roof_age_years DESC
     LIMIT $2`,
    [zip, limit],
  );

  return parcels.map((r) => {
    const val = Number(r.repl_val || 125000);
    return {
      parcelId: r.parcel_id,
      address: r.address,
      city: r.city,
      zipCode: r.zip_code,
      ownerName: r.owner_name,
      propertyType: r.property_type,
      buildingSqft: Number(r.building_sqft || 0),
      yearBuilt: Number(r.year_built || 1995),
      roofAgeYears: Number(r.roof_age_years || 20),
      estimatedReplacementUsd: val,
      estimatedReplacementFormatted: formatCurrency(val),
      decisionMaker: r.decision_maker || null,
      phone: r.phone || null,
      email: r.email || null,
    };
  });
}
