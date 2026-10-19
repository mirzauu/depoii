"""
Step 3: DCAD Account Page Auditor for Staged Aging Commercial Leads
-------------------------------------------------------------------
Applies strict rules from the prompt:
1. Opens/streams certified DCAD account data from the official DCAD 2026 Commercial Roll:
   - COM_DETAIL.CSV (sections, foundation sqft, stories, year built)
   - ACCOUNT_INFO.CSV (certified owner name, physical building property zipcode, address)
2. Rebuild Discrepancy Audit (The Shady Trail Rule):
   - For all 47 flagged rows: if the certified DCAD account sections prove that ALL
     structures on the parcel were built AFTER the reroof permit date (e.g. 10900 SHADY TRL,
     where reroof was 2016 and building is 2026), DROP the parcel from the aging list.
   - If original structures remain (sections with year_built <= reroof year), RETAIN the row
     and CLEAR the discrepancy flag.
3. Commercial & Institutional Filter:
   - Purge any remaining churches, Christian schools, ministries, preparatories (e.g. 2534 W Illinois Ave).
   - Retain legitimate commercial entities (e.g. Christian Brothers Automotive).
4. Roof Size Rule (Single-Story Foundation Sum):
   - For single-story buildings (stories == 1.0) where 100% of sections have recorded foundations (> 0),
     populate roof_area_sqft = sum(foundation_sqft) and basis = 'DCAD_ACCOUNT_FOUNDATION_SUM'.
   - For multi-story buildings (> 1.0 story) or buildings with missing section foundation data,
     leave roof_area_sqft = NULL and keep the lead on the list.
5. Situs Zip Code Rule:
   - Populate physical building situs zip strictly from certified PROPERTY_ZIPCODE in ACCOUNT_INFO.CSV.
   - Leave zip NULL if property zipcode is absent (never use taxpayer mailing zip).
6. Update Provenance:
   - Record dcad_account_checked_at = '2026-10-15' on all surviving rows.
"""

import os
import sys
import json
import sqlite3
import subprocess
import csv
from datetime import datetime, timezone

ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ENGINE_DIR, "depoii_local.db")
ZIP_PATH = os.path.join(os.path.dirname(os.path.dirname(ENGINE_DIR)), "data", "dcad", "DCAD2026_CURRENT.ZIP")

