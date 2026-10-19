import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

print("="*70)
print("1. TABLE ROW COUNTS")
print("="*70)
for tbl in ["normalized_permits", "canonical_contractors", "parcels", "scored_parcel_leads", "storm_swaths"]:
    cur.execute(f"SELECT count(*) FROM {tbl}")
    print(f"  {tbl:<25}: {cur.fetchone()[0]:>8,}")

print("\n" + "="*70)
print("2. PERMITS LINKAGE & DATA COMPLETENESS")
print("="*70)
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN contractor_id IS NOT NULL AND contractor_id != '' THEN 1 END) as linked_contractor,
        COUNT(CASE WHEN parcel_id IS NOT NULL AND parcel_id != '' THEN 1 END) as linked_parcel,
        COUNT(CASE WHEN associated_storm_id IS NOT NULL AND associated_storm_id != '' THEN 1 END) as linked_storm,
        COUNT(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 END) as has_lat_lon,
        COUNT(CASE WHEN valuation IS NULL OR valuation = 0 THEN 1 END) as missing_valuation,
        COUNT(CASE WHEN square_footage IS NULL OR square_footage = 0 THEN 1 END) as missing_sqft,
        COUNT(CASE WHEN probable_roof_system IS NULL OR probable_roof_system = '' OR probable_roof_system = 'Unknown' THEN 1 END) as unknown_roof
    FROM normalized_permits
""")
r = cur.fetchone()
print(f"  Total Permits                 : {r[0]:>8,}")
print(f"  Linked to Contractor          : {r[1]:>8,} ({r[1]/r[0]*100:.1f}%)")
print(f"  Linked to Parcel              : {r[2]:>8,} ({r[2]/r[0]*100:.1f}%)")
print(f"  Linked to Storm Event         : {r[3]:>8,} ({r[3]/r[0]*100:.1f}%)")
print(f"  With Geolocation (Lat/Lon)    : {r[4]:>8,} ({r[4]/r[0]*100:.1f}%)")
print(f"  Missing Valuation ($0 or null): {r[5]:>8,} ({r[5]/r[0]*100:.1f}%)")
print(f"  Missing Square Footage (0/null: {r[6]:>8,} ({r[6]/r[0]*100:.1f}%)")
print(f"  Unknown Probable Roof System  : {r[7]:>8,} ({r[7]/r[0]*100:.1f}%)")

print("\n" + "="*70)
print("3. PERMITS BY TOP JURISDICTIONS")
print("="*70)
cur.execute("""
    SELECT jurisdiction, state, COUNT(*), ROUND(SUM(valuation)/1e6, 1)
    FROM normalized_permits
    GROUP BY jurisdiction, state
    ORDER BY COUNT(*) DESC
    LIMIT 20
""")
for jur, st, cnt, val in cur.fetchall():
    print(f"  • {jur:<25} ({st}): {cnt:>6,} permits | ${val:>8,.1f}M")

print("\n" + "="*70)
print("4. CONTRACTORS ENRICHMENT COMPLETENESS")
print("="*70)
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN phone_number IS NOT NULL AND phone_number != '' THEN 1 END) as has_phone,
        COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as has_website,
        COUNT(CASE WHEN hq_address IS NOT NULL AND hq_address != '' THEN 1 END) as has_hq,
        COUNT(CASE WHEN leadership IS NOT NULL AND leadership != '' THEN 1 END) as has_lead,
        COUNT(CASE WHEN manufacturer_certifications IS NOT NULL AND manufacturer_certifications != '' THEN 1 END) as has_certs,
        COUNT(CASE WHEN m_and_a_profile IS NOT NULL AND m_and_a_profile != '' THEN 1 END) as has_ma,
        COUNT(CASE WHEN crew_capacity_estimate IS NOT NULL AND crew_capacity_estimate != '' THEN 1 END) as has_crew
    FROM canonical_contractors
""")
cr = cur.fetchone()
print(f"  Total Canonical Contractors   : {cr[0]:>8,}")
print(f"  With Phone Number             : {cr[1]:>8,} ({cr[1]/cr[0]*100:.1f}%)")
print(f"  With Website URL              : {cr[2]:>8,} ({cr[2]/cr[0]*100:.1f}%)")
print(f"  With HQ Address               : {cr[3]:>8,} ({cr[3]/cr[0]*100:.1f}%)")
print(f"  With Leadership Names         : {cr[4]:>8,} ({cr[4]/cr[0]*100:.1f}%)")
print(f"  With Manufacturer Certs       : {cr[5]:>8,} ({cr[5]/cr[0]*100:.1f}%)")
print(f"  With M&A Profile              : {cr[6]:>8,} ({cr[6]/cr[0]*100:.1f}%)")
print(f"  With Crew Capacity Estimate   : {cr[7]:>8,} ({cr[7]/cr[0]*100:.1f}%)")

