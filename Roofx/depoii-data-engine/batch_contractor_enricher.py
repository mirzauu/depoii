import os
import sys
import time
import json
import sqlite3
import re
import argparse
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "enrichment_checkpoint.json")

# Regional phone area codes for accurate regional synthesis
AREA_CODES = {
    "NY": "212",
    "WA": "206",
    "TX": "214",
    "FL": "352",
    "OH": "513",
}

DEFAULT_CITIES = {
    "NY": "New York, NY",
    "WA": "Seattle, WA",
    "TX": "Dallas, TX",
    "FL": "Gainesville, FL",
    "OH": "Cincinnati, OH",
}

CERTIFICATIONS_POOL = [
    ["Carlisle SynTec ESP Award", "Elevate Master Contractor", "GAF Master Select"],
    ["Johns Manville Peak Advantage", "Firestone Building Products Master", "Sika Sarnafil Elite"],
    ["Carlisle Centurion", "Versico Gold Medal Contractor", "GAF Commercial Certified"],
    ["SOPREMA Alliance Partner", "Mule-Hide Certified Warranty Contractor", "Duro-Last Master Contractor"],
    ["Elevate UltraPly Partner", "Carlisle SynTec Excellence", "Johns Manville Certified"]
]

FIRST_NAMES = ["Michael", "David", "Robert", "James", "John", "Thomas", "Richard", "Charles", "Daniel", "Matthew", "Brian", "William", "Christopher", "Joseph"]
LAST_NAMES = ["Miller", "Anderson", "Taylor", "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill"]

def clean_tokens(name: str):
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    ignore = {'inc', 'corp', 'llc', 'ltd', 'co', 'group', 'the', 'and', 'roofing', 'construction', 'contractor', 'contractors', 'services', 'systems', 'corporation', 'express', 'p', 'h', 'company'}
    tokens = [w for w in clean.split() if w not in ignore]
    return tokens

def derive_domain(name: str):
    tokens = clean_tokens(name)
    if not tokens:
        # Fallback to sanitized raw letters
        base = re.sub(r'[^a-zA-Z0-9]', '', name.lower())[:12]
        return f"{base}roofing.com" if base else "commercialroofingpro.com"
    
    if len(tokens) == 1:
        return f"{tokens[0]}roofing.com"
    elif len(tokens) == 2:
        return f"{tokens[0]}{tokens[1]}.com"
    else:
        return f"{tokens[0]}{tokens[1]}group.com"

def generate_enrichment_profile(row):
    _cid, name, state, total_val, total_permits = row
    _ = (name, state, total_val, total_permits)
    return {
        "website_url": None,
        "phone_number": None,
        "hq_address": None,
        "year_founded": None,
        "crew_capacity_estimate": None,
        "manufacturer_certifications": None,
        "leadership": None,
        "m_and_a_profile": None,
    }


def get_un_enriched_contractors(limit=50):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    query = """
        SELECT id, canonical_name, headquarters_state, total_valuation, total_permits
        FROM canonical_contractors
        WHERE website_url IS NULL
          AND LOWER(canonical_name) NOT LIKE '%licensed commercial contractor%'
          AND LOWER(canonical_name) NOT LIKE '%self-contracted%'
        ORDER BY total_valuation DESC, total_permits DESC
        LIMIT ?
    """
    c.execute(query, (limit,))
    rows = c.fetchall()
    conn.close()
    return rows

def count_remaining():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT COUNT(*)
        FROM canonical_contractors
        WHERE website_url IS NULL
          AND LOWER(canonical_name) NOT LIKE '%licensed commercial contractor%'
          AND LOWER(canonical_name) NOT LIKE '%self-contracted%'
    """)
    cnt = c.fetchone()[0]
    conn.close()
    return cnt

def count_enriched():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM canonical_contractors WHERE website_url IS NOT NULL")
    cnt = c.fetchone()[0]
    conn.close()
    return cnt

def update_batch(enriched_records):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    sql = """
        UPDATE canonical_contractors
        SET website_url = :website_url,
            phone_number = :phone_number,
            hq_address = :hq_address,
            year_founded = :year_founded,
            crew_capacity_estimate = :crew_capacity_estimate,
            manufacturer_certifications = :manufacturer_certifications,
            leadership = :leadership,
            m_and_a_profile = :m_and_a_profile,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :id
    """
    c.executemany(sql, enriched_records)
    conn.commit()
    conn.close()

def main():
    raise SystemExit("Contractor enrichment is disabled. Contact fields need a fetched source.")
    parser = argparse.ArgumentParser(description="Autonomous Batch Contractor Enrichment Engine")
    parser.add_argument("--batch-size", type=int, default=50, help="Number of contractors per batch")
    parser.add_argument("--break-minutes", type=float, default=5.0, help="Cooldown minutes between batches")
    parser.add_argument("--max-batches", type=int, default=0, help="Stop after N batches (0 for all)")
    args = parser.parse_args()

    batch_size = args.batch_size
    break_seconds = int(args.break_minutes * 60)
    max_batches = args.max_batches

    print("=" * 70)
    print(">> DEPOII COMMERCIAL CONTRACTOR ENRICHMENT RUNNER")
    print(f"   Batch Size:      {batch_size} companies/batch")
    print(f"   Cooldown Pause:  {args.break_minutes} minutes ({break_seconds} seconds)")
    print(f"   Database:        {DB_PATH}")
    print("=" * 70)

    total_remaining = count_remaining()
    total_already_enriched = count_enriched()
    print(f"[*] Starting state: {total_already_enriched} enriched | {total_remaining} pending enrichment\n")

    batch_num = 1
    total_processed_session = 0

    while True:
        rows = get_un_enriched_contractors(limit=batch_size)
        if not rows:
            print("\n[!] ALL CONTRACTORS IN THE DATABASE ARE FULLY ENRICHED!")
            break

        print(f"--- [BATCH #{batch_num}] Processing {len(rows)} commercial contractors ---")
        enriched_records = []
        for r in rows:
            cid = r[0]
            name = r[1]
            profile = generate_enrichment_profile(r)
            profile["id"] = cid
            enriched_records.append(profile)
            print(f"  + Enriched: {name[:36].ljust(38)} -> {profile['website_url']} | {profile['phone_number']}")

        # Commit to DB
        update_batch(enriched_records)
        total_processed_session += len(enriched_records)

        # Check remaining
        remaining = count_remaining()
        enriched_count = count_enriched()
        print(f"[OK] Batch #{batch_num} committed to database.")
        print(f"   Progress: {enriched_count} total enriched | {remaining} remaining.")

        # Save checkpoint
        checkpoint = {
            "last_batch": batch_num,
            "last_run": datetime.utcnow().isoformat(),
            "total_enriched": enriched_count,
            "remaining": remaining
        }
        with open(CHECKPOINT_PATH, "w") as f:
            json.dump(checkpoint, f, indent=2)

        if remaining == 0:
            print("\n[DONE] Completed 100% of commercial contractors!")
            break

        if max_batches > 0 and batch_num >= max_batches:
            print(f"\nReached max specified batches ({max_batches}). Stopping.")
            break

        batch_num += 1

        print(f"\n[PAUSE] Cooling down for {args.break_minutes} minutes before next batch...")
        for remaining_sec in range(break_seconds, 0, -10):
            sys.stdout.write(f"\r   Next batch starting in: {remaining_sec // 60}m {remaining_sec % 60:02d}s... ")
            sys.stdout.flush()
            time.sleep(min(10, remaining_sec))
        print("\n")

if __name__ == "__main__":
    main()
