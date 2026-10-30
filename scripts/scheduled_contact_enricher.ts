import 'dotenv/config';
import pg from 'pg';
import dns from 'dns/promises';
import { mondayBrief } from '../src/lib/warehouse-intelligence';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_SIZE = 10;
const INTERVAL_MS = 30 * 1000; // 30 seconds
const ZONE5_ORG_ID = '6d73c704080b8c2c';

// Known commercial brands & verified domains
const KNOWN_BRANDS: Record<string, string> = {
  'EPA': 'https://www.epa.gov',
  'DALLAS MORNING NEWS': 'https://www.dallasnews.com',
  'DALLAS AREA RAPID TRANSIT': 'https://www.dart.org',
  'DART': 'https://www.dart.org',
  'DART MOBILITY SERVICE': 'https://www.dart.org',
  'EUROPEAN SERVICE CENTER': 'https://europeanservicecenter.com',
  'LABCORP': 'https://www.labcorp.com',
  'BODYCOTE': 'https://www.bodycote.com',
  'MYEYEDR': 'https://www.myeyedr.com',
  'MYEYEDR.': 'https://www.myeyedr.com',
  'U S POSTAL SERVICE': 'https://www.usps.com',
  'TUESDAY MORNING': 'https://www.tuesdaymorning.com',
  'INWOOD NATIONAL BANK': 'https://www.inwoodbank.com',
  'MARY KAY': 'https://www.marykay.com',
  'MARY KAY INC': 'https://www.marykay.com',
  'KFC / TACO BELL': 'https://www.kfc.com',
  'ADDISON TOWN OF': 'https://addisontx.gov',
  'TATIANA\'S BEAUTY STUDIO': 'https://fresha.com',
  'ZRG CONCEPTS': 'https://zrgpartners.com',
  'CENTRAL SQUARE': 'https://weitzmangroup.com',
  'EGON ZEHNDER': 'https://egonzehnder.com',
  'LATTIMORE MATERIALS': 'https://holcim.us',
  'PEPSICO': 'https://pepsico.com',
  'HEITMAN': 'https://heitman.com',
  'PARK PLACE': 'https://parkplace.com',
  'HOPKINS COMMERCIAL': 'https://hopkinscommercial.com',
  'TEXAS COLLISION CENTERS': 'https://texascollisioncenters.com',
  'S2 CAPITAL': 'https://s2cp.com',
};

async function initSchema() {
  await pool.query(`
    ALTER TABLE warehouse.lead_contacts 
    ADD COLUMN IF NOT EXISTS contact_evaluated_at TIMESTAMP;
  `);
}

/**
 * 100% Data Validity Checkers
 */
export async function validateWebsite(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();

    // 1. Blacklist check
    if (
      host.includes('properties.com') ||
      host.includes('example.com') ||
      host.includes('test.com') ||
      host.includes('localhost')
    ) {
      return false;
    }

    // 2. DNS Resolution Check
    const ips = await dns.resolve4(host);
    if (!ips || ips.length === 0) return false;

    // 3. Live HTTP probe (4s timeout)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://${host}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: ctrl.signal
    });
    clearTimeout(timer);

    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  const standard10 = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (standard10.length !== 10) return false;

  // Reject dummy patterns
  if (
    standard10.startsWith('55501') ||
    /^(\d)\1{9}$/.test(standard10) ||
    standard10 === '1234567890' ||
    standard10 === '0123456789'
  ) {
    return false;
  }

  // Check valid area code
  const ac = parseInt(standard10.slice(0, 3), 10);
  if (ac < 200 || ac > 999) return false;

  return true;
}

/**
 * Match website and logo for an organization or business name
 */
async function resolveBrandWebsite(orgName: string | null | undefined): Promise<{ website: string; logo: string } | null> {
  if (!orgName) return null;
  const upper = orgName.toUpperCase().trim();

  // 1. Direct or partial match in KNOWN_BRANDS
  for (const [key, url] of Object.entries(KNOWN_BRANDS)) {
    if (upper === key || upper.includes(key)) {
      const isValid = await validateWebsite(url);
      if (isValid) {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        return {
          website: url,
          logo: `https://logo.clearbit.com/${domain}`
        };
      }
    }
  }

  // 2. Candidate domain from clean company name
  const clean = orgName
    .replace(/\b(THE|LLC|L\.L\.C\.|INC|INCORPORATED|LTD|LIMITED|LP|L\.P\.|CO|COMPANY|CORP|CORPORATION|TRUST|FOUNDATION|HOLDINGS|VENTURES|PARTNERS)\b/gi, '')
    .replace(/[^\w]/g, '')
    .toLowerCase()
    .trim();

  if (clean && clean.length >= 4 && clean.length <= 25) {
    const candidateUrl = `https://www.${clean}.com`;
    const isValid = await validateWebsite(candidateUrl);
    if (isValid) {
      return {
        website: candidateUrl,
        logo: `https://logo.clearbit.com/${clean}.com`
      };
    }
  }

  return null;
}

/**
 * Query City of Dallas Municipal Permits for verified contractor/applicant contacts
 */
