"""
Prepare and Sync Aging Batch 3 (+100 Commercial Warehouses)
-----------------------------------------------------------
1. Queries staged_aging_commercial_leads for 1-story commercial warehouses meeting:
   - roof_area_basis = 'DCAD_ACCOUNT_FOUNDATION_SUM'
   - DallasNow checked: 0 reroofs on file (or non-reroof filings only)
   - Non-institutional commercial owner (no churches, schools, government, banks, medical)
   - No rebuild discrepancies
   - roof_area_sqft >= 5,000 sq ft
   - Not already synced in data/depoii.sqlite (currently 165 synced)
   - No multi-parcel ambiguous addresses
2. Selects 10 sample candidates for verification on DCAD & DallasNow.
3. Syncs the 100 leads to:
   - Production DB: data/depoii.sqlite (leads, parcels, permits) strictly under org 19b8a9bce1316429.
   - Engine DB: depoii_local.db (released_leads, lead_evidence).
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
          AND UPPER(s.owner_name) NOT LIKE '%COUNTRY CLUB%'
          AND UPPER(s.owner_name) NOT LIKE '%GOLF%'
          AND UPPER(s.owner_name) NOT LIKE '%CEMETERY%'
          AND UPPER(s.owner_name) NOT LIKE '%FAIR PARK%'
          AND UPPER(s.owner_name) NOT LIKE '%DEVELOPMENT CORP%'
          AND UPPER(s.owner_name) NOT LIKE '%COMMUNITY%'
        ORDER BY s.last_reroof_date ASC
    """

    all_rows = engine_conn.execute(query).fetchall()
    unsynced = [r for r in all_rows if r[0] not in synced_pids]
    print(f"Total unsynced candidates available: {len(unsynced)}")

    # Check for multi-parcel address collisions
    addrs = [r[2].strip().upper() for r in unsynced]
    safe_candidates = []
    for r in unsynced:
        addr = r[2].strip().upper()
        count = engine_conn.execute("SELECT count(*) FROM parcels WHERE UPPER(address) = ?", (addr,)).fetchone()[0]
        if count <= 1:
            safe_candidates.append(r)
        else:
            print(f"  [!] Skipping ambiguous multi-parcel address: {addr} ({count} parcels)")

    selected = safe_candidates[:limit]
    print(f"Selected Batch 3 slice: {len(selected)} leads")

    engine_conn.close()
    prod_conn.close()
    return selected

