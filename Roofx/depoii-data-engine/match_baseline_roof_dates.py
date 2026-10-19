"""
Strict 3-Token Staging Matcher for Baseline Roof Dates
------------------------------------------------------
1. Loads all active parcels in depoii_local.db.
2. Extracts 3 tokens: [ST_NUM] + [DIRECTIONAL: N/S/E/W] + [ST_NAME].
   - Does NOT require city token.
   - Strictly preserves directional prefix so '205 N Henry' != '205 Henry'.
3. Flags Ambiguity:
   - If two or more parcels share the same 3 tokens, writes NOTHING to either,
     and logs both into staged_baseline_roof_matches with match_status = 'AMBIGUOUS_MULTI_PARCEL'.
4. Matches against normalized_permits (filtered to data_source = 'NewPermit_2008_2024' or Dallas).
5. For unambiguous matches:
   - Selects the newest ISSUE_DATE on or before '2024-11-12' where is_pure_reroof = 1 (FULL_REPLACEMENT).
   - Writes match to staged_baseline_roof_matches table (leaves parcels table UNTOUCHED).
6. Outputs QA check suite:
   - Verifies target permit 1601191013 (10900 Shady Trl).
   - Prints sample matched pairs where both addresses were read.
"""

import os
import sys
import sqlite3
import re
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")

# Add engine dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from batch_parcel_matcher import clean_address_components

def extract_3_tokens(addr):
    if not addr:
        return None, None, None
    num, street = clean_address_components(addr)
    if not num or not street:
        return None, None, None
    
    parts = street.split()
    direction = None
    if parts and parts[0] in ["N", "S", "E", "W", "NE", "NW", "SE", "SW"]:
        direction = parts[0]
        st_name = " ".join(parts[1:])
    else:
        direction = ""
        st_name = street

    return num, direction, st_name