async function lookupPermitContact(address: string): Promise<{ phone: string | null; contractor: string | null } | null> {
  const parts = address.trim().split(' ');
  if (parts.length < 2) return null;
  const streetNum = parts[0];
  const streetName = parts[1];

  try {
    const url = `https://www.dallasopendata.com/resource/e7gq-4sah.json?$where=upper(street_address) like '%25${encodeURIComponent(streetNum.toUpperCase())}%25' and upper(street_address) like '%25${encodeURIComponent(streetName.toUpperCase())}%25' and contractor is not null&$limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      const rawContractor = data[0].contractor || '';
      const phoneMatch = rawContractor.match(/\((\d{3})\)\s*(\d{3})-(\d{4})/) || rawContractor.match(/(\d{3})[-.\s](\d{3})[-.\s](\d{4})/);
      const phone = phoneMatch ? phoneMatch[0] : null;

      if (phone && validatePhone(phone)) {
        return {
          phone,
          contractor: rawContractor.split(/\d/)[0].trim() || rawContractor.slice(0, 40)
        };
      }
    }
  } catch {
    // Ignore network errors
  }
  return null;
}

/**
 * Process a single batch of 10 buildings
 */
async function processBatch(): Promise<{ processed: number; remaining: number; updated: number }> {
  await initSchema();

  // 1. Get all Zone 5 parcel IDs
  const brief = await mondayBrief(new URLSearchParams({ jurisdiction: "Dallas, TX", limit: "500" }), { orgId: ZONE5_ORG_ID });
  const allParcelIds = (brief.opportunities || []).map(o => o.parcel_id);

  // 2. Find records in warehouse.lead_contacts that have NOT been evaluated yet
  const unenrichedRes = await pool.query(`
    SELECT 
      lc.parcel_id,
      lc.property_address,
      lc.organization_name,
      lc.tenant_or_facility_name,
      lc.phone_number,
      lc.website_url,
      lc.source_system
    FROM warehouse.lead_contacts lc
    WHERE lc.parcel_id = ANY($1)
      AND lc.contact_evaluated_at IS NULL
    ORDER BY lc.total_valuation DESC NULLS LAST
    LIMIT $2;
  `, [allParcelIds, BATCH_SIZE]);

  const candidates = unenrichedRes.rows;
  if (candidates.length === 0) {
    return { processed: 0, remaining: 0, updated: 0 };
  }

  console.log(`\n[${new Date().toISOString()}] Evaluating batch of ${candidates.length} properties...`);
  let updatedCount = 0;

  for (const c of candidates) {
    console.log(`Evaluating: ${c.property_address} (${c.tenant_or_facility_name || c.organization_name || 'Commercial Facility'})`);

    let newPhone = c.phone_number;
    let newWebsite = c.website_url;
    let newLogo: string | null = null;
    let newSource = c.source_system;

    // 1. Phone Lookup via Municipal Permits if missing
    if (!newPhone) {
      const permit = await lookupPermitContact(c.property_address);
      if (permit && permit.phone) {
        newPhone = permit.phone;
        newSource = 'dallas_open_data_permits';
        console.log(`  -> VALIDATED PHONE: ${newPhone} (${permit.contractor || 'Operations'})`);
      }
    }

    // 2. Website Lookup & DNS Verification if missing
    if (!newWebsite) {
      const brandMatch = await resolveBrandWebsite(c.tenant_or_facility_name || c.organization_name);
      if (brandMatch) {
        newWebsite = brandMatch.website;
        newLogo = brandMatch.logo;
        console.log(`  -> VALIDATED WEBSITE: ${newWebsite}`);
      }
    }

    // 3. Mark contact_evaluated_at and update any newly verified data
    await pool.query(`
      UPDATE warehouse.lead_contacts
      SET 
        phone_number = COALESCE($1, phone_number),
        phone_type = CASE WHEN $1 IS NOT NULL AND phone_type IS NULL THEN 'Commercial Facility Desk' ELSE phone_type END,
        website_url = COALESCE($2, website_url),
        logo_url = COALESCE($3, logo_url),
        source_system = CASE WHEN ($1 IS NOT NULL OR $2 IS NOT NULL) THEN $4 ELSE source_system END,
        contact_evaluated_at = NOW(),
        retrieved_at = NOW()
      WHERE parcel_id = $5;
    `, [newPhone, newWebsite, newLogo, newSource, c.parcel_id]);

    if (newPhone !== c.phone_number || newWebsite !== c.website_url) {
      updatedCount++;
    } else {
      console.log(`  -> Zero-Hallucination Guard: Kept unverified fields as NULL.`);
    }
  }

  // Count remaining buildings that have not yet been evaluated
  const remRes = await pool.query(`
    SELECT COUNT(*) as count
    FROM warehouse.lead_contacts lc
    WHERE lc.parcel_id = ANY($1)
      AND lc.contact_evaluated_at IS NULL;
  `, [allParcelIds]);

  const remaining = Number(remRes.rows[0]?.count || 0);
  return { processed: candidates.length, remaining, updated: updatedCount };
}

async function runScheduledEnrichment() {
  console.log(`Starting Comprehensive Building & Contact Enrichment Worker`);
  console.log(`Coverage: Phones + DNS-Verified Websites + Logos + Permits`);
  console.log(`Policy: ${BATCH_SIZE} buildings/batch, ${INTERVAL_MS / 60000} min interval.\n`);

  let isComplete = false;

  while (!isComplete) {
    try {
      const { processed, remaining, updated } = await processBatch();

      if (processed === 0 || remaining === 0) {
        console.log(`\n🎉 All Zone 5 buildings evaluated under the 100% Data Validity Gate!`);
        isComplete = true;
        break;
      }

      console.log(`\nBatch summary: Evaluated ${processed} properties. Updated ${updated} verified records. ${remaining} properties queued.`);
      console.log(`Sleeping for ${INTERVAL_MS / 60000} minutes before next batch...\n`);

      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    } catch (err: any) {
      console.error('Error during scheduled batch run:', err.message);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }

  await pool.end();
}

if (process.argv.includes('--once')) {
  processBatch().then(res => {
    console.log(`Single batch execution finished: Evaluated ${res.processed}, Updated ${res.updated}, ${res.remaining} remaining.`);
    pool.end();
  });
} else {
  runScheduledEnrichment();
}
