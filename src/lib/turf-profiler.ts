import { query, queryOne } from "@/lib/pg";

export interface NeighborhoodStat {
  zip: string;
  label: string;
  jobCount: number;
  totalValuation: number;
  formattedValuation: string;
}

export interface TurfProfile {
  orgId: string;
  contractorId: string;
  contractorName: string;
  primaryZips: string[];
  expansionZips: string[];
  totalHistoricalJobs: number;
  totalHistoricalVolume: number;
  totalHistoricalVolumeFormatted: string;
  avgTicketSize: number;
  avgTicketSizeFormatted: string;
  primaryRoofSystem: string;
  commercialPercentage: number;
  neighborhoods: NeighborhoodStat[];
  lastCalculatedAt: string;
}

const DALLAS_ZIP_NAMES: Record<string, string> = {
  "75201": "Downtown / Arts District",
  "75202": "Historic West End",
  "75204": "Uptown / West Village",
  "75205": "Highland Park / SMU",
  "75206": "Lower Greenville / M Streets",
  "75207": "Design District / Trinity",
  "75208": "Bishop Arts / North Oak Cliff",
  "75209": "Inwood / Bluffview",
  "75214": "Lakewood / White Rock Lake",
  "75219": "Oak Lawn / Turtle Creek",
  "75220": "Love Field / Bachman Lake",
  "75223": "Hollywood Heights / Fair Park",
  "75224": "Kiest Park / Oak Cliff",
  "75225": "University Park / Preston Center",
  "75226": "Deep Ellum / Baylor",
  "75227": "Pleasant Grove / Buckner",
  "75230": "Preston Hollow / North Dallas",
  "75231": "Lake Highlands / Vickery",
  "75234": "Farmers Branch / Carrollton",
  "75238": "Lake Highlands South",
  "75240": "Galleria / North Central",
  "75243": "Forest Meadow / Richardson South",
  "75246": "Baylor Univ Medical District",
  "75247": "Brookhollow / Stemmons Industrial",
  "75248": "North Dallas / Prestonwood",
  "75251": "North Central Corridor",
  "75252": "Far North Dallas",
};

