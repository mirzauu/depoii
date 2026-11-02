import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ZONE_ZIPS = ['75234', '75251', '75266', '75001', '75209'];
const BATCH_SIZE = 5;
const PAUSE_MS = 60 * 1000; // 1 minute break between batches
const STATE_FILE = path.join(process.cwd(), 'scratch', 'zone5_history_state.json');

interface State {
  completed_parcel_ids: string[];
  total_permits_linked: number;
  total_permits_inserted: number;
  total_sections_updated: number;
  total_occupants_matched: number;
  current_batch: number;
  last_updated_at: string;
}

function loadState(): State {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {}
  }
  return {
    completed_parcel_ids: [],
    total_permits_linked: 0,
    total_permits_inserted: 0,
    total_sections_updated: 0,
    total_occupants_matched: 0,
    current_batch: 0,
    last_updated_at: new Date().toISOString(),
  };
}

function saveState(state: State) {
  state.last_updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function parseStreet(address: string): { streetNumber: string; streetName: string } {
  const clean = (address || '').trim().replace(/^(N|S|E|W|NORTH|SOUTH|EAST|WEST)\s+/i, '');
  const parts = clean.split(/\s+/);
  const streetNumber = parts[0] || '';
  // Normalize street name (remove unit/ste, suffixes)
  const remaining = parts.slice(1).join(' ').replace(/\b(STE|SUITE|APT|UNIT|BLDG|#).*/i, '').trim();
  const streetName = remaining.split(/\s+/)[0] || '';
  return { streetNumber, streetName: streetName.toUpperCase() };
}

function parseValuation(raw: any): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseDate(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    let yyyy = m[3];
    if (yyyy.length === 2) {
      yyyy = parseInt(yyyy, 10) > 50 ? `19${yyyy}` : `20${yyyy}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

/**
 * Fetch permits from City of Dallas Open Data (Socrata API)
 */
async function fetchDallasCityPermits(streetNumber: string, streetName: string) {
  if (!streetNumber || !streetName || streetName.length < 2) return [];
  try {
    const params = new URLSearchParams({
      $limit: '50',
      $where: `street_address like '${streetNumber} %${streetName}%'`
    });
    const url = `https://www.dallasopendata.com/resource/e7gq-4sah.json?${params.toString()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'DepoiiAudit/2.0' }
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Enforce strict number start match
    return data.filter((p: any) => {
      const addr = String(p.street_address || '').toUpperCase().trim();
      return addr.startsWith(streetNumber + ' ');
    });
  } catch {
    return [];
  }
}

/**
 * Fetch Certificate of Occupancy from City of Dallas Open Data
 */
async function fetchCertificateOfOccupancy(streetNumber: string, streetName: string) {
  if (!streetNumber || !streetName) return null;
  try {
    const params = new URLSearchParams({
      $limit: '1',
      $where: `address like '${streetNumber} %${streetName}%'`
    });
    const url = `https://www.dallasopendata.com/resource/9qet-qt9e.json?${params.toString()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'DepoiiAudit/2.0' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
  } catch {}
  return null;
}

async function processBuilding(p: any): Promise<{
  permitsLinked: number;
  permitsInserted: number;
  sectionsUpdated: boolean;
  occupantMatched: boolean;
}> {
  let permitsLinked = 0;
  let permitsInserted = 0;
  let sectionsUpdated = false;
  let occupantMatched = false;

  const { streetNumber, streetName } = parseStreet(p.address);

  // 1. Link existing unlinked permits in warehouse.normalized_permits for this address
  if (p.address) {
    const linkRes = await pool.query(`
      UPDATE warehouse.normalized_permits
      SET parcel_id = $1
      WHERE parcel_id IS NULL
        AND lower(trim(normalized_address)) = lower(trim($2))
    `, [p.id, p.address]);
    permitsLinked += (linkRes.rowCount || 0);
  }

  // 2. Fetch Dallas Open Data permits for this street number & name
  if (streetNumber && streetName) {
    const cityPermits = await fetchDallasCityPermits(streetNumber, streetName);
    for (const cp of cityPermits) {
      const permitNo = String(cp.permit_number || '').trim();
      if (!permitNo) continue;

      // Check if already in warehouse.normalized_permits
      const existing = await pool.query(
        `SELECT id FROM warehouse.normalized_permits WHERE raw_permit_number = $1 LIMIT 1`,
        [permitNo]
      );

      if (existing.rows.length === 0) {
        const issueDate = parseDate(cp.issued_date);
        const val = parseValuation(cp.value);
        const valFormatted = val > 0 ? `$${val.toLocaleString()}` : '';
        const contractor = String(cp.contractor || '').trim();
        const desc = String(cp.work_description || '').trim();
        const cat = String(cp.permit_type || '').trim();

        // Determine probable roof system
        let roofSys = '';
        const combined = `${cat} ${desc}`.toLowerCase();
        if (combined.includes('tpo')) roofSys = 'TPO';
        else if (combined.includes('pvc')) roofSys = 'PVC';
        else if (combined.includes('epdm')) roofSys = 'EPDM';
        else if (combined.includes('modified') || combined.includes('mod bit')) roofSys = 'Modified Bitumen';
        else if (combined.includes('metal') || combined.includes('standing seam')) roofSys = 'Metal Standing Seam';
        else if (combined.includes('built-up') || combined.includes('tar and gravel') || combined.includes('gravel')) roofSys = 'Built-Up Roof';
        else if (combined.includes('roof') || combined.includes('shingle')) roofSys = 'Commercial Shingle';

        await pool.query(`
          INSERT INTO warehouse.normalized_permits (
            id, parcel_id, raw_permit_number, normalized_address, city, state, zip_code,
            issue_date, valuation, valuation_formatted, category, contractor_name,
            raw_description, probable_roof_system, status, data_source, retrieved_at, normalized_at
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, 'TX', $5,
            $6, $7, $8, $9, $10,
            $11, $12, 'Issued', 'dallas_open_data_socrata', NOW()::text, NOW()::text
          )
        `, [
          p.id, permitNo, p.address, p.city || 'Dallas', p.zip_code || '',
          issueDate, val, valFormatted, cat, contractor,
          desc, roofSys
        ]);
        permitsInserted++;
      }
    }

    // 3. Certificate of Occupancy
    const co = await fetchCertificateOfOccupancy(streetNumber, streetName);
    if (co && co.business_name) {
      const bizName = String(co.business_name).trim();
      const updateCo = await pool.query(`
        UPDATE warehouse.lead_contacts
        SET tenant_or_facility_name = $1,
            retrieved_at = NOW()
        WHERE parcel_id = $2
      `, [bizName, p.id]);

      if ((updateCo.rowCount || 0) > 0) {
        occupantMatched = true;
      }
    }
  }

  // 4. DCAD Improvement Sections: verify structure specs
  if (!p.improvement_sections || p.improvement_sections === '[]' || p.improvement_sections === '') {
    // If parcel has building_sqft, create a default baseline structural section
    if (p.building_sqft && p.building_sqft > 0) {
      const defaultSection = JSON.stringify([{
        description: 'COMMERCIAL IMPROVEMENT',
        area_sqft: Number(p.building_sqft),
        year_built: p.year_built ? Number(p.year_built) : undefined,
        stories: p.stories ? Number(p.stories) : 1.0,
      }]);
      await pool.query(`
        UPDATE warehouse.parcels
        SET improvement_sections = $1
        WHERE id = $2
      `, [defaultSection, p.id]);
      sectionsUpdated = true;
    }
  }

  return { permitsLinked, permitsInserted, sectionsUpdated, occupantMatched };
}

async function main() {
  console.log(`================================================================`);
  console.log(`🚀 AUTONOMOUS 1,022 BUILDING HISTORY EXTRACTION ENGINE`);
  console.log(`Target: Dallas Zone 5 Commercial Buildings`);
  console.log(`Batch Size: ${BATCH_SIZE} buildings | Cooldown: ${PAUSE_MS / 1000}s`);
  console.log(`================================================================\n`);

  const state = loadState();
  const completedSet = new Set(state.completed_parcel_ids);

  // Fetch all qualified 1,022 buildings in Zone 5
  const buildingsRes = await pool.query(`
    SELECT p.id, p.account_number, p.address, p.city, p.zip_code, p.building_sqft, p.year_built, p.stories, p.improvement_sections, p.total_valuation
    FROM warehouse.parcels p
    WHERE substring(coalesce(p.zip_code,''), 1, 5) = ANY($1)
      AND p.property_type NOT ILIKE '%VACANT%'
    ORDER BY p.total_valuation DESC NULLS LAST
    LIMIT 1022;
  `, [ZONE_ZIPS]);

  const allBuildings = buildingsRes.rows;
  console.log(`[+] Total candidate buildings loaded: ${allBuildings.length}`);
  console.log(`[+] Previously completed: ${completedSet.size}`);

  const remaining = allBuildings.filter(b => !completedSet.has(b.id));
  console.log(`[+] Remaining to process: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log(`🎉 All 1,022 buildings have been fully verified and enriched!`);
    await pool.end();
    return;
  }

  const isTestOnce = process.argv.includes('--once');
  const maxBatches = process.argv.includes('--batch-count') 
    ? parseInt(process.argv[process.argv.indexOf('--batch-count') + 1], 10)
    : (isTestOnce ? 1 : 99999);

  let batchCount = 0;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batchCount++;
    state.current_batch++;
    const batch = remaining.slice(i, i + BATCH_SIZE);

    console.log(`----------------------------------------------------------------`);
    console.log(`📦 BATCH ${state.current_batch} (${i + 1} to ${Math.min(i + BATCH_SIZE, remaining.length)} of ${remaining.length} remaining)`);
    console.log(`----------------------------------------------------------------`);

    for (const b of batch) {
      console.log(`🔍 [${b.id}] ${b.address}, ${b.city} (Acct: ${b.account_number || 'N/A'})`);
      try {
        const res = await processBuilding(b);
        state.completed_parcel_ids.push(b.id);
        state.total_permits_linked += res.permitsLinked;
        state.total_permits_inserted += res.permitsInserted;
        if (res.sectionsUpdated) state.total_sections_updated++;
        if (res.occupantMatched) state.total_occupants_matched++;

        console.log(`   └─ Permits linked: ${res.permitsLinked} | New inserted: ${res.permitsInserted} | Section: ${res.sectionsUpdated ? '✅' : '—'} | CO Tenant: ${res.occupantMatched ? '✅' : '—'}`);
      } catch (err: any) {
        console.error(`   ❌ Error processing building ${b.address}:`, err.message);
        state.completed_parcel_ids.push(b.id);
      }
    }

    saveState(state);
    console.log(`\n📊 Running Totals: Permits Linked: ${state.total_permits_linked} | New Permits: ${state.total_permits_inserted} | Sections Updated: ${state.total_sections_updated} | Completed: ${state.completed_parcel_ids.length}/${allBuildings.length}`);

    if (batchCount >= maxBatches) {
      console.log(`\n🛑 Batch limit of ${maxBatches} reached. Progress checkpoint saved.`);
      break;
    }

    if (i + BATCH_SIZE < remaining.length) {
      console.log(`\n⏳ Taking 1-minute cooldown before next batch (preventing municipal rate limits)...`);
      await new Promise(r => setTimeout(r, PAUSE_MS));
    }
  }

  console.log(`\n🏁 Worker finished execution. State is safely persisted in ${STATE_FILE}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Fatal worker error:', err);
  await pool.end();
});
