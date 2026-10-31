import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function parseDate(dStr) {
  if (!dStr) return null;
  dStr = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  const match = dStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    let [_, m, d, y] = match;
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    if (y.length === 2) {
      const yrNum = parseInt(y, 10);
      y = yrNum > 50 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(dStr);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

function parseValuation(valStr) {
  if (!valStr || valStr === 'N/A') return { num: null, formatted: null };
  const cleaned = String(valStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return { num: null, formatted: null };
  return { num, formatted: `$${num.toLocaleString()}` };
}

async function main() {
  console.log('--- FAST HIGH-PERFORMANCE PERMIT INGESTION ---');
  
  // 1. Ensure source_url column exists
  await pool.query('ALTER TABLE warehouse.normalized_permits ADD COLUMN IF NOT EXISTS source_url text;');

  // 2. Load audit data
  const data = JSON.parse(await fs.readFile('data/zone5_all_permits_audit.json', 'utf8'));
  console.log(`Loaded ${data.length} buildings.`);

  const allPermitNos = [];
  for (const lead of data) {
    for (const p of lead.permits || []) {
      if (p.permitNumber) allPermitNos.push(String(p.permitNumber).trim());
    }
  }

  console.log(`Audited municipal permits to process: ${allPermitNos.length}`);

  // 3. Batch check existing permits in DB
  const existingRes = await pool.query(
    'SELECT id, raw_permit_number FROM warehouse.normalized_permits WHERE raw_permit_number = ANY($1)',
    [allPermitNos]
  );
  const existingMap = new Map();
  for (const r of existingRes.rows) {
    existingMap.set(r.raw_permit_number, r.id);
  }
  console.log(`Found ${existingMap.size} existing permits in DB (will link & update with parcel + source URL).`);

  // 4. Build records array
  const toUpsert = [];
  const dcadRecords = [];
  const parcelUpdates = [];

  for (const lead of data) {
    const parcelId = lead.parcelId;
    const cleanAccountId = parcelId.replace(/^DCAD-PARCEL-/i, '');
    const isAddison = lead.zip === '75001' || parcelId.startsWith('DCAD-PARCEL-1000');
    const city = isAddison ? 'Addison' : 'Dallas';
    const jurisdiction = isAddison ? 'Addison, TX' : 'Dallas, TX';

    // Municipal permits
    for (const p of lead.permits || []) {
      const permitNo = String(p.permitNumber).trim();
      if (!permitNo) continue;

      const issueDate = parseDate(p.issueDate);
      const { num: valNum, formatted: valFmt } = parseValuation(p.valuation);
      const desc = p.workDescription || p.type || 'Municipal Permit';
      const descLower = desc.toLowerCase();
      const typeLower = (p.type || '').toLowerCase();
      const isRoof = descLower.includes('roof') || typeLower.includes('roof');
      
      let probableRoof = null;
      if (descLower.includes('tpo') || typeLower.includes('tpo')) probableRoof = 'TPO Single-Ply';
      else if (descLower.includes('mod') || descLower.includes('bitumen')) probableRoof = 'Modified Bitumen';
      else if (descLower.includes('metal')) probableRoof = 'Standing Seam Metal';
      else if (descLower.includes('gravel') || descLower.includes('bur')) probableRoof = 'Built-Up Roof (BUR)';
      else if (descLower.includes('coating') || descLower.includes('elastomeric')) probableRoof = 'Silicone / Elastomeric Coating';
      else if (isRoof) probableRoof = 'Commercial Roof System';

      const category = isRoof ? 'Roofing' : (typeLower.includes('elec') ? 'Electrical' : (typeLower.includes('plumb') ? 'Plumbing' : (typeLower.includes('mech') ? 'Mechanical' : 'General Building')));
      const contractor = p.contractor || 'Owner / Not Listed';

      const sourceSystem = isAddison 
        ? 'Town of Addison EnerGov CSS' 
        : 'City of Dallas Open Data (Socrata e7gq-4sah)';
      const sourceUrl = isAddison 
        ? 'https://developmentservices.addisontx.gov/' 
        : `https://www.dallasopendata.com/resource/e7gq-4sah.json?permit_number=${encodeURIComponent(permitNo)}`;

      // ID resolution
      const id = existingMap.get(permitNo) || `DAL-SOC-${cleanAccountId.slice(-8)}-${permitNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      toUpsert.push({
        id,
        raw_permit_number: permitNo,
        parcel_id: parcelId,
        source_system: sourceSystem,
        jurisdiction,
        state: 'TX',
        city,
        issue_date: issueDate,
        status: 'Issued',
        normalized_address: lead.address,
        zip_code: lead.zip,
        valuation: valNum,
        valuation_formatted: valFmt,
        category,
        probable_roof_system: probableRoof,
        raw_description: desc,
        contractor_name: contractor,
        is_pure_reroof: isRoof,
        source_url: sourceUrl,
        data_source: isAddison ? 'Addison_EnerGov' : 'DallasOpenData_e7gq-4sah'
      });
    }

    // DCAD historical reroof record
    if (lead.dcadLastReroofDate) {
      const dcadDate = parseDate(lead.dcadLastReroofDate);
      const dcadPermitNo = lead.dcadLastReroofPermitNo || `DCAD-REROOF-${cleanAccountId.slice(-6)}`;
      const dcadId = `DCAD-REROOF-${cleanAccountId}`;
      const dcadSourceUrl = `https://www.dallascad.org/SearchAcct.aspx?ACCOUNTNO=${encodeURIComponent(cleanAccountId)}`;
      const dcadSourceSystem = 'Dallas County Appraisal District (DCAD)';

      dcadRecords.push({
        id: dcadId,
        raw_permit_number: dcadPermitNo,
        parcel_id: parcelId,
        source_system: dcadSourceSystem,
        jurisdiction: 'Dallas County, TX',
        state: 'TX',
        city,
        issue_date: dcadDate,
        status: 'Recorded',
        normalized_address: lead.address,
        zip_code: lead.zip,
        valuation: null,
        valuation_formatted: null,
        category: 'Roofing',
        probable_roof_system: 'Commercial Roof System',
        raw_description: `County Certified Appraisal Roll Roof Record (Last Recorded Re-Roof: ${lead.dcadLastReroofDate})`,
        contractor_name: 'Dallas County Certified Appraisal Roll',
        is_pure_reroof: true,
        source_url: dcadSourceUrl,
        data_source: 'DCAD_Appraisal_Roll'
      });

      parcelUpdates.push({
        parcelId,
        cleanAccountId,
        lastReroofDate: dcadDate,
        lastReroofPermitNo: dcadPermitNo
      });
    }
  }

  console.log(`Total permits to upsert: ${toUpsert.length}`);
  console.log(`Total DCAD reroof records to insert: ${dcadRecords.length}`);

  // 5. Batch upsert municipal permits (chunks of 100)
  const CHUNK_SIZE = 100;
  for (let i = 0; i < toUpsert.length; i += CHUNK_SIZE) {
    const chunk = toUpsert.slice(i, i + CHUNK_SIZE);
    const values = [];
    const params = [];
    let pIdx = 1;

    for (const row of chunk) {
      values.push(`(
        $${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6},
        $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11}, $${pIdx+12},
        $${pIdx+13}, $${pIdx+14}, $${pIdx+15}, $${pIdx+16},
        $${pIdx+17}, $${pIdx+18}, $${pIdx+19}, NOW()::text
      )`);
      params.push(
        row.id, row.raw_permit_number, row.parcel_id, row.source_system, row.jurisdiction, row.state, row.city,
        row.issue_date, row.status, row.normalized_address, row.zip_code, row.valuation, row.valuation_formatted,
        row.category, row.probable_roof_system, row.raw_description, row.contractor_name,
        row.is_pure_reroof, row.source_url, row.data_source
      );
      pIdx += 20;
    }

    const sql = `
      INSERT INTO warehouse.normalized_permits (
        id, raw_permit_number, parcel_id, source_system, jurisdiction, state, city,
        issue_date, status, normalized_address, zip_code, valuation, valuation_formatted,
        category, probable_roof_system, raw_description, contractor_name,
        is_pure_reroof, source_url, data_source, retrieved_at
      ) VALUES ${values.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        parcel_id = EXCLUDED.parcel_id,
        source_url = EXCLUDED.source_url,
        source_system = EXCLUDED.source_system,
        normalized_address = EXCLUDED.normalized_address,
        zip_code = EXCLUDED.zip_code,
        status = EXCLUDED.status,
        valuation = coalesce(warehouse.normalized_permits.valuation, EXCLUDED.valuation),
        valuation_formatted = coalesce(warehouse.normalized_permits.valuation_formatted, EXCLUDED.valuation_formatted),
        probable_roof_system = coalesce(warehouse.normalized_permits.probable_roof_system, EXCLUDED.probable_roof_system),
        retrieved_at = EXCLUDED.retrieved_at;
    `;

    await pool.query(sql, params);
    process.stdout.write(`Upserted ${Math.min(i + CHUNK_SIZE, toUpsert.length)} / ${toUpsert.length} municipal permits...\r`);
  }
  console.log(`\nSuccessfully upserted all ${toUpsert.length} municipal permits!`);

  // 6. Batch upsert DCAD historical records
  for (const dcad of dcadRecords) {
    await pool.query(`
      INSERT INTO warehouse.normalized_permits (
        id, raw_permit_number, parcel_id, source_system, jurisdiction, state, city,
        issue_date, status, normalized_address, zip_code, valuation, valuation_formatted,
        category, probable_roof_system, raw_description, contractor_name,
        is_pure_reroof, source_url, data_source, retrieved_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'TX', $6,
        $7, 'Recorded', $8, $9, NULL, NULL,
        'Roofing', 'Commercial Roof System', $10, $11,
        TRUE, $12, 'DCAD_Appraisal_Roll', NOW()::text
      )
      ON CONFLICT (id) DO UPDATE SET
        parcel_id = EXCLUDED.parcel_id,
        source_url = EXCLUDED.source_url,
        source_system = EXCLUDED.source_system,
        issue_date = EXCLUDED.issue_date,
        retrieved_at = EXCLUDED.retrieved_at;
    `, [
      dcad.id, dcad.raw_permit_number, dcad.parcel_id, dcad.source_system, dcad.jurisdiction, dcad.city,
      dcad.issue_date, dcad.normalized_address, dcad.zip_code, dcad.raw_description, dcad.contractor_name, dcad.source_url
    ]);
  }
  console.log(`Successfully upserted all ${dcadRecords.length} DCAD historical reroof records!`);

  // 7. Update warehouse.parcels with reroof date and permit numbers
  for (const pu of parcelUpdates) {
    await pool.query(`
      UPDATE warehouse.parcels SET
        last_reroof_date = $1,
        last_reroof_permit_no = $2
      WHERE id = $3 OR account_number = $3 OR account_number = $4
    `, [pu.lastReroofDate, pu.lastReroofPermitNo, pu.parcelId, pu.cleanAccountId]);
  }
  console.log(`Updated ${parcelUpdates.length} parcels in warehouse.parcels with certified reroof benchmarks.`);

  console.log('\n======================================================');
  console.log('ALL AUDITED PERMIT DATA IS NOW LIVE IN THE DATABASE!');
  console.log('======================================================\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fast ingestion failed:', err);
  process.exit(1);
});

