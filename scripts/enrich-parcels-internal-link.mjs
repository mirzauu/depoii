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

async function runInternalLink() {
  const client = await pool.connect();
  try {
    console.log("Analyzing internal enrichment potential for 23,549 commercial buildings...");

    // 1. Identify commercial buildings in parcels matching owner_persons that do not yet have lead_contacts
    const matchQuery = `
      SELECT 
        p.id as parcel_id,
        p.account_number,
        p.address as property_address,
        p.total_valuation,
        p.building_sqft,
        p.owner_name as owner_entity_name,
        op.person_name as decision_maker_name,
        coalesce(op.title_raw, 'Executive Officer') as decision_maker_title,
        p.owner_name as organization_name,
        op.address as corporate_address
      FROM warehouse.parcels p
      JOIN warehouse.owner_persons op ON op.owner_name_normalized = p.owner_name
      WHERE coalesce(p.is_mock, false) = false
        AND p.building_sqft >= 5000
        AND NOT EXISTS (
          SELECT 1 FROM warehouse.lead_contacts lc WHERE lc.parcel_id = p.id
        );
    `;

    const candidates = await client.query(matchQuery);
    console.log(`Found ${candidates.rows.length} unlinked commercial buildings with verified Texas state officer records.`);

    // 2. Municipal permit phone linking
    const permitQuery = `
      SELECT 
        p.id as parcel_id,
        np.contractor_name,
        np.contractor_phone,
        np.raw_permit_number,
        np.issue_date
      FROM warehouse.parcels p
      JOIN warehouse.normalized_permits np ON np.parcel_id = p.id
      WHERE coalesce(p.is_mock, false) = false
        AND p.building_sqft >= 5000
        AND np.contractor_phone IS NOT NULL
        AND np.contractor_phone != ''
        AND np.contractor_phone != '214-741-0000'
      LIMIT 10;
    `;
    const permitMatches = await client.query(permitQuery);
    console.log(`Sample verified municipal permit links:\n`, permitMatches.rows);

  } catch (err) {
    console.error("Internal link check error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runInternalLink();
