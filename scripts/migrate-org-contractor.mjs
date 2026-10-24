import pg from "pg";
const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
});

async function run() {
  console.log("Ensuring schema columns on app.orgs...");
  await pool.query(`
    ALTER TABLE app.orgs 
    ADD COLUMN IF NOT EXISTS contractor_id TEXT REFERENCES warehouse.canonical_contractors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS contractor_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS contractor_matched_via TEXT DEFAULT 'manual';

    CREATE INDEX IF NOT EXISTS idx_app_orgs_contractor ON app.orgs(contractor_id);
  `);

  console.log("Targeting New View Roofing contractor link...");
  const newViewRes = await pool.query(`
    UPDATE warehouse.normalized_permits
    SET contractor_id = 'CTR-DAL-MOB-HOME-SOLUTIONS-INC-DBA'
    WHERE lower(contractor_name) LIKE '%new view roofing%'
      AND (contractor_id IS NULL OR contractor_id <> 'CTR-DAL-MOB-HOME-SOLUTIONS-INC-DBA');
  `);
  console.log(`Updated ${newViewRes.rowCount} New View Roofing permits with contractor_id.`);

  // Fast exact match update
  const exactRes = await pool.query(`
    UPDATE warehouse.normalized_permits p
    SET contractor_id = c.id
    FROM warehouse.canonical_contractors c
    WHERE p.contractor_name = c.canonical_name
      AND p.contractor_id IS NULL;
  `);
  console.log(`Updated ${exactRes.rowCount} exact matched permits with contractor_id.`);

  // Let's check New View Roofing
  const checkRes = await pool.query(`
    SELECT count(*) as total, count(contractor_id) as with_contractor_id
    FROM warehouse.normalized_permits
    WHERE lower(contractor_name) LIKE '%new view%'
  `);
  console.log("New View permits check:", checkRes.rows[0]);

  // Let's check current orgs
  const orgsRes = await pool.query(`
    SELECT id, name, contractor_id, subscription_tier FROM app.orgs
  `);
  console.log("Current orgs:", orgsRes.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
