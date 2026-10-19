import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

# Find top commercial roofing contractors active in Fort Worth
cur.execute("""
    SELECT c.name, c.phone, c.email, c.city, c.total_permits, COUNT(p.id) as fw_roof_permits
    FROM contractors c
    JOIN normalized_permits p ON p.contractor_id = c.id
    WHERE p.jurisdiction = 'Fort Worth, TX'
    GROUP BY c.id
    ORDER BY fw_roof_permits DESC
    LIMIT 10
""")
rows = cur.fetchall()

print("=== TOP COMMERCIAL CONTRACTORS IN FORT WORTH ===")
for r in rows:
    print(f"Contractor: {r[0]:<35} | Permits: {r[5]:>3} | City: {r[3]} | Phone: {r[1]} | Email: {r[2]}")