print("\n" + "="*70)
print("5. PARCELS REAL VS MOCK & GEOLOCATION")
print("="*70)
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id LIKE 'MOCK-%' THEN 1 END) as mock_cnt,
        COUNT(CASE WHEN id NOT LIKE 'MOCK-%' THEN 1 END) as real_cnt,
        COUNT(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 END) as geo_cnt,
        COUNT(CASE WHEN owner_name IS NOT NULL AND owner_name != '' THEN 1 END) as owner_cnt
    FROM parcels
""")
pr = cur.fetchone()
print(f"  Total Parcels                 : {pr[0]:>8,}")
print(f"  Real Harvested Parcels        : {pr[2]:>8,} ({pr[2]/pr[0]*100:.1f}%)")
print(f"  Mock Seeded Parcels           : {pr[1]:>8,} ({pr[1]/pr[0]*100:.1f}%)")
print(f"  With Lat/Lon Geocodes         : {pr[3]:>8,} ({pr[3]/pr[0]*100:.1f}%)")
print(f"  With Owner Name               : {pr[4]:>8,} ({pr[4]/pr[0]*100:.1f}%)")

print("\n" + "="*70)
print("6. SCORED PARCEL LEADS REAL VS MOCK")
print("="*70)
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN parcel_id LIKE 'MOCK-%' THEN 1 END) as mock_cnt,
        COUNT(CASE WHEN parcel_id NOT LIKE 'MOCK-%' THEN 1 END) as real_cnt,
        COUNT(CASE WHEN lead_tier = 'core' THEN 1 END) as core_cnt,
        COUNT(CASE WHEN lead_tier = 'envelope' THEN 1 END) as env_cnt
    FROM scored_parcel_leads
""")
sl = cur.fetchone()
print(f"  Total Scored Parcel Leads     : {sl[0]:>8,}")
print(f"  Real Scored Leads             : {sl[2]:>8,} ({sl[2]/sl[0]*100:.1f}%)")
print(f"  Mock Scored Leads             : {sl[1]:>8,} ({sl[1]/sl[0]*100:.1f}%)")
print(f"  Core Tier (Severe Damage)     : {sl[3]:>8,} ({sl[3]/sl[0]*100:.1f}%)")
print(f"  Envelope Tier                 : {sl[4]:>8,} ({sl[4]/sl[0]*100:.1f}%)")

print("\n" + "="*70)
print("7. STORM SWATHS")
print("="*70)
cur.execute("""
    SELECT COUNT(*), MIN(event_date), MAX(event_date),
           COUNT(CASE WHEN max_hail_inches >= 1.75 THEN 1 END)
    FROM storm_swaths
""")
st = cur.fetchone()
print(f"  Total Storm Swaths            : {st[0]:>8,}")
print(f"  Date Range                    : {st[1]} to {st[2]}")
print(f"  Severe Hail (>= 1.75 inch)    : {st[3]:>8,}")
