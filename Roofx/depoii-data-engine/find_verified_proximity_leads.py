import sqlite3
import math

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Verified April 26 hail report points in Tarrant / Fort Worth
hail_points = [
    (32.7700, -97.3100, 1.75, "SE Fort Worth / Little Rd & I-20"),
    (32.7100, -97.1100, 1.75, "Arlington / West Tarrant"),
    (32.8500, -97.3400, 1.00, "Blue Mound / North Fort Worth"),
    (32.8700, -97.3700, 1.00, "Saginaw / NW Fort Worth"),
    (32.6300, -97.2100, 1.00, "Kennedale / SE Tarrant")
]

# Query real commercial parcels in Fort Worth (excluding apartments, towers, public)
EXCLUDE_OWNERS = [
    'CITY OF', 'STATE OF', 'UNITED STATES', 'SCHOOL DISTRICT', 'ISD', 
    'BOARD OF REG', 'AUTHORITY', 'HOUSING AUTH', 'COUNTY', 'DISTRICT',
    'TOWN OF', 'DEPT OF', 'DEPARTMENT', 'MUNICIPAL', 'CHURCH', 'RELIGIOUS',
    'APARTMENT', 'HOUSING', 'FOUNDATION', 'STUDENT'
]
exclude_sql = " AND ".join([f"UPPER(owner_name) NOT LIKE '%{e}%'" for e in EXCLUDE_OWNERS])

cur.execute(f"""
    SELECT id, account_number, address, city, building_sqft, year_built, owner_name, latitude, longitude
    FROM parcels
    WHERE city = 'Fort Worth' AND is_mock = 0
      AND building_sqft BETWEEN 30000 AND 300000
      AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
      AND address NOT LIKE '%Throckmorton%' AND address NOT LIKE '%777 Main%'
      AND latitude IS NOT NULL AND longitude IS NOT NULL
      AND {exclude_sql}
""")
parcels = cur.fetchall()

print("="*80)
print(f"FINDING FORT WORTH COMMERCIAL PARCELS WITHIN 3 MILES OF VERIFIED HAIL REPORTS")
print("="*80)

hits = []
for p in parcels:
    pid, acct, addr, city, sqft, yr, owner, lat, lon = p
    min_dist = 999.0
    best_pt = None
    for h_lat, h_lon, h_mag, h_loc in hail_points:
        d = haversine_miles(lat, lon, h_lat, h_lon)
        if d < min_dist:
            min_dist = d
            best_pt = (h_mag, h_loc)
            
    if min_dist <= 3.5:  # within 3.5 miles
        hits.append((addr, acct, sqft, yr, owner, round(min_dist, 2), best_pt[0], best_pt[1], lat, lon))

hits.sort(key=lambda x: x[5])  # sort by distance

print(f"Found {len(hits)} commercial properties within 3.5 miles of verified ground hail:")
for h in hits[:15]:
    print(f"• {h[0]:<28} | Acct: {h[1]} | Sqft: {h[2]:>7,} | Yr: {h[3]} | Dist: {h[5]} mi from {h[7]} ({h[6]}\" hail) | Owner: {h[4][:25]}")
