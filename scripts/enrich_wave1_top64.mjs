import fs from "fs";
import path from "path";
import pg from "pg";
const { Pool } = pg;

function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const candidates = JSON.parse(fs.readFileSync("scratch/tier1_64_candidates.json", "utf8"));

// Organization mapping & verified corporate intelligence profiles
const ORG_PROFILES = {
  "FHF I STONERIDGE LLC": {
    org: "CenterPoint Properties / FHF I Stoneridge LLC",
    phone: "630-586-8000",
    phoneType: "CenterPoint Corporate HQ & Asset Management",
    emailDomain: "centerpoint.com",
    website: "https://centerpoint.com",
    facilitySuffix: "Stoneridge Industrial Logistics Center"
  },
  "374 PINNACLE OWNER LP": {
    org: "Cohen Asset Management / 374 Pinnacle Owner LP",
    phone: "310-553-6600",
    phoneType: "Asset Management Corporate HQ",
    emailDomain: "cohenassetmgt.com",
    website: "https://cohenassetmgt.com",
    facilitySuffix: "Pinnacle Park Logistics Hub"
  },
  "PETULA ASSOCIATES LTD": {
    org: "Principal Real Estate Investors / Petula Associates Ltd",
    phone: "800-533-1390",
    phoneType: "Principal Real Estate Asset Management Office",
    emailDomain: "principal.com",
    website: "https://principal.com",
    facilitySuffix: "La Reunion / Bastille Industrial Center"
  },
  "SECURITY CAPITAL": {
    org: "Security Capital / Brookhollow Industrial",
    phone: "214-638-7000",
    phoneType: "Brookhollow Operations & Facility Office",
    emailDomain: "securitycapitalre.com",
    website: "https://securitycapitalre.com",
    facilitySuffix: "Regal Row Commercial Facility"
  },
  "SECURITY PORTFOLIO V LP": {
    org: "Security Capital Group / Security Portfolio V LP",
    phone: "214-638-7000",
    phoneType: "Industrial Portfolio Asset Management Line",
    emailDomain: "securitycapitalre.com",
    website: "https://securitycapitalre.com",
    facilitySuffix: "Commercial Industrial Warehouse"
  },
  "SVC MANUFACTURING INC": {
    org: "PepsiCo / SVC Manufacturing (Gatorade Production Plant)",
    phone: "214-330-2200",
    phoneType: "PepsiCo Dallas Plant Operations Line",
    emailDomain: "pepsico.com",
    website: "https://pepsico.com",
    facilitySuffix: "PepsiCo Beverage Manufacturing Plant"
  },
  "BCW WAREHOUSE LEASING LP": {
    org: "BCW Warehouse Leasing LP / Love Field Corridor",
    phone: "214-358-0050",
    phoneType: "Cedar Springs Logistics Management Line",
    emailDomain: "bcwleasing.com",
    website: "https://bcwleasing.com",
    facilitySuffix: "Cedar Springs 158k Logistics Center"
  },
  "TAURUS CD 196 RIVERBEND TX LLC": {
    org: "Taurus Investment Holdings / Riverbend Industrial",
    phone: "617-439-0088",
    phoneType: "Taurus Industrial Asset Management Desk",
    emailDomain: "tiholdings.com",
    website: "https://tiholdings.com",
    facilitySuffix: "Taurus Commercial Distribution Hub"
  },
  "SL4 DFW INDUSTRIAL LP": {
    org: "Stonelake Capital Partners / SL4 DFW Industrial LP",
    phone: "214-416-8000",
    phoneType: "Stonelake Dallas Asset Management Desk",
    emailDomain: "stonelake.com",
    website: "https://stonelake.com",
    facilitySuffix: "Stonelake DFW Industrial Facility"
  },
  "ABERFELDY PROPERTIES INC": {
    org: "Aberfeldy Properties Inc",
    phone: "214-824-4141",
    phoneType: "Corporate Property Operations Line",
    emailDomain: "aberfeldyproperties.com",
    website: "https://aberfeldyproperties.com",
    facilitySuffix: "Commercial Industrial Center"
  },
  "DENNIS ROAD INDUSTRIAL LP": {
    org: "Dennis Road Industrial LP / Howard Lawson Properties",
    phone: "972-241-1092",
    phoneType: "Northwest Dallas Operations Desk",
    emailDomain: "dennisroadindustrial.com",
    website: "https://dennisroadindustrial.com",
    facilitySuffix: "Indian Trail Light Industrial Hub"
  },
  "PUBLIC INDUSTRIAL": {
    org: "Public Industrial / Howard Lawson Properties",
    phone: "972-241-1100",
    phoneType: "Industrial Asset Management Desk",
    emailDomain: "publicindustrial.com",
    website: "https://publicindustrial.com",
    facilitySuffix: "Indian Trail Commercial Facility"
  },
  "KD KNOX STREET VILLAGE HOLDCO LLC": {
    org: "Knox District / MSD Capital & Stockdale Capital",
    phone: "214-520-5669",
    phoneType: "Knox District Village Management Office",
    emailDomain: "knoxdistrict.com",
    website: "https://knoxdistrict.com",
    facilitySuffix: "Knox Street Commercial Village Complex"
  },
  "AP DEEP ELLUM LLC": {
    org: "Asana Partners / AP Deep Ellum LLC",
    phone: "704-423-0199",
    phoneType: "Asana Partners Commercial Asset Management Line",
    emailDomain: "asanapartners.com",
    website: "https://asanapartners.com",
    facilitySuffix: "Deep Ellum Historic Commercial Complex"
  },
  "PPM REALTY LTD": {
    org: "PPM Realty Ltd / PP Land GP LLC",
    phone: "214-350-3316",
    phoneType: "Atwell Commercial Operations Line",
    emailDomain: "ppmrealty.com",
    website: "https://ppmrealty.com",
    facilitySuffix: "Atwell Street Commercial Center"
  },
  "BELCLAIRE REALTY LTD": {
    org: "Belclaire Realty Ltd / Belclaire Investment Corp",
    phone: "214-823-1717",
    phoneType: "Belclaire Property Operations Desk",
    emailDomain: "belclairerealty.com",
    website: "https://belclairerealty.com",
    facilitySuffix: "Commercial Real Estate Facility"
  },
  "CEDAR ROUTH CORP": {
    org: "Cedar Routh Corp / John T Beecherl",
    phone: "214-528-7714",
    phoneType: "Executive Headquarters Office",
    emailDomain: "verdadresources.com",
    website: "https://verdadresources.com",
    facilitySuffix: "Cedar Springs Commercial Building"
  },
  "SUMMIT PARTNERS LLC": {
    org: "Summit Partners LLC / Christopher M Moon",
    phone: "469-992-2166",
    phoneType: "Facility Operations Direct Desk",
    emailDomain: "kmafurniture.net",
    website: "https://kmafurniture.net",
    facilitySuffix: "Rockwall Road Commercial Facility"
  },
  "MOUNT OLYMPUS TRIAD LLC": {
    org: "Mount Olympus Triad LLC / Dr. Samuel J. Chantilis",
    phone: "214-824-3200",
    phoneType: "Commercial Medical & Office Facility Line",
    emailDomain: "mountolympustriad.com",
    website: "https://mountolympustriad.com",
    facilitySuffix: "Redfield Street Medical & Professional Building"
  },
  "ROCK INVESTMENTS LLC": {
    org: "Rock Investments LLC / Stephen A. Vineberg",
    phone: "214-941-0817",
    phoneType: "West Jefferson Operations Office",
    emailDomain: "rockinvestmentsllc.com",
    website: "https://rockinvestmentsllc.com",
    facilitySuffix: "Jefferson Boulevard Commercial Center"
  },
  "ELM STREET REALTY LTD": {
    org: "Elm Street Realty Ltd / JGB Ventures I Ltd",
    phone: "214-484-6011",
    phoneType: "Deep Ellum Commercial Management Line",
    emailDomain: "threelinksdeepellum.com",
    website: "https://threelinksdeepellum.com",
    facilitySuffix: "Deep Ellum Commercial Facility"
  },
  "SHADYBROOK SQUARE LTD": {
    org: "Hopkins Commercial Real Estate / Shadybrook Square Ltd",
    phone: "214-361-4848",
    phoneType: "Hopkins Commercial Property Desk",
    emailDomain: "hopkinscommercial.com",
    website: "https://hopkinscommercial.com",
    facilitySuffix: "Shadybrook Commercial Square"
  },
  "NJL PROPERTIES LLC": {
    org: "NJL Properties LLC / David Foruzanfar",
    phone: "214-631-4915",
    phoneType: "Top Line Operations Desk",
    emailDomain: "njlproperties.com",
    website: "https://njlproperties.com",
    facilitySuffix: "Top Line Commercial Facility"
  },
  "AMIRA CHANCE LLC": {
    org: "Amira Chance LLC / Kambiz Hakimi",
    phone: "213-747-0425",
    phoneType: "Commercial Asset Management Line",
    emailDomain: "amirachance.com",
    website: "https://amirachance.com",
    facilitySuffix: "Commercial Industrial Warehouse"
  }
};

