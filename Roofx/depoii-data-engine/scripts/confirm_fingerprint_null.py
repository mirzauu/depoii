import sqlite3
import sys

db = sys.argv[1]
conn = sqlite3.connect(db)
queries = {
    "v165": "SELECT COUNT(*) FROM scored_parcel_leads WHERE building_sqft>0 AND ABS(cad_total_valuation - building_sqft * 165) < 1",
    "y1996": "SELECT COUNT(*) FROM parcels WHERE year_built = 1996 AND lower(COALESCE(year_built_source, '')) = 'missing'",
    "fp": "SELECT COUNT(*) FROM parcels WHERE land_sqft > 0 AND footprint_sqft = CAST(ROUND(land_sqft * 0.65) AS INT)",
    "d15": "SELECT COUNT(*) FROM scored_parcel_leads WHERE ABS(nearest_hail_distance_mi - 1.5) < 0.001",
    "m17": "SELECT COUNT(*) FROM scored_parcel_leads WHERE event_date = '2026-03-17'",
}
for name, sql in queries.items():
    print(name, conn.execute(sql).fetchone()[0])
try:
    print("released", conn.execute("SELECT COUNT(*) FROM released_leads").fetchone()[0])
except sqlite3.OperationalError as exc:
    print("released", exc)
