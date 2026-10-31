import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BATCH_SIZE = 5;
const BATCH_INDEX = 14; // Batch 14 (Buildings 66 - 70)

async function fetchCityPermitsForAddress(streetNumber, streetName, zip, parcelId) {
  try {
    // If Addison, check warehouse.normalized_permits for EnerGov filings
    if (zip === '75001' || parcelId.includes('10000')) {
      const { rows } = await pool.query(`
        SELECT raw_permit_number as permit_number, issue_date, category as permit_type,
               valuation as value, contractor_name as contractor, raw_description as work_description,
               'Addison Commercial' as land_use, normalized_address as street_address
        FROM warehouse.normalized_permits
        WHERE parcel_id = $1
      `, [parcelId]);
      if (rows.length > 0) return rows;
    }

    const q = `${streetNumber} ${streetName}`;
    const url = `https://www.dallasopendata.com/resource/e7gq-4sah.json?$q=${encodeURIComponent(q)}&$limit=200&$order=issued_date%20DESC`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DepoiiAudit/1.0' } });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    // Filter to ensure street number matches to avoid bleed from adjacent addresses
    return list.filter(p => {
      const addr = (p.street_address || '').toUpperCase().trim();
      return addr.startsWith(streetNumber.toUpperCase() + ' ');
    });
  } catch (err) {
    console.error(`Error querying Dallas API for ${streetNumber} ${streetName}:`, err.message);
    return [];
  }
}

async function main() {
  const zone5Zips = ['75234', '75251', '75266', '75001', '75209'];

  const { rows: leads } = await pool.query(`
    SELECT DISTINCT ON (s.parcel_id)
      s.parcel_id, s.address, s.zip_code, s.year_built, s.owner_name, s.building_sqft,
      s.property_type, s.cad_total_valuation, s.muni_permit_status,
      p.last_reroof_date, p.last_reroof_permit_no
    FROM warehouse.scored_parcel_leads s
    JOIN warehouse.parcels p ON s.parcel_id = p.id
    WHERE s.zip_code = ANY($1::text[])
    ORDER BY s.parcel_id ASC
  `, [zone5Zips]);

  const parcelIds = leads.map(r => r.parcel_id);

  // 1. normalized_permits
  const normMatches = await pool.query(`
    SELECT DISTINCT parcel_id FROM warehouse.normalized_permits WHERE parcel_id = ANY($1::text[])
  `, [parcelIds]);
  const normSet = new Set(normMatches.rows.map(r => r.parcel_id));

  // 2. live_permits
  const liveMatches = await pool.query(`
    SELECT jsonb_array_elements_text(parcel_ids) as pid
    FROM warehouse.live_permits
    WHERE parcel_ids IS NOT NULL AND jsonb_typeof(parcel_ids) = 'array'
  `);
  const liveSet = new Set(liveMatches.rows.map(r => r.pid).filter(pid => parcelIds.includes(pid)));

  // 3. DCAD parcel records with last_reroof
  const reroofSet = new Set(leads.filter(r => r.last_reroof_date || r.last_reroof_permit_no).map(r => r.parcel_id));

  // 4. muni_permit_status = 'PERMIT_DETECTED'
  const permitDetectedSet = new Set(leads.filter(r => r.muni_permit_status === 'PERMIT_DETECTED').map(r => r.parcel_id));

  // Full 105 leads
  const permitLeads = leads.filter(l => 
    normSet.has(l.parcel_id) || 
    liveSet.has(l.parcel_id) || 
    reroofSet.has(l.parcel_id) || 
    permitDetectedSet.has(l.parcel_id)
  );

  console.log(`Total verified permit-holding leads in pool: ${permitLeads.length}`);

  // Slice Batch 14 (Buildings 66 - 70)
  const startIndex = (BATCH_INDEX - 1) * BATCH_SIZE;
  const batchLeads = permitLeads.slice(startIndex, startIndex + BATCH_SIZE);

  console.log(`Processing Batch ${BATCH_INDEX} (${batchLeads.length} buildings):\n`);

  const results = [];

  for (let i = 0; i < batchLeads.length; i++) {
    const lead = batchLeads[i];
    const match = lead.address.match(/^(\d+)\s+(.+)$/);
    const streetNumber = match ? match[1] : '';
    const fullStreet = match ? match[2] : lead.address;
    const streetRoot = fullStreet.split(/\s+/)[0]; // e.g. "ERVAY", "COMMERCE", "LAKE"

    console.log(`[${i + 1}/${batchLeads.length}] Querying permits for: ${lead.address} (${lead.parcel_id})...`);

    const cityPermits = await fetchCityPermitsForAddress(streetNumber, streetRoot, lead.zip_code, lead.parcel_id);
    console.log(`  -> Found ${cityPermits.length} municipal permit record(s) on file.`);

    results.push({
      leadNumber: startIndex + i + 1,
      parcelId: lead.parcel_id,
      address: lead.address,
      zip: lead.zip_code,
      owner: lead.owner_name,
      propertyType: lead.property_type,
      yearBuilt: lead.year_built,
      valuation: lead.cad_total_valuation,
      dcadLastReroofDate: lead.last_reroof_date,
      dcadLastReroofPermitNo: lead.last_reroof_permit_no,
      permitsCount: cityPermits.length,
      permits: cityPermits.map(p => ({
        permitNumber: p.permit_number,
        issueDate: p.issued_date,
        type: p.permit_type,
        valuation: p.value ? `$${Number(p.value).toLocaleString()}` : 'N/A',
        contractor: p.contractor || 'Owner / Not Listed',
        workDescription: p.work_description || 'N/A',
        landUse: p.land_use || 'Commercial'
      }))
    });
  }

  // Save to disk
  const outDir = path.join(process.cwd(), 'data');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `permits_batch_${BATCH_INDEX}.json`);
  await fs.writeFile(outFile, JSON.stringify(results, null, 2));
  console.log(`\nBatch ${BATCH_INDEX} results saved to: ${outFile}`);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
