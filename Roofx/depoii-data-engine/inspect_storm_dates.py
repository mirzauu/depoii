import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*70)
print("ALL 2026 & 2024 DFW STORMS IN DATABASE")
print("="*70)
cur.execute("""
    SELECT id, storm_name, event_date, max_hail_inches
    FROM storm_swaths
    WHERE (jurisdiction_id LIKE 'TX-%' OR storm_name LIKE '%Dallas%' OR storm_name LIKE '%Fort Worth%')
      AND (event_date LIKE '2026%' OR event_date LIKE '2024%')
    ORDER BY event_date DESC
""")
for r in cur.fetchall():
    print(f"ID: {r[0]:<25} | Date: {r[2]} | Hail: {r[3]:.2f}\" | Name: {r[1]}")
