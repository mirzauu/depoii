import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

cur.execute("""
    SELECT event_date, max_hail_inches, storm_name, id
    FROM storm_swaths
    WHERE jurisdiction_id LIKE 'TX-%' OR storm_name LIKE '%Dallas%' OR storm_name LIKE '%Fort Worth%'
    ORDER BY event_date DESC
""")
rows = cur.fetchall()

print(f"Total Texas Storms: {len(rows)}")
for r in rows:
    print(f"• {r[0]} | {r[1]:.2f}\" | {r[3]} | {r[2]}")
