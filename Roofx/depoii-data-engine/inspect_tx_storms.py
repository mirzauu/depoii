import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*70)
print("TOP SEVERE DFW STORM SWATHS IN DATABASE")
print("="*70)
cur.execute("""
    SELECT id, storm_name, event_date, max_hail_inches, jurisdiction_id
    FROM storm_swaths
    WHERE (jurisdiction_id LIKE 'TX-%' OR storm_name LIKE '%Texas%' OR storm_name LIKE '%Dallas%' OR storm_name LIKE '%Fort Worth%')
      AND max_hail_inches >= 1.75
    ORDER BY event_date DESC
    LIMIT 15
""")
rows = cur.fetchall()
for r in rows:
    print(f"ID: {r[0]:<20} | Date: {r[2]} | Hail: {r[3]:.2f}\" | Name: {r[1]:<35}")

print(f"\nTotal severe storms found: {len(rows)}")