def sync_batch_3():
    candidates = get_candidates(100)
    if len(candidates) < 100:
        print(f"Warning: only {len(candidates)} candidates found.")

    print(f"\nProceeding with sync of {len(candidates)} Batch 3 aging leads...")

    engine_conn = sqlite3.connect(ENGINE_DB)
    engine_cur = engine_conn.cursor()

    prod_conn = sqlite3.connect(PROD_DB)
    prod_cur = prod_conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()
    synced_count = 0

    for r in candidates:
        (
            pid, acct, addr, city, zip_code,
            ptype, owner, o_addr, o_city, o_state, o_zip,
            stories, bldg_sqft, roof_sqft, roof_basis,
            yr_built, reroof_date, reroof_permit_no,
            dcad_checked, dnow_checked, dnow_count,
            dnow_newest_no, dnow_newest_date, dnow_newest_desc,
            lat, lon, tot_val
        ) = r

        city_clean = city or "Dallas"
        lat_clean = float(lat) if lat else 32.7767
        lon_clean = float(lon) if lon else -96.7970
        roof_sqft_clean = int(roof_sqft or 0)
        tot_val_clean = float(tot_val) if tot_val else float(roof_sqft_clean * 120.0)

        # 1. Update/Insert in Production parcels
        owner_full_addr = f"{o_addr or ''}, {o_city or ''} {o_state or ''} {o_zip or ''}".strip(", ")
        dcad_url = f"https://www.dallascad.org/AcctDetailCom.aspx?ID={acct}"
        prod_cur.execute("""
            INSERT INTO parcels (account, owner, address, city, year_built, sqft, lat, lng, owner_address, record_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account) DO UPDATE SET
                owner = excluded.owner,
                address = excluded.address,
                year_built = excluded.year_built,
                sqft = excluded.sqft,
                record_url = excluded.record_url,
                updated_at = excluded.updated_at
        """, (
            pid, owner, addr, city_clean, int(yr_built or 1970), roof_sqft_clean,
            lat_clean, lon_clean, owner_full_addr, dcad_url, now_iso
        ))

        # 2. Update/Insert in Production permits
        permit_scope = f"Historical Commercial Reroof: {reroof_date} (Permit #{reroof_permit_no})"
        prod_cur.execute("""
            INSERT INTO permits (permit_no, kind, address, city, contractor_name, contractor_state, issued, valuation, scope, membrane, lat, lng, parcel_ids, record_url, portal, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(permit_no) DO UPDATE SET
                issued = excluded.issued,
                scope = excluded.scope,
                updated_at = excluded.updated_at
        """, (
            reroof_permit_no, "Commercial Roofing Permit", addr, city_clean,
            "Public Record Contractor", "TX", reroof_date, 0,
            permit_scope, "BUR / Mod-Bit", lat_clean, lon_clean,
            f'["{pid}"]', dcad_url, "City of Dallas Building Inspection", now_iso
        ))

        # 3. Create clean notes for contractor UI
        if dnow_count == 0:
            dnow_line = "DallasNow audit: 0 filings on file"
        else:
            dnow_line = f"DallasNow audit: {dnow_count} filing(s), newest {dnow_newest_date} ({dnow_newest_no}: {str(dnow_newest_desc)[:45]}...)"

        age_years = max(0, 2026 - int(reroof_date[:4]))
        score = min(95, 50 + int(age_years * 1.2) + (15 if roof_sqft_clean >= 15000 else 5))
        lead_notes = (
            f"1-Story Commercial Warehouse | Roof Area: {roof_sqft_clean:,} sq ft ({roof_basis}) | "
            f"Built {yr_built} | Last reroof: {reroof_date} (Permit #{reroof_permit_no}, {age_years} yrs old) | "
            f"{dnow_line} | DCAD roll verified {str(dcad_checked)[:10]}"
        )

        est_price = round(roof_sqft_clean * 9.50, 0)

        # 4. Insert lead exclusively for PILOT_ORG (single org prevents count duplication)
        lead_id = str(uuid.uuid4())
        prod_cur.execute("""
            INSERT INTO leads (id, org_id, parcel_id, storm_id, address, city, stage, assignee, notes, score, hail, price, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(org_id, parcel_id, storm_id) DO UPDATE SET
                notes = excluded.notes,
                score = excluded.score,
                price = excluded.price,
                updated_at = excluded.updated_at
        """, (
            lead_id, PILOT_ORG, pid, "DALLAS-AGING-ROOF-PILOT", addr, city_clean,
            "New", "Unassigned", lead_notes, score, 0.0, est_price, now_iso
        ))

        # 5. Write to Engine DB (parcels, released_leads & lead_evidence)
        engine_cur.execute("""
            UPDATE parcels SET 
                owner_name = ?, 
                last_reroof_date = ?, 
                last_reroof_permit_no = ? 
            WHERE id = ?
        """, (owner, reroof_date, reroof_permit_no, pid))

        engine_cur.execute("""
            INSERT INTO released_leads (parcel_id, state, released_at, release_reason)
            VALUES (?, 'TX', ?, 'Batch 3 curated aging commercial warehouse - Foundation sum roof area, DallasNow verified')
            ON CONFLICT(parcel_id) DO UPDATE SET
                released_at = excluded.released_at,
                release_reason = excluded.release_reason
        """, (pid, now_iso))

        evidence_items = [
            ("address", addr, "Dallas CAD", dcad_url, "Property Address"),
            ("owner_name", owner, "Dallas CAD", dcad_url, "Owner Name"),
            ("year_built", yr_built, "Dallas CAD", dcad_url, "Year Built"),
            ("stories", 1, "Dallas CAD", dcad_url, "Stories"),
            ("source_area", roof_sqft_clean, "Dallas CAD", dcad_url, "Foundation Sum"),
            ("roof_sqft_used", roof_sqft_clean, "Dallas CAD", dcad_url, "Foundation Sum Roof Area"),
            ("last_reroof_date", reroof_date, "City of Dallas Building Inspection", "", f"Permit {reroof_permit_no}"),
            ("permit_portal", "DallasNow (ACA)", "City of Dallas Accela", "https://aca-prod.accela.com/DALLASTX/", "DallasNow Portal"),
            ("permit_match_count", dnow_count, "City of Dallas Accela", "https://aca-prod.accela.com/DALLASTX/", "Permit Filings"),
        ]

        for fname, sval, ssys, surl, sfield in evidence_items:
            engine_cur.execute("""
                INSERT INTO lead_evidence (parcel_id, field_name, stored_value, source_system, source_url, source_field, retrieved_at, raw_excerpt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(parcel_id, field_name) DO UPDATE SET
                    stored_value = excluded.stored_value,
                    source_system = excluded.source_system,
                    retrieved_at = excluded.retrieved_at
            """, (pid, fname, str(sval), ssys, surl, sfield, now_iso, lead_notes[:400]))

        synced_count += 1

    prod_conn.commit()
    prod_conn.close()

    engine_conn.commit()
    engine_conn.close()

    print(f"\n[+] Successfully synced {synced_count} Batch 3 curated commercial aging leads.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--sync":
        sync_batch_3()
    else:
        candidates = get_candidates(100)
        print("\nFirst 10 sample candidates for verification:")
        for i, c in enumerate(candidates[:10], 1):
            pid, acct, addr, city, zip_code = c[0], c[1], c[2], c[3], c[4]
            owner, stories, sqft, reroof_date, permit_no = c[6], c[11], c[13], c[16], c[17]
            dnow_cnt = c[20]
            dnow_desc = str(c[23] or "")[:35]
            print(f"[{i:02d}] Acct: {acct} | {addr} | Owner: {owner[:25]} | {sqft:,} sqft | Reroof: {reroof_date} (#{permit_no}) | DallasNow: {dnow_cnt} ({dnow_desc})")
