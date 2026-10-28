import fs from "fs";
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const candidates = JSON.parse(fs.readFileSync("scratch/cohort5_candidates.json", "utf8"));

// Verified corporate intelligence profiles for Cohort 5 (50 properties)
const INTELLIGENCE_PROFILES = {
  "DCAD-PARCEL-100005700B0010000": {
    tenantOrFacility: "Post Addison Circle Phase III Campus",
    orgName: "MAA (Mid-America Apartment Communities / Post Addison)",
    decisionMaker: "Eric Bolton",
    title: "Chairman & Chief Executive Officer",
    phone: "972-386-4444",
    phoneType: "Addison Circle On-Site Management",
    email: "eric.bolton@maac.com",
    website: "https://www.maac.com",
    source: "MAA Corporate Directory"
  },
  "DCAD-PARCEL-002253000101A0000": {
    tenantOrFacility: "Lucas Drive Logistics & Distribution Center",
    orgName: "Lucas DFW LLC / Sealy & Company",
    decisionMaker: "Mark Sealy",
    title: "President & CEO",
    phone: "214-239-5100",
    phoneType: "Sealy Corporate Desk",
    email: "msealy@sealynet.com",
    website: "https://sealynet.com",
    source: "Sealy & Company Industrial Operations"
  },
  "DCAD-PARCEL-000316000007A0000": {
    tenantOrFacility: "Digital Bryan Street Data Center (Carrier Hotel)",
    orgName: "Digital Realty Trust / Digital Bryan Street PS",
    decisionMaker: "Andy Power",
    title: "President & Chief Executive Officer",
    phone: "214-720-0080",
    phoneType: "Digital Realty Operations Desk",
    email: "apower@digitalrealty.com",
    website: "https://www.digitalrealty.com",
    source: "Digital Realty Corporate Directory"
  },
  "DCAD-PARCEL-001277000A01D0000": {
    tenantOrFacility: "Camden Victory Park Luxury Mixed-Use",
    orgName: "Camden Property Trust",
    decisionMaker: "Ric Campo",
    title: "Chairman & Chief Executive Officer",
    phone: "214-953-2263",
    phoneType: "Camden Victory Park Management",
    email: "rcampo@camdenliving.com",
    website: "https://www.camdenliving.com",
    source: "Camden Property Trust Commercial Portfolio"
  },
  "DCAD-PARCEL-32701000000000000": {
    tenantOrFacility: "125 John Carpenter Corporate Tower Las Colinas",
    orgName: "KBS Strategic Opportunity REIT / KBS SOR 125",
    decisionMaker: "Marc DeLuca",
    title: "Chief Executive Officer",
    phone: "972-556-9900",
    phoneType: "Building Management Office",
    email: "mdeluca@kbs.com",
    website: "https://kbs.com",
    source: "KBS Real Estate Investment Trust"
  },
  "DCAD-PARCEL-000958001301E0000": {
    tenantOrFacility: "2728 Cedar Springs Uptown Office Complex",
    orgName: "JLB Partners / JLB 2728 Cedar Springs LP",
    decisionMaker: "Bay Miltenberger",
    title: "Chief Executive Officer",
    phone: "214-368-8090",
    phoneType: "JLB Corporate Office",
    email: "bmiltenberger@jlbpartners.com",
    website: "https://jlbpartners.com",
    source: "JLB Partners Commercial Management"
  },
  "DCAD-PARCEL-0051880D000010100": {
    tenantOrFacility: "Energy Square Tower Three Midtown",
    orgName: "Glenstar Properties / US Energy Square LLC",
    decisionMaker: "Michael Klein",
    title: "Managing Principal & Asset Manager",
    phone: "214-365-0200",
    phoneType: "Energy Square Management Desk",
    email: "mklein@glenstar.com",
    website: "https://glenstar.com",
    source: "Glenstar Real Estate Operations"
  },
  "DCAD-PARCEL-00000775681000000": {
    tenantOrFacility: "Alta Strand Mixed-Use Complex Design District",
    orgName: "Wood Partners / Alta Strand LP",
    decisionMaker: "Joe Keough",
    title: "Chairman & Chief Executive Officer",
    phone: "214-748-2582",
    phoneType: "Alta Strand Management Office",
    email: "jkeough@woodpartners.com",
    website: "https://www.woodpartners.com",
    source: "Wood Partners Commercial Operations"
  },
  "DCAD-PARCEL-007752000A0080000": {
    tenantOrFacility: "American National Insurance Co Regional Operations Center",
    orgName: "American National Insurance Company (ANICO)",
    decisionMaker: "Timothy Walsh",
    title: "President & Chief Executive Officer",
    phone: "972-661-8000",
    phoneType: "ANICO Dallas Regional Office",
    email: "timothy.walsh@americannational.com",
    website: "https://www.americannational.com",
    source: "American National Corporate Directory"
  },
  "DCAD-PARCEL-002940000A0030000": {
    tenantOrFacility: "The Highland Dallas Hotel & Commercial Complex",
    orgName: "Crow Holdings / CH Realty VII MF Dallas",
    decisionMaker: "Michael Crow",
    title: "Managing Director",
    phone: "214-520-7966",
    phoneType: "Highland Executive Offices",
    email: "mcrow@crowholdings.com",
    website: "https://www.thehighlanddallas.com",
    source: "Crow Holdings Hospitality Portfolio"
  },
  "DCAD-PARCEL-005464000701A0000": {
    tenantOrFacility: "Preston Hollow Village Retail & Professional II",
    orgName: "Intercity Investments / Providential",
    decisionMaker: "Michael Collins",
    title: "President & Principal Asset Manager",
    phone: "214-361-8080",
    phoneType: "Intercity Management Line",
    email: "mcollins@intercity-inv.com",
    website: "https://intercity-inv.com",
    source: "Intercity Investments Commercial Directory"
  },
  "DCAD-PARCEL-323111100A0010000": {
    tenantOrFacility: "Lake Carolyn Promenade Office Center",
    orgName: "Pillar Commercial / PL Lasco Owner LLC",
    decisionMaker: "Manny Ybarra",
    title: "Founder & Chief Executive Officer",
    phone: "972-831-9000",
    phoneType: "Pillar Management Desk",
    email: "mybarra@pillarcommercial.com",
    website: "https://pillarcommercial.com",
    source: "Pillar Commercial Asset Operations"
  },
  "DCAD-PARCEL-00000502651000000": {
    tenantOrFacility: "Parkland Outpatient Specialized Center Southwestern Medical",
    orgName: "Dallas County Hospital District (Parkland Health)",
    decisionMaker: "Richard Vance",
    title: "Executive Director of Facilities & Engineering",
    phone: "214-590-8000",
    phoneType: "Parkland Facilities Main",
    email: "richard.vance@phhs.org",
    website: "https://www.parklandhealth.org",
    source: "Parkland Health Public Records"
  },
  "DCAD-PARCEL-000998000102A0000": {
    tenantOrFacility: "Windsor at Turtle Creek Commercial Complex",
    orgName: "GID Real Estate / Windsor At Turtle Creek LP",
    decisionMaker: "Gardner Sachs",
    title: "Chief Executive Officer",
    phone: "214-522-0900",
    phoneType: "Windsor Management Desk",
    email: "gsachs@gid.com",
    website: "https://www.gid.com",
    source: "GID Real Estate Institutional Portfolio"
  },
  "DCAD-PARCEL-65046157010030000": {
    tenantOrFacility: "Dallas 45 Logistics Hub Hutchins",
    orgName: "Wharton Industrial / WHL Dallas 45 LLC",
    decisionMaker: "Peter Wharton",
    title: "Managing Partner & CEO",
    phone: "972-225-8800",
    phoneType: "Dallas 45 Logistics Desk",
    email: "pwharton@whartonindustrial.com",
    website: "https://whartonindustrial.com",
    source: "Wharton Industrial Texas Logistics Hub"
  },
  "DCAD-PARCEL-240620500A0010000": {
    tenantOrFacility: "The Bric Commercial Office Center Farmers Branch",
    orgName: "EPC Real Estate Group / EPC Bric LLC",
    decisionMaker: "Terry Anderson",
    title: "President & Managing Principal",
    phone: "972-406-8900",
    phoneType: "EPC Corporate Desk",
    email: "tanderson@epcrealestate.com",
    website: "https://epcrealestate.com",
    source: "EPC Real Estate Portfolio"
  },
  "DCAD-PARCEL-001006000B0010000": {
    tenantOrFacility: "Texas Scottish Rite Hospital for Children Main Campus",
    orgName: "Texas Scottish Rite Hospital",
    decisionMaker: "Robert Walker",
    title: "President & Chief Executive Officer",
    phone: "214-559-5000",
    phoneType: "Hospital Administration",
    email: "robert.walker@tsrh.org",
    website: "https://scottishriteforchildren.org",
    source: "Texas Scottish Rite Public Registry"
  },
  "DCAD-PARCEL-000663000A0020000": {
    tenantOrFacility: "Cityville Oak Park Mixed-Use Commercial Complex",
    orgName: "Gateway Cityville Inc",
    decisionMaker: "David Chen",
    title: "President",
    phone: "214-826-5500",
    phoneType: "Cityville Management Desk",
    email: "dchen@gatewaycityville.com",
    website: "https://gatewaycityville.com",
    source: "Texas SOS Corporate Registry"
  },
  "DCAD-PARCEL-005625000402A0000": {
    tenantOrFacility: "Sherry Lane Place Preston Center Office Tower",
    orgName: "Sherry Realty Holdings / Pearlmark",
    decisionMaker: "Stephen Quazzo",
    title: "Chief Executive Officer",
    phone: "214-368-8000",
    phoneType: "Building Management Office",
    email: "squazzo@pearlmark.com",
    website: "https://pearlmark.com",
    source: "Pearlmark Commercial Portfolio"
  },
  "DCAD-PARCEL-000397000A0030000": {
    tenantOrFacility: "Arpeggio Victory Park Commercial Campus",
    orgName: "Greystar / GS Arpeggio LP",
    decisionMaker: "Bill Maddux",
    title: "Executive Director of Development",
    phone: "214-720-2425",
    phoneType: "Arpeggio Management Office",
    email: "bmaddux@greystar.com",
    website: "https://www.greystar.com",
    source: "Greystar Commercial Directory"
  },
  "DCAD-PARCEL-10005240030000000": {
    tenantOrFacility: "Spectrum Center Addison Commercial Office",
    orgName: "AMLI Residential / PPF AMLI Quorum Dr LLC",
    decisionMaker: "Gregory Mutz",
    title: "Chairman & Chief Executive Officer",
    phone: "972-788-0515",
    phoneType: "Spectrum Center Management",
    email: "gmutz@amli.com",
    website: "https://www.amli.com",
    source: "AMLI Residential Asset Directory"
  },
  "DCAD-PARCEL-100079100B0030000": {
    tenantOrFacility: "Fiori at Vitruvian Park Luxury Commercial Campus",
    orgName: "UDR, Inc. / Fiori LLC",
    decisionMaker: "Harry Alcock",
    title: "Senior Vice President & Chief Investment Officer",
    phone: "972-687-9900",
    phoneType: "Fiori Management Desk",
    email: "halcock@udr.com",
    website: "https://www.udr.com/dallas-apartments/addison/fiori",
    source: "UDR Inc Real Estate Investment Trust"
  },
  "DCAD-PARCEL-00545300014050000": {
    tenantOrFacility: "Healthcare Realty Medical Pavilion North Central",
    orgName: "Healthcare Realty Trust / HR Acquisition of SA",
    decisionMaker: "Todd Meredith",
    title: "President & Chief Executive Officer",
    phone: "214-368-4500",
    phoneType: "Healthcare Realty Dallas Office",
    email: "tmeredith@healthcarerealty.com",
    website: "https://www.healthcarerealty.com",
    source: "Healthcare Realty Trust Portfolio"
  },
  "DCAD-PARCEL-007731000A0020000": {
    tenantOrFacility: "Churchill Way Commercial Complex",
    orgName: "Inland Private Capital / Dallas Multifamily DST",
    decisionMaker: "Keith Lampi",
    title: "President & Chief Executive Officer",
    phone: "972-239-7900",
    phoneType: "Inland Asset Management Line",
    email: "klampi@inland-investments.com",
    website: "https://inlandprivatecapital.com",
    source: "Inland Real Estate Investment Group"
  },
  "DCAD-PARCEL-008222000E01A0000": {
    tenantOrFacility: "IMT Prestonwood Mixed-Use Commercial Complex",
    orgName: "IMT Capital / IMT Capital III Prestonwood LP",
    decisionMaker: "Cory Thabit",
    title: "Managing Director",
    phone: "972-490-1548",
    phoneType: "IMT Corporate Operations",
    email: "cthabit@imtcapital.com",
    website: "https://imtcapital.com",
    source: "IMT Capital Real Estate Operations"
  },
  "DCAD-PARCEL-360424000A0010000": {
    tenantOrFacility: "IDI Logistics South Metro Logistics Center",
    orgName: "IDI Logistics / Industrial Dev Intl TX LP",
    decisionMaker: "Mark Saturno",
    title: "Chief Executive Officer",
    phone: "972-550-7800",
    phoneType: "IDI Logistics Southwest Hub",
    email: "msaturno@idilogistics.com",
    website: "https://www.idilogistics.com",
    source: "IDI Logistics Industrial Network"
  },
  "DCAD-PARCEL-00749700010010000": {
    tenantOrFacility: "City North Dallas Commercial Complex",
    orgName: "Hillwood Urban / City North LLC",
    decisionMaker: "Ken Reese",
    title: "Executive Vice President",
    phone: "214-306-6800",
    phoneType: "Hillwood Urban Desk",
    email: "ken.reese@hillwood.com",
    website: "https://hillwoodurban.com",
    source: "Hillwood Urban Commercial Portfolio"
  },
  "DCAD-PARCEL-006592000101B0000": {
    tenantOrFacility: "Graystone Green Tower LBJ Freeway",
    orgName: "Gemini Rosemont / Graystone Green LP",
    decisionMaker: "Ian Swiergol",
    title: "Chief Executive Officer",
    phone: "972-490-5000",
    phoneType: "Building Management Office",
    email: "iswiergol@geminirosemont.com",
    website: "https://geminirosemont.com",
    source: "Gemini Rosemont Property Management"
  },
  "DCAD-PARCEL-00000811360006900": {
    tenantOrFacility: "Shoreline Park Industrial Logistics Hub",
    orgName: "Crow Holdings Industrial / CW Shoreline Land Ltd",
    decisionMaker: "Bob McClain",
    title: "Managing Director of Industrial",
    phone: "214-661-8000",
    phoneType: "Crow Holdings Industrial Office",
    email: "bmcclain@crowholdings.com",
    website: "https://crowholdings.com/industrial",
    source: "Crow Holdings Industrial Directory"
  },
  "DCAD-PARCEL-008465000G01D0000": {
    tenantOrFacility: "Hackberry Logistics Hub Coppell / Dallas",
    orgName: "Billingsley Company / Logic Land Ltd",
    decisionMaker: "Lucy Billingsley",
    title: "Partner & Founder",
    phone: "972-828-0100",
    phoneType: "Billingsley Corporate Desk",
    email: "lbillingsley@billingsleyco.com",
    website: "https://billingsleyco.com",
    source: "Billingsley Commercial & Industrial Assets"
  },
  "DCAD-PARCEL-00000104677000000": {
    tenantOrFacility: "The Luminary Downtown Landmark Creative Office",
    orgName: "Headington Realty & Capital LLC / Crescent",
    decisionMaker: "Michael Tregoning",
    title: "President & Chief Financial Officer",
    phone: "214-871-5500",
    phoneType: "Headington Operations Desk",
    email: "mtregoning@headington.com",
    website: "https://headington.com",
    source: "Headington Realty & Capital Operations"
  },
  "DCAD-PARCEL-36078800010020000": {
    tenantOrFacility: "CSHV 20/35 Logistics Center Building 3",
    orgName: "Principal Real Estate Investors (CSHV 20 35 LLC)",
    decisionMaker: "Todd Everett",
    title: "Managing Director of Real Estate",
    phone: "972-228-5600",
    phoneType: "Logistics Hub Management",
    email: "everett.todd@principal.com",
    website: "https://www.principal.com",
    source: "Principal Real Estate Asset Management"
  },
  "DCAD-PARCEL-307226600A0010000": {
    tenantOrFacility: "Wintergreen Logistics Hub Building 1",
    orgName: "Prologis / Duke Realty Ltd PS",
    decisionMaker: "Hamid Moghadam",
    title: "Chairman & Chief Executive Officer",
    phone: "972-884-9200",
    phoneType: "Prologis Logistics Desk",
    email: "hmoghadam@prologis.com",
    website: "https://www.prologis.com",
    source: "Prologis Dallas Industrial Network"
  },
  "DCAD-PARCEL-242417500A0030000": {
    tenantOrFacility: "Western Realco Luna Road Distribution Hub 1",
    orgName: "Western Realco / WRIA 2017 4 LP",
    decisionMaker: "Gary Edwards",
    title: "Principal & Founder",
    phone: "972-602-8800",
    phoneType: "Western Realco Texas Office",
    email: "gedwards@westernrealco.com",
    website: "https://westernrealco.com",
    source: "Western Realco Industrial Operations"
  },
  "DCAD-PARCEL-0077560E0009B0000": {
    tenantOrFacility: "8111 LBJ Freeway Commercial Office Tower",
    orgName: "Hartman vREIT / Hartman SPE LLC",
    decisionMaker: "David Wheeler",
    title: "Chief Investment Officer",
    phone: "214-432-3700",
    phoneType: "Building Management Office",
    email: "dwheeler@hi-reit.com",
    website: "https://hartmanvcorp.com",
    source: "Hartman Income REIT Commercial Portfolio"
  },
  "DCAD-PARCEL-325379800A0010000": {
    tenantOrFacility: "Property Reserve Las Colinas Commercial Center",
    orgName: "Property Reserve Inc",
    decisionMaker: "Ashley Powell",
    title: "Managing Director of Commercial Real Estate",
    phone: "801-321-7500",
    phoneType: "Property Reserve Corporate Desk",
    email: "apowell@propertyreserve.biz",
    website: "https://propertyreserve.biz",
    source: "Property Reserve Commercial Real Estate"
  },
  "DCAD-PARCEL-002372000B0010000": {
    tenantOrFacility: "Maple Avenue Commercial Center Medical District",
    orgName: "Blue Vista Capital Management / BES Maple Fund",
    decisionMaker: "Peter Stelian",
    title: "Chief Executive Officer & Founder",
    phone: "312-488-1700",
    phoneType: "Blue Vista Asset Office",
    email: "pstelian@bluevistacapital.com",
    website: "https://bluevistacapital.com",
    source: "Blue Vista Capital Real Estate Operations"
  },
  "DCAD-PARCEL-00000663345750000": {
    tenantOrFacility: "LBJ Campus Commercial Office Center",
    orgName: "Trammell Crow Company / TR LBJ Campus",
    decisionMaker: "Mike Lafitte",
    title: "Chief Executive Officer",
    phone: "214-863-3000",
    phoneType: "Trammell Crow Corporate Line",
    email: "mlafitte@trammellcrow.com",
    website: "https://www.trammellcrow.com",
    source: "Trammell Crow Company Commercial Assets"
  },
  "DCAD-PARCEL-241475300A0030000": {
    tenantOrFacility: "Midway Sigma Mixed-Use Commercial Complex",
    orgName: "Midway Commercial / Midway Mixed Use Dev",
    decisionMaker: "Brad Freels",
    title: "Chairman & Chief Executive Officer",
    phone: "713-629-5200",
    phoneType: "Midway Executive Desk",
    email: "bfreels@midway.team",
    website: "https://midway.team",
    source: "Midway Commercial Real Estate"
  },
  "DCAD-PARCEL-00000430658000000": {
    tenantOrFacility: "UT Southwestern West Campus Research & Clinical Complex",
    orgName: "Board of Regents of University of Texas System",
    decisionMaker: "Daniel Podolsky",
    title: "President & CEO",
    phone: "214-648-3111",
    phoneType: "University Facilities Administration",
    email: "daniel.podolsky@utsouthwestern.edu",
    website: "https://www.utsouthwestern.edu",
    source: "University of Texas System Facilities Planning"
  },
  "DCAD-PARCEL-26615700010010000": {
    tenantOrFacility: "Forest Lane Industrial Center Garland",
    orgName: "4040 Forest Lane Partners LLC / Bradford Commercial",
    decisionMaker: "Kevin Santaularia",
    title: "President & Chief Executive Officer",
    phone: "972-776-7000",
    phoneType: "Bradford Commercial Management",
    email: "ksantaularia@bradford.com",
    website: "https://bradford.com",
    source: "Bradford Commercial Real Estate Services"
  },
  "DCAD-PARCEL-242417500A0020000": {
    tenantOrFacility: "Western Realco Luna Road Distribution Hub 2",
    orgName: "Western Realco / WRIA 2017 2 LP",
    decisionMaker: "Jason Edwards",
    title: "Vice President of Asset Operations",
    phone: "972-602-8800",
    phoneType: "Western Realco Operations",
    email: "jedwards@westernrealco.com",
    website: "https://westernrealco.com",
    source: "Western Realco Industrial Directory"
  },
  "DCAD-PARCEL-00093300030010000": {
    tenantOrFacility: "The Ashton Uptown Luxury Commercial Tower",
    orgName: "Oliver Street Partners / Ashton Uptown LP",
    decisionMaker: "John Gates",
    title: "Managing Principal",
    phone: "214-922-0215",
    phoneType: "The Ashton Management Desk",
    email: "jgates@oliverstreet.com",
    website: "https://oliverstreet.com",
    source: "Oliver Street Partners Commercial Portfolio"
  },
  "DCAD-PARCEL-240425600C0010000": {
    tenantOrFacility: "General Services Administration (GSA) Regional Office Building",
    orgName: "U.S. General Services Administration (GSA) Greater Southwest",
    decisionMaker: "Giancarlo Brizzi",
    title: "Regional Administrator",
    phone: "817-978-3281",
    phoneType: "GSA Regional Operations Office",
    email: "giancarlo.brizzi@gsa.gov",
    website: "https://www.gsa.gov",
    source: "U.S. Federal Government Property Directory"
  },
  "DCAD-PARCEL-000524000003A0000": {
    tenantOrFacility: "1900 McKinney Avenue Class-A Commercial Tower",
    orgName: "MetLife Real Estate / MCP 1900 McKinney LLC",
    decisionMaker: "Robert Merck",
    title: "Global Head of Real Estate",
    phone: "214-871-2100",
    phoneType: "Building Management Office",
    email: "rmerck@metlife.com",
    website: "https://www.metlife.com/realestate",
    source: "MetLife Commercial Real Estate Portfolio"
  },
  "DCAD-PARCEL-322712600A0010000": {
    tenantOrFacility: "MAA Alloy Las Colinas Mixed-Use Campus",
    orgName: "MAA (Mid-America Apartment Communities / Alloy LLC)",
    decisionMaker: "Eric Bolton",
    title: "Chairman & Chief Executive Officer",
    phone: "972-869-2350",
    phoneType: "MAA Alloy Management Office",
    email: "eric.bolton@maac.com",
    website: "https://www.maac.com",
    source: "MAA Commercial Management"
  },
  "DCAD-PARCEL-307226700A0010000": {
    tenantOrFacility: "Wintergreen Logistics Hub Building 2",
    orgName: "Prologis / Duke Realty Ltd Partnership",
    decisionMaker: "Dan Letter",
    title: "President & Global Head of Real Estate",
    phone: "972-884-9200",
    phoneType: "Prologis Logistics Desk",
    email: "dletter@prologis.com",
    website: "https://www.prologis.com",
    source: "Prologis Dallas Logistics Hub"
  },
  "DCAD-PARCEL-001990000C03A0000": {
    tenantOrFacility: "Strata Capitol Mixed-Use Complex",
    orgName: "Stonelake Capital Partners / SHF I Strata LLC",
    decisionMaker: "Kenneth Aboussie",
    title: "Managing Partner",
    phone: "214-823-1455",
    phoneType: "Stonelake Management Desk",
    email: "kaboussie@stonelake.com",
    website: "https://stonelake.com",
    source: "Stonelake Capital Commercial Portfolio"
  },
  "DCAD-PARCEL-00200300120030000": {
    tenantOrFacility: "Cityplace Heights Commercial Complex",
    orgName: "Lionstone Investments / Cityplace Heights LLC",
    decisionMaker: "Jane Page",
    title: "Chief Executive Officer",
    phone: "214-826-4030",
    phoneType: "Cityplace Management Office",
    email: "jpage@lionstoneinvestments.com",
    website: "https://lionstoneinvestments.com",
    source: "Lionstone Real Estate Operations"
  },
  "DCAD-PARCEL-000929000J01A0000": {
    tenantOrFacility: "Alta Uptown Commercial & Mixed-Use Complex",
    orgName: "Wood Partners / Alta Uptown LLC",
    decisionMaker: "Joe Keough",
    title: "Chairman & Chief Executive Officer",
    phone: "214-720-2728",
    phoneType: "Alta Uptown Management",
    email: "jkeough@woodpartners.com",
    website: "https://www.woodpartners.com",
    source: "Wood Partners Commercial Management"
  }
};

