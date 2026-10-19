import sqlite3
import math

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

# Severe hail reports
hail_points = [
    (32.72, -97.43, 2.25, "2 SW Westover Hills (mPING)"),
    (32.71, -97.45, 2.00, "2 N Benbrook (mPING)"),
    (32.76, -97.51, 2.75, "3 W White Settlement (Spotter photo)"),
    (32.79, -97.35, 2.75, "3 NNW Fort Worth (Spotter photo)"),
    (32.80, -97.36, 1.75, "3 E Sansom Park (mPING)")
]

def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Query parcels in Fort Worth
cur.execute("""
    SELECT p.id, p.account_number, p.address, p.city, p.owner_name, p.property_type,
           p.building_sqft, p.year_built, p.total_valuation, p.latitude, p.longitude
    FROM parcels p
    WHERE p.city = 'Fort Worth'
      AND p.building_sqft BETWEEN 25000 AND 200000
      AND p.year_built <= 2015
      AND p.id NOT IN (SELECT parcel_id FROM manual_disqualifications)
      AND LOWER(p.address) NOT IN (SELECT LOWER(address) FROM manual_disqualifications)
      AND UPPER(p.owner_name) NOT LIKE '%APARTMENT%'
      AND UPPER(p.owner_name) NOT LIKE '%HOUSING%'
      AND UPPER(p.owner_name) NOT LIKE '%CHURCH%'
      AND UPPER(p.owner_name) NOT LIKE '%ISD%'
      AND UPPER(p.owner_name) NOT LIKE '%CITY OF%'
      AND UPPER(p.owner_name) NOT LIKE '%COUNTY%'
      AND UPPER(p.owner_name) NOT LIKE '%HOSPITAL%'
      AND UPPER(p.owner_name) NOT LIKE '%MEDICAL%'
      AND p.address NOT LIKE '6777 Camp Bowie%'
      AND p.address NOT LIKE '6353 Camp Bowie%'
      AND p.address NOT LIKE '3209 Alta Mere%'
      AND p.address NOT LIKE '201 NE 28th%'
      AND p.address NOT LIKE '2701 Decatur%'
""")

rows = cur.fetchall()
print(f"Total candidate commercial parcels: {len(rows)}")

matches = []
for r in rows:
    pid, acct, addr, city, owner, ptype, sqft, ybuilt, val, lat, lon = r
    if not lat or not lon:
        continue
    for hlat, hlon, hsize, hdesc in hail_points:
        d = haversine(lat, lon, hlat, hlon)
        if d <= 1.0:  # Within 1.0 mile
            matches.append((d, hsize, hdesc, r))
            break

matches.sort(key=lambda x: x[0])
print(f"Found {len(matches)} commercial parcels within 1.0 mile of severe hail:")
for d, hsize, hdesc, r in matches[:15]:
    pid, acct, addr, city, owner, ptype, sqft, ybuilt, val, lat, lon = r
    print(f"  • {addr} (TAD #{acct}) | {sqft:,} sq ft | Built {ybuilt} | Owner: {owner}")
    print(f"    Dist: {d:.2f} mi from {hsize}\" hail at {hdesc}")
