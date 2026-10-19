"""00 — schema inventory of the audit copy. Read-only."""
import sqlite3
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\00_schema_inventory.txt"

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
cur = conn.cursor()
lines = []
lines.append(f"RUN_UTC {datetime.now(timezone.utc).isoformat()}")
lines.append(f"DB {DB}")

tables = cur.execute(
    "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name"
).fetchall()
for name, typ in tables:
    if typ == "table":
        n = cur.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        lines.append(f"{typ}\t{name}\t{n}")
    else:
        lines.append(f"{typ}\t{name}")

lines.append("---COLUMNS---")
for name, typ in tables:
    if typ != "table":
        continue
    cols = cur.execute(f'PRAGMA table_info("{name}")').fetchall()
    coltxt = ", ".join(f"{c[1]}:{c[2]}" for c in cols)
    lines.append(f"{name} | {coltxt}")

text = "\n".join(lines) + "\n"
with open(OUT, "w", encoding="utf-8") as f:
    f.write(text)
print(text)
conn.close()
