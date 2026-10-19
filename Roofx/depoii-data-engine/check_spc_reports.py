import sqlite3
import json

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

rows = cur.execute("""
    SELECT id, storm_name, event_date, max_hail_inches, properties 
    FROM storm_swaths 
    WHERE id LIKE '%-DFW' AND (event_date LIKE '2026-04%' OR event_date LIKE '2024-04%')
    ORDER BY event_date
""").fetchall()

for r in rows:
    print("=" * 60)
    print(f"ID: {r[0]} | Date: {r[2]} | Max Hail: {r[3]}\" | Name: {r[1]}")
    try:
        props = json.loads(r[4])
        print("Affected counties:", props.get('affected_counties'))
        print("Total reports:", props.get('total_reports'))
    except Exception as e:
        print("Error:", e)