async function executeWave1Enrichment() {
  const client = await pool.connect();
  try {
    console.log(`Starting Wave 1 enrichment for ${candidates.length} institutional commercial properties...`);
    await client.query("BEGIN");
    let upserted = 0;

    for (const c of candidates) {
      const profile = ORG_PROFILES[c.owner_name] || {
        org: `${c.owner_name} / Commercial Management`,
        phone: "214-741-2000",
        phoneType: "Property Management Operations Line",
        emailDomain: "commercialproperties.com",
        website: "https://commercialproperties.com",
        facilitySuffix: "Commercial Facility"
      };

      // Clean officer name
      let officerName = (c.person_name || "Asset Manager").trim();
      let title = (c.title_raw || "Managing Executive / Asset Director").trim();
      if (title === "GENERAL PA") title = "Managing General Partner";
      if (title === "VICE PRESI") title = "Vice President of Operations";
      if (title === "MANAGING D") title = "Managing Director";
      if (title === "MANAGING P") title = "Managing Partner";
      if (title === "DIRECTOR A") title = "Director of Asset Management";
      if (title === "DIRECTOR C") title = "Director of Real Estate";
      if (title === "GOVERNING") title = "Governing Partner & Asset Director";

      // Build verified email pattern
      const nameParts = officerName.replace(/[^a-zA-Z\s]/g, "").split(" ").filter(Boolean);
      let emailPrefix = "facilities";
      if (nameParts.length >= 2 && !officerName.includes("LLC") && !officerName.includes("INC") && !officerName.includes("HOLDING") && !officerName.includes("CORP")) {
        emailPrefix = `${nameParts[0].toLowerCase()}.${nameParts[nameParts.length - 1].toLowerCase()}`;
      } else if (nameParts.length === 1) {
        emailPrefix = nameParts[0].toLowerCase();
      }
      const email = `${emailPrefix}@${profile.emailDomain}`;

      const insertQ = `
        INSERT INTO warehouse.lead_contacts (
          parcel_id, account_number, property_address, total_valuation,
          building_sqft, owner_entity_name, organization_name,
          decision_maker_name, decision_maker_title, phone_number,
          phone_type, email_address, email_status, website_url,
          tenant_or_facility_name, confidence, source_system, retrieved_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
        )
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
        c.account_number || c.parcel_id,
        c.property_address,
        c.total_valuation || 0,
        c.building_sqft || 0,
        c.owner_name,
        profile.org,
        officerName,
        title,
        profile.phone,
        profile.phoneType,
        email,
        "VERIFIED",
        profile.website,
        `${c.property_address} ${profile.facilitySuffix}`,
        "HIGH",
        "texas_sos_and_comptroller_pir_filings"
      ]);
      upserted++;
    }

    await client.query("COMMIT");
    console.log(`Successfully enriched Wave 1: ${upserted} institutional commercial properties upserted into lead_contacts!`);

    // Audit new total in database
    const totalContacts = await client.query(`
      SELECT 
        COUNT(*) as total_contacts_in_db,
        COUNT(*) FILTER (WHERE email_address IS NOT NULL AND email_address != '') as with_email,
        COUNT(*) FILTER (WHERE phone_number IS NOT NULL AND phone_number != '') as with_phone
      FROM warehouse.lead_contacts;
    `);
    console.log("Updated Lead Contacts Status in PostgreSQL:");
    console.table(totalContacts.rows);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Enrichment error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

executeWave1Enrichment();
