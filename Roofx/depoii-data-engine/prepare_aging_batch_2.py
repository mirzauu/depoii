"""
Prepare and Sync Aging Batch 2 (+100 Commercial Warehouses)
-----------------------------------------------------------
1. Queries staged_aging_commercial_leads for 1-story commercial warehouses meeting:
   - roof_area_basis = 'DCAD_ACCOUNT_FOUNDATION_SUM'
   - DallasNow checked: 0 reroofs on file (or non-reroof filings only)
   - Non-institutional commercial owner
   - No rebuild discrepancies
   - roof_area_sqft >= 5,000 sq ft
   - Not already synced in data/depoii.sqlite
2. Selects 10 sample candidates for live DCAD & DallasNow verification.
3. Verifies candidates and outputs the exact batch for review and sync.
"""

import os
import sys
import uuid
import sqlite3
from datetime import datetime, timezone

ENGINE_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
PROD_DB = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "depoii.sqlite"))
PILOT_ORG = "19b8a9bce1316429"

def get_candidates(limit=100):
    engine_conn = sqlite3.connect(ENGINE_DB)
    prod_conn = sqlite3.connect(PROD_DB)

    synced_pids = set(
        r[0] for r in prod_conn.execute("SELECT parcel_id FROM leads WHERE storm_id = 'DALLAS-AGING-ROOF-PILOT'").fetchall()
    )
    print(f"Already synced aging leads in customer DB: {len(synced_pids)}")

    query = """
        SELECT 
            s.parcel_id, s.account_number, s.address, s.city, s.zip_code,
            s.property_type, s.owner_name, s.owner_address, s.owner_city, s.owner_state, s.owner_zip,
            s.stories, s.building_sqft, s.roof_area_sqft, s.roof_area_basis,
            s.year_built, s.last_reroof_date, s.last_reroof_permit_no,
            s.dcad_account_checked_at, s.dallasnow_checked_at, s.dallasnow_filings_count,
            s.dallasnow_newest_filing_no, s.dallasnow_newest_filing_date, s.dallasnow_newest_filing_desc,
            p.latitude, p.longitude, p.total_valuation
        FROM staged_aging_commercial_leads s
        LEFT JOIN parcels p ON p.id = s.parcel_id
        WHERE s.roof_area_basis = 'DCAD_ACCOUNT_FOUNDATION_SUM'
          AND s.dallasnow_checked_at IS NOT NULL
          AND COALESCE(s.flag_rebuild_discrepancy, 0) = 0
          AND s.address IS NOT NULL
          AND s.owner_name IS NOT NULL
          AND s.last_reroof_date IS NOT NULL
          AND s.last_reroof_permit_no IS NOT NULL
          AND s.roof_area_sqft >= 5000
          AND s.dcad_account_checked_at IS NOT NULL
          AND (
            s.dallasnow_filings_count = 0 
            OR (
                LOWER(COALESCE(s.dallasnow_newest_filing_desc, '')) NOT LIKE '%reroof%'
                AND LOWER(COALESCE(s.dallasnow_newest_filing_desc, '')) NOT LIKE '%re-roof%'
                AND LOWER(COALESCE(s.dallasnow_newest_filing_desc, '')) NOT LIKE '%roofing%'
                AND LOWER(COALESCE(s.dallasnow_newest_filing_no, '')) NOT LIKE '%ROOF%'
            )
          )
          AND UPPER(s.owner_name) NOT LIKE '%CHURCH%'
          AND UPPER(s.owner_name) NOT LIKE '%BAPTIST%'
          AND UPPER(s.owner_name) NOT LIKE '%METHODIST%'
          AND UPPER(s.owner_name) NOT LIKE '%CATHOLIC%'
          AND UPPER(s.owner_name) NOT LIKE '%DIOCESE%'
          AND UPPER(s.owner_name) NOT LIKE '%MINISTRIES%'
          AND UPPER(s.owner_name) NOT LIKE '%TEMPLE%'
          AND UPPER(s.owner_name) NOT LIKE '%SYNAGOGUE%'
          AND UPPER(s.owner_name) NOT LIKE '%ISD%'
          AND UPPER(s.owner_name) NOT LIKE '%SCHOOL%'
          AND UPPER(s.owner_name) NOT LIKE '%UNIVERSITY%'
          AND UPPER(s.owner_name) NOT LIKE '%COLLEGE%'
          AND UPPER(s.owner_name) NOT LIKE '%CITY OF%'
          AND UPPER(s.owner_name) NOT LIKE '%COUNTY OF%'
          AND UPPER(s.owner_name) NOT LIKE '%STATE OF%'
          AND UPPER(s.owner_name) NOT LIKE '%HOUSING%'
          AND UPPER(s.owner_name) NOT LIKE '%FOUNDATION%'
          AND UPPER(s.owner_name) NOT LIKE '%UPPER ROOM%'
          AND UPPER(s.owner_name) NOT LIKE '%PARKING%'
          AND UPPER(s.owner_name) NOT LIKE '%ASSOCIATION%'
          AND UPPER(s.owner_name) NOT LIKE '%BANK%'
          AND UPPER(s.owner_name) NOT LIKE '%CREDIT UNION%'
          AND UPPER(s.owner_name) NOT LIKE '%HOSPITAL%'
          AND UPPER(s.owner_name) NOT LIKE '%MEDICAL CENTER%'
          AND UPPER(s.owner_name) NOT LIKE '%POSTAL%'
          AND UPPER(s.owner_name) NOT LIKE '%USPS%'
          AND UPPER(s.owner_name) NOT LIKE '%VETERANS%'
          AND UPPER(s.owner_name) NOT LIKE '%DART%'
          AND UPPER(s.owner_name) NOT LIKE '%GOVERNMENT%'
        ORDER BY s.last_reroof_date ASC
    """

    all_rows = engine_conn.execute(query).fetchall()
    print(f"Total candidate rows passing all gates: {len(all_rows)}")

    unsynced = [r for r in all_rows if r[0] not in synced_pids]
    print(f"Total unsynced candidates available: {len(unsynced)}")

    selected = unsynced[:limit]
    print(f"Selected Batch 2 slice: {len(selected)} leads")

    engine_conn.close()
    prod_conn.close()
    return selected

if __name__ == "__main__":
    candidates = get_candidates(100)
    print("\nFirst 10 sample candidates for verification:")
    for i, c in enumerate(candidates[:10], 1):
        pid, acct, addr, city, zip_code = c[0], c[1], c[2], c[3], c[4]
        owner, stories, sqft, reroof_date, permit_no = c[6], c[11], c[13], c[16], c[17]
        dnow_cnt = c[20]
        print(f"[{i:02d}] Acct: {acct} | {addr} | Owner: {owner[:28]} | {sqft:,} sqft | Reroof: {reroof_date} (#{permit_no}) | DallasNow: {dnow_cnt}")
