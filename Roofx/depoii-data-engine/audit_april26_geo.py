import sqlite3
import json

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

cur.execute("""
    SELECT id, storm_name, event_date, max_hail_inches, properties
    FROM storm_swaths
    WHERE id = 'STORM-2026-04-26-DFW'
""")
r = cur.fetchone()
print(f"ID: {r[0]}")
print(f"Name: {r[1]}")
print(f"Hail: {r[3]}\"")
props = json.loads(r[4])
poly = props.get("polygon", [])
print(f"Affected Counties: {props.get('affected_counties')}")
print(f"Total reports: {props.get('total_reports')}")
if poly:
    lons = [p[0] for p in poly]
    lats = [p[1] for p in poly]
    print(f"Bounding Box: Lat [{min(lats):.4f}, {max(lats):.4f}], Lon [{min(lons):.4f}, {max(lons):.4f}]")
    print(f"Centroid: Lat {sum(lats)/len(lats):.4f}, Lon {sum(lons)/len(lons):.4f}")

# Check coordinates of Dallas Pkwy vs Fort Worth
cur.execute("""
    SELECT address, city, latitude, longitude
    FROM parcels
    WHERE address LIKE '%14222 Dallas%' OR address LIKE '%4300 Old Benbrook%' OR address LIKE '%2720 Cullen%'
""")
for p in cur.fetchall():
    print(f"\nProperty: {p[0]}, {p[1]}")
    print(f"Coords: Lat {p[2]}, Lon {p[3]}")
    # Point in bounding box?
    in_box = (min(lats) <= p[2] <= max(lats)) and (min(lons) <= p[3] <= max(lons))
    print(f"Inside April 26 Bounding Box? {in_box}")
