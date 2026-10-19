import sqlite3
import time

def run_stage1_hygiene():
    print("=" * 70)
    print("STAGE 1: IN-DATABASE HYGIENE GUARD (SQL REGEX & CLASSIFICATION)")
    print("=" * 70)
    
    start_t = time.time()
    conn = sqlite3.connect('depoii_local.db')
    cur = conn.cursor()
    
    # 1. Total leads before hygiene
    cur.execute("SELECT count(*) FROM scored_parcel_leads WHERE COALESCE(is_mock, 0) = 0")
    total_leads = cur.fetchone()[0]
    print(f"Total active leads in database: {total_leads:,}")
    
    # 2. Provenance Hygiene Gate (Kill unverified seeds)
    cur.execute("""
        UPDATE scored_parcel_leads
        SET verification_status = 'BLOCKED_NO_PROVENANCE',
            verification_score = 0,
            outbound_ready = 0,
            outbound_block_reason = 'building_sqft has no live provenance'
        WHERE COALESCE(is_mock, 0) = 0
          AND (
            data_provenance = 'unverified_seed'
            OR data_provenance IS NULL
            OR building_sqft IS NULL
            OR building_sqft_source IS NULL
            OR building_sqft_source = 'unverified_seed'
          )
    """)
    prov_blocked = cur.rowcount
    print(f"• Disqualified Unverified Seed / Missing Provenance: {prov_blocked:,}")

    # 3. Institutional Disqualification
    cur.execute("""
        UPDATE scored_parcel_leads
        SET verification_status = 'DISQUALIFIED_INSTITUTIONAL',
            verification_score = 0,
            outbound_ready = 0,
            outbound_block_reason = 'Institutional / tax-exempt owner'
        WHERE COALESCE(is_mock, 0) = 0
          AND verification_status NOT IN ('BLOCKED_NO_PROVENANCE')
          AND (
            UPPER(COALESCE(owner_name, '')) LIKE '%CHURCH%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%BAPTIST%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%METHODIST%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%CATHOLIC%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%DIOCESE%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%MINISTRIES%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%TEMPLE%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%SYNAGOGUE%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%ISD%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%SCHOOL DISTRICT%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%UNIVERSITY%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%COLLEGE%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%BOARD OF REG%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%CITY OF%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%COUNTY OF%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%STATE OF%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%UNITED STATES%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%HOUSING AUTH%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%AUTHORITY%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%FOUNDATION%'
          )
    """)
    inst_count = cur.rowcount
    print(f"• Disqualified Institutional / Exempt Owners: {inst_count:,}")
    
    # 4. Multi-Family Residential & Apartment Disqualification
    cur.execute("""
        UPDATE scored_parcel_leads
        SET verification_status = 'DISQUALIFIED_MFR',
            verification_score = 0,
            outbound_ready = 0,
            outbound_block_reason = 'Multi-family residential or apartment'
        WHERE COALESCE(is_mock, 0) = 0
          AND verification_status NOT IN ('BLOCKED_NO_PROVENANCE', 'DISQUALIFIED_INSTITUTIONAL')
          AND (
            UPPER(COALESCE(property_type, '')) LIKE '%RESIDENTIAL%'
            OR UPPER(COALESCE(property_type, '')) LIKE '%APARTMENT%'
            OR UPPER(COALESCE(property_type, '')) LIKE '%CONDO%'
            OR UPPER(COALESCE(property_type, '')) LIKE '%MFR%'
            OR UPPER(COALESCE(property_type, '')) LIKE '%TOWNHOME%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%APARTMENT%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%APTS%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%HOUSING%'
            OR UPPER(COALESCE(owner_name, '')) LIKE '%STUDENT LIVING%'
          )
    """)
    mfr_count = cur.rowcount
    print(f"• Disqualified Multi-Family / Apartments / Residential: {mfr_count:,}")
    
    # 5. Undersized Properties (< 15,000 sq ft - non-commercial low-slope)
    cur.execute("""
        UPDATE scored_parcel_leads
        SET verification_status = 'DISQUALIFIED_UNDERSIZED',
            verification_score = 0,
            outbound_ready = 0,
            outbound_block_reason = 'Undersized building (< 15,000 sq ft)'
        WHERE COALESCE(is_mock, 0) = 0
          AND verification_status NOT IN ('BLOCKED_NO_PROVENANCE', 'DISQUALIFIED_INSTITUTIONAL', 'DISQUALIFIED_MFR')
          AND (building_sqft IS NULL OR building_sqft < 15000)
    """)
    undersized_count = cur.rowcount
    print(f"• Disqualified Undersized Buildings (< 15,000 sq ft): {undersized_count:,}")
    
    # 6. Remaining Commercial Candidates
    cur.execute("""
        SELECT count(*) 
        FROM scored_parcel_leads 
        WHERE COALESCE(is_mock, 0) = 0 
          AND verification_status = 'UNVERIFIED'
    """)
    remaining = cur.fetchone()[0]
    print(f"• Remaining Commercial Candidates for Storm & CAD Validation: {remaining:,}")
    
    conn.commit()
    conn.close()
    
    elapsed = time.time() - start_t
    print(f"\nStage 1 completed in {elapsed:.2f} seconds.")

if __name__ == "__main__":
    run_stage1_hygiene()
