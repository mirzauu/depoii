import sqlite3
import json

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*70)
print("1. ALL TEXAS STORM SWATHS IN DATABASE")
print("="*70)
cur.execute("""
    SELECT id, storm_name, event_date, max_hail_inches, properties, created_at
    FROM storm_swaths
    WHERE jurisdiction_id LIKE 'TX-%' OR storm_name LIKE '%Texas%' OR storm_name LIKE '%Dallas%' OR storm_name LIKE '%Fort Worth%'
    ORDER BY event_date DESC
""")
storms = cur.fetchall()
for s in storms:
    print(f"ID: {s[0]} | Date: {s[2]} | Hail: {s[3]}\" | Name: {s[1]}")

print("\n" + "="*70)
print("2. PERMIT COVERAGE BY CITY IN TEXAS")
print("="*70)
cur.execute("""
    SELECT city, COUNT(*) as cnt, 
           COUNT(CASE WHEN is_pure_reroof = 1 THEN 1 END) as reroofs,
           MIN(issue_date), MAX(issue_date)
    FROM normalized_permits
    WHERE state = 'TX'
    GROUP BY city
    ORDER BY cnt DESC
""")
for r in cur.fetchall():
    print(f"  • {r[0]:<25}: {r[1]:>6,} total | {r[2]:>4,} reroofs | {r[3]} to {r[4]}")

print("\n" + "="*70)
print("3. REAL PARCELS BY CITY IN TEXAS (is_mock = 0)")
print("="*70)
cur.execute("""
    SELECT city, COUNT(*) as cnt, 
           MIN(building_sqft), MAX(building_sqft), AVG(building_sqft)
    FROM parcels
    WHERE state = 'TX' AND is_mock = 0
    GROUP BY city
    ORDER BY cnt DESC
""")
for r in cur.fetchall():
    print(f"  • {r[0]:<25}: {r[1]:>5,} parcels | Min Sqft: {r[2]:,} | Max: {r[3]:,} | Avg: {int(r[4]):,}")
