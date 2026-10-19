import sqlite3

conn = sqlite3.connect(r"Roofx/depoii-data-engine/depoii_local.db")
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Matching tables in depoii_local.db:")
for t in tables:
    if any(k in t.lower() for k in ["storm", "spc", "hail", "staged", "lead"]):
        cur.execute(f"SELECT count(*) FROM {t}")
        cnt = cur.fetchone()[0]
        print(f"  {t}: {cnt} rows")

conn.close()