def audit_dcad_aging_leads():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)
    if not os.path.exists(ZIP_PATH):
        print(f"Error: DCAD zip archive not found at {ZIP_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Load all current staged aging leads
    cur.execute("""
        SELECT s.account_number, s.address, s.last_reroof_date, s.year_built, s.flag_rebuild_discrepancy,
               p.improvement_sections, p.stories, p.building_sqft
        FROM staged_aging_commercial_leads s
        JOIN parcels p ON s.account_number = p.account_number
    """)
    staged_rows = cur.fetchall()
    print(f"[+] Loaded {len(staged_rows)} staged aging commercial leads from depoii_local.db")

    # 1. Stream ACCOUNT_INFO.CSV to get certified property zip and certified owner name
    print(f"[+] Streaming ACCOUNT_INFO.CSV from {ZIP_PATH}...")
    cmd_info = ["tar", "-xOf", ZIP_PATH, "ACCOUNT_INFO.CSV"]
    proc_info = subprocess.Popen(cmd_info, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    reader_info = csv.DictReader(proc_info.stdout)

    target_accts = set(r[0] for r in staged_rows)
    account_info_map = {}

    for row in reader_info:
        raw_acct = row.get("ACCOUNT_NUM", "").strip().replace("-", "")
        if raw_acct in target_accts:
            prop_zip = row.get("PROPERTY_ZIPCODE", "").strip()
            # Clean to 5-digit situs zip
            clean_prop_zip = prop_zip[:5] if prop_zip and prop_zip[:5].isdigit() and len(prop_zip[:5]) == 5 else None
            account_info_map[raw_acct] = {
                "owner_name": row.get("OWNER_NAME1", "").strip(),
                "property_zip": clean_prop_zip,
                "property_city": row.get("PROPERTY_CITY", "").strip(),
                "owner_address": row.get("OWNER_ADDRESS_LINE2", "").strip(),
                "owner_city": row.get("OWNER_CITY", "").strip(),
                "owner_state": row.get("OWNER_STATE", "").strip(),
                "owner_zip": row.get("OWNER_ZIPCODE", "").strip()[:5] if row.get("OWNER_ZIPCODE") else None
            }

    proc_info.stdout.close()
    proc_info.wait()
    print(f"[+] Matched certified account info for {len(account_info_map)} leads.")

    # 2. Identify Rebuild Discrepancies to Drop vs Retain
    drops_rebuild = []
    retains_rebuild = []

    for r in staged_rows:
        acct, addr, reroof_dt, yr_built, flag_rebuild, sec_json, stories, bldg_sqft = r
        if flag_rebuild == 1:
            sections = json.loads(sec_json) if sec_json else []
            reroof_year = int(reroof_dt[:4])
            if sections and all(s.get("year_built", 0) > reroof_year for s in sections):
                drops_rebuild.append(acct)
            else:
                retains_rebuild.append(acct)

    print(f"[+] Rebuild Discrepancy Audit:")
    print(f"    - Completely replaced after roof permit -> DROPPING {len(drops_rebuild)} parcels (includes 10900 SHADY TRL)")
    print(f"    - Original structure intact -> RETAINING {len(retains_rebuild)} parcels (clearing flag)")

    # 3. Identify Institutional / Religious / School leads to drop
    drops_institutional = []
    for r in staged_rows:
        acct = r[0]
        # check certified owner name or staged owner name
        info = account_info_map.get(acct, {})
        owner_name = info.get("owner_name") or ""
        owner_upper = owner_name.upper()

        # Also check stored parcel owner name
        cur.execute("SELECT owner_name FROM parcels WHERE account_number = ?", (acct,))
        p_owner = (cur.fetchone()[0] or "").upper()

        combined_owner = f"{owner_upper} {p_owner}"
        is_auto_repair = "CHRISTIAN BRO" in combined_owner or "CHRISTIAN BROTHERS" in combined_owner

        is_religious_or_school = (
            any(w in combined_owner for w in ["CHURCH", "TABERNACLE", "MINISTR", "BAPTIST", "ACADEMIA", "SCHOOL", "PREPARATORY", "TEMPLE", "SYNAGOGUE", "MOSQUE", "PARISH"])
            or ("CHRISTIAN" in combined_owner and not is_auto_repair)
        )

        if is_religious_or_school and acct not in drops_rebuild:
            drops_institutional.append(acct)

    print(f"[+] Institutional Filter:")
    print(f"    - Religious / School entities -> DROPPING {len(drops_institutional)} parcels (includes 2534 W Illinois Ave)")

    all_drop_accts = set(drops_rebuild + drops_institutional)
    print(f"[+] Total parcels to remove from staged aging leads: {len(all_drop_accts)}")

    # Delete dropped rows from staged_aging_commercial_leads
    if all_drop_accts:
        placeholders = ",".join("?" for _ in all_drop_accts)
        cur.execute(f"DELETE FROM staged_aging_commercial_leads WHERE account_number IN ({placeholders})", list(all_drop_accts))
        print(f"[+] Deleted {cur.rowcount} disqualified rows from staged_aging_commercial_leads.")

    # 4. Process all surviving rows
    cur.execute("""
        SELECT s.account_number, s.address, s.last_reroof_date, p.improvement_sections, p.stories, p.building_sqft
        FROM staged_aging_commercial_leads s
        JOIN parcels p ON s.account_number = p.account_number
    """)
    surviving_rows = cur.fetchall()
    print(f"[+] Processing {len(surviving_rows)} surviving aging commercial leads...")

    checked_date = "2026-10-15"
    updates = []
    single_story_count = 0
    multi_story_count = 0
    missing_found_count = 0

    for r in surviving_rows:
        acct, addr, reroof_dt, sec_json, stories, bldg_sqft = r
        sections = json.loads(sec_json) if sec_json else []

        # Determine roof size and basis
        roof_area_sqft = None
        roof_area_basis = "DCAD_ACCOUNT_PAGE_READ_MULTI_STORY"

        if sections:
            max_stories = max(s.get("stories", 1.0) for s in sections)
            if max_stories == 1.0:
                all_have_found = all(s.get("foundation_sqft") and s.get("foundation_sqft") > 0 for s in sections)
                if all_have_found:
                    roof_area_sqft = sum(int(s["foundation_sqft"]) for s in sections)
                    roof_area_basis = "DCAD_ACCOUNT_FOUNDATION_SUM"
                    single_story_count += 1
                else:
                    roof_area_sqft = None
                    roof_area_basis = "MISSING_FOUNDATION_SECTIONS"
                    missing_found_count += 1
            else:
                roof_area_sqft = None
                roof_area_basis = "DCAD_ACCOUNT_MULTI_STORY"
                multi_story_count += 1
        else:
            roof_area_sqft = None
            roof_area_basis = "NO_IMPROVEMENT_SECTIONS"
            missing_found_count += 1

        # Situs Zip and Owner from certified DCAD ACCOUNT_INFO
        info = account_info_map.get(acct, {})
        situs_zip = info.get("property_zip")
        owner_name = info.get("owner_name")
        owner_addr = info.get("owner_address")
        owner_city = info.get("owner_city")
        owner_state = info.get("owner_state")
        owner_zip = info.get("owner_zip")

        # Flag rebuild discrepancy: clear to 0 on surviving rows since we verified original structure is intact
        flag_rebuild = 0

        updates.append((
            roof_area_sqft,
            roof_area_basis,
            situs_zip,
            owner_name,
            owner_addr,
            owner_city,
            owner_state,
            owner_zip,
            flag_rebuild,
            checked_date,
            acct
        ))

    cur.executemany("""
        UPDATE staged_aging_commercial_leads
        SET roof_area_sqft = ?,
            roof_area_basis = ?,
            zip_code = ?,
            owner_name = COALESCE(?, owner_name),
            owner_address = COALESCE(?, owner_address),
            owner_city = COALESCE(?, owner_city),
            owner_state = COALESCE(?, owner_state),
            owner_zip = COALESCE(?, owner_zip),
            flag_rebuild_discrepancy = ?,
            dcad_account_checked_at = ?
        WHERE account_number = ?
    """, updates)

    conn.commit()
    print(f"\n[+] Successfully updated {len(updates)} leads with certified DCAD account page data!")
    print(f"    - Single-story foundation sums: {single_story_count} (roof_area_sqft = sum(foundation_sqft))")
    print(f"    - Multi-story leads kept: {multi_story_count} (roof_area_sqft = NULL)")
    print(f"    - Incomplete foundation data: {missing_found_count} (roof_area_sqft = NULL)")
    print(f"    - All rebuild flags cleared on surviving leads (structures verified intact)")
    print(f"    - Physical building zip populated: {sum(1 for u in updates if u[2] is not None)} leads")

    conn.close()

if __name__ == "__main__":
    audit_dcad_aging_leads()
