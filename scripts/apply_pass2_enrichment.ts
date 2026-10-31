import 'dotenv/config';
import pg from 'pg';
import dns from 'dns/promises';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ZONE_ZIPS = ['75234', '75251', '75266', '75001', '75209'];

const EXPANDED_SPONSORS: Array<{
  pattern: RegExp;
  execName: string;
  execTitle: string;
  parentOrg: string;
  phone: string;
  domain: string;
}> = [
  // S2 Capital Holdings
  { pattern: /S2\s+/i, execName: 'Scott Everett', execTitle: 'Founder & Chief Executive Officer', parentOrg: 'S2 Capital', phone: '(214) 330-3035', domain: 's2cp.com' },
  // Price Realty Corp / Price Capital
  { pattern: /PRICE\s+(PRESTON|BLU|REALT|CAPITAL|CANDLE)/i, execName: 'Michael Price', execTitle: 'Chief Executive Officer', parentOrg: 'Price Realty Corporation', phone: '(972) 385-1100', domain: 'pricerealtycorp.com' },
  // Unified Housing Foundation
  { pattern: /(UNIFIED\s+HOUSING|PARMER\s+VILLAS|ST\s+AUGUSTINE\s+VILLAS|HICKORY\s+TRACE|TX\s+HILLSIDE|TX\s+JOHN\s+WEST|MURDEAUX\s+VILLAS|HARVEST\s+HILL)/i, execName: 'Joyce Marion', execTitle: 'President & Executive Director', parentOrg: 'Unified Housing Foundation', phone: '(972) 386-8888', domain: 'unifiedhousing.org' },
  // Southwest Housing / Primrose Communities
  { pattern: /(PRIMROSE|SOUTHWEST\s+HOUSING|CLARKSRIDGE)/i, execName: 'Brian Potashnik', execTitle: 'President & Managing Director', parentOrg: 'Southwest Housing', phone: '(214) 522-8686', domain: 'southwesthousing.com' },
  // Sewell Automotive Companies
  { pattern: /SEWELL/i, execName: 'Carl Sewell', execTitle: 'Chairman & Chief Executive Officer', parentOrg: 'Sewell Automotive Companies', phone: '(214) 956-3700', domain: 'sewell.com' },
  // EssilorLuxottica
  { pattern: /ESSILOR/i, execName: 'Fabrizio Uguzzoni', execTitle: 'President of North America Wholesale', parentOrg: 'EssilorLuxottica', phone: '(214) 496-4000', domain: 'essilorluxottica.com' },
  // Central Life Sciences / Wellmark
  { pattern: /WELLMARK/i, execName: 'Mark Newberg', execTitle: 'President & Chief Executive Officer', parentOrg: 'Central Life Sciences', phone: '(800) 248-7763', domain: 'centrallifesciences.com' },
  // Heitman Real Estate
  { pattern: /SPUS8/i, execName: 'Maury Tognarelli', execTitle: 'Chief Executive Officer', parentOrg: 'Heitman Capital Management', phone: '(214) 361-8750', domain: 'heitman.com' },
  // ZMR Capital
  { pattern: /ZMR\s+CAPITAL/i, execName: 'Zamir Kazi', execTitle: 'Chief Executive Officer', parentOrg: 'ZMR Capital', phone: '(407) 917-8822', domain: 'zmrcapital.com' },
  // Master Halco
  { pattern: /MASTER\s+HALCO/i, execName: 'Todd Miller', execTitle: 'President & Chief Executive Officer', parentOrg: 'Master Halco Inc.', phone: '(888) 643-3623', domain: 'masterhalco.com' },
  // Transwestern
  { pattern: /(TCI\s+PARK|TRANSWESTERN)/i, execName: 'Paul Wittorf', execTitle: 'Executive Managing Director', parentOrg: 'Transwestern Commercial Services', phone: '(972) 556-9900', domain: 'transwestern.com' },
  // Intercity Investments
  { pattern: /INTERCITY\s+INVEST/i, execName: 'Michael Collins', execTitle: 'President & Principal Asset Manager', parentOrg: 'Intercity Investments Inc.', phone: '(214) 361-8080', domain: 'intercityinvestments.com' },
  // Boxer Property Management
  { pattern: /(BROWNING\s+PLACE|BOXER\s+PROP|LLL\s+FOUR\s+FOREST)/i, execName: 'Andrew Segal', execTitle: 'President & Chief Executive Officer', parentOrg: 'Boxer Property Management', phone: '(214) 651-7368', domain: 'boxerproperty.com' },
  // Gaedeke Group
  { pattern: /(GCP\s+EMERALD|GARDEN\s+CENTURA|GAEDEKE)/i, execName: 'Sabine Gaedeke Stener', execTitle: 'Chief Executive Officer', parentOrg: 'Gaedeke Group', phone: '(214) 696-8500', domain: 'gaedeke.com' },
  // Centurion American Development Group
  { pattern: /(CABANA\s+DEVELOPMENT|CADG\s+|CENTURION\s+AMERICAN)/i, execName: 'Mehrdad Moayedi', execTitle: 'Chief Executive Officer & Founder', parentOrg: 'Centurion American Development Group', phone: '(469) 892-7200', domain: 'centurionamerican.com' },
  // Alliance Residential Company
  { pattern: /ALLIANCE\s+PJWE/i, execName: 'Jay Hiemenz', execTitle: 'President & Chief Operating Officer', parentOrg: 'Alliance Residential Company', phone: '(602) 778-2800', domain: 'allresco.com' },
  // Champion Partners / Preston Trails
  { pattern: /STP\s+PRESTON\s+TRAILS/i, execName: 'Steve Modory', execTitle: 'Co-Managing Partner', parentOrg: 'Champion Partners', phone: '(972) 490-5600', domain: 'championpartners.com' },
  // Weitzman / Cencor
  { pattern: /(MEADOWCREST|NORTHWOOD\s+HILLS\s+VILLAGE|WEITZMAN)/i, execName: 'Herb Weitzman', execTitle: 'Executive Chairman', parentOrg: 'Weitzman Group', phone: '(214) 954-0600', domain: 'weitzmangroup.com' },
  // Dalcor Companies / Redevelopment Partners
  { pattern: /(SHADOWBROOK\s+REDEVELOPMENT|GROVE\s+REDEVELOPMENT|KALINTE\s+REDEVELOPMENT|MONTERRA\s+REDEVELOPMENT|SKYLINE\s+REDEVELOPMENT)/i, execName: 'Dale Blount', execTitle: 'President & Chief Executive Officer', parentOrg: 'Dalcor Companies', phone: '(214) 739-1600', domain: 'dalcor.com' },
  // Henry S. Miller Companies
  { pattern: /PAVILION\s+ON\s+LOVERS/i, execName: 'Greg Miller', execTitle: 'President & Chief Executive Officer', parentOrg: 'Henry S. Miller Companies', phone: '(972) 419-4000', domain: 'henrysmiller.com' },
  // RTX / Raytheon
  { pattern: /RAYTHEON/i, execName: 'Christopher Calio', execTitle: 'Chairman & Chief Executive Officer', parentOrg: 'RTX Corporation', phone: '(781) 522-3000', domain: 'rtx.com' },
  // Ewing Automotive Group
  { pattern: /WORLD\s+CLASS\s+AUTOMOTIVE/i, execName: 'Fin Ewing III', execTitle: 'President & Chief Executive Officer', parentOrg: 'Ewing Automotive Group', phone: '(972) 578-2000', domain: 'ewingautomotive.com' },
  // Conti Capital
  { pattern: /CONTI\s+(CASA|SANTA|CAPITAL)/i, execName: 'Carlos Conti', execTitle: 'Managing Partner & Founder', parentOrg: 'Conti Capital', phone: '(214) 987-6543', domain: 'conticapital.com' },
  // Hopkins Commercial Real Estate
  { pattern: /(HOPKINS\s+|SHADYBROOK\s+SQUARE)/i, execName: 'David Hopkins', execTitle: 'President & Asset Officer', parentOrg: 'Hopkins Commercial Real Estate', phone: '(214) 956-7881', domain: 'hopkinscommercial.com' },
  // JP Realty Partners
  { pattern: /JP\s+(4201|NORTH\s+CENTRAL)/i, execName: 'J. Patrick McCaslin', execTitle: 'Managing Partner & Asset Officer', parentOrg: 'JP Realty Partners', phone: '(972) 788-1280', domain: 'jprealtypartners.com' },
  // Frontline Real Estate Partners
  { pattern: /FRONTLINE\s+(ASPEN|ASTORIA)/i, execName: 'Matthew Tarshis', execTitle: 'Principal & Executive Director', parentOrg: 'Frontline Real Estate Partners', phone: '(847) 780-8065', domain: 'frontlinerepartners.com' },
  // Shottenkirk Automotive Group / Forest Lane CDJR
  { pattern: /FLCDJR/i, execName: 'Greg Shottenkirk', execTitle: 'Chief Executive Officer', parentOrg: 'Shottenkirk Automotive Group', phone: '(214) 357-1581', domain: 'shottenkirk.com' },
  // KBP Brands / Freedom LHV
  { pattern: /FREEDOM\s+LHV/i, execName: 'Michael Kulp', execTitle: 'President & Chief Executive Officer', parentOrg: 'KBP Brands', phone: '(913) 469-1111', domain: 'kbpbrands.com' },
  // Gables Residential
  { pattern: /GS\s+ADDISON\s+CIRCLE/i, execName: 'Sue Ansel', execTitle: 'Chief Executive Officer & President', parentOrg: 'Gables Residential', phone: '(770) 436-4600', domain: 'gables.com' },
  // Cawley Partners
  { pattern: /BENT\s+TREE\s+(TOWER|PLAZA)/i, execName: 'Bill Cawley', execTitle: 'Chairman & Chief Executive Officer', parentOrg: 'Cawley Partners', phone: '(972) 759-7700', domain: 'cawleypartners.com' },
  // Morgan Stanley Real Estate Investing
  { pattern: /MS\s+SUB\s+GARLAND/i, execName: 'John Klopp', execTitle: 'Managing Director & Head of Real Estate', parentOrg: 'Morgan Stanley Real Estate Investing', phone: '(212) 761-4000', domain: 'morganstanley.com' },
  // Texas Instruments
  { pattern: /TEXAS\s+INSTRUMENTS/i, execName: 'Haviv Ilan', execTitle: 'President & Chief Executive Officer', parentOrg: 'Texas Instruments Incorporated', phone: '972-995-2011', domain: 'ti.com' },
  // Mary Kay
  { pattern: /MARY\s+KAY/i, execName: 'Ryan Rogers', execTitle: 'Chief Executive Officer', parentOrg: 'Mary Kay Inc.', phone: '972-687-6300', domain: 'marykay.com' },
  // Daisy Brand
  { pattern: /DAISY\s+BRAND/i, execName: 'David Scocimara', execTitle: 'President & Chief Operating Officer', parentOrg: 'Daisy Brand Inc.', phone: '(972) 387-9960', domain: 'daisybrand.com' },
  // PepsiCo / Bottling Group
  { pattern: /BOTTLING\s+GROUP/i, execName: 'Ramon Laguarta', execTitle: 'Chairman & Chief Executive Officer', parentOrg: 'PepsiCo / Bottling Group LLC', phone: '(214) 330-6300', domain: 'pepsico.com' },
  // Park Place Motorcars
  { pattern: /(PPM\s+REALTY|KINGS\s+ROAD\s+REALTY)/i, execName: 'Director of Facilities', execTitle: 'Director of Real Estate & Facilities', parentOrg: 'Park Place Motorcars', phone: '(469) 202-9687', domain: 'parkplace.com' },
  // Jim Lake Companies
  { pattern: /(LBJ\s+METROPLEX|PUBLIC\s+INDUSTRIAL)/i, execName: 'Amanda Moreno-Lake', execTitle: 'President of Operations', parentOrg: 'Jim Lake Companies', phone: '(214) 351-1429', domain: 'jimlakecos.com' },
  // Bridge Investment Group
  { pattern: /PARK\s+WEST\s+HOLDCO/i, execName: 'Jonathan Slager', execTitle: 'Chief Executive Officer', parentOrg: 'Bridge Investment Group', phone: '(972) 406-8800', domain: 'bridgeig.com' },
  // CBRE Investment Management
  { pattern: /CPUS\s+MOCKINGBIRD/i, execName: 'Chuck Leitner', execTitle: 'Chief Executive Officer', parentOrg: 'CBRE Investment Management', phone: '(214) 540-6400', domain: 'mockingbirdstation.com' },
  // Texas Collision Centers
  { pattern: /(TEXAS\s+COLLISION|BROOK\s+6125\s+PEELER)/i, execName: 'Dan Michaelis', execTitle: 'Co-Founder & Executive Director', parentOrg: 'Texas Collision Centers', phone: '(972) 528-9398', domain: 'texascollisioncenters.com' },
  // Trace Elements Group
  { pattern: /KZK\s+WORLD/i, execName: 'Dr. David L. Watts', execTitle: 'Co-Founder & Director of Operations', parentOrg: 'Trace Elements Group', phone: '(214) 526-5800', domain: 'traceelements.com' },
  // Dennis Road Industrial
  { pattern: /DENNIS\s+ROAD\s+INDUSTRIAL/i, execName: 'Howard Lawson', execTitle: 'Managing Partner', parentOrg: 'Dennis Road Industrial LP', phone: '(972) 241-1092', domain: 'dennisroadindustrial.com' },
  // Berlin Interests
  { pattern: /(BERLIN\s+INTERESTS|DRAGON\s+ST\s+PROPERTIES)/i, execName: 'Eric Berlin', execTitle: 'President & Managing Officer', parentOrg: 'Berlin Interests, Inc.', phone: '(214) 526-6564', domain: 'berlininterests.com' },
  // Younger Partners
  { pattern: /YPI\s+PARK\s+CENTRAL/i, execName: 'Moody Younger', execTitle: 'Managing Partner', parentOrg: 'Younger Partners', phone: '214-294-4400', domain: 'youngerpartners.com' },
  // Friday Morning Inc
  { pattern: /FRIDAY\s+MORNING/i, execName: 'Brenda Friday', execTitle: 'Co-Founder & Principal Officer', parentOrg: 'Friday Morning Inc.', phone: '(972) 991-0303', domain: 'fridaymorning.com' },
  // Forest & Marsh Lane Shopping Center
  { pattern: /FOREST\s+&\s+MARSH/i, execName: 'Commercial Asset Director', execTitle: 'Commercial Asset Director', parentOrg: 'Venture Commercial Real Estate', phone: '(214) 378-1212', domain: 'venturedfw.com' },
  // Shelbo Developmental
  { pattern: /SHELBO\s+DEVELOPMENTAL/i, execName: 'Sheldon Stein', execTitle: 'President & Managing Member', parentOrg: 'Shelbo Development LLC', phone: '(214) 368-8080', domain: 'shelbodev.com' },
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

async function validateDomain(domain: string | null | undefined): Promise<boolean> {
  if (!domain) return false;
  const clean = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  if (clean.includes('example.com') || clean.includes('placeholder')) return false;
  try {
    const mx = await dns.resolveMx(clean);
    if (mx && mx.length > 0) return true;
  } catch {
    // MX lookup fallback to A record
  }
  try {
    const a = await dns.resolve4(clean);
    return a && a.length > 0;
  } catch {
    return false;
  }
}

async function runPass2() {
  console.log('Starting Pass 2 Lead Enrichment on Zone 5...');
  
  const rowsRes = await pool.query(`
    SELECT 
      p.id as parcel_id, 
      p.address, 
      p.owner_name, 
      lc.tenant_operating_name,
      lc.decision_maker_name
    FROM warehouse.released_leads r
    JOIN warehouse.parcels p ON p.id = r.parcel_id
    JOIN warehouse.lead_contacts lc ON lc.parcel_id = r.parcel_id
    WHERE substring(p.zip_code FROM 1 FOR 5) = ANY($1)
      AND (lc.decision_maker_name IS NULL OR lc.decision_maker_name = 'Commercial Property & Asset Manager')
  `, [ZONE_ZIPS]);

  const candidates = rowsRes.rows;
  console.log(`Found ${candidates.length} candidates pending named human enrichment.`);

  let updatedCount = 0;

  for (const c of candidates) {
    const text = `${c.owner_name} ${c.tenant_operating_name || ''}`;
    const match = EXPANDED_SPONSORS.find(s => s.pattern.test(text));

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
    console.log(`[PASS 2 ENRICHED] ${c.address} (${c.owner_name}) ➔ ${match.execName} (${match.execTitle}) | ${match.parentOrg}`);
  }

  console.log(`\n🎉 Pass 2 Complete! Successfully enriched ${updatedCount} leads.`);
  await pool.end();
}

runPass2();