function formatCurrency(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${Math.trunc(val).toLocaleString()}`;
  return `$${val}`;
}

/**
 * Computes and caches the territorial footprint and core ZIP codes for an organization's linked contractor.
 */
export async function computeOrgTurfProfile(orgId: string): Promise<TurfProfile | null> {
  const org = await queryOne<{
    id: string;
    name: string;
    contractor_id: string | null;
  }>(
    `SELECT id, name, contractor_id FROM app.orgs WHERE id = $1`,
    [orgId],
  );

  if (!org || !org.contractor_id) return null;

  const contractor = await queryOne<{
    id: string;
    canonical_name: string;
    primary_roof_system: string | null;
  }>(
    `SELECT id, canonical_name, primary_roof_system 
     FROM warehouse.canonical_contractors 
     WHERE id = $1`,
    [org.contractor_id],
  );

  if (!contractor) return null;

  // 1. Fetch all normalized permits associated with this contractor
  const permits = await query<{
    zip_code: string;
    valuation: number;
    probable_roof_system: string | null;
    category: string | null;
  }>(
    `SELECT substring(zip_code from 1 for 5) as zip_code,
            coalesce(valuation, 0) as valuation,
            probable_roof_system,
            category
     FROM warehouse.normalized_permits
     WHERE contractor_id = $1 OR lower(contractor_name) = lower($2)`,
    [contractor.id, contractor.canonical_name],
  );

  if (permits.length === 0) {
    // If no individual permits mapped yet, fallback to default profile
    const emptyProfile: TurfProfile = {
      orgId,
      contractorId: contractor.id,
      contractorName: contractor.canonical_name,
      primaryZips: ["75201", "75204", "75206"],
      expansionZips: ["75214", "75230"],
      totalHistoricalJobs: 0,
      totalHistoricalVolume: 0,
      totalHistoricalVolumeFormatted: "$0",
      avgTicketSize: 0,
      avgTicketSizeFormatted: "$0",
      primaryRoofSystem: contractor.primary_roof_system || "Commercial Re-Roof",
      commercialPercentage: 0,
      neighborhoods: [],
      lastCalculatedAt: new Date().toISOString(),
    };
    return emptyProfile;
  }

  // 2. Aggregate stats by ZIP code
  const zipMap = new Map<string, { count: number; volume: number; commercialCount: number }>();
  let totalVolume = 0;
  let totalCommercialCount = 0;
  const systemCounts = new Map<string, number>();

  for (const p of permits) {
    const rawZip = (p.zip_code || "").trim();
    if (!rawZip || rawZip.length < 5) continue;
    const zip = rawZip.slice(0, 5);
    const val = Number(p.valuation) || 0;
    totalVolume += val;

    const isCommercial =
      (p.probable_roof_system && /commercial|membrane|tpo|epdm|mod.*bit|built-up|bur|standing seam|metal/i.test(p.probable_roof_system)) ||
      (val >= 50000 && !/shingle/i.test(p.probable_roof_system || ""));

    if (isCommercial) totalCommercialCount++;

    const sys = p.probable_roof_system || "Architectural Asphalt Shingle";
    systemCounts.set(sys, (systemCounts.get(sys) || 0) + 1);

    const existing = zipMap.get(zip) || { count: 0, volume: 0, commercialCount: 0 };
    existing.count += 1;
    existing.volume += val;
    if (isCommercial) existing.commercialCount += 1;
    zipMap.set(zip, existing);
  }

  // 3. Rank ZIP codes by weighted influence: (jobCount * 0.6) + (volumeRatio * 10 * 0.4)
  const rankedZips = Array.from(zipMap.entries()).map(([zip, stat]) => {
    const volumeRatio = totalVolume > 0 ? stat.volume / totalVolume : 0;
    const score = stat.count * 0.6 + volumeRatio * 10 * 0.4;
    return {
      zip,
      label: DALLAS_ZIP_NAMES[zip] || `Dallas ${zip}`,
      jobCount: stat.count,
      totalValuation: stat.volume,
      formattedValuation: formatCurrency(stat.volume),
      score,
    };
  });

  rankedZips.sort((a, b) => b.score - a.score);

  const primaryZips = rankedZips.slice(0, 3).map((z) => z.zip);

  // 4. Select expansion ZIPs (contiguous or high-value commercial corridors)
  const candidateExpansions = ["75201", "75204", "75207", "75214", "75230", "75247", "75226", "75231"];
  const expansionZips = candidateExpansions.filter((z) => !primaryZips.includes(z)).slice(0, 3);

  // 5. System specialization
  let primaryRoofSystem = contractor.primary_roof_system || "Architectural Asphalt Shingle";
  let highestCount = 0;
  for (const [sys, count] of systemCounts.entries()) {
    if (count > highestCount) {
      highestCount = count;
      primaryRoofSystem = sys;
    }
  }

  const totalHistoricalJobs = permits.length;
  const avgTicket = totalHistoricalJobs > 0 ? totalVolume / totalHistoricalJobs : 0;
  const commercialPct = totalHistoricalJobs > 0 ? Math.round((totalCommercialCount / totalHistoricalJobs) * 100) : 0;

  // 6. Write to app.org_turf_profiles
  await query(
    `INSERT INTO app.org_turf_profiles (
      org_id, contractor_id, primary_zips, expansion_zips,
      total_historical_jobs, total_historical_volume, avg_ticket_size,
      primary_roof_system, commercial_percentage, last_calculated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (org_id) DO UPDATE SET
      contractor_id = EXCLUDED.contractor_id,
      primary_zips = EXCLUDED.primary_zips,
      expansion_zips = EXCLUDED.expansion_zips,
      total_historical_jobs = EXCLUDED.total_historical_jobs,
      total_historical_volume = EXCLUDED.total_historical_volume,
      avg_ticket_size = EXCLUDED.avg_ticket_size,
      primary_roof_system = EXCLUDED.primary_roof_system,
      commercial_percentage = EXCLUDED.commercial_percentage,
      last_calculated_at = NOW()`,
    [
      orgId,
      contractor.id,
      primaryZips,
      expansionZips,
      totalHistoricalJobs,
      totalVolume,
      Math.round(avgTicket),
      primaryRoofSystem,
      commercialPct,
    ],
  );

  return {
    orgId,
    contractorId: contractor.id,
    contractorName: contractor.canonical_name,
    primaryZips,
    expansionZips,
    totalHistoricalJobs,
    totalHistoricalVolume: totalVolume,
    totalHistoricalVolumeFormatted: formatCurrency(totalVolume),
    avgTicketSize: Math.round(avgTicket),
    avgTicketSizeFormatted: formatCurrency(Math.round(avgTicket)),
    primaryRoofSystem,
    commercialPercentage: commercialPct,
    neighborhoods: rankedZips.slice(0, 5).map(({ zip, label, jobCount, totalValuation, formattedValuation }) => ({
      zip,
      label,
      jobCount,
      totalValuation,
      formattedValuation,
    })),
    lastCalculatedAt: new Date().toISOString(),
  };
}

/**
 * Gets the turf profile for an organization, recalculating if expired or missing.
 */
export async function getOrgTurfProfile(orgId: string): Promise<TurfProfile | null> {
  const cached = await queryOne<Record<string, any>>(
    `SELECT t.*, c.canonical_name 
     FROM app.org_turf_profiles t
     JOIN warehouse.canonical_contractors c ON c.id = t.contractor_id
     WHERE t.org_id = $1`,
    [orgId],
  );

  if (cached && cached.last_calculated_at) {
    const ageMinutes = (Date.now() - new Date(cached.last_calculated_at).getTime()) / (1000 * 60);
    if (ageMinutes < 1440) {
      // Fetch top neighborhoods
      const nRows = await query<{
        zip: string;
        job_count: string;
        total_val: string;
      }>(
        `SELECT substring(zip_code from 1 for 5) as zip,
                count(*) as job_count,
                coalesce(sum(valuation), 0) as total_val
         FROM warehouse.normalized_permits
         WHERE contractor_id = $1 OR lower(contractor_name) = lower($2)
         GROUP BY substring(zip_code from 1 for 5)
         ORDER BY job_count DESC, total_val DESC
         LIMIT 5`,
        [cached.contractor_id, cached.canonical_name],
      );

      const tot = Number(cached.total_historical_volume || 0);
      const avg = Number(cached.avg_ticket_size || 0);

      return {
        orgId: cached.org_id,
        contractorId: cached.contractor_id,
        contractorName: cached.canonical_name,
        primaryZips: cached.primary_zips || [],
        expansionZips: cached.expansion_zips || [],
        totalHistoricalJobs: Number(cached.total_historical_jobs || 0),
        totalHistoricalVolume: tot,
        totalHistoricalVolumeFormatted: formatCurrency(tot),
        avgTicketSize: avg,
        avgTicketSizeFormatted: formatCurrency(avg),
        primaryRoofSystem: cached.primary_roof_system || "Architectural Asphalt Shingle",
        commercialPercentage: Number(cached.commercial_percentage || 0),
        neighborhoods: nRows.map((r) => ({
          zip: r.zip,
          label: DALLAS_ZIP_NAMES[r.zip] || `Dallas ${r.zip}`,
          jobCount: Number(r.job_count),
          totalValuation: Number(r.total_val),
          formattedValuation: formatCurrency(Number(r.total_val)),
        })),
        lastCalculatedAt: String(cached.last_calculated_at),
      };
    }
  }

  return computeOrgTurfProfile(orgId);
}
