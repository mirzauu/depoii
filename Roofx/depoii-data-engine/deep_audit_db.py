import sqlite3
import json

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

report = {}

# 1. Total counts
report["counts"] = {}
for tbl in ["normalized_permits", "canonical_contractors", "parcels", "scored_parcel_leads", "storm_swaths"]:
    cur.execute(f"SELECT count(*) FROM {tbl}")
    report["counts"][tbl] = cur.fetchone()[0]

# 2. Permits overview
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
report["permits_health"] = {
    "total": r[0],
    "linked_contractor": r[1],
    "linked_contractor_pct": round(r[1] / r[0] * 100, 1) if r[0] else 0,
    "linked_parcel": r[2],
    "linked_parcel_pct": round(r[2] / r[0] * 100, 1) if r[0] else 0,
    "linked_storm": r[3],
    "linked_storm_pct": round(r[3] / r[0] * 100, 1) if r[0] else 0,
    "has_lat_lon": r[4],
    "has_lat_lon_pct": round(r[4] / r[0] * 100, 1) if r[0] else 0,
    "missing_valuation": r[5],
    "missing_sqft": r[6],
    "unknown_roof": r[7]
}

# 3. Permits by jurisdiction / city / state
cur.execute("""
    SELECT COALESCE(jurisdiction, 'UNKNOWN'), COALESCE(state, 'UNKNOWN'), COUNT(*), ROUND(SUM(valuation)/1e6, 2)
    FROM normalized_permits
    GROUP BY jurisdiction, state
    ORDER BY COUNT(*) DESC
""")
report["permits_by_jurisdiction"] = [
    {"jurisdiction": row[0], "state": row[1], "count": row[2], "val_millions": row[3]}
    for row in cur.fetchall()
]

# 4. Contractor enrichment stats
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN phone_number IS NOT NULL AND phone_number != '' THEN 1 END) as has_phone,
        COUNT(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 END) as has_website,
        COUNT(CASE WHEN hq_address IS NOT NULL AND hq_address != '' THEN 1 END) as has_hq_address,
        COUNT(CASE WHEN leadership IS NOT NULL AND leadership != '' THEN 1 END) as has_leadership,
        COUNT(CASE WHEN manufacturer_certifications IS NOT NULL AND manufacturer_certifications != '' THEN 1 END) as has_certs,
        COUNT(CASE WHEN m_and_a_profile IS NOT NULL AND m_and_a_profile != '' THEN 1 END) as has_ma_profile,
        COUNT(CASE WHEN crew_capacity_estimate IS NOT NULL AND crew_capacity_estimate != '' THEN 1 END) as has_crew_cap
    FROM canonical_contractors
""")
cr = cur.fetchone()
report["contractors_health"] = {
    "total": cr[0],
    "has_phone": cr[1],
    "has_website": cr[2],
    "has_hq_address": cr[3],
    "has_leadership": cr[4],
    "has_certs": cr[5],
    "has_ma_profile": cr[6],
    "has_crew_cap": cr[7]
}

# 5. Parcels stats: real vs mock, by city/state, coordinates
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id LIKE 'MOCK-%' THEN 1 END) as mock_parcels,
        COUNT(CASE WHEN id NOT LIKE 'MOCK-%' THEN 1 END) as real_parcels,
        COUNT(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 END) as has_lat_lon,
        COUNT(CASE WHEN owner_name IS NOT NULL AND owner_name != '' THEN 1 END) as has_owner,
        COUNT(CASE WHEN total_valuation > 0 THEN 1 END) as has_valuation,
        COUNT(CASE WHEN building_sqft > 0 THEN 1 END) as has_sqft,
        COUNT(CASE WHEN year_built > 0 THEN 1 END) as has_year_built
    FROM parcels
""")
pr = cur.fetchone()
report["parcels_health"] = {
    "total": pr[0],
    "mock_parcels": pr[1],
    "real_parcels": pr[2],
    "has_lat_lon": pr[3],
    "has_owner": pr[4],
    "has_valuation": pr[5],
    "has_sqft": pr[6],
    "has_year_built": pr[7]
}

# Parcels by city / state
cur.execute("""
    SELECT COALESCE(city, 'UNKNOWN'), COALESCE(state, 'UNKNOWN'), 
           COUNT(*), 
           COUNT(CASE WHEN id LIKE 'MOCK-%' THEN 1 END) as mock_count,
           COUNT(CASE WHEN id NOT LIKE 'MOCK-%' THEN 1 END) as real_count
    FROM parcels
    GROUP BY city, state
    ORDER BY COUNT(*) DESC
""")
report["parcels_by_city"] = [
    {"city": row[0], "state": row[1], "total": row[2], "mock": row[3], "real": row[4]}
    for row in cur.fetchall()
]

# 6. Scored Parcel Leads
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN parcel_id LIKE 'MOCK-%' THEN 1 END) as mock_scored,
        COUNT(CASE WHEN parcel_id NOT LIKE 'MOCK-%' THEN 1 END) as real_scored,
        COUNT(CASE WHEN lead_tier = 'core' THEN 1 END) as tier_core,
        COUNT(CASE WHEN lead_tier = 'envelope' THEN 1 END) as tier_envelope
    FROM scored_parcel_leads
""")
slr = cur.fetchone()
report["scored_leads_health"] = {
    "total": slr[0],
    "mock_scored": slr[1],
    "real_scored": slr[2],
    "tier_core": slr[3],
    "tier_envelope": slr[4]
}

cur.execute("""
    SELECT COALESCE(city, 'UNKNOWN'), COALESCE(state, 'UNKNOWN'), COUNT(*),
           COUNT(CASE WHEN parcel_id LIKE 'MOCK-%' THEN 1 END) as mock_count,
           COUNT(CASE WHEN parcel_id NOT LIKE 'MOCK-%' THEN 1 END) as real_count
    FROM scored_parcel_leads
    GROUP BY city, state
    ORDER BY COUNT(*) DESC
""")
report["scored_leads_by_city"] = [
    {"city": row[0], "state": row[1], "total": row[2], "mock": row[3], "real": row[4]}
    for row in cur.fetchall()
]

# 7. Storm Swaths stats
cur.execute("""
    SELECT COUNT(*), MIN(event_date), MAX(event_date),
           COUNT(CASE WHEN max_hail_inches >= 1.75 THEN 1 END) as severe_hail
    FROM storm_swaths
""")
sr = cur.fetchone()
report["storms_health"] = {
    "total": sr[0],
    "min_date": sr[1],
    "max_date": sr[2],
    "severe_hail_ge_1_75": sr[3]
}

print(json.dumps(report, indent=2))
