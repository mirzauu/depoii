import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [r[0] for r in cur.fetchall()])

for tbl in ['contractor_profiles', 'contractor_market_shares', 'normalized_permits', 'parcels']:
    try:
        cur.execute(f"PRAGMA table_info({tbl})")
        print(f"Schema {tbl}:", [c[1] for c in cur.fetchall()][:8])
    except Exception as e:
        print(tbl, e)
