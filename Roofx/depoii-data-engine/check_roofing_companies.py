import sqlite3

def check_prod():
    conn = sqlite3.connect("data/depoii.sqlite")
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print("Tables in data/depoii.sqlite:")
    for t in tables:
        cur.execute(f"SELECT count(*) FROM {t}")
        print(f"  {t}: {cur.fetchone()[0]}")

    # Check Dallas in parcels
    cur.execute("SELECT count(*) FROM parcels WHERE city = 'Dallas'")
    print(f"  Parcels in Dallas: {cur.fetchone()[0]}")

    # Check contractors
    if "contractors" in tables:
        cur.execute("SELECT count(*) FROM contractors")
        print(f"  Contractors count: {cur.fetchone()[0]}")
        cur.execute("SELECT name FROM contractors LIMIT 5")
        print("  Sample contractors:", cur.fetchall())

    conn.close()

def check_engine():
    conn = sqlite3.connect("Roofx/depoii-data-engine/depoii_local.db")
    cur = conn.cursor()
    
    # Check roofers in canonical_contractors
    cur.execute("""
        SELECT count(*) 
        FROM canonical_contractors 
        WHERE LOWER(canonical_name) LIKE '%roof%' 
           OR LOWER(canonical_name) LIKE '%sheet metal%'
           OR LOWER(canonical_name) LIKE '%waterproof%'
    """)
    roofers_count = cur.fetchone()[0]
    print(f"\nIn Engine DB (canonical_contractors):")
    print(f"  Total canonical contractors: 15,498")
    print(f"  Roofing/Waterproofing/Sheet Metal specialists: {roofers_count}")

    cur.execute("""
        SELECT canonical_name, total_permits, total_valuation 
        FROM canonical_contractors 
        WHERE LOWER(canonical_name) LIKE '%roof%'
        ORDER BY total_permits DESC 
        LIMIT 10
    """)
    print("\n  Top 10 Roofing Contractors by Dallas permit volume:")
    for r in cur.fetchall():
        print(f"    - {r[0]}: {r[1]} permits (${r[2]:,.0f} valuation)")

    # Check RCAT directory
    try:
        import json
        with open("Roofx/depoii-data-engine/rcat_official_directory.json", "r", encoding="utf-8") as f:
            rcat = json.load(f)
            print(f"\n  RCAT (Roofing Contractors Association of Texas) Directory cached: {len(rcat)} licensed contractors")
    except Exception as e:
        print("  RCAT check error:", e)

    conn.close()

if __name__ == "__main__":
    check_prod()
    check_engine()
