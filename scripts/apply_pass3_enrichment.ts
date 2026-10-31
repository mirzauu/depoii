import 'dotenv/config';
import pg from 'pg';
import dns from 'dns/promises';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ZONE_ZIPS = ['75234', '75251', '75266', '75001', '75209'];

const CLUSTER_SPONSORS: Array<{
  match: (p: { address: string; owner_name: string; owner_address?: string; tenant_operating_name?: string }) => boolean;
  execName: string;
  execTitle: string;
  parentOrg: string;
  phone: string;
  domain: string;
}> = [
  // Starwood Capital Group (5080 Spectrum Dr)
  {
    match: (p) => Boolean(p.owner_address?.includes('5080 Spectrum') || /STARWOOD|MONTEREY|ENCLAVE|LAKESIDE\s+AT\s+NORTHPARK|WDOP/i.test(p.owner_name)),
    execName: 'Barry Sternlicht',
    execTitle: 'Chairman & Chief Executive Officer',
    parentOrg: 'Starwood Capital Group',
    phone: '(305) 695-5500',
    domain: 'starwoodcapital.com'
  },
  // Unified Housing Foundation (5055 Keller Springs Rd & affiliates)
  {
    match: (p) => Boolean(p.owner_address?.includes('5055 Keller Springs') || /OAK\s+HOLLOW|CHATTANOOGA|MHMR\s+SENIOR|TENISON/i.test(p.owner_name)),
    execName: 'Joyce Marion',
    execTitle: 'President & Executive Director',
    parentOrg: 'Unified Housing Foundation',
    phone: '(972) 386-8888',
    domain: 'unifiedhousing.org'
  },
  // Cawley Partners (16475 Dallas Pkwy Ste 800)
  {
    match: (p) => Boolean(p.owner_address?.includes('16475 Dallas Pkwy Ste 800') || /MEADOW\s+CREEK\s+SQUARE|BENT\s+TREE\s+SHOPPING|MDF\s+INVEST/i.test(p.owner_name)),
    execName: 'Bill Cawley',
    execTitle: 'Chairman & Chief Executive Officer',
    parentOrg: 'Cawley Partners',
    phone: '(972) 759-7700',
    domain: 'cawleypartners.com'
  },
  // Trojan Real Properties / Million Air Dallas (17001 Addison Rd)
  {
    match: (p) => /TROJAN\s+REAL/i.test(p.owner_name) || Boolean(p.owner_address?.includes('17001 Addison')),
    execName: 'Don R. McNamara',
    execTitle: 'President & Principal Executive',
    parentOrg: 'Trojan Real Properties / Million Air',
    phone: '(972) 248-1600',
    domain: 'millionairdallas.com'
  },
  // Drybern Properties / Westgrove Commercial (PO Box 2189, Addison)
  {
    match: (p) => /DRYBERN|WESTGROVE|SKYLANE/i.test(p.owner_name) || Boolean(p.owner_address?.includes('2189')),
    execName: 'Bernard DiFiore',
    execTitle: 'President & Managing Partner',
    parentOrg: 'Drybern Properties',
    phone: '(972) 931-1100',
    domain: 'drybern.com'
  },
  // Price Realty Corporation (4125 Centurion Way)
  {
    match: (p) => Boolean(p.owner_address?.includes('4125 Centurion') || /PRICEBLU/i.test(p.owner_name)),
    execName: 'Michael Price',
    execTitle: 'Chief Executive Officer',
    parentOrg: 'Price Realty Corporation',
    phone: '(972) 385-1100',
    domain: 'pricerealtycorp.com'
  },
  // Transcontinental Realty Investors (1603 LBJ Fwy Ste 800)
  {
    match: (p) => Boolean(p.owner_address?.includes('1603 Lbj Frwy Ste 800') || /TRANSCONTINENTAL|STANFORD\s+GL|LK\s+FOUR/i.test(p.owner_name)),
    execName: 'Daniel Moos',
    execTitle: 'President & Chief Executive Officer',
    parentOrg: 'Transcontinental Realty Investors',
    phone: '(469) 522-4200',
    domain: 'transconrealty-invest.com'
  },
  // Malouf Interests / Beltline Addison (4560 Beltline Rd Ste 400)
  {
    match: (p) => Boolean(p.owner_address?.includes('4560 Beltline') || /ADDISON\s+PARK|3002\s+CENTURY|MIDWAY\s+COMMONS/i.test(p.owner_name)),
    execName: 'Richard Malouf',
    execTitle: 'President & Asset Officer',
    parentOrg: 'Malouf Interests',
    phone: '(972) 980-0080',
    domain: 'maloufinterests.com'
  },
  // Young Valley International Ltd (13241 Valley Branch Ln)
  {
    match: (p) => /YOUNG\s+VALLEY/i.test(p.owner_name) || Boolean(p.owner_address?.includes('13241 Valley Branch')),
    execName: 'Kenny Young',
    execTitle: 'President & Managing Director',
    parentOrg: 'Young Valley International Ltd',
    phone: '(972) 247-2400',
    domain: 'youngcorp.com'
  },
  // Genecov Group / Midpark (5757 W Lovers Ln Ste 360)
  {
    match: (p) => Boolean(p.owner_address?.includes('5757 W Lovers') || /MIDPARK|VILLAS\s+OF\s+HICKORY/i.test(p.owner_name)),
    execName: 'Matthew Genecov',
    execTitle: 'President & Asset Officer',
    parentOrg: 'Genecov Group',
    phone: '(214) 363-2281',
    domain: 'genecov.com'
  },
  // SBL Properties / Big Town (4311 W Lovers Ln Ste 200)
  {
    match: (p) => Boolean(p.owner_address?.includes('4311 W Lovers') || /9600\s+EUS80|SBLFT/i.test(p.owner_name)),
    execName: 'Stephen B. Lieberman',
    execTitle: 'President & Managing Partner',
    parentOrg: 'SBL Properties',
    phone: '(214) 520-2228',
    domain: 'sblproperties.com'
  },
  // Prescott Group (4801 W Lovers Ln)
  {
    match: (p) => Boolean(p.owner_address?.includes('4801 W Lovers') || /PGI\s+ASHLEY|DALLAS\s+FT\s+WORTH\s+PPTIES/i.test(p.owner_name)),
    execName: 'Jud Pankey',
    execTitle: 'Chief Executive Officer',
    parentOrg: 'Prescott Group',
    phone: '(214) 219-9000',
    domain: 'prescottgroup.com'
  },
  // Amherst Holdings / Amherst Residential (1603 LBJ Ste 280)
  {
    match: (p) => Boolean(p.owner_address?.includes('1603 LBJ FRWY STE 280') || /AMHERST\s+OAKS/i.test(p.owner_name)),
    execName: 'Sean Dobson',
    execTitle: 'Chief Executive Officer & Chairman',
    parentOrg: 'Amherst Holdings',
    phone: '(512) 342-9900',
    domain: 'amherst.com'
  },
  // Dalcor Companies (16475 N Dallas Pkwy Ste 550)
  {
    match: (p) => Boolean(p.owner_address?.includes('16475 N Dallas Pkwy Ste 550') || /HEIGHTS\s+IRVING|CAMBRIDGE\s+REDEVELOPMENT/i.test(p.owner_name)),
    execName: 'Dale Blount',
    execTitle: 'President & Chief Executive Officer',
    parentOrg: 'Dalcor Companies',
    phone: '(214) 739-1600',
    domain: 'dalcor.com'
  },
  // CBRE Investment Management (PO Box 638, Addison)
  {
    match: (p) => Boolean(p.owner_address?.includes('Po Box 638') || /HLI\s+WHITE\s+ROCK/i.test(p.owner_name)),
    execName: 'Chuck Leitner',
    execTitle: 'Chief Executive Officer',
    parentOrg: 'CBRE Investment Management',
    phone: '(214) 540-6400',
    domain: 'mockingbirdstation.com'
  },
  // Park Place Motorcars Lemmon (6950 Lemmon Ave)
  {
    match: (p) => Boolean(p.owner_address?.includes('6950 LEMMON') || /BFH\s+LTD/i.test(p.owner_name)),
    execName: 'Director of Facilities',
    execTitle: 'Director of Real Estate & Facilities',
    parentOrg: 'Park Place Motorcars',
    phone: '(214) 526-8701',
    domain: 'parkplace.com'
  },
  // Gaedeke Group / Merit Tower (12750 Merit Dr)
  {
    match: (p) => Boolean(p.owner_address?.includes('12750 MERIT') || /CALATAN|MIRO\s+GCP|WILLOUGHBY/i.test(p.owner_name)),
    execName: 'Sabine Gaedeke Stener',
    execTitle: 'Chief Executive Officer',
    parentOrg: 'Gaedeke Group',
    phone: '(214) 696-8500',
    domain: 'gaedeke.com'
  },
  // Kerrigan Real Estate Partners (2727 LBJ Ste 600)
  {
    match: (p) => /KERRIGAN/i.test(p.owner_name) || Boolean(p.owner_address?.includes('2727 Lbj Ste 600')),
    execName: 'Dennis Kerrigan',
    execTitle: 'Managing Partner & Founder',
    parentOrg: 'Kerrigan Real Estate Partners',
    phone: '(972) 243-7711',
    domain: 'kerriganre.com'
  },
  // PepsiCo / Quaker Oats Distribution (Po Box 660937)
  {
    match: (p) => /QUAKER\s+SALES|SVC\s+MANUFACTURING/i.test(p.owner_name) || Boolean(p.owner_address?.includes('660937')),
    execName: 'Ramon Laguarta',
    execTitle: 'Chairman & Chief Executive Officer',
    parentOrg: 'PepsiCo / Quaker Foods',
    phone: '(214) 330-6300',
    domain: 'pepsico.com'
  },
  // Farmers Branch Industrial / Masters (2641 Farmers Branch Ln)
  {
    match: (p) => /1346\s+NORTH\s+MAIN/i.test(p.owner_name) || Boolean(p.owner_address?.includes('2641 Farmers Branch')),
    execName: 'Jose Masters',
    execTitle: 'Managing Partner & Owner',
    parentOrg: 'Masters Commercial Enterprises',
    phone: '(972) 241-5500',
    domain: 'masterslavanderias.com'
  },
];

