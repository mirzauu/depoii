import sqlite3

conn = sqlite3.connect(r'd:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db')
cur = conn.cursor()

# Check property types and uses in parcels
print("=== INSPECTING CANDIDATE PARCELS IN TAD ===")
pids = [
    "TAD-PARCEL-00788821", # 6777 Camp Bowie
    "TAD-PARCEL-06350739", # 6353 Camp Bowie
    "TAD-PARCEL-01077848", # 3100 Sappington Pl
    "TAD-PARCEL-00973742", # 201 Ne 28th St
    "TAD-PARCEL-00973688", # 2701 Decatur Ave
]

for pid in pids:
    row = cur.execute("""
        SELECT p.id, p.address, p.owner_name, p.property_type, p.building_sqft, p.year_built,
               l.cad_property_class, l.why_strong_summary, l.aerial_snapshot_url, l.aerial_capture_date
        FROM parcels p
        LEFT JOIN scored_parcel_leads l ON l.parcel_id = p.id
        WHERE p.id = ?
    """, (pid,)).fetchone()
    print(f"\n[{row[0]}] {row[1]}")
    print(f"  Owner: {row[2]} | Prop Type: {row[3]} | SqFt: {row[4]:,} | Built: {row[5]}")
    print(f"  CAD Class: {row[6]} | Aerial URL: {row[8]} | Aerial Date: {row[9]}")

# Let's find replacement commercial candidates for Ducker in South Fort Worth / Benbrook / I-35W / McCart
# that are NOT in manual_disqualifications
print("\n=== FINDING REPLACEMENT COMMERCIAL CANDIDATES FOR DUCKER ===")
ducker_candidates = cur.execute("""
    SELECT p.id, p.address, p.owner_name, p.property_type, p.building_sqft, p.year_built,
           l.roof_age_years, l.roof_age_basis, l.nearest_hail_distance_mi, l.nearest_hail_size_in, l.nearest_hail_location
    FROM parcels p
    JOIN scored_parcel_leads l ON l.parcel_id = p.id
    WHERE l.verification_status IN ('VERIFIED', 'NON_ROOF_PERMIT_DETECTED')
      AND (l.muni_permit_status IS NULL OR l.muni_permit_status IN ('NO_POST_STORM_ROOF_PERMIT_FOUND', 'NON_ROOF_PERMIT_DETECTED'))
      AND l.roof_age_years >= 10
      AND l.nearest_hail_distance_mi <= 1.5
      AND p.building_sqft >= 20000
      AND p.id NOT IN (SELECT parcel_id FROM manual_disqualifications)
      AND p.address NOT LIKE '%Benbrook%'
      AND p.address NOT LIKE '%Brown%'
      AND p.address NOT LIKE '%Loop%'
      AND p.address NOT LIKE '%Cullen%'
      AND UPPER(p.owner_name) NOT LIKE '%APARTMENT%'
      AND UPPER(p.owner_name) NOT LIKE '%CHURCH%'
      AND UPPER(p.owner_name) NOT LIKE '%HOSPITAL%'
      AND UPPER(p.property_type) NOT LIKE '%RESIDENTIAL%'
      AND UPPER(p.property_type) NOT LIKE '%MULTIFAMILY%'
    ORDER BY l.nearest_hail_distance_mi ASC
    LIMIT 15
""").fetchall()

for c in ducker_candidates:
    print(f"[{c[0]}] {c[1]} | {c[2]} | {c[3]} | {c[4]:,} sqft | Built: {c[5]} | Age: {c[6]}y ({c[7]}) | Hail: {c[9]}\" at {c[8]} mi ({c[10]})")
