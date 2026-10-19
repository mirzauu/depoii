import sqlite3
import json

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]

summary = {}
for t in tables:
    cur.execute(f'PRAGMA table_info("{t}")')
    cols = [c[1] for c in cur.fetchall()]
    cur.execute(f'SELECT count(*) FROM "{t}"')
    count = cur.fetchone()[0]
    summary[t] = {"count": count, "columns": cols}

print(json.dumps(summary, indent=2))
