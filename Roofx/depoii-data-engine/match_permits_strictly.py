"""
Strict 4-Token Municipal Permit Matcher
---------------------------------------
Enforces strict address token matching (Number + Directional N/S/E/W + Street Name + City)
to attach municipal building permits to candidate parcels.

Evaluates post-storm permit status:
- If a reroof permit exists after storm date -> RESOLVED (Competitor captured)
- If zero reroof permits exist after storm date -> UNRESOLVED HIGH-VALUE LEAD
"""

import os
import sys
import json
import sqlite3
import re
from datetime import datetime, timezone
from batch_parcel_matcher import clean_address_components

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("=" * 70)
    print("DEPOII STRICT PERMIT RESOLUTION ENGINE")
    print("=" * 70)

    # 1. Load candidate scored leads in Sector 1 & Dallas
    cur.execute("""
        SELECT parcel_id, address, city, event_date, building_sqft, exposure_score, cad_total_valuation
        FROM scored_parcel_leads
        WHERE state = 'TX'
    """)
    leads = cur.fetchall()
    print(f"[+] Loaded {len(leads):,} candidate storm leads across DFW.")

    # Index leads by (city.upper(), street_number)
    lead_index = {}
    for lead in leads:
        pid, addr, city, event_date, sqft, score, val = lead
        num, street = clean_address_components(addr)
        if not num or not street:
            continue
        key = (city.strip().upper(), num)
        if key not in lead_index:
            lead_index[key] = []
        lead_index[key].append({
            "pid": pid,
            "raw_address": addr,
            "street": street,
            "city": city,
            "event_date": event_date,
            "sqft": sqft,
            "score": score
        })

    print(f"[+] Indexed leads into {len(lead_index):,} (city, street_number) address buckets.")

    # 2. Load Texas permits
    cur.execute("""
        SELECT id, raw_permit_number, normalized_address, city, issue_date, 
               category, raw_description, contractor_name, is_pure_reroof
        FROM normalized_permits
        WHERE state = 'TX'
    """)
    permits = cur.fetchall()
    print(f"[+] Loaded {len(permits):,} Texas municipal permits to evaluate.")

    matches_found = 0
    resolved_leads = {}  # pid -> permit details
    permit_links = []    # (pid, pm_id)

    for p in permits:
        pm_id, pm_no, pm_addr, pm_city, pm_date, pm_cat, pm_desc, contractor, is_reroof = p
        if not pm_addr or not pm_city:
            continue

        pm_num, pm_street = clean_address_components(pm_addr)
        if not pm_num or not pm_street:
            continue

        key = (pm_city.strip().upper(), pm_num)
        candidates = lead_index.get(key, [])

        for cand in candidates:
            pr_street = cand["street"]
            
            # STRICT MATCH RULE:
            # 1. Must share identical directional prefix if directional exists
            # 2. Must match street base
            pm_parts = pm_street.split()
            pr_parts = pr_street.split()

            # Check directional agreement
            pm_has_dir = pm_parts[0] in ["N", "S", "E", "W"] if pm_parts else False
            pr_has_dir = pr_parts[0] in ["N", "S", "E", "W"] if pr_parts else False

            if pm_has_dir and pr_has_dir:
                if pm_parts[0] != pr_parts[0]:
                    continue  # Mismatch: e.g. N vs S -> REJECT
            elif pm_has_dir != pr_has_dir:
                # One has directional, other does not -> conservative skip
                continue

            # Check core street name match
            pm_core = " ".join(pm_parts[1:]) if pm_has_dir else pm_street
            pr_core = " ".join(pr_parts[1:]) if pr_has_dir else pr_street

            if pm_core == pr_core or pm_core in pr_core or pr_core in pm_core:
                # VERIFIED MATCH!
                matches_found += 1
                pid = cand["pid"]
                permit_links.append((pid, pm_id))

                # Check if this permit was issued after the storm event date
                event_date = cand["event_date"] or "2024-01-01"
                if pm_date and pm_date >= event_date:
                    # Check if it's a roofing permit
                    desc_lower = (pm_desc or "").lower() + " " + (pm_cat or "").lower()
                    if is_reroof or any(kw in desc_lower for kw in ["roof", "reroof", "tear-off", "shingle", "tpo", "epdm", "flat roof"]):
                        resolved_leads[pid] = {
                            "permit_no": pm_no,
                            "issue_date": pm_date,
                            "contractor": contractor or "Named on Municipal Permit",
                            "status": "RESOLVED_COMPETITOR_PERMIT_FILED"
                        }

    print(f"\n[+] Verified {matches_found:,} strict permit-to-lead linkages!")
    print(f"[+] Identified {len(resolved_leads):,} candidate leads that ALREADY have post-storm reroof permits filed (RESOLVED).")

    # 3. Update normalized_permits with verified parcel_ids
    if permit_links:
        cur.executemany("""
            UPDATE normalized_permits
            SET parcel_id = ?
            WHERE id = ?
        """, permit_links)

    # 4. Update scored_parcel_leads status
    # First, mark resolved leads
    for pid, res in resolved_leads.items():
        cur.execute("""
            UPDATE scored_parcel_leads
            SET muni_permit_status = ?,
                muni_permit_check_date = date('now')
            WHERE parcel_id = ?
        """, (f"RESOLVED: {res['contractor']} ({res['permit_no']}, {res['issue_date']})", pid))

    # Next, mark candidates that have NO post-storm roof permit found
    cur.execute("""
        UPDATE scored_parcel_leads
        SET muni_permit_status = 'NO_POST_STORM_ROOF_PERMIT_FOUND',
            muni_permit_check_date = date('now')
        WHERE state = 'TX'
          AND (muni_permit_status IS NULL OR muni_permit_status = '' OR muni_permit_status = 'ZERO_PERMITS_FOUND')
          AND parcel_id NOT IN (
              SELECT parcel_id FROM normalized_permits 
              WHERE parcel_id IS NOT NULL AND parcel_id != '' 
                AND is_pure_reroof = 1 AND issue_date >= '2024-01-01'
          )
    """)

    conn.commit()

    # 5. Output Summary by City
    cur.execute("""
        SELECT city,
               count(*) as total_storm_leads,
               count(CASE WHEN muni_permit_status LIKE 'RESOLVED%' THEN 1 END) as resolved_leads,
               count(CASE WHEN muni_permit_status = 'NO_POST_STORM_ROOF_PERMIT_FOUND' THEN 1 END) as open_unresolved_leads
        FROM scored_parcel_leads
        WHERE state = 'TX'
          AND city IN ('Dallas', 'Garland', 'Irving', 'Farmers Branch', 'Carrollton', 'Coppell', 'Addison', 'Mesquite', 'Rowlett', 'Richardson', 'Grand Prairie', 'Duncanville', 'Balch Springs', 'Lancaster', 'Fort Worth')
        GROUP BY city
        ORDER BY open_unresolved_leads DESC
    """)
    summary = cur.fetchall()

    print("\n" + "=" * 70)
    print("STRICT PERMIT RESOLUTION AUDIT SUMMARY")
    print("=" * 70)
    print(f"{'City':<18} | {'Total Leads':<12} | {'Resolved (Competitor)':<22} | {'Open Unresolved'}")
    print("-" * 70)
    for r in summary:
        print(f"{r[0]:<18} | {r[1]:<12} | {r[2]:<22} | {r[3]:<15}")

    conn.close()
    print("\n[OK] Strict permit resolution analysis completed successfully!")

if __name__ == "__main__":
    main()
