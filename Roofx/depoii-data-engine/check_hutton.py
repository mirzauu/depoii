import sqlite3
conn = sqlite3.connect('depoii_local.db')
print(conn.cursor().execute("SELECT owner_name, property_type FROM parcels WHERE address LIKE '%1801 Hutton%'").fetchall())
