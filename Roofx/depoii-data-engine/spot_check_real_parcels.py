import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

# Only covered cities: Dallas, Fort Worth, Addison, Carrollton, Farmers Branch, Grand Prairie, Irving
covered_cities = ('Dallas', 'Fort Worth', 'Addison', 'Carrollton', 'Farmers Branch', 'Grand Prairie', 'Irving')

print("="*80)
print("REAL PARCELS IN COVERED CITIES BY SIZE TIER")
print("="*80)

for tier_name, min_sq, max_sq in [
    ("TIER 1 (30K - 100K sq ft)", 30000, 100000),
    ("TIER 2 (100K - 250K sq ft)", 100000, 250000),
    ("TIER 3 (250K+ sq ft)", 250000, 5000000)
]:
    print(f"\n--- {tier_name} ---")
    query = f"""
        SELECT id, address, city, zip_code, owner_name, building_sqft, year_built, total_valuation, data_source
        FROM parcels
        WHERE state = 'TX' 
          AND is_mock = 0 
          AND city IN {covered_cities}
          AND building_sqft BETWEEN ? AND ?
          AND address NOT LIKE '%No Name%'
          AND address NOT LIKE '9999%'
          AND address NOT LIKE '0 %'
          AND owner_name NOT LIKE '%City Of%'
          AND owner_name NOT LIKE '%State Of%'
          AND owner_name NOT LIKE '%United States%'
          AND owner_name NOT LIKE '%School District%'
          AND owner_name NOT LIKE '%ISD%'
          AND owner_name NOT LIKE '%Board Of Reg%'
          AND owner_name NOT LIKE '%Authority%'
        ORDER BY RANDOM()
        LIMIT 5
    """
    cur.execute(query, (min_sq, max_sq))
    for r in cur.fetchall():
        print(f"ID: {r[0]:<22} | Addr: {r[1]:<30} | City: {r[2]:<14} | Sqft: {r[5]:>7,} | Yr: {r[6]} | Owner: {r[4]}")
