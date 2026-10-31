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
  console.log('Starting full permit database ingestion for Dallas Zone 5 (105 leads)...');
  
  // Ensure source_url column exists
  await pool.query('ALTER TABLE warehouse.normalized_permits ADD COLUMN IF NOT EXISTS source_url text;');

  const data = JSON.parse(await fs.readFile('data/zone5_all_permits_audit.json', 'utf8'));
  console.log(`Loaded ${data.length} leads from master audit file.`);

  let insertedPermits = 0;
  let updatedPermits = 0;
  let dcadPermitsCreated = 0;
  let parcelsUpdated = 0;

  for (let idx = 0; idx < data.length; idx++) {
    const lead = data[idx];
    const parcelId = lead.parcelId;
    const cleanAccountId = parcelId.replace(/^DCAD-PARCEL-/i, '');
    const isAddison = lead.zip === '75001' || parcelId.startsWith('DCAD-PARCEL-1000');
    const city = isAddison ? 'Addison' : 'Dallas';
    const jurisdiction = isAddison ? 'Addison, TX' : 'Dallas, TX';

    // 1. Process municipal permits
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

      // Check if permit exists
      const existing = await pool.query(
        'SELECT id, parcel_id FROM warehouse.normalized_permits WHERE raw_permit_number = $1 LIMIT 1',
        [permitNo]
      );

      if (existing.rows.length > 0) {
        // Update existing record with parcel linkage and source URL
        await pool.query(
          `UPDATE warehouse.normalized_permits SET
            parcel_id = $1,
            source_url = $2,
            source_system = $3,
            normalized_address = $4,
            zip_code = $5,
            status = coalesce(status, 'Issued'),
            valuation = coalesce(valuation, $6),
            valuation_formatted = coalesce(valuation_formatted, $7),
            probable_roof_system = coalesce(probable_roof_system, $8),
            retrieved_at = NOW()::text
           WHERE id = $9`,
          [parcelId, sourceUrl, sourceSystem, lead.address, lead.zip, valNum, valFmt, probableRoof, existing.rows[0].id]
        );
        updatedPermits++;
      } else {
        // Insert new permit record
        const id = `DAL-SOC-${cleanAccountId.slice(-8)}-${permitNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        await pool.query(
          `INSERT INTO warehouse.normalized_permits (
            id, raw_permit_number, parcel_id, source_system, jurisdiction, state, city,
            issue_date, status, normalized_address, zip_code, valuation, valuation_formatted,
            category, probable_roof_system, raw_description, contractor_name,
            is_pure_reroof, source_url, data_source, retrieved_at
          ) VALUES (
            $1, $2, $3, $4, $5, 'TX', $6,
            $7, 'Issued', $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, 'DallasOpenData_e7gq-4sah', NOW()::text
          )
          ON CONFLICT (id) DO UPDATE SET
            parcel_id = EXCLUDED.parcel_id,
            source_url = EXCLUDED.source_url,
            source_system = EXCLUDED.source_system,
            retrieved_at = EXCLUDED.retrieved_at`,
          [
            id, permitNo, parcelId, sourceSystem, jurisdiction, city,
            issueDate, lead.address, lead.zip, valNum, valFmt,
            category, probableRoof, desc, contractor,
            isRoof, sourceUrl
          ]
        );
        insertedPermits++;
      }
    }

    // 2. Process DCAD last reroof record if present
    if (lead.dcadLastReroofDate) {
      const dcadDate = parseDate(lead.dcadLastReroofDate);
      const dcadPermitNo = lead.dcadLastReroofPermitNo || `DCAD-REROOF-${cleanAccountId.slice(-6)}`;
      const dcadId = `DCAD-REROOF-${cleanAccountId}`;
      const dcadSourceUrl = `https://www.dallascad.org/SearchAcct.aspx?ACCOUNTNO=${encodeURIComponent(cleanAccountId)}`;
      const dcadSourceSystem = 'Dallas County Appraisal District (DCAD)';

      await pool.query(
        `INSERT INTO warehouse.normalized_permits (
          id, raw_permit_number, parcel_id, source_system, jurisdiction, state, city,
          issue_date, status, normalized_address, zip_code, valuation, valuation_formatted,
          category, probable_roof_system, raw_description, contractor_name,
          is_pure_reroof, source_url, data_source, retrieved_at
        ) VALUES (
          $1, $2, $3, $4, 'Dallas County, TX', 'TX', $5,
          $6, 'Recorded', $7, $8, NULL, NULL,
          'Roofing', 'Commercial Roof System', $9, 'Dallas County Certified Appraisal Roll',
          TRUE, $10, 'DCAD_Appraisal_Roll', NOW()::text
        )
        ON CONFLICT (id) DO UPDATE SET
          parcel_id = EXCLUDED.parcel_id,
          source_url = EXCLUDED.source_url,
          source_system = EXCLUDED.source_system,
          issue_date = EXCLUDED.issue_date,
          retrieved_at = EXCLUDED.retrieved_at`,
        [
          dcadId, dcadPermitNo, parcelId, dcadSourceSystem, city,
          dcadDate, lead.address, lead.zip,
          `County Certified Appraisal Roll Roof Record (Last Recorded Re-Roof: ${lead.dcadLastReroofDate})`,
          dcadSourceUrl
        ]
      );
      dcadPermitsCreated++;

      // Update parcel record with DCAD reroof
      await pool.query(
        `UPDATE warehouse.parcels SET
          last_reroof_date = $1,
          last_reroof_permit_no = $2
         WHERE id = $3 OR account_number = $3 OR account_number = $4`,
        [dcadDate, dcadPermitNo, parcelId, cleanAccountId]
      );
      parcelsUpdated++;
    }

    if ((idx + 1) % 20 === 0 || idx === data.length - 1) {
      console.log(`Progress: [${idx + 1}/${data.length}] leads processed...`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`DATABASE INGESTION COMPLETE!`);
  console.log(`Total Leads Processed: ${data.length}`);
  console.log(`New Municipal Permits Inserted: ${insertedPermits}`);
  console.log(`Existing Permits Linked & Updated: ${updatedPermits}`);
  console.log(`DCAD Appraisal Roll Historical Roofs Inserted: ${dcadPermitsCreated}`);
  console.log(`Parcels Updated with Reroof Data: ${parcelsUpdated}`);
  console.log(`======================================================\n`);

  await pool.end();
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});

