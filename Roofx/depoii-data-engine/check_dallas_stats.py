import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()
cur.execute("SELECT category, count(*), min(issue_date), max(issue_date) FROM normalized_permits WHERE jurisdiction = 'Dallas, TX' GROUP BY category")
print("=== DALLAS PERMIT STATS IN LOCAL DB ===")
for r in cur.fetchall():
    print(r)
