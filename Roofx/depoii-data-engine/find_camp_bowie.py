import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

rows = cur.execute("""
    SELECT id, account_number, address, owner_name, building_sqft, year_built, property_type, latitude, longitude
    FROM parcels
    WHERE address LIKE '%Camp Bowie%'
""").fetchall()

for r in rows:
    print(r)
