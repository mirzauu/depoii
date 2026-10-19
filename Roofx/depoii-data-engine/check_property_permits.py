import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("=== CHECKING PERMITS FOR 3100 SAPPINGTON PL (FORT WORTH) ===")
cur.execute("""
    SELECT raw_permit_number, issue_date, valuation, category, raw_description, contractor_name
    FROM normalized_permits
    WHERE normalized_address LIKE '%SAPPINGTON%' OR raw_description LIKE '%SAPPINGTON%'
""")
fw_permits = cur.fetchall()
if fw_permits:
    for p in fw_permits:
        print(p)
else:
    print("Zero permits on file for Sappington Pl in Fort Worth.")

print("\n=== CHECKING PERMITS FOR 13999 GOLDMARK DR (DALLAS) ===")
cur.execute("""
    SELECT raw_permit_number, issue_date, valuation, category, raw_description, contractor_name
    FROM normalized_permits
    WHERE normalized_address LIKE '%GOLDMARK%' OR raw_description LIKE '%GOLDMARK%'
""")
dal_permits = cur.fetchall()
if dal_permits:
    for p in dal_permits:
        print(p)
else:
    print("Zero permits on file for Goldmark Dr in Dallas.")

print("\n=== CHECKING NEARBY PERMITS IN FORT WORTH 76116 ===")
cur.execute("""
    SELECT raw_permit_number, issue_date, normalized_address, valuation, raw_description
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Fort Worth%' AND zip_code LIKE '76116%' AND is_pure_reroof = 1
    ORDER BY issue_date DESC
    LIMIT 5
""")
for r in cur.fetchall():
    print(r)
