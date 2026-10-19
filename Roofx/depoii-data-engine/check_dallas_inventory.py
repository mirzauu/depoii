import sqlite3

def check_db(path, name):
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    print(f"=== {name} ({path}) ===")
    
    # 1. Parcels in Dallas
    try:
        cur.execute("SELECT count(*) FROM parcels WHERE city = 'Dallas' OR jurisdiction LIKE '%Dallas%'")
        print("  Dallas parcels:", cur.fetchone()[0])
    except Exception as e:
        print("  Parcels error:", e)

    # 2. Check last_reroof_date
    try:
        cur.execute("SELECT count(*) FROM parcels WHERE last_reroof_date IS NOT NULL")
        print("  Parcels with last_reroof_date:", cur.fetchone()[0])
    except Exception:
        print("  last_reroof_date column not present")

    # 3. Permits count
    for tbl in ["permits", "normalized_permits"]:
        try:
            cur.execute(f"SELECT count(*) FROM {tbl} WHERE city = 'Dallas' OR jurisdiction LIKE '%Dallas%'")
            print(f"  {tbl} in Dallas:", cur.fetchone()[0])
        except Exception:
            pass

    # 4. Contractors
    for tbl in ["contractors", "canonical_contractors"]:
        try:
            cur.execute(f"SELECT count(*) FROM {tbl}")
            print(f"  {tbl} total:", cur.fetchone()[0])
        except Exception:
            pass

    # 5. Roofers in Dallas / TX
    for tbl in ["contractors", "canonical_contractors"]:
        try:
            cur.execute(f"""
                SELECT count(*) FROM {tbl} 
                WHERE (canonical_name LIKE '%ROOF%' OR canonical_name LIKE '%SHEET METAL%' OR services LIKE '%roof%')
            """)
            print(f"  {tbl} roofing companies:", cur.fetchone()[0])
        except Exception:
            pass

    conn.close()
    print()

check_db(r"data/depoii.sqlite", "App Database (data/depoii.sqlite)")
check_db(r"Roofx/depoii-data-engine/depoii_local.db", "Engine Database (depoii_local.db)")
