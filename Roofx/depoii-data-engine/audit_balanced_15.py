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

EXCLUDE_ZIPS = "('76102', '75201', '75202')"
EXCLUDE_OWNERS = [
    'CITY OF', 'STATE OF', 'UNITED STATES', 'SCHOOL DISTRICT', 'ISD', 
    'BOARD OF REG', 'AUTHORITY', 'HOUSING AUTH', 'COUNTY', 'DISTRICT',
    'TOWN OF', 'DEPT OF', 'DEPARTMENT', 'MUNICIPAL', 'CHURCH', 'RELIGIOUS',
    'CARROLLTON FARMERS BRANCH', 'DALLAS INDEPENDENT', 'FORT WORTH INDEPENDENT',
    'COMMUNITY COLLEGE', 'HOSPITAL DISTRICT', 'TRANSIT', 'DART', 'DFW AIRPORT',
    'PARK DISTRICT', 'VALWOOD IMPT', 'APARTMENT', 'HOUSING', 'SCHOOL'
]
exclude_sql = " AND ".join([f"UPPER(owner_name) NOT LIKE '%{e}%'" for e in EXCLUDE_OWNERS])

candidates = []

# 1. 8 Fort Worth candidates (including 76116)
q_fw = f"""
    SELECT id, account_number, address, city, zip_code, owner_name, 
           property_type, building_sqft, year_built, total_valuation, latitude, longitude, data_source
    FROM parcels
    WHERE state = 'TX' AND is_mock = 0 AND city = 'Fort Worth'
      AND zip_code NOT IN {EXCLUDE_ZIPS}
      AND building_sqft BETWEEN 30000 AND 300000
      AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
      AND address NOT LIKE '%No Name%' AND address NOT LIKE '9999%' AND address NOT LIKE '0 %'
      AND {exclude_sql}
    ORDER BY RANDOM()
    LIMIT 8
"""
cur.execute(q_fw)
for r in cur.fetchall():
    candidates.append(("Fort Worth", r))

# 2. 7 Dallas candidates
q_dal = f"""
    SELECT id, account_number, address, city, zip_code, owner_name, 
           property_type, building_sqft, year_built, total_valuation, latitude, longitude, data_source
    FROM parcels
    WHERE state = 'TX' AND is_mock = 0 AND city = 'Dallas'
      AND zip_code NOT IN {EXCLUDE_ZIPS}
      AND building_sqft BETWEEN 30000 AND 300000
      AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
      AND address NOT LIKE '%No Name%' AND address NOT LIKE '9999%' AND address NOT LIKE '0 %'
      AND {exclude_sql}
    ORDER BY RANDOM()
    LIMIT 7
"""
cur.execute(q_dal)
for r in cur.fetchall():
    candidates.append(("Dallas", r))

cur.execute("""
    SELECT raw_permit_number, normalized_address, issue_date, valuation, category, raw_description, latitude, longitude, city
    FROM normalized_permits
    WHERE city IN ('Dallas', 'Fort Worth')
""")
all_permits = cur.fetchall()

audited_batch = []

for idx, (city_grp, c) in enumerate(candidates, 1):
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

    audited_batch.append({
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

with open("audit_15_balanced_results.json", "w", encoding="utf-8") as f:
    json.dump(audited_batch, f, indent=2)

print("="*85)
print(f"{'#':<3} | {'Address':<26} | {'City':<12} | {'Sq Ft':<8} | {'Owner':<24} | {'Status'}")
print("="*85)
pass_cnt = 0
for r in audited_batch:
    if "PASS" in r["status"]:
        pass_cnt += 1
    print(f"{r['rank']:<3} | {r['address']:<26} | {r['city']:<12} | {r['sqft']:>7,} | {r['owner_name'][:22]:<24} | {r['status']}")

print("\n" + "="*85)
print(f"BALANCED SCREENING SUMMARY: {pass_cnt} / {len(audited_batch)} Passed ({pass_cnt/len(audited_batch)*100:.1f}%)")
print(f"Verified False-Positive Rate: {(len(audited_batch) - pass_cnt)/len(audited_batch)*100:.1f}%")
print("="*85)