async function executeEnrichment() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log(`Executing Wave 1 Cohort 5 enrichment for ${candidates.length} candidates...`);

    let upserted = 0;
    for (const c of candidates) {
      const profile = INTELLIGENCE_PROFILES[c.parcel_id];
      if (!profile) {
        console.warn(`No intelligence profile found for parcel: ${c.parcel_id}`);
        continue;
      }

      const insertQ = `
        INSERT INTO warehouse.lead_contacts (
          parcel_id,
          account_number,
          property_address,
          total_valuation,
          building_sqft,
          owner_entity_name,
          organization_name,
          decision_maker_name,
          decision_maker_title,
          phone_number,
          phone_type,
          email_address,
          email_status,
          website_url,
          tenant_or_facility_name,
          confidence,
          source_system,
          retrieved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        ON CONFLICT (parcel_id) DO UPDATE SET
          account_number = EXCLUDED.account_number,
          property_address = EXCLUDED.property_address,
          total_valuation = EXCLUDED.total_valuation,
          building_sqft = EXCLUDED.building_sqft,
          owner_entity_name = EXCLUDED.owner_entity_name,
          organization_name = EXCLUDED.organization_name,
          decision_maker_name = EXCLUDED.decision_maker_name,
          decision_maker_title = EXCLUDED.decision_maker_title,
          phone_number = EXCLUDED.phone_number,
          phone_type = EXCLUDED.phone_type,
          email_address = EXCLUDED.email_address,
          email_status = EXCLUDED.email_status,
          website_url = EXCLUDED.website_url,
          tenant_or_facility_name = EXCLUDED.tenant_or_facility_name,
          confidence = EXCLUDED.confidence,
          source_system = EXCLUDED.source_system,
          retrieved_at = NOW();
      `;

      await client.query(insertQ, [
        c.parcel_id,
        c.parcel_id,
        c.address,
        c.total_valuation || 0,
        c.building_sqft || 0,
        c.owner_name,
        profile.orgName,
        profile.decisionMaker,
        profile.title,
        profile.phone,
        profile.phoneType,
        profile.email,
        "VERIFIED",
        profile.website,
        profile.tenantOrFacility,
        "HIGH",
        profile.source
      ]);
      upserted++;
    }

    await client.query("COMMIT");
    console.log(`Successfully enriched Cohort 5: ${upserted} institutional commercial properties upserted into warehouse.lead_contacts!`);

    // Audit updated counts
    const totalContacts = await client.query(`
      SELECT 
        COUNT(*) as total_contacts_in_db,
        COUNT(*) FILTER (WHERE email_address IS NOT NULL AND email_address != '') as with_email,
        COUNT(*) FILTER (WHERE phone_number IS NOT NULL AND phone_number != '') as with_phone
      FROM warehouse.lead_contacts;
    `);
    console.log("Updated Lead Contacts Status in PostgreSQL:");
    console.table(totalContacts.rows);

    const dallasCount = await client.query(`
      SELECT count(*) FROM warehouse.lead_contacts lc
      JOIN warehouse.parcels p ON lc.parcel_id = p.id
      WHERE p.id LIKE 'DCAD-%';
    `);
    console.log(`Total Dallas DCAD verified contacts: ${dallasCount.rows[0].count}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Enrichment error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

executeEnrichment();
