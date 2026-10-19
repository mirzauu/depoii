import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("--- CONTRACTORS SAMPLE (Top 5) ---")
cur.execute("SELECT canonical_name, headquarters_city, headquarters_state, phone_number, website_url, crew_capacity_estimate, total_permits FROM canonical_contractors ORDER BY total_permits DESC LIMIT 5")
for row in cur.fetchall():
    print(row)

print("\n--- CITIES IN PERMITS BUT MISSING REAL PARCELS ---")
cur.execute("""
    SELECT p.city, p.state, COUNT(p.id) as permit_count,
           COALESCE(pr.real_parcels, 0) as real_parcels,
           COALESCE(pr.mock_parcels, 0) as mock_parcels
    FROM normalized_permits p
    LEFT JOIN (
        SELECT city, state,
               COUNT(CASE WHEN id NOT LIKE 'MOCK-%' THEN 1 END) as real_parcels,
               COUNT(CASE WHEN id LIKE 'MOCK-%' THEN 1 END) as mock_parcels
        FROM parcels
        GROUP BY city, state
    ) pr ON LOWER(p.city) = LOWER(pr.city) AND LOWER(p.state) = LOWER(pr.state)
    GROUP BY p.city, p.state
    ORDER BY permit_count DESC
""")
cities_status = cur.fetchall()
print(f"{'City':<25} | {'State':<5} | {'Permits':<10} | {'Real Parcels':<14} | {'Mock Parcels':<14} | Status")
print("-" * 80)
for c, s, pc, rp, mp in cities_status[:30]:
    status = "OK (Real)" if rp > 0 else ("Mock Seeded" if mp > 0 else "MISSING PARCELS")
    print(f"{c:<25} | {s:<5} | {pc:<10,} | {rp:<14,} | {mp:<14,} | {status}")

print("\n--- NYC PARCELS BREAKDOWN ---")
cur.execute("SELECT city, county, COUNT(*) FROM parcels WHERE state = 'NY' GROUP BY city, county")
for row in cur.fetchall():
    print(row)

print("\n--- PERMITS LINKAGE TO PARCELS BREAKDOWN ---")
cur.execute("""
    SELECT state, COUNT(*) as total_permits, 
           COUNT(CASE WHEN parcel_id IS NOT NULL AND parcel_id != '' THEN 1 END) as linked_parcels
    FROM normalized_permits
    GROUP BY state
    ORDER BY total_permits DESC
""")
for row in cur.fetchall():
    print(f"State {row[0]}: {row[2]:,} / {row[1]:,} permits linked to parcels ({row[2]/row[1]*100:.1f}%)")

