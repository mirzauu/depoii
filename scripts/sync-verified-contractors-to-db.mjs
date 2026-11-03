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

const VERIFIED_PATH = path.join(process.cwd(), "data", "dallas_contractors_100pct_verified.json");

async function syncToPostgres() {
  if (!fs.existsSync(VERIFIED_PATH)) {
    throw new Error(`File not found: ${VERIFIED_PATH}`);
  }

  const verifiedContractors = JSON.parse(fs.readFileSync(VERIFIED_PATH, "utf8"));
  console.log(`Loaded ${verifiedContractors.length} verified contractor records.`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log("\n=======================================================");
    console.log("  SYNCING TO POSTGRESQL (warehouse.canonical_contractors)");
    console.log("=======================================================");

    let updated = 0;
    let inserted = 0;

    for (const c of verifiedContractors) {
      const checkRes = await client.query(
        `SELECT id FROM warehouse.canonical_contractors WHERE LOWER(canonical_name) = LOWER($1) LIMIT 1`,
        [c.name]
      );

      const nowIso = new Date().toISOString();

      if (checkRes.rows.length > 0) {
        // Update existing record
        await client.query(`
          UPDATE warehouse.canonical_contractors
          SET website_url = $1,
              bbb_profile_url = $2,
              bbb_rating = $3,
              linkedin_company_url = $4,
              rcat_profile_url = $5,
              phone_number = $6,
              primary_license = $7,
              crew_capacity_estimate = $8,
              enrichment_status = '100PCT_VERIFIED_5STEP',
              enrichment_updated_at = $9
          WHERE LOWER(canonical_name) = LOWER($10)
        `, [
          c.website_url || null,
          c.bbb_profile_url || null,
          c.bbb_rating || null,
          c.linkedin_company_url || null,
          c.rcat_profile_url || null,
          c.phone_number || null,
          c.rcat_license || null,
          c.workers_capacity || null,
          nowIso,
          c.name
        ]);
        updated++;
      } else {
        // Insert new canonical record
        const newId = `CTR-${c.name.toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 30)}`;
        await client.query(`
          INSERT INTO warehouse.canonical_contractors (
            id, canonical_name, website_url, bbb_profile_url, bbb_rating,
            linkedin_company_url, rcat_profile_url, phone_number, primary_license,
            crew_capacity_estimate, total_permits, total_valuation,
            enrichment_status, enrichment_updated_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '100PCT_VERIFIED_5STEP', $13, $13, $13)
        `, [
          newId,
          c.name,
          c.website_url || null,
          c.bbb_profile_url || null,
          c.bbb_rating || null,
          c.linkedin_company_url || null,
          c.rcat_profile_url || null,
          c.phone_number || null,
          c.rcat_license || null,
          c.workers_capacity || null,
          parseInt(c.permits || 1, 10),
          parseFloat(c.valuation || 0),
          nowIso
        ]);
        inserted++;
      }
    }

    console.log(`✔ PostgreSQL Sync Complete:`);
    console.log(`   - Updated: ${updated} existing records`);
    console.log(`   - Inserted: ${inserted} new records`);

    // Verify stats in PostgreSQL
    const statsRes = await client.query(`
      SELECT 
        COUNT(*) as total_contractors,
        COUNT(CASE WHEN enrichment_status = '100PCT_VERIFIED_5STEP' THEN 1 END) as verified_5step,
        COUNT(CASE WHEN website_url IS NOT NULL THEN 1 END) as with_live_website,
        COUNT(CASE WHEN bbb_profile_url IS NOT NULL THEN 1 END) as with_live_bbb,
        COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as with_phone,
        COUNT(CASE WHEN linkedin_company_url IS NOT NULL THEN 1 END) as with_linkedin
      FROM warehouse.canonical_contractors
    `);

    console.log("\nCurrent PostgreSQL warehouse.canonical_contractors Overview:");
    console.table(statsRes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

syncToPostgres().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});

