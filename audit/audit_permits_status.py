import sqlite3
import os

engine_db_path = os.path.join(os.path.dirname(__file__), "..", "Roofx", "depoii-data-engine", "depoii_local.db")
next_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "depoii.sqlite")

print("=" * 70)
print("DEPOII PERMIT AUDIT REPORT (ENGINE DB & NEXT.JS DB)")
print("=" * 70)

# 1. ENGINE DB
if os.path.exists(engine_db_path):
    c_eng = sqlite3.connect(engine_db_path)
    cur = c_eng.cursor()
    
    total = cur.execute("SELECT count(*) FROM normalized_permits").fetchone()[0]
    tx_total = cur.execute("SELECT count(*) FROM normalized_permits WHERE state = 'TX'").fetchone()[0]
    print(f"\n[ENGINE DB: depoii_local.db]")
    print(f"Total Normalized Permits: {total:,}")
    print(f"Texas Permits: {tx_total:,}")

    print("\nPermits by State:")
    for r in cur.execute("SELECT state, count(*) FROM normalized_permits GROUP BY state ORDER BY count(*) DESC").fetchall():
        print(f"  {r[0] or 'NULL':<8}: {r[1]:,}")

    print("\nTexas Municipal Permits by City:")
    q_city = """
    SELECT city, 
           count(*) as total, 
           count(CASE WHEN parcel_id IS NOT NULL AND parcel_id != '' THEN 1 END) as linked,
           count(CASE WHEN is_pure_reroof = 1 THEN 1 END) as reroof,
           min(issue_date) as earliest,
           max(issue_date) as latest
    FROM normalized_permits 
    WHERE state = 'TX' 
    GROUP BY city 
    ORDER BY total DESC
    """
    for r in cur.execute(q_city).fetchall():
        print(f"  {r[0] or 'Unknown':<16} | Total: {r[1]:<6} | Linked to Parcel: {r[2]:<6} | Pure Reroof: {r[3]:<6} | Dates: {r[4]} to {r[5]}")

    linked_tx = cur.execute("SELECT count(*) FROM normalized_permits WHERE state = 'TX' AND parcel_id IS NOT NULL AND parcel_id != ''").fetchone()[0]
    print(f"\nCurrently Linked Texas Permits: {linked_tx:,} / {tx_total:,} ({linked_tx/tx_total*100:.1f}%)")

    # Check how many permits can be matched against ALL parcels in depoii_local.db
    cur.execute("SELECT count(*) FROM parcels WHERE state = 'TX'")
    p_cnt = cur.execute("SELECT count(*) FROM parcels WHERE state = 'TX'").fetchone()[0]
    print(f"Total Texas Commercial Parcels in Master Table: {p_cnt:,}")

    # Check how many distinct parcels currently have a permit linked to them
    parcels_with_permits = cur.execute("SELECT count(DISTINCT parcel_id) FROM normalized_permits WHERE state = 'TX' AND parcel_id IS NOT NULL AND parcel_id != ''").fetchone()[0]
    print(f"Distinct Commercial Parcels with At Least 1 Linked Permit: {parcels_with_permits:,}")
    c_eng.close()

# 2. NEXT.JS DB
if os.path.exists(next_db_path):
    c_nxt = sqlite3.connect(next_db_path)
    cur2 = c_nxt.cursor()
    print("\n" + "=" * 70)
    print("[NEXT.JS DB: data/depoii.sqlite]")
    tables = [r[0] for r in cur2.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print(f"Tables in depoii.sqlite: {tables}")
    
    for t in ["permits", "parcels", "commercial_parcels", "leads", "storm_events"]:
        if t in tables:
            cnt = cur2.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
            print(f"Table '{t}': {cnt:,} rows")
            cols = [c[1] for c in cur2.execute(f"PRAGMA table_info({t})").fetchall()]
            print(f"  Columns: {cols[:8]}")

    if "permits" in tables:
        total_p = cur2.execute("SELECT count(*) FROM permits").fetchone()[0]
        linked_p = cur2.execute("SELECT count(*) FROM permits WHERE parcel_account IS NOT NULL AND parcel_account != ''").fetchone()[0] if "parcel_account" in [c[1] for c in cur2.execute("PRAGMA table_info(permits)").fetchall()] else 0
        print(f"Permits in Next.js DB: {total_p:,} | Linked: {linked_p:,}")
    c_nxt.close()