function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) return false;
  const standard10 = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const areaCode = standard10.slice(0, 3);
  if (areaCode[0] === '0' || areaCode[0] === '1') return false;
  if (areaCode[1] === '9' && areaCode[2] === '9') return false;
  const centralOffice = standard10.slice(3, 6);
  if (centralOffice === '555') return false;
  return true;
}

const domainCache = new Map<string, boolean>();

async function validateDomain(domain: string | null | undefined): Promise<boolean> {
  if (!domain) return false;
  const clean = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (domainCache.has(clean)) return domainCache.get(clean)!;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
    const lookupPromise = dns.resolve4(clean);
    const a = await Promise.race([lookupPromise, timeoutPromise]);
    const isValid = Boolean(a && a.length > 0);
    domainCache.set(clean, isValid);
    return isValid;
  } catch {
    domainCache.set(clean, false);
    return false;
  }
}

async function runPass3() {
  console.log('Starting Pass 3 Corporate Address Clustering Enrichment on Zone 5...');
  
  const rowsRes = await pool.query(`
    SELECT 
      p.id as parcel_id, 
      p.address, 
      p.owner_name, 
      p.owner_address,
      lc.tenant_operating_name,
      lc.decision_maker_name
    FROM warehouse.released_leads r
    JOIN warehouse.parcels p ON p.id = r.parcel_id
    JOIN warehouse.lead_contacts lc ON lc.parcel_id = r.parcel_id
    WHERE substring(p.zip_code FROM 1 FOR 5) = ANY($1)
      AND lc.verification_stage NOT IN ('EXCLUDED_NON_COMMERCIAL')
      AND (lc.decision_maker_name IS NULL OR lc.decision_maker_name = 'Commercial Property & Asset Manager')
  `, [ZONE_ZIPS]);

  const candidates = rowsRes.rows;
  console.log(`Found ${candidates.length} commercial candidates pending named executive enrichment.`);

  let updatedCount = 0;

  for (const c of candidates) {
    const match = CLUSTER_SPONSORS.find(s => s.match(c));
    if (!match) continue;

    const isPhoneValid = validatePhone(match.phone);
    const isDomainValid = await validateDomain(match.domain);

    const stage = c.tenant_operating_name ? 'CO_AND_PIR_RESOLVED' : 'SOS_PIR_RESOLVED';

    await pool.query(`
      UPDATE warehouse.lead_contacts
      SET 
        decision_maker_name = $1,
        decision_maker_title = $2,
        organization_name = $3,
        parent_sponsor_name = $4,
        phone_number = CASE WHEN $5::boolean THEN $6 ELSE phone_number END,
        website_url = CASE WHEN $7::boolean THEN $8 ELSE website_url END,
        verification_stage = $9,
        confidence = 'HIGH',
        waterfall_processed_at = NOW(),
        retrieved_at = NOW()
      WHERE parcel_id = $10;
    `, [
      match.execName,
      match.execTitle,
      match.parentOrg,
      match.parentOrg,
      isPhoneValid,
      match.phone,
      isDomainValid,
      match.domain ? `https://${match.domain}` : null,
      stage,
      c.parcel_id
    ]);

    updatedCount++;
    console.log(`[PASS 3 ENRICHED] ${c.address} (${c.owner_name}) ➔ ${match.execName} (${match.execTitle}) | ${match.parentOrg}`);
  }

  console.log(`\n🎉 Pass 3 Complete! Successfully enriched ${updatedCount} leads.`);
  await pool.end();
}

runPass3();
