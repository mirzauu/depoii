import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

cur.execute("""
    SELECT id, address, city, property_type, building_sqft, total_valuation, data_source
    FROM parcels
    WHERE address LIKE '%Throckmorton%' OR address LIKE '%777 Main%'
""")
for r in cur.fetchall():
    print(r)
