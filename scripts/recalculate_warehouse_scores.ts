import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Calibrated exposure score matching Roofx/depoii-data-engine/app/science/lead_quality.py
 */
export function calculateCalibratedScore(params: {
  hailInches: number;
  distanceMiles: number | null;
  tier: string;
  roofAgeYears: number | null;
  roofSqft: number;
}): number {
  const hail = Math.max(0.0, Number(params.hailInches || 0));

  // 1. Kinetic energy curve (threshold 1.25", 1.75" = 18 pts, max 35 pts at 2.5"+)
  const severity = hail >= 1.0 ? Math.min(35.0, Math.pow(hail / 1.75, 2.4) * 18.0) : hail * 5.0;

  // 2. Smooth exponential distance decay (no 6-mile cliff)
  const tierClean = String(params.tier || 'core').trim().toLowerCase();
  const isCore = ['core', 'priority_1', 'priority_2', 'swath'].includes(tierClean);
  let proximity = 0.0;
  if (params.distanceMiles == null) {
    proximity = isCore ? 14.0 : 6.0;
  } else {
    proximity = 18.0 * Math.exp(-0.22 * Math.max(0.0, Number(params.distanceMiles)));
  }

  // 3. Swath position credit
  const position = isCore ? 10.0 : (tierClean === 'envelope' ? 4.0 : 0.0);

  // 4. Membrane Failure Window (15 - 25 years sweet spot)
  let agePts = 0.0;
  if (params.roofAgeYears != null && params.roofAgeYears > 0) {
    const a = Number(params.roofAgeYears);
    if (a < 10) {
      agePts = a * 0.3; // Resilient young membrane
    } else if (a < 18) {
      agePts = 3.0 + (a - 10) * 0.7; // Aging single-ply
    } else if (a <= 26) {
      agePts = 8.6 + (a - 18) * 1.15; // Prime failure / insurance replacement window
    } else {
      agePts = 18.0; // Fully oxidized / depleted (capped to avoid ACV wear-and-tear penalty)
    }
  }
  agePts = Math.min(18.0, agePts);

  // 5. Logarithmic Commercial Footprint Scale (sweet spot: 25k - 150k sq ft)
  let sizePts = 0.0;
  const s = Number(params.roofSqft || 0);
  if (s >= 5000) {
    sizePts = Math.min(19.0, Math.max(2.0, 7.5 * Math.log10(s / 2500.0)));
  } else if (s > 0) {
    sizePts = 1.0;
  }

  const raw = severity + proximity + position + agePts + sizePts;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

async function main() {
  console.log('--- Depoii Lead Scoring Engine: Warehouse Score Recalculation ---');
  
  // 1. Create backup table
  console.log('Creating snapshot backup: warehouse.scored_parcel_leads_backup_20261101...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS warehouse.scored_parcel_leads_backup_20261101 AS
    SELECT * FROM warehouse.scored_parcel_leads;
  `);
  console.log('Backup verified.');

  // 2. Fetch all scored leads with parcel information
  console.log('Querying all scored parcel leads...');
  const { rows } = await pool.query(`
    SELECT 
      s.parcel_id,
      s.max_hail_inches,
      s.nearest_hail_distance_mi,
      s.lead_tier,
      s.roof_age_years,
      s.exposure_score as old_score,
      p.year_built,
      p.footprint_sqft,
      p.building_sqft,
      p.zip_code
    FROM warehouse.scored_parcel_leads s
    LEFT JOIN warehouse.parcels p ON p.id = s.parcel_id;
  `);

  console.log(`Loaded ${rows.length} scored parcel records.`);

  const BATCH_SIZE = 100;
  let updatedCount = 0;
  const currentYear = 2026;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    
    const cases: string[] = [];
    const pids: string[] = [];

    for (const r of chunk) {
      const hail = r.max_hail_inches ?? 1.75;
      const dist = r.nearest_hail_distance_mi;
      const tier = r.lead_tier ?? 'core';
      const age = r.roof_age_years ?? (r.year_built ? currentYear - r.year_built : null);
      const sqft = r.footprint_sqft ?? r.building_sqft ?? 15000;

      const newScore = calculateCalibratedScore({
        hailInches: hail,
        distanceMiles: dist,
        tier: tier,
        roofAgeYears: age,
        roofSqft: sqft
      });

      pids.push(r.parcel_id);
      cases.push(`WHEN parcel_id = '${r.parcel_id}' THEN ${newScore}`);
    }

    const updateSql = `
      UPDATE warehouse.scored_parcel_leads
      SET exposure_score = CASE 
        ${cases.join(' ')}
      END
      WHERE parcel_id IN ('${pids.join("','")}');
    `;

    await pool.query(updateSql);
    updatedCount += chunk.length;
    process.stdout.write(`\rProgress: ${updatedCount} / ${rows.length} leads updated...`);
  }

  console.log('\n\nUpdate complete! Calculating new statistics for Dallas Zone 5...');

  const zone5Zips = ['75234', '75251', '75266', '75001', '75209'];
  const z5Stats = await pool.query(`
    SELECT 
      count(*) as total_leads,
      min(exposure_score) as min_score,
      max(exposure_score) as max_score,
      round(avg(exposure_score), 1) as avg_score,
      count(*) FILTER (WHERE exposure_score >= 80) as tier_80_plus,
      count(*) FILTER (WHERE exposure_score >= 70 AND exposure_score < 80) as tier_70_79,
      count(*) FILTER (WHERE exposure_score >= 60 AND exposure_score < 70) as tier_60_69,
      count(*) FILTER (WHERE exposure_score < 60) as tier_under_60
    FROM warehouse.scored_parcel_leads
    WHERE substring(zip_code from 1 for 5) = ANY($1);
  `, [zone5Zips]);

  console.log('\nDallas Zone 5 Recalibrated Score Distribution:');
  console.table(z5Stats.rows);

  await pool.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