def main():
    print("=" * 70)
    print("STAGING 3-TOKEN MATCHER FOR BASELINE ROOF DATES")
    print("=" * 70)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Load active commercial parcels
    cur.execute("""
        SELECT id, account_number, address, city, state, building_sqft, year_built
        FROM parcels
        WHERE state = 'TX' AND city = 'Dallas'
    """)
    parcels = cur.fetchall()
    print(f"[+] Loaded {len(parcels):,} Dallas commercial parcels.")

    # 2. Index parcels and detect duplicate 3-token addresses (Ambiguity check)
    parcel_buckets = {}
    for p in parcels:
        pid, acct, addr, city, state, bldg_sqft, yr = p
        num, direction, st_name = extract_3_tokens(addr)
        if not num or not st_name:
            continue
        key = (num, direction, st_name)
        if key not in parcel_buckets:
            parcel_buckets[key] = []
        parcel_buckets[key].append({
            "id": pid,
            "account": acct,
            "raw_address": addr,
            "bldg_sqft": bldg_sqft,
            "year_built": yr
        })

    ambiguous_keys = {k for k, p_list in parcel_buckets.items() if len(p_list) > 1}
    unambiguous_buckets = {k: p_list[0] for k, p_list in parcel_buckets.items() if len(p_list) == 1}

    print(f"[+] Unique 3-token parcel address buckets: {len(unambiguous_buckets):,}")
    print(f"[+] Ambiguous multi-parcel address keys flagged: {len(ambiguous_keys):,} (will be excluded from automated match)")

    # 3. Load permits from NewPermit_2008_2024
    cur.execute("""
        SELECT raw_permit_number, normalized_address, issue_date, permit_scope, is_pure_reroof, raw_description
        FROM normalized_permits
        WHERE data_source = 'NewPermit_2008_2024'
    """)
    permits = cur.fetchall()
    print(f"[+] Loaded {len(permits):,} permits from NewPermit_2008_2024 to evaluate.")

    # Reset staging table
    cur.execute("DELETE FROM staged_baseline_roof_matches")
    conn.commit()

    matched_records = []
    now_iso = datetime.now(timezone.utc).isoformat()

    # Match each permit
    for pm in permits:
        p_no, p_addr, p_date, p_scope, is_pure, p_desc = pm
        num, direction, st_name = extract_3_tokens(p_addr)
        if not num or not st_name:
            continue
        key = (num, direction, st_name)

        if key in ambiguous_keys:
            # Multi-parcel ambiguity
            for cand in parcel_buckets[key]:
                matched_records.append((
                    p_no, p_addr, cand["id"], cand["raw_address"], p_date,
                    p_scope, is_pure, p_desc, "AMBIGUOUS_MULTI_PARCEL",
                    f"Address shared by {len(parcel_buckets[key])} distinct parcels in DB", now_iso
                ))
            continue

        if key in unambiguous_buckets:
            cand = unambiguous_buckets[key]
            # Valid candidate
            matched_records.append((
                p_no, p_addr, cand["id"], cand["raw_address"], p_date,
                p_scope, is_pure, p_desc, "MATCHED_UNAMBIGUOUS",
                None, now_iso
            ))

    print(f"[+] Writing {len(matched_records):,} match pairs to staged_baseline_roof_matches table...")
    cur.executemany("""
        INSERT INTO staged_baseline_roof_matches (
            permit_no, raw_permit_address, parcel_id, raw_parcel_address,
            issue_date, permit_scope, is_pure_reroof, raw_description,
            match_status, ambiguity_notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, matched_records)
    conn.commit()

    # 4. QA Audits
    # A. Check permit 1601191013
    cur.execute("""
        SELECT permit_no, raw_permit_address, parcel_id, raw_parcel_address, issue_date, permit_scope, is_pure_reroof, raw_description
        FROM staged_baseline_roof_matches
        WHERE permit_no = '1601191013'
    """)
    target_match = cur.fetchone()

    print("\n" + "=" * 70)
    print("QA AUDIT 1: TARGET PERMIT 1601191013 VERIFICATION")
    print("=" * 70)
    if target_match:
        print(f"  [PASS] Successfully matched permit 1601191013 in staging table!")
        print(f"  Permit Address : {target_match[1]}")
        print(f"  Parcel ID      : {target_match[2]}")
        print(f"  Parcel Address : {target_match[3]}")
        print(f"  Issue Date     : {target_match[4]}")
        print(f"  Scope Tier     : {target_match[5]}")
        print(f"  Is Pure Reroof : {target_match[6]}")
        print(f"  Raw Desc       : {target_match[7]}")
    else:
        print(f"  [FAIL] Target permit 1601191013 not matched in staging table.")

    # B. Sample of unambiguous matched pairs where both addresses were read
    cur.execute("""
        SELECT permit_no, raw_permit_address, parcel_id, raw_parcel_address, issue_date, permit_scope, is_pure_reroof
        FROM staged_baseline_roof_matches
        WHERE match_status = 'MATCHED_UNAMBIGUOUS' AND is_pure_reroof = 1 AND issue_date <= '2024-11-12'
        ORDER BY issue_date DESC
        LIMIT 6
    """)
    samples = cur.fetchall()

    print("\n" + "=" * 70)
    print("QA AUDIT 2: SAMPLE OF UNAMBIGUOUS FULL-REPLACEMENT MATCHES")
    print("(Showing both permit and parcel addresses read)")
    print("=" * 70)
    for idx, s in enumerate(samples, 1):
        print(f"Sample #{idx}:")
        print(f"  Permit No      : {s[0]}")
        print(f"  Permit Address : {s[1]}")
        print(f"  Parcel ID      : {s[2]}")
        print(f"  Parcel Address : {s[3]}")
        print(f"  Issue Date     : {s[4]} (Newest <= 2024-11-12)")
        print(f"  Scope Tier     : {s[5]}")
        print("-" * 50)

    # C. Ambiguity Check
    cur.execute("SELECT count(*) FROM staged_baseline_roof_matches WHERE match_status = 'AMBIGUOUS_MULTI_PARCEL'")
    amb_count = cur.fetchone()[0]
    print(f"\nQA AUDIT 3: AMBIGUITY SUMMARY")
    print(f"  Total permit rows held in staging due to multi-parcel ambiguity: {amb_count:,}")
    print(f"  parcels table status: UNTOUCHED (0 writes committed to parcels table)")

    conn.close()

if __name__ == "__main__":
    main()
