import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db"

def upgrade_schema():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("PRAGMA table_info(canonical_contractors)")
    cols = [r[1] for r in cur.fetchall()]
    
    # 1. Add enrichment_status
    if "enrichment_status" not in cols:
        print("Adding column 'enrichment_status' to canonical_contractors...")
        cur.execute("ALTER TABLE canonical_contractors ADD COLUMN enrichment_status TEXT DEFAULT 'pending'")
    else:
        print("Column 'enrichment_status' already exists.")
        
    # 2. Add enrichment_updated_at
    if "enrichment_updated_at" not in cols:
        print("Adding column 'enrichment_updated_at' to canonical_contractors...")
        cur.execute("ALTER TABLE canonical_contractors ADD COLUMN enrichment_updated_at TEXT")
    else:
        print("Column 'enrichment_updated_at' already exists.")
        
    conn.commit()
    
    # 3. Backfill existing enriched contractors
    cur.execute("""
        UPDATE canonical_contractors
        SET enrichment_status = 'enriched',
            enrichment_updated_at = ?
        WHERE (phone_number IS NOT NULL AND phone_number != '')
           OR (website_url IS NOT NULL AND website_url != '')
           OR (rcat_license_number IS NOT NULL AND rcat_license_number != '')
           OR (bbb_rating IS NOT NULL AND bbb_rating != '')
           OR (linkedin_company_url IS NOT NULL AND linkedin_company_url != '')
    """, (datetime.now(timezone.utc).isoformat(),))
    enriched_count = cur.rowcount
    print(f"Backfilled {enriched_count} existing enriched contractors with status='enriched'.")
    
    # 4. Check Dallas contractor status distribution
    cur.execute("""
        SELECT COALESCE(enrichment_status, 'pending'), COUNT(*)
        FROM canonical_contractors
        WHERE LOWER(TRIM(headquarters_city)) = 'dallas'
        GROUP BY COALESCE(enrichment_status, 'pending')
    """)
    print("Dallas Contractors by enrichment_status:")
    for status, cnt in cur.fetchall():
        print(f"  - {status}: {cnt}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    upgrade_schema()
