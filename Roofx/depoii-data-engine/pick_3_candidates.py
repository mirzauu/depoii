import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*75)
print("CANDIDATE 1: FORT WORTH 76116 (WEST FORT WORTH / BENBROOK)")
print("="*75)
cur.execute("""
    SELECT id, account_number, address, city, zip_code, owner_name, building_sqft, year_built, total_valuation
    FROM parcels
    WHERE city = 'Fort Worth' AND zip_code LIKE '76116%' AND is_mock = 0
      AND building_sqft BETWEEN 30000 AND 100000
      AND address NOT LIKE '%Tower%' AND address NOT LIKE '%Plaza%'
      AND address NOT LIKE '%No Name%'
    LIMIT 5
""")
for r in cur.fetchall():
    print(f"ID: {r[0]} | ACCT: {r[1]} | Addr: {r[2]}, {r[3]} {r[4]} | Sqft: {r[6]:,} | Yr: {r[7]} | Owner: {r[5]}")

print("\n" + "="*75)
print("CANDIDATE 2: DALLAS (COMMERCIAL CORRIDOR - TIER 1)")
print("="*75)
cur.execute("""
    SELECT id, account_number, address, city, zip_code, owner_name, building_sqft, year_built, total_valuation
    FROM parcels
    WHERE city = 'Dallas' AND is_mock = 0
      AND building_sqft BETWEEN 30000 AND 100000
      AND zip_code NOT IN ('75201', '75202')
      AND address NOT LIKE '%Tower%'
      AND address NOT LIKE '%No Name%'
      AND owner_name NOT LIKE '%City Of%'
    ORDER BY building_sqft DESC
    LIMIT 5
""")
for r in cur.fetchall():
    print(f"ID: {r[0]} | ACCT: {r[1]} | Addr: {r[2]}, {r[3]} {r[4]} | Sqft: {r[6]:,} | Yr: {r[7]} | Owner: {r[5]}")

print("\n" + "="*75)
print("CANDIDATE 3: TIER 2 (100K - 250K sq ft - DALLAS/FORT WORTH INDUSTRIAL)")
print("="*75)
cur.execute("""
    SELECT id, account_number, address, city, zip_code, owner_name, building_sqft, year_built, total_valuation
    FROM parcels
    WHERE city IN ('Dallas', 'Fort Worth') AND is_mock = 0
      AND building_sqft BETWEEN 100000 AND 250000
      AND zip_code NOT IN ('75201', '75202', '76102')
      AND address NOT LIKE '%Tower%'
      AND address NOT LIKE '%No Name%'
      AND owner_name NOT LIKE '%City Of%'
    ORDER BY building_sqft DESC
    LIMIT 5
""")
for r in cur.fetchall():
    print(f"ID: {r[0]} | ACCT: {r[1]} | Addr: {r[2]}, {r[3]} {r[4]} | Sqft: {r[6]:,} | Yr: {r[7]} | Owner: {r[5]}")
