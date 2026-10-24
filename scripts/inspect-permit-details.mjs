import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      select id, contractor_name, raw_description, normalized_address, city, valuation, issue_date
      from warehouse.normalized_permits 
      where lower(contractor_name) like '%sanderlin%' 
         or lower(contractor_name) like '%troxlair%' 
         or lower(contractor_name) like '%amezcia%'
      limit 10
    `);
    console.log(res.rows);
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(console.error);
