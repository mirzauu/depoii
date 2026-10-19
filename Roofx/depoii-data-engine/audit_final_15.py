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

EXCLUDE_OWNERS = [
    'CITY OF', 'STATE OF', 'UNITED STATES', 'SCHOOL DISTRICT', 'ISD', 
    'BOARD OF REG', 'AUTHORITY', 'HOUSING AUTH', 'COUNTY', 'DISTRICT',
    'TOWN OF', 'DEPT OF', 'DEPARTMENT', 'MUNICIPAL', 'CHURCH', 'RELIGIOUS',
    'CARROLLTON FARMERS BRANCH', 'DALLAS INDEPENDENT', 'FORT WORTH INDEPENDENT',
    'COMMUNITY COLLEGE', 'HOSPITAL DISTRICT', 'TRANSIT', 'DART', 'DFW AIRPORT',
    'PARK DISTRICT', 'VALWOOD IMPT', 'APARTMENT', 'HOUSING', 'FOUNDATION'
]
exclude_sql = " AND ".join([f"UPPER(owner_name) NOT LIKE '%{e}%'" for e in EXCLUDE_OWNERS])

# Fort Worth CBD street exclusion to eliminate high-rises
fw_exclude_streets = "AND address NOT LIKE '%Throckmorton%' AND address NOT LIKE '%777 Main%' AND address NOT LIKE '%Commerce%' AND address NOT LIKE '%Houston St%' AND address NOT LIKE '%Taylor St%'"

# Pull 8 Fort Worth properties
cur.execute(f"""
    SELECT id, account_number, address, city, zip_code, owner_name, 
           property_type, building_sqft, year_built, total_valuation, latitude, longitude, data_source
    FROM parcels
    WHERE city = 'Fort Worth' AND is_mock = 0
      AND building_sqft BETWEEN 30000 AND 250000
      AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
      AND address NOT LIKE '%No Name%' AND address NOT LIKE '9999%'
      {fw_exclude_streets}
      AND {exclude_sql}
    ORDER BY building_sqft DESC
    LIMIT 8
""")
fw_candidates = cur.fetchall()

# Pull 7 Dallas properties
cur.execute(f"""
    SELECT id, account_number, address, city, zip_code, owner_name, 
           property_type, building_sqft, year_built, total_valuation, latitude, longitude, data_source
    FROM parcels
    WHERE city = 'Dallas' AND is_mock = 0
      AND zip_code NOT IN ('75201', '75202')
      AND building_sqft BETWEEN 30000 AND 250000
      AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
      AND address NOT LIKE '%No Name%' AND address NOT LIKE '9999%'
      AND {exclude_sql}
    ORDER BY building_sqft DESC
    LIMIT 7
""")
dal_candidates = cur.fetchall()

candidates = fw_candidates + dal_candidates

cur.execute("""
    SELECT raw_permit_number, normalized_address, issue_date, valuation, category, raw_description, latitude, longitude, city
    FROM normalized_permits
    WHERE city IN ('Dallas', 'Fort Worth')
""")
all_permits = cur.fetchall()

print(f"Loaded {len(candidates)} candidate properties (8 Fort Worth, 7 Dallas).")
print(f"Loaded {len(all_permits):,} municipal permits for wildcard & spatial audit.\n")

results = []
for idx, c in enumerate(candidates, 1):
    pid, acct, addr, city, zip_code, owner, ptype, sqft, yr, val, lat, lon, src = c
    parts = addr.split()
    num = parts[0]
    st_name = parts[1] if len(parts) > 1 else ""

    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, valuation, category, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{st_name}%"))
    text_matches = cur.fetchall()

    post_storm_permits = [m for m in text_matches if m[1] >= "2026-04-26"]
    
    nearby_post_permits = []
    if lat and lon:
        for pm in all_permits:
            p_no, p_addr, p_date, p_val, p_cat, p_desc, p_lat, p_lon, p_city = pm
            if p_lat and p_lon and p_date >= "2026-04-26":
                d = haversine_m(lat, lon, p_lat, p_lon)
                if d <= 75.0:
                    nearby_post_permits.append((p_no, p_addr, p_date, round(d, 1), p_desc))

    if post_storm_permits:
        status = "FAIL (Permit Found Post-Storm)"
        reason = f"Permit {post_storm_permits[0][0]} on {post_storm_permits[0][1]}: {post_storm_permits[0][5][:45]}"
    elif nearby_post_permits:
        status = "FLAG (Nearby Permit within 75m)"
        reason = f"Nearby permit {nearby_post_permits[0][0]} at {nearby_post_permits[0][1]} ({nearby_post_permits[0][3]}m away)"
    else:
        status = "PASS (Verified Zero Permits)"
        reason = "Clean address and 0 permits within 75m radius post-storm"

    results.append({
        "rank": idx,
        "address": addr,
        "city": city,
        "account_number": acct,
        "owner_name": owner,
        "sqft": sqft,
        "year_built": yr,
        "cad_source": src,
        "status": status,
        "reason": reason
    })

conn.close()

with open("audit_15_final_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("="*85)
print(f"{'#':<3} | {'Address':<26} | {'City':<12} | {'Sq Ft':<8} | {'Owner':<24} | {'Status'}")
print("="*85)
pass_cnt = 0
for r in results:
    if "PASS" in r["status"]:
        pass_cnt += 1
    print(f"{r['rank']:<3} | {r['address']:<26} | {r['city']:<12} | {r['sqft']:>7,} | {r['owner_name'][:22]:<24} | {r['status']}")

print("\n" + "="*85)
print(f"FINAL AUDIT SUMMARY: {pass_cnt} / {len(results)} Passed ({pass_cnt/len(results)*100:.1f}%)")
print(f"Measured False-Positive Rate: {(len(results) - pass_cnt)/len(results)*100:.1f}%")
print("="*85)
