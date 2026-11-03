import sqlite3
import json
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.getcwd(), "Roofx", "depoii-data-engine", "depoii_local.db")
VERIFIED_PATH = os.path.join(os.getcwd(), "data", "dallas_contractors_100pct_verified.json")

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def sync_sqlite():
    if not os.path.exists(DB_PATH):
        print(f"SQLite DB not found: {DB_PATH}")
        return
    if not os.path.exists(VERIFIED_PATH):
        print(f"Verified JSON not found: {VERIFIED_PATH}")
        return

    with open(VERIFIED_PATH, "r", encoding="utf-8") as f:
        verified_contractors = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    now_iso = datetime.now(timezone.utc).isoformat()
    updated_count = 0
    inserted_count = 0

    print("=======================================================")
    print("  SYNCING TO SQLITE (depoii_local.db: canonical_contractors)")
    print("=======================================================")

    for c in verified_contractors:
        cname = c.get("name", "").strip()
        if not cname:
            continue

        cur.execute("SELECT id FROM canonical_contractors WHERE LOWER(canonical_name) = LOWER(?) LIMIT 1", (cname,))
        row = cur.fetchone()

        web = c.get("website_url") or None
        bbb_url = c.get("bbb_profile_url") or None
        bbb_rating = c.get("bbb_rating") or None
        linkedin = c.get("linkedin_company_url") or None
        rcat_url = c.get("rcat_profile_url") or None
        rcat_lic = c.get("rcat_license") or None
        phone = c.get("phone_number") or None
        crew = c.get("workers_capacity") or None
        permits = int(c.get("permits") or 1)
        valuation = float(c.get("valuation") or 0.0)

        if row:
            cid = row[0]
            cur.execute("""
                UPDATE canonical_contractors
                SET website_url = ?,
                    bbb_profile_url = ?,
                    bbb_rating = ?,
                    linkedin_company_url = ?,
                    rcat_profile_url = ?,
                    rcat_license_number = ?,
                    phone_number = ?,
                    crew_capacity_estimate = ?,
                    enrichment_status = '100PCT_VERIFIED_5STEP',
                    enrichment_updated_at = ?,
                    updated_at = ?
                WHERE id = ?
            """, (web, bbb_url, bbb_rating, linkedin, rcat_url, rcat_lic, phone, crew, now_iso, now_iso, cid))
            updated_count += 1
        else:
            cid = f"CTR-DAL-{cname.upper()[:20].replace(' ', '-')}"
            cur.execute("""
                INSERT INTO canonical_contractors (
                    id, canonical_name, website_url, bbb_profile_url, bbb_rating,
                    linkedin_company_url, rcat_profile_url, rcat_license_number,
                    phone_number, crew_capacity_estimate, total_permits, total_valuation,
                    enrichment_status, enrichment_updated_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '100PCT_VERIFIED_5STEP', ?, ?, ?)
            """, (cid, cname, web, bbb_url, bbb_rating, linkedin, rcat_url, rcat_lic, phone, crew, permits, valuation, now_iso, now_iso, now_iso))
            inserted_count += 1

    conn.commit()

    print(f"✔ SQLite Sync Complete:")
    print(f"   - Updated: {updated_count} existing records")
    print(f"   - Inserted: {inserted_count} new records")

    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN enrichment_status = '100PCT_VERIFIED_5STEP' THEN 1 END) as verified,
            COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as with_web,
            COUNT(CASE WHEN bbb_profile_url IS NOT NULL AND bbb_profile_url != '' THEN 1 END) as with_bbb,
            COUNT(CASE WHEN phone_number IS NOT NULL AND phone_number != '' THEN 1 END) as with_phone
        FROM canonical_contractors
    """)
    stats = cur.fetchone()
    print("\nUpdated SQLite canonical_contractors Stats:")
    print(f"  Total: {stats[0]} | 100% Verified: {stats[1]} | Live Websites: {stats[2]} | Live BBB: {stats[3]} | Phone: {stats[4]}")

    conn.close()

if __name__ == "__main__":
    sync_sqlite()
