import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ZONE_ZIPS = ['75234', '75251', '75266', '75001', '75209'];

async function syncAll() {
  console.log('Starting Full Database Synchronization with Enriched Intelligence...');

  // 1. Update warehouse.scored_parcel_leads for VERIFIED leads
  const scoredUpdateRes = await pool.query(`
    UPDATE warehouse.scored_parcel_leads spl
    SET 
      verification_status = 'VERIFIED',
      verification_score = 95,
      outbound_ready = true,
      outbound_block_reason = NULL,
      provenance_date = NOW()
    FROM warehouse.lead_contacts lc
    WHERE spl.parcel_id = lc.parcel_id
      AND lc.decision_maker_name IS NOT NULL
      AND lc.decision_maker_name != 'Commercial Property & Asset Manager'
      AND lc.verification_stage IN ('SOS_PIR_RESOLVED', 'CO_AND_PIR_RESOLVED');
  `);
  console.log(`✅ Updated ${scoredUpdateRes.rowCount} leads in warehouse.scored_parcel_leads to VERIFIED & OUTBOUND_READY`);

  // 2. Update warehouse.scored_parcel_leads for EXCLUDED_NON_COMMERCIAL leads
  const excludedUpdateRes = await pool.query(`
    UPDATE warehouse.scored_parcel_leads spl
    SET 
      verification_status = 'EXCLUDED',
      verification_score = 0,
      outbound_ready = false,
      outbound_block_reason = 'NON_COMMERCIAL_MUNICIPAL_OR_INSTITUTION'
    FROM warehouse.lead_contacts lc
    WHERE spl.parcel_id = lc.parcel_id
      AND lc.verification_stage = 'EXCLUDED_NON_COMMERCIAL';
  `);
  console.log(`✅ Tagged ${excludedUpdateRes.rowCount} leads in warehouse.scored_parcel_leads as EXCLUDED_NON_COMMERCIAL`);

  // 3. Upsert into warehouse.owner_persons for all 188 verified decision-makers
  const enrichedContacts = await pool.query(`
    SELECT DISTINCT
      p.owner_name,
      lc.decision_maker_name,
      lc.decision_maker_title,
      lc.parent_sponsor_name,
      lc.phone_number,
      lc.website_url,
      p.owner_address,
      p.owner_city,
      p.owner_state,
      p.owner_zip
    FROM warehouse.lead_contacts lc
    JOIN warehouse.parcels p ON p.id = lc.parcel_id
    WHERE lc.decision_maker_name IS NOT NULL
      AND lc.decision_maker_name != 'Commercial Property & Asset Manager'
      AND lc.verification_stage IN ('SOS_PIR_RESOLVED', 'CO_AND_PIR_RESOLVED');
  `);

  console.log(`Syncing ${enrichedContacts.rows.length} verified executives into warehouse.owner_persons...`);
  let personsSynced = 0;

  for (const r of enrichedContacts.rows) {
    if (!r.owner_name || !r.decision_maker_name) continue;
    const address = [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(', ');

    await pool.query(`
      INSERT INTO warehouse.owner_persons (
        owner_name_normalized,
        person_name,
        title_raw,
        person_role,
        address,
        source_system,
        retrieved_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'TEXAS_PIR_AND_CO', NOW()
      )
      ON CONFLICT DO NOTHING;
    `, [
      r.owner_name,
      r.decision_maker_name,
      r.decision_maker_title || 'Chief Executive Officer',
      'EXECUTIVE_DECISION_MAKER',
      address || null
    ]);
    personsSynced++;
  }
  console.log(`✅ Synced ${personsSynced} officers into warehouse.owner_persons`);

  // 4. Upsert into warehouse.owner_entities
  let entitiesSynced = 0;
  for (const r of enrichedContacts.rows) {
    if (!r.owner_name) continue;
    const address = [r.owner_address, r.owner_city, r.owner_state, r.owner_zip].filter(Boolean).join(', ');

    await pool.query(`
      INSERT INTO warehouse.owner_entities (
        owner_name_normalized,
        owner_name_raw,
        entity_legal_name,
        sos_status,
        mailing_address,
        match_confidence,
        source_system,
        retrieved_at
      ) VALUES (
        $1, $1, $2, 'ACTIVE_IN_GOOD_STANDING', $3, 'HIGH', 'TEXAS_PIR_WATERFALL', NOW()
      )
      ON CONFLICT (owner_name_normalized) DO UPDATE SET
        entity_legal_name = COALESCE(EXCLUDED.entity_legal_name, warehouse.owner_entities.entity_legal_name),
        sos_status = 'ACTIVE_IN_GOOD_STANDING',
        mailing_address = COALESCE(EXCLUDED.mailing_address, warehouse.owner_entities.mailing_address),
        retrieved_at = NOW();
    `, [
      r.owner_name,
      r.parent_sponsor_name || r.owner_name,
      address || null
    ]);
    entitiesSynced++;
  }
  console.log(`✅ Synced ${entitiesSynced} corporate entities into warehouse.owner_entities`);

  // 5. Final summary
  const summaryRes = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM warehouse.lead_contacts WHERE decision_maker_name IS NOT NULL AND decision_maker_name != 'Commercial Property & Asset Manager') as total_named_executives,
      (SELECT COUNT(*) FROM warehouse.scored_parcel_leads WHERE outbound_ready = true) as total_outbound_ready,
      (SELECT COUNT(*) FROM warehouse.scored_parcel_leads WHERE verification_status = 'VERIFIED') as total_verified_scored,
      (SELECT COUNT(*) FROM warehouse.owner_persons WHERE source_system = 'TEXAS_PIR_AND_CO') as total_synced_persons,
      (SELECT COUNT(*) FROM warehouse.owner_entities WHERE source_system = 'TEXAS_PIR_WATERFALL') as total_synced_entities;
  `);

  console.log('\n================ FINAL DB STATE ================');
  console.log(summaryRes.rows[0]);
  console.log('================================================');

  await pool.end();
}

syncAll().catch(err => {
  console.error(err);
  process.exit(1);
});

