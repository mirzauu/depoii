import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("=== ALL PARCELS MATCHING 'BENBROOK' IN DB ===")
cur.execute("SELECT id, account_number, address, city, building_sqft, year_built, owner_name, total_valuation, data_source FROM parcels WHERE address LIKE '%Benbrook%'")
for r in cur.fetchall():
    print(r)

print("\n=== ALL PARCELS MATCHING 'CULLEN' IN DB ===")
cur.execute("SELECT id, account_number, address, city, building_sqft, year_built, owner_name, total_valuation, data_source FROM parcels WHERE address LIKE '%Cullen%'")
for r in cur.fetchall():
    print(r)
