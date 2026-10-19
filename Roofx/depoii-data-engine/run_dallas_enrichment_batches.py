import os
import sys
import time
import json
import random
import argparse
import sqlite3
import httpx
from datetime import datetime, timezone
from enrich_stage2_dallas_worker import enrich_contractor

DB_PATH = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db"
STATE_FILE = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\dallas_enrichment_state.json"

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "current_batch": 0,
        "total_enriched": 0,
        "completed_ids": [],
        "last_run": None
    }

def save_state(state):
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def print_status_report():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN enrichment_status = 'enriched' THEN 1 END) as enriched,
            COUNT(CASE WHEN enrichment_status = 'no_web_presence' THEN 1 END) as no_web,
            COUNT(CASE WHEN enrichment_status = 'disqualified_non_roofer' THEN 1 END) as disq,
            COUNT(CASE WHEN enrichment_status IS NULL OR enrichment_status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN phone_number IS NOT NULL AND phone_number != '' THEN 1 END) as with_phone,
            COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as with_website,
            COUNT(CASE WHEN rcat_license_number IS NOT NULL AND rcat_license_number != '' THEN 1 END) as with_rcat,
            COUNT(CASE WHEN bbb_profile_url IS NOT NULL AND bbb_profile_url != '' THEN 1 END) as with_bbb
        FROM canonical_contractors
        WHERE LOWER(TRIM(headquarters_city)) = 'dallas'
    """)
    row = cur.fetchone()
    
    total = row[0]
    enriched = row[1]
    no_web = row[2]
    disq = row[3]
    pending = row[4]
    with_phone = row[5]
    with_website = row[6]
    with_rcat = row[7]
    with_bbb = row[8]
    
    processed = enriched + no_web + disq
    pct_processed = (processed / total * 100) if total else 0.0
    pct_enriched = (enriched / total * 100) if total else 0.0
    
    print("\n=======================================================")
    print("      DALLAS CONTRACTOR ENRICHMENT STATUS REPORT       ")
    print("=======================================================")
    print(f"Total Dallas Contractors:       {total:,}")
    print(f"Total Processed / Accounted:    {processed:,} ({pct_processed:.2f}%)")
    print(f"  - Verified Enriched Contacts: {enriched:,} ({pct_enriched:.2f}%)")
    print(f"  - No Commercial Web Presence: {no_web:,}")
    print(f"  - Disqualified Non-Roofers:   {disq:,}")
    print(f"Remaining Pending in Queue:     {pending:,}")
    print("-------------------------------------------------------")
    print("Detailed Verified Attribute Coverage:")
    print(f"  - Usable Phone Numbers:       {with_phone:,}")
    print(f"  - Official Websites:          {with_website:,}")
    print(f"  - BBB Profile / Ratings:      {with_bbb:,}")
    print(f"  - Official RCAT Licenses:     {with_rcat:,}")
    print("=======================================================\n")
    conn.close()

def run_batch(batch_size=50, dry_run=False):
    state = load_state()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Priority sorting:
    # 1. Names containing roof, waterproof, sheet metal, resto
    # 2. General construction / building
    # 3. By total_permits DESC, total_valuation DESC
    cur.execute("""
        SELECT id, canonical_name, total_permits, total_valuation
        FROM canonical_contractors
        WHERE LOWER(TRIM(headquarters_city)) = 'dallas'
          AND (enrichment_status IS NULL OR enrichment_status = 'pending')
        ORDER BY 
            CASE 
                WHEN LOWER(canonical_name) LIKE '%roof%' THEN 1
                WHEN LOWER(canonical_name) LIKE '%waterproof%' THEN 1
                WHEN LOWER(canonical_name) LIKE '%sheet metal%' THEN 1
                WHEN LOWER(canonical_name) LIKE '%restoration%' THEN 2
                WHEN LOWER(canonical_name) LIKE '%construction%' THEN 3
                WHEN LOWER(canonical_name) LIKE '%builder%' THEN 3
                ELSE 4
            END ASC,
            total_permits DESC,
            total_valuation DESC
        LIMIT ?
    """, (batch_size,))
    batch_records = cur.fetchall()
    
    if not batch_records:
        print("No pending Dallas contractors left to process! 100% Dallas coverage reached.")
        conn.close()
        return 0
        
    batch_num = state["current_batch"] + 1
    print(f"\n[BATCH #{batch_num}] Processing {len(batch_records)} Dallas contractors...")
    
    enriched_count = 0
    no_web_count = 0
    disq_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    
    with httpx.Client(timeout=10.0) as client:
        for idx, (c_id, c_name, permits, val) in enumerate(batch_records, 1):
            print(f"[{idx}/{len(batch_records)}] Searching: {c_name} (ID: {c_id}, Permits: {permits})...", end=" ", flush=True)
            res = enrich_contractor(c_id, c_name, client)
            status = res["status"]
            data = res.get("data", {})
            
            if status == "enriched":
                enriched_count += 1
                print(f"-> ENRICHED! (Phone: {data.get('phone_number')}, Web: {data.get('website_url')})")
            elif status == "disqualified_non_roofer":
                disq_count += 1
                print(f"-> DISQUALIFIED NON-ROOFER ({res.get('reason')})")
            else:
                no_web_count += 1
                print(f"-> NO ONLINE FOOTPRINT")
                
            if not dry_run:
                cur.execute("""
                    UPDATE canonical_contractors
                    SET website_url = COALESCE(?, website_url),
                        phone_number = COALESCE(?, phone_number),
                        hq_address = COALESCE(?, hq_address),
                        bbb_profile_url = COALESCE(?, bbb_profile_url),
                        bbb_rating = COALESCE(?, bbb_rating),
                        bbb_accredited = COALESCE(?, bbb_accredited),
                        enrichment_status = ?,
                        enrichment_updated_at = ?
                    WHERE id = ?
                """, (
                    data.get("website_url"),
                    data.get("phone_number"),
                    data.get("hq_address"),
                    data.get("bbb_profile_url"),
                    data.get("bbb_rating"),
                    data.get("bbb_accredited"),
                    status,
                    now_iso,
                    c_id
                ))
                state["completed_ids"].append(c_id)
                
            # Random jitter to prevent IP blocks
            time.sleep(random.uniform(1.2, 2.5))
            
    if not dry_run:
        conn.commit()
        state["current_batch"] = batch_num
        state["total_enriched"] += enriched_count
        save_state(state)
        print(f"\nBatch #{batch_num} committed to database.")
        print(f"Summary: {enriched_count} Enriched, {no_web_count} No Web Presence, {disq_count} Disqualified Non-Roofers.")
        
    conn.close()
    return len(batch_records)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dallas Contractor Enrichment Batch Runner")
    parser.add_argument("--batch-size", type=int, default=15, help="Batch size (default: 15)")
    parser.add_argument("--status-report", action="store_true", help="Print status report")
    parser.add_argument("--dry-run", action="store_true", help="Dry run without writing to DB")
    parser.add_argument("--continuous", action="store_true", help="Run continuously until queue empty")
    args = parser.parse_args()
    
    if args.status_report:
        print_status_report()
    elif args.continuous:
        while True:
            processed = run_batch(args.batch_size, args.dry_run)
            print_status_report()
            if processed == 0:
                break
            time.sleep(3)
    else:
        run_batch(args.batch_size, args.dry_run)
        print_status_report()
