import sqlite3
import math
import json

DB_PATH = "depoii_local.db"

def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Exclude downtown CBD high-rise zip codes: 76102 (Fort Worth Downtown), 75201, 75202 (Dallas Downtown)
EXCLUDE_ZIPS = "('76102', '75201', '75202')"
EXCLUDE_OWNERS = [
    'CITY OF', 'STATE OF', 'UNITED STATES', 'SCHOOL DISTRICT', 'ISD', 
    'BOARD OF REG', 'AUTHORITY', 'HOUSING AUTH', 'COUNTY', 'DISTRICT',
    'TOWN OF', 'DEPT OF', 'DEPARTMENT', 'MUNICIPAL', 'CHURCH', 'RELIGIOUS',
    'CARROLLTON FARMERS BRANCH', 'DALLAS INDEPENDENT', 'FORT WORTH INDEPENDENT',
    'COMMUNITY COLLEGE', 'HOSPITAL DISTRICT', 'TRANSIT', 'DART', 'DFW AIRPORT',
    'PARK DISTRICT', 'VALWOOD IMPT', 'APARTMENT', 'HOUSING'
]
exclude_sql = " AND ".join([f"UPPER(owner_name) NOT LIKE '%{e}%'" for e in EXCLUDE_OWNERS])

# Select 15 candidates across tiers in Dallas and Fort Worth:
# 6 from Tier 1 (30k - 100k)
# 6 from Tier 2 (100k - 250k)
# 3 from Tier 3 (250k+)
selection_queries = [
    ("Tier 1: 30K - 100K sq ft", 30000, 100000, 6),
    ("Tier 2: 100K - 250K sq ft", 100000, 250000, 6),
    ("Tier 3: 250K+ sq ft", 250000, 1000000, 3)
]

candidates = []
for tier_name, min_sq, max_sq, count in selection_queries:
    q = f"""
        SELECT id, account_number, address, city, zip_code, owner_name, 
               property_type, building_sqft, year_built, total_valuation, latitude, longitude, data_source
        FROM parcels
        WHERE state = 'TX' 
          AND is_mock = 0
          AND city IN ('Dallas', 'Fort Worth')
          AND zip_code NOT IN {EXCLUDE_ZIPS}
          AND building_sqft BETWEEN ? AND ?
          AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
          AND address NOT LIKE '%No Name%' AND address NOT LIKE '9999%' AND address NOT LIKE '0 %'
          AND {exclude_sql}
        ORDER BY RANDOM()
        LIMIT ?
    """
    cur.execute(q, (min_sq, max_sq, count))
    rows = cur.fetchall()
    for r in rows:
        candidates.append((tier_name, r))

# Load all permits in Dallas and Fort Worth with coordinates
cur.execute("""
    SELECT raw_permit_number, normalized_address, issue_date, valuation, category, raw_description, latitude, longitude, city
    FROM normalized_permits
    WHERE city IN ('Dallas', 'Fort Worth')
""")
all_permits = cur.fetchall()

print(f"Selected {len(candidates)} test candidate properties across Dallas & Fort Worth.")
print(f"Loaded {len(all_permits):,} municipal permits for wildcard & spatial audit.\n")

results = []

for idx, (tier_name, c) in enumerate(candidates, 1):
    pid, acct, addr, city, zip_code, owner, ptype, sqft, yr, val, lat, lon, src = c
    parts = addr.split()
    num = parts[0]
    st_name = parts[1] if len(parts) > 1 else ""

    # 1. Text wildcard match on street number & street name
    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, valuation, category, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{st_name}%"))
    text_matches = cur.fetchall()

    # Filter text matches post-April 26, 2026
    post_storm_permits = [m for m in text_matches if m[1] >= "2026-04-26"]
    pre_storm_permits = [m for m in text_matches if m[1] < "2026-04-26"]

    # 2. Spatial proximity match within 75 meters
    nearby_post_permits = []
    if lat and lon:
        for pm in all_permits:
            p_no, p_addr, p_date, p_val, p_cat, p_desc, p_lat, p_lon, p_city = pm
            if p_lat and p_lon and p_date >= "2026-04-26":
                d = haversine_m(lat, lon, p_lat, p_lon)
                if d <= 75.0:
                    nearby_post_permits.append((p_no, p_addr, p_date, round(d, 1), p_desc))

    # Determine status
    if post_storm_permits:
        status = "FAIL (Permit Found Post-Storm)"
        reason = f"Municipal permit {post_storm_permits[0][0]} on {post_storm_permits[0][1]}: {post_storm_permits[0][5][:50]}"
    elif nearby_post_permits:
        status = "FLAG (Nearby Permit within 75m)"
        reason = f"Nearby permit {nearby_post_permits[0][0]} at {nearby_post_permits[0][1]} ({nearby_post_permits[0][3]}m away)"
    else:
        status = "PASS (Verified Zero Permits)"
        reason = "Clean address and 0 permits within 75m radius post-storm"

    results.append({
        "index": idx,
        "tier": tier_name,
        "address": addr,
        "city": city,
        "zip_code": zip_code,
        "account_number": acct,
        "cad_source": src,
        "owner_name": owner,
        "sqft": sqft,
        "year_built": yr,
        "valuation": val,
        "lat": lat,
        "lon": lon,
        "status": status,
        "reason": reason,
        "historical_pre_permits_count": len(pre_storm_permits)
    })

conn.close()

with open("audit_15_screening_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("="*80)
print(f"{'#':<3} | {'Address':<26} | {'City':<12} | {'Sq Ft':<8} | {'Owner':<24} | {'Status'}")
print("="*80)
pass_count = 0
for r in results:
    if "PASS" in r["status"]:
        pass_count += 1
    print(f"{r['index']:<3} | {r['address']:<26} | {r['city']:<12} | {r['sqft']:>7,} | {r['owner_name'][:22]:<24} | {r['status']}")

print("\n" + "="*80)
print(f"SCREENING SUMMARY: {pass_count} / {len(results)} Passed ({pass_count/len(results)*100:.1f}%)")
print(f"Calculated False-Positive Rate: {(len(results) - pass_count)/len(results)*100:.1f}%")
print("="*80)
