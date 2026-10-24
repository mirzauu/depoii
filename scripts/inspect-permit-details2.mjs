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
      select contractor_name, raw_description, normalized_address, valuation, issue_date
      from warehouse.normalized_permits 
      where lower(contractor_name) like '%bobby foster%'
         or lower(contractor_name) like '%daniel arenas%'
         or lower(contractor_name) like '%jennifer jennings%'
         or lower(contractor_name) like '%esthela sifuentes%'
      limit 10
    `);
    console.log(res.rows);
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(console.error);
