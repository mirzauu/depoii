import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()
cur.execute("SELECT category, count(*) FROM normalized_permits WHERE jurisdiction = 'Fort Worth, TX' GROUP BY category")
print("Fort Worth Categories:", cur.fetchall())

cur.execute("SELECT raw_permit_number, normalized_address, issue_date, raw_description FROM normalized_permits WHERE jurisdiction = 'Fort Worth, TX' LIMIT 5")
for r in cur.fetchall():
    print(r)
