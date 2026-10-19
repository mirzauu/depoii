import sqlite3
import urllib.request
import urllib.parse
import json
import time
from datetime import datetime

CFW_PERMITS_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0", "Accept": "application/json"}

from app.science.verification_engine import _parse_street_tokens, is_roof_permit_text, MunicipalPermitAuditor

def run_stage4_muni_permits():
    print("=" * 70)
    print("STAGE 4: MUNICIPAL PERMIT PORTAL AUDITOR")
    print("=" * 70)
    
    start_t = time.time()
    conn = sqlite3.connect('depoii_local.db')
    cur = conn.cursor()
    
    # Select candidate leads that passed Stages 1, 2, and 3
    cur.execute("""
        SELECT l.parcel_id, l.address, l.city, l.verification_score
        FROM scored_parcel_leads l
        WHERE l.state = 'TX'
          AND l.verification_status = 'UNVERIFIED'
          AND l.cad_account_id IS NOT NULL
    """)
    leads = cur.fetchall()
    print(f"Total CAD-confirmed Tarrant County leads to audit: {len(leads):,}")
    
    zero_permits_count = 0
    permits_detected_count = 0
    non_roof_count = 0
    no_feed_count = 0
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    for i, (pid, addr, city, cur_score) in enumerate(leads, 1):
        num, core_tokens = _parse_street_tokens(addr)

        # 1. Check local warehouse
        cur.execute("""
            SELECT raw_permit_number, issue_date, category, raw_description
            FROM normalized_permits
            WHERE parcel_id = ?
              AND (issue_date >= '2026-04-26' OR applied_date >= '2026-04-26')
        """, (pid,))
        local_permits = cur.fetchall()

        if not local_permits and num and core_tokens:
            cur.execute(f"""
                SELECT raw_permit_number, issue_date, category, raw_description
                FROM normalized_permits
                WHERE normalized_address LIKE ?
                  AND (issue_date >= '2026-04-26' OR applied_date >= '2026-04-26')
                LIMIT 5
            """, (f"%{num}%{'%'.join(core_tokens)}%",))
            local_permits = cur.fetchall()

        if local_permits:
            has_roof = any(is_roof_permit_text(f"{p[2] or ''} {p[3] or ''}") for p in local_permits)
            if has_roof:
                cur.execute("""
                    UPDATE scored_parcel_leads
                    SET verification_status = 'ROOF_PERMIT_DETECTED',
                        verification_score = 0,
                        muni_permit_status = 'ROOF_PERMIT_DETECTED',
                        muni_permit_check_date = ?
                    WHERE parcel_id = ?
                """, (today_str, pid))
                permits_detected_count += 1
                print(f"[{i:03d}/{len(leads)}] {addr} ({city}): ROOF PERMIT DETECTED in local database")
            else:
                new_score = cur_score + 25
                cur.execute("""
                    UPDATE scored_parcel_leads
                    SET verification_status = 'NON_ROOF_PERMIT_DETECTED',
                        verification_score = ?,
                        muni_permit_status = 'NON_ROOF_PERMIT_DETECTED',
                        muni_permit_check_date = ?
                    WHERE parcel_id = ?
                """, (new_score, today_str, pid))
                non_roof_count += 1
                print(f"[{i:03d}/{len(leads)}] {addr} ({city}): NON-ROOF PERMIT DETECTED in local database")
            continue
            
        # For Fort Worth, check live City of Fort Worth Open Data Permits
        if city.lower() == 'fort worth':
            muni_res = MunicipalPermitAuditor.audit_fort_worth(addr, storm_date="2026-04-26")
            audit_status = muni_res.get("audit_status")
            if audit_status == "ROOF_PERMIT_DETECTED":
                cur.execute("""
                    UPDATE scored_parcel_leads
                    SET verification_status = 'ROOF_PERMIT_DETECTED',
                        verification_score = 0,
                        muni_permit_status = 'ROOF_PERMIT_DETECTED',
                        muni_permit_check_date = ?
                    WHERE parcel_id = ?
                """, (today_str, pid))
                permits_detected_count += 1
                print(f"[{i:03d}/{len(leads)}] {addr}: LIVE CFW ROOF PERMIT DETECTED")
            elif audit_status == "NON_ROOF_PERMIT_DETECTED":
                new_score = cur_score + 25
                cur.execute("""
                    UPDATE scored_parcel_leads
                    SET verification_status = 'NON_ROOF_PERMIT_DETECTED',
                        verification_score = ?,
                        muni_permit_status = 'NON_ROOF_PERMIT_DETECTED',
                        muni_permit_check_date = ?
                    WHERE parcel_id = ?
                """, (new_score, today_str, pid))
                non_roof_count += 1
                print(f"[{i:03d}/{len(leads)}] {addr}: LIVE CFW NON-ROOF PERMIT DETECTED")
            else:
                new_score = cur_score + 25
                v_status = 'VERIFIED' if new_score >= 75 else 'UNVERIFIED'
                cur.execute("""
                    UPDATE scored_parcel_leads
                    SET verification_status = ?,
                        verification_score = ?,
                        muni_permit_status = 'NO_POST_STORM_ROOF_PERMIT_FOUND',
                        muni_permit_check_date = ?
                    WHERE parcel_id = ?
                """, (v_status, new_score, today_str, pid))
                zero_permits_count += 1
        else:
            # Cities without active open data feeds (e.g. Arlington, Benbrook)
            new_score = cur_score + 15
            v_status = 'VERIFIED' if new_score >= 75 else 'UNVERIFIED'
            cur.execute("""
                UPDATE scored_parcel_leads
                SET verification_status = ?,
                    verification_score = ?,
                    muni_permit_status = 'NO_ACTIVE_MUNICIPAL_FEED',
                    muni_permit_check_date = ?
                WHERE parcel_id = ?
            """, (v_status, new_score, today_str, pid))
            no_feed_count += 1
            
        if i % 50 == 0:
            print(f"Progress: {i}/{len(leads)} audited...")
            conn.commit()
            
    conn.commit()
    conn.close()
    
    elapsed = time.time() - start_t
    print("\nSTAGE 4 RESULTS:")
    print(f"  • Confirmed Zero Post-Storm Roof Permits (+25 score): {zero_permits_count:,}")
    print(f"  • Active Site Capex Non-Roof Permits (+25 score)   : {non_roof_count:,}")
    print(f"  • Confirmed Zero Permits in Local Warehouse / No Feed: {no_feed_count:,}")
    print(f"  • Disqualified - Post-Storm Roof Permit Detected    : {permits_detected_count:,}")
    print(f"Stage 4 completed in {elapsed:.2f} seconds.")

if __name__ == "__main__":
    run_stage4_muni_permits()
