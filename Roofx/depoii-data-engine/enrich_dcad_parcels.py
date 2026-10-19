"""
DCAD Commercial Roll Enricher
----------------------------
Streams COM_DETAIL.CSV from data/dcad/DCAD2026_CURRENT.ZIP and populates
building_sqft, year_built, footprint_sqft, stories, property_type, and
improvement_sections for all Dallas County parcels in depoii_local.db.
"""

import os
import sys
import json
import sqlite3
import subprocess
import csv
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
ZIP_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "dcad", "DCAD2026_CURRENT.ZIP")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)
    if not os.path.exists(ZIP_PATH):
        print(f"Error: DCAD zip archive not found at {ZIP_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Load all parcel account numbers that belong to Dallas jurisdiction or Dallas County
    cur.execute("""
        SELECT id, account_number, city
        FROM parcels
        WHERE state = 'TX'
    """)
    target_rows = cur.fetchall()
    print(f"[+] Loaded {len(target_rows):,} target Dallas County parcels from depoii_local.db")

    # Map account_number -> list of parcel IDs (cleaning dashes/spaces)
    acct_to_pids = {}
    for pid, acct, city in target_rows:
        if not acct:
            continue
        clean_acct = str(acct).strip().replace("-", "")
        if clean_acct not in acct_to_pids:
            acct_to_pids[clean_acct] = []
        acct_to_pids[clean_acct].append(pid)

    print(f"[+] Unique account numbers to match: {len(acct_to_pids):,}")

    # 2. Stream COM_DETAIL.CSV from zip
    print(f"[+] Streaming COM_DETAIL.CSV from {ZIP_PATH}...")
    cmd = ["tar", "-xOf", ZIP_PATH, "COM_DETAIL.CSV"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")

    reader = csv.DictReader(proc.stdout)
    
    # Aggregate data by account_number
    # account -> list of sections
    bldg_data = {}
    total_records_scanned = 0

    for row in reader:
        total_records_scanned += 1
        raw_acct = row.get("ACCOUNT_NUM", "").strip().replace("-", "")
        if raw_acct in acct_to_pids:
            if raw_acct not in bldg_data:
                bldg_data[raw_acct] = []
            
            try:
                area = int(float(row.get("GROSS_BLDG_AREA") or 0))
            except ValueError:
                area = 0

            try:
                found_area = int(float(row.get("FOUNDATION_AREA") or 0))
            except ValueError:
                found_area = 0

            try:
                yr = int(float(row.get("YEAR_BUILT") or 0))
            except ValueError:
                yr = 0

            try:
                stories = float(row.get("NUM_STORIES") or 1.0)
            except ValueError:
                stories = 1.0

            bldg_data[raw_acct].append({
                "description": row.get("BLDG_CLASS_DESC", "").strip(),
                "area_sqft": area,
                "year_built": yr,
                "foundation_sqft": found_area,
                "stories": stories,
                "prop_name": row.get("PROPERTY_NAME", "").strip(),
                "constr_type": row.get("CONSTR_TYP_DESC", "").strip()
            })

    proc.stdout.close()
    proc.wait()

    print(f"[+] Scanned {total_records_scanned:,} commercial records in roll.")
    print(f"[+] Successfully matched {len(bldg_data):,} accounts in depoii_local.db!")

    # 3. Update database in bulk
    updates = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for acct, sections in bldg_data.items():
        total_sqft = sum(s["area_sqft"] for s in sections)
        total_footprint = sum(s["foundation_sqft"] for s in sections)
        valid_years = [s["year_built"] for s in sections if s["year_built"] > 1800]
        year_built = min(valid_years) if valid_years else None
        max_stories = max(s["stories"] for s in sections) if sections else 1.0
        
        # Primary description
        primary_desc = sections[0]["description"] if sections else "Commercial"

        improvement_json = json.dumps([{
            "description": s["description"],
            "area_sqft": s["area_sqft"],
            "year_built": s["year_built"],
            "foundation_sqft": s["foundation_sqft"],
            "stories": s["stories"]
        } for s in sections])

        for pid in acct_to_pids[acct]:
            updates.append((
                total_sqft if total_sqft > 0 else None,
                total_footprint if total_footprint > 0 else None,
                year_built,
                max_stories,
                primary_desc,
                improvement_json,
                now_iso,
                "DCAD Certified 2026 Commercial Roll",
                pid
            ))

    print(f"[+] Applying {len(updates):,} parcel updates...")
    cur.executemany("""
        UPDATE parcels
        SET building_sqft = COALESCE(?, building_sqft),
            footprint_sqft = COALESCE(?, footprint_sqft),
            year_built = COALESCE(?, year_built),
            stories = COALESCE(?, stories),
            property_type = CASE WHEN property_type IS NULL OR property_type = '' OR property_type = 'Commercial' THEN ? ELSE property_type END,
            improvement_sections = ?,
            enriched_at = ?,
            building_sqft_source = ?,
            year_built_source = ?
        WHERE id = ?
    """, [(u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7], u[7], u[8]) for u in updates])

    conn.commit()

    # 4. Verification summary
    cur.execute("""
        SELECT city,
               count(*) as total,
               count(building_sqft) as with_sqft,
               count(CASE WHEN building_sqft >= 25000 THEN 1 END) as target_25k,
               round(avg(building_sqft)) as avg_bldg_sqft
        FROM parcels
        WHERE state = 'TX' AND (county = 'Dallas County' OR jurisdiction = 'Dallas, TX')
        GROUP BY city
        ORDER BY target_25k DESC
        LIMIT 15
    """)
    summary = cur.fetchall()

    print("\n" + "="*70)
    print("SECTOR ENRICHMENT VERIFICATION SUMMARY")
    print("="*70)
    print(f"{'City':<18} | {'Total':<6} | {'With SqFt':<10} | {'>= 25k SqFt':<11} | {'Avg Bldg SqFt'}")
    print("-" * 70)
    for row in summary:
        print(f"{row[0]:<18} | {row[1]:<6} | {row[2]:<10} | {row[3]:<11} | {row[4] or 0:,.0f} sqft")

    conn.close()
    print("\n[OK] DCAD certified commercial roll enrichment completed successfully!")

if __name__ == "__main__":
    main()
