import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

# Check Fort Worth parcels
cur.execute("""
    SELECT id, account_number, address, city, zip_code, latitude, longitude
    FROM parcels
    WHERE city = 'Fort Worth' AND is_mock = 0
    LIMIT 10
""")
for r in cur.fetchall():
    print(r)
