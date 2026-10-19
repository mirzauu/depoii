import sqlite3

conn = sqlite3.connect(r"Roofx/depoii-data-engine/depoii_local.db")
cur = conn.cursor()

print("=" * 80)
print(" AUDIT: STAGED AGING COMMERCIAL LEADS (`staged_aging_commercial_leads`)")
print("=" * 80)
cur.execute("SELECT count(*) FROM staged_aging_commercial_leads")
print(f"Total rows in aging table: {cur.fetchone()[0]}")

cur.execute("""
    SELECT address, zip_code, owner_name, stories, roof_area_sqft, roof_area_basis, last_reroof_date, last_reroof_permit_no
    FROM staged_aging_commercial_leads
    WHERE roof_area_sqft IS NOT NULL
    LIMIT 3
""")
print("\nSample 1-Story Warehouses (Foundation Sum):")
for r in cur.fetchall():
    print(f"  {r[0]} ({r[1]}) | Owner: {r[2]} | Roof: {r[4]} sq ft ({r[5]}) | Reroof: {r[6]} ({r[7]})")

cur.execute("""
    SELECT address, zip_code, owner_name, stories, roof_area_sqft, roof_area_basis, last_reroof_date, last_reroof_permit_no
    FROM staged_aging_commercial_leads
    WHERE stories > 1.01
    LIMIT 3
""")
print("\nSample Multi-Story Offices (Roof Area NULL):")
for r in cur.fetchall():
    print(f"  {r[0]} ({r[1]}) | Owner: {r[2]} | Stories: {r[3]} | Roof: {r[4]} ({r[5]}) | Reroof: {r[6]} ({r[7]})")

cur.execute("""
    SELECT address, zip_code, owner_name, year_built, last_reroof_date, flag_rebuild_discrepancy
    FROM staged_aging_commercial_leads
    WHERE flag_rebuild_discrepancy = 1
    LIMIT 3
""")
print("\nSample Flagged Rebuild Discrepancies (Kept in Table):")
for r in cur.fetchall():
    print(f"  {r[0]} ({r[1]}) | Owner: {r[2]} | Year Built: {r[3]} vs Reroof: {r[4]} | Flag: {r[5]}")

print("\n" + "=" * 80)
print(" AUDIT: STAGED HAIL COMMERCIAL LEADS (`staged_hail_commercial_leads`)")
print("=" * 80)
cur.execute("SELECT count(*) FROM staged_hail_commercial_leads")
print(f"Total rows in hail table: {cur.fetchone()[0]}")

cur.execute("""
    SELECT hail_group, count(*) 
    FROM staged_hail_commercial_leads 
    GROUP BY hail_group
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} rows")

cur.execute("""
    SELECT address, zip_code, owner_name, last_reroof_date, hail_group, roof_status_line, spc_observation_line, spc_source_file
    FROM staged_hail_commercial_leads
    WHERE hail_group = 'KNOWN_PRE_STORM'
    LIMIT 3
""")
print("\nSample Group A Leads (Known Pre-Storm Reroof):")
for r in cur.fetchall():
    print(f"  Address:     {r[0]} ({r[1]}) | Owner: {r[2]}")
    print(f"  Roof Status: {r[5]} (Date: {r[3]})")
    print(f"  Observation: {r[6]} (Source: {r[7]})")
    print()

cur.execute("""
    SELECT address, zip_code, owner_name, last_reroof_date, hail_group, roof_status_line, spc_observation_line, spc_source_file
    FROM staged_hail_commercial_leads
    WHERE hail_group = 'ROOF_DATE_UNKNOWN'
    LIMIT 3
""")
print("Sample Group B Records (Roof Date Unknown - NOT A CALL LIST):")
for r in cur.fetchall():
    print(f"  Address:     {r[0]} ({r[1]}) | Owner: {r[2]}")
    print(f"  Roof Status: {r[5]} (Date: {r[3]})")
    print(f"  Observation: {r[6]} (Source: {r[7]})")
    print()

# Check production database
cur_prod = sqlite3.connect("data/depoii.sqlite").cursor()
cur_prod.execute("SELECT count(*) FROM parcels")
print(f"Production `data/depoii.sqlite` parcels count: {cur_prod.fetchone()[0]}")
cur_prod.execute("PRAGMA table_info(parcels)")
print(f"Production has staged tables: {[r[1] for r in cur_prod.fetchall() if 'staged' in r[1] or 'reroof' in r[1]]}")
cur_prod.close()

conn.close()
