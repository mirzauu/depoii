import sqlite3
import re

DB_PATH = "depoii_local.db"

def run_permit_cleaning_migration():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("[*] Checking normalized_permits schema...")
    cur.execute("PRAGMA table_info(normalized_permits)")
    cols = [c[1] for c in cur.fetchall()]

    if "permit_scope" not in cols:
        print("[+] Adding permit_scope column...")
        cur.execute("ALTER TABLE normalized_permits ADD COLUMN permit_scope TEXT DEFAULT 'GENERAL_COMMERCIAL'")
    if "is_pure_reroof" not in cols:
        print("[+] Adding is_pure_reroof column...")
        cur.execute("ALTER TABLE normalized_permits ADD COLUMN is_pure_reroof INTEGER DEFAULT 0")
    if "calibrated_roof_valuation" not in cols:
        print("[+] Adding calibrated_roof_valuation column...")
        cur.execute("ALTER TABLE normalized_permits ADD COLUMN calibrated_roof_valuation REAL DEFAULT 0.0")

    print("[*] Fetching all permits for classification...")
    cur.execute("SELECT id, raw_description, category, valuation, square_footage FROM normalized_permits")
    rows = cur.fetchall()

    updates = []
    scope_counts = {}
    calibrated_total = 0.0
    original_total = 0.0

    for pid, desc, cat, val, sqft in rows:
        val = val or 0.0
        sqft = sqft or 0.0
        original_total += val

        desc_clean = (desc or "").upper()
        cat_clean = (cat or "").upper()

        # Pure Reroof
        if any(k in desc_clean for k in ["RE-ROOF", "REROOF", "ROOF REPLACEMENT", "TEAR OFF", "RECOVER", "OVERLAY", "SHINGLES", "TPO", "EPDM", "MOD BIT", "STANDING SEAM", "BUILT-UP ROOF"]) or ("RE-ROOF" in cat_clean or "REROOF" in cat_clean):
            scope = "COMMERCIAL_REROOF"
            is_reroof = 1
            # If valuation is realistic (> $1000 and < $15M), keep it. If missing/0, estimate via sqft * $14
            if 1000 <= val <= 15_000_000:
                cal_val = val
            elif sqft > 0:
                cal_val = sqft * 14.50
            else:
                cal_val = min(val, 2_500_000.0) if val > 0 else 150_000.0

        elif any(k in desc_clean for k in ["ROOF REPAIR", "LEAK REPAIR", "ROOF COATING", "PATCH ROOF"]):
            scope = "ROOF_REPAIR"
            is_reroof = 1
            cal_val = min(val, 500_000.0) if val > 0 else 25_000.0

        elif any(k in desc_clean for k in ["NEW CONSTRUCTION", "NEW:", "CORE AND SHELL", "GROUND UP", "CONSTRUCT A", "NEW BUILDING", "FOOTING", "FOUNDATION"]):
            scope = "NEW_CONSTRUCTION"
            is_reroof = 0
            # Roofing subcontract is ~4.5% of total shell construction cost
            if sqft > 0:
                cal_val = sqft * 14.50
            else:
                cal_val = min(val * 0.045, 3_000_000.0)

        elif any(k in desc_clean for k in ["FINISH-OUT", "FINISHOUT", "TENANT IMPROVEMENT", "INTERIOR REMODEL", "ALTERATION", "REMODEL", "PLUMBING", "ELECTRICAL", "HVAC"]):
            scope = "INTERIOR_OR_GENERAL_ALTERATION"
            is_reroof = 0
            cal_val = 0.0 # Non-roof scope

        else:
            scope = "GENERAL_COMMERCIAL"
            is_reroof = 0
            cal_val = min(val * 0.08, 1_000_000.0) if val > 0 else 0.0

        scope_counts[scope] = scope_counts.get(scope, 0) + 1
        calibrated_total += cal_val
        updates.append((scope, is_reroof, cal_val, pid))

    print("[*] Writing classifications back to database...")
    cur.executemany("""
        UPDATE normalized_permits
        SET permit_scope = ?, is_pure_reroof = ?, calibrated_roof_valuation = ?
        WHERE id = ?
    """, updates)

    conn.commit()

    print("\n" + "="*70)
    print("PERMIT SCRUB AUDIT RESULTS (ALL 93,508 PERMITS)")
    print("="*70)
    for sc, cnt in sorted(scope_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {sc:<32}: {cnt:>6,} permits ({cnt/len(rows)*100:.1f}%)")

    print("\n" + "-"*70)
    print(f"Original Raw Construction Valuation  : ${original_total / 1e9:.2f} Billion")
    print(f"Calibrated Commercial Roofing Scope   : ${calibrated_total / 1e9:.2f} Billion")
    print("-" * 70)

    # Fort Worth specific after scrub
    cur.execute("""
        SELECT COUNT(*), 
               COUNT(CASE WHEN is_pure_reroof = 1 THEN 1 END) as reroofs,
               ROUND(SUM(valuation)/1e6, 2) as raw_m,
               ROUND(SUM(calibrated_roof_valuation)/1e6, 2) as cal_m
        FROM normalized_permits
        WHERE jurisdiction LIKE '%Fort Worth%'
    """)
    fw = cur.fetchone()
    print(f"Fort Worth Raw Valuation             : ${fw[2]:,.2f}M across {fw[0]:,} permits")
    print(f"Fort Worth Calibrated Roofing Scope   : ${fw[3]:,.2f}M (Pure reroofs: {fw[1]:,})")

    # Dallas specific after scrub
    cur.execute("""
        SELECT COUNT(*), 
               COUNT(CASE WHEN is_pure_reroof = 1 THEN 1 END) as reroofs,
               ROUND(SUM(valuation)/1e6, 2) as raw_m,
               ROUND(SUM(calibrated_roof_valuation)/1e6, 2) as cal_m
        FROM normalized_permits
        WHERE jurisdiction LIKE '%Dallas%'
    """)
    dl = cur.fetchone()
    print(f"Dallas Raw Valuation                 : ${dl[2]:,.2f}M across {dl[0]:,} permits")
    print(f"Dallas Calibrated Roofing Scope       : ${dl[3]:,.2f}M (Pure reroofs: {dl[1]:,})")

    conn.close()

if __name__ == "__main__":
    run_permit_cleaning_migration()
