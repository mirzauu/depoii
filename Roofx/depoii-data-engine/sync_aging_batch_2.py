"""
Sync Aging Batch 2 (+100 Commercial Warehouses)
-----------------------------------------------
Syncs the curated 100 commercial warehouses from staged_aging_commercial_leads into:
1. Production app DB: data/depoii.sqlite (leads, parcels, permits) strictly for PILOT_ORG (19b8a9bce1316429).
2. Engine DB: depoii_local.db (released_leads, lead_evidence).
"""

import os
import sys
import uuid
import sqlite3
from datetime import datetime, timezone

ENGINE_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
PROD_DB = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "depoii.sqlite"))
PILOT_ORG = "19b8a9bce1316429"

from prepare_aging_batch_2 import get_candidates

def sync_batch_2():
    candidates = get_candidates(100)
    print(f"\nProceeding with sync of {len(candidates)} Batch 2 aging leads...")

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

        # 5. Write to Engine DB (released_leads & lead_evidence)
        engine_cur.execute("""
            INSERT INTO released_leads (parcel_id, state, released_at, release_reason)
            VALUES (?, 'TX', ?, 'Batch 2 curated aging commercial warehouse - Foundation sum roof area, DallasNow verified')
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

    print(f"\n[+] Successfully synced {synced_count} Batch 2 curated commercial aging leads.")

if __name__ == "__main__":
    sync_batch_2()
