import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ROOFING_SQL = `(
  (lower(coalesce(p.raw_description,'')) like '%roof replacement%' or lower(coalesce(p.raw_description,'')) like '%roof repair%'
   or lower(coalesce(p.raw_description,'')) like '%reroof%' or lower(coalesce(p.raw_description,'')) like '%re-roof%'
   or lower(coalesce(p.raw_description,'')) like '%re roof%' or lower(coalesce(p.raw_description,'')) like '%tear-off%'
   or lower(coalesce(p.raw_description,'')) like '%tear off%' or lower(coalesce(p.raw_description,'')) like '%tpo%'
   or lower(coalesce(p.raw_description,'')) like '%epdm%' or lower(coalesce(p.raw_description,'')) like '%shingle%'
   or lower(coalesce(p.raw_description,'')) like '%single-ply%' or lower(coalesce(p.raw_description,'')) like '%single ply%'
   or lower(coalesce(p.raw_description,'')) like '%modified bitumen%' or lower(coalesce(p.raw_description,'')) like '%built-up%'
   or lower(coalesce(p.raw_description,'')) like '%built up roof%' or lower(coalesce(p.raw_description,'')) like '%roof coating%'
   or lower(coalesce(p.raw_description,'')) like '%roofing%')
  and lower(coalesce(p.raw_description,'')) not like '%solar%' and lower(coalesce(p.raw_description,'')) not like '%photovoltaic%'
  and lower(coalesce(p.raw_description,'')) not like '%scaffold%' and lower(coalesce(p.raw_description,'')) not like '%chain link%'
  and lower(coalesce(p.raw_description,'')) not like '%sidewalk shed%' and lower(coalesce(p.raw_description,'')) not like '%hvac%'
  and lower(coalesce(p.raw_description,'')) not like '%multi-family dwelling%' and lower(coalesce(p.raw_description,'')) not like '%core and shell%'
  and lower(coalesce(p.raw_description,'')) not like '%core & shell%' and lower(coalesce(p.raw_description,'')) not like '%detention tank%'
  and not ((p.square_footage is not null and p.square_footage > 0 and p.valuation / p.square_footage > 1000)
    or (p.valuation > 50000000 and (lower(coalesce(p.raw_description,'')) like '%roof%' or lower(coalesce(p.category,'')) like '%roof%')))
)`;

async function inspectBatch() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      with dallas_c as (
        select p.contractor_name as name,
               count(*)::text as permits,
               coalesce(sum(p.valuation),0)::text as val
        from warehouse.normalized_permits p
        where lower(coalesce(p.contractor_name,'')) not like '%licensed%'
          and lower(coalesce(p.contractor_name,'')) not like '%unknown%'
          and lower(coalesce(p.contractor_name,'')) not like '%municipal record%'
          and lower(coalesce(p.contractor_name,'')) not like 'pending %'
          and lower(coalesce(p.contractor_name,'')) not like 'commercial re-roof%'
          and lower(coalesce(p.contractor_name,'')) not like 'roof recover%'
          and lower(coalesce(p.contractor_name,'')) not like 'tear off%'
          and length(trim(p.contractor_name)) between 3 and 80
          and coalesce(p.contractor_name,'') <> ''
          and ${ROOFING_SQL}
          and lower(p.city) like '%dallas%'
        group by p.contractor_name
        order by sum(p.valuation) desc
        limit 10
      )
      select dc.name, dc.permits, dc.val, 
             c.id, c.canonical_name, c.phone_number, c.website_url, 
             c.bbb_profile_url, c.linkedin_company_url, c.rcat_profile_url
      from dallas_c dc
      left join warehouse.canonical_contractors c on lower(c.canonical_name) = lower(dc.name)
    `);

    console.log('Top 10 contractors in Dallas commercial roofing:');
    for (const row of res.rows) {
      console.log(`\n--- ${row.name} (Valuation: $${Number(row.val).toLocaleString()}) ---`);
      console.log('Website: ', row.website_url);
      console.log('BBB:     ', row.bbb_profile_url);
      console.log('LinkedIn:', row.linkedin_company_url);
      console.log('RCAT:    ', row.rcat_profile_url);
    }
  } finally {
    client.release();
    pool.end();
  }
}

inspectBatch().catch(console.error);
