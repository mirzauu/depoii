"""02 — geography, storms, permits, eligibility, scoring leakage. Read-only."""
import sqlite3
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\02_geo_storms_permits.txt"
conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
cur = conn.cursor()
L = [f"RUN_UTC {datetime.now(timezone.utc).isoformat()}"]

def q(title, sql):
    L.append("\n=== " + title + " ===")
    L.append("SQL: " + " ".join(sql.split()))
    rows = cur.execute(sql).fetchall()
    L.append(f"ROWS {len(rows)}")
    for r in rows[:100]:
        L.append(" | ".join("" if x is None else str(x) for x in r))
    if len(rows) > 100:
        L.append(f"... truncated {len(rows)-100}")
    return rows

q("city x data_source parcels",
  """SELECT COALESCE(city,'(null)') city, COALESCE(data_source,'(null)') src, COUNT(*) n
     FROM parcels GROUP BY 1,2 ORDER BY n DESC""")

q("scored city x verification",
  """SELECT COALESCE(city,'(null)'), verification_status, outbound_ready, COUNT(*) n
     FROM scored_parcel_leads GROUP BY 1,2,3 ORDER BY n DESC""")

q("jurisdiction parcels",
  """SELECT COALESCE(jurisdiction,'(null)'), COALESCE(county,'(null)'), COALESCE(state,'(null)'), COUNT(*) n
     FROM parcels GROUP BY 1,2,3 ORDER BY n DESC""")

q("lat/lon bounds and nulls parcels",
  """SELECT
       SUM(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 ELSE 0 END) null_xy,
       SUM(CASE WHEN latitude BETWEEN 32.4 AND 33.2 AND longitude BETWEEN -97.6 AND -96.4 THEN 1 ELSE 0 END) dfw_box,
       SUM(CASE WHEN latitude BETWEEN 40.4 AND 41.0 AND longitude BETWEEN -74.3 AND -73.6 THEN 1 ELSE 0 END) nyc_box,
       SUM(CASE WHEN latitude BETWEEN 47.2 AND 47.8 AND longitude BETWEEN -122.6 AND -122.0 THEN 1 ELSE 0 END) seattle_box,
       SUM(CASE WHEN ABS(latitude-32.7555)<0.0001 THEN 1 ELSE 0 END) downtown_327555,
       MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude),
       COUNT(*) n
     FROM parcels""")

q("scored lat via join",
  """SELECT
       SUM(CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 1 ELSE 0 END) null_xy,
       SUM(CASE WHEN p.latitude BETWEEN 32.4 AND 33.2 AND p.longitude BETWEEN -97.6 AND -96.4 THEN 1 ELSE 0 END) dfw_box,
       SUM(CASE WHEN p.latitude BETWEEN 40.4 AND 41.0 AND p.longitude BETWEEN -74.3 AND -73.6 THEN 1 ELSE 0 END) nyc_box,
       SUM(CASE WHEN ABS(p.latitude-32.7555)<0.0001 THEN 1 ELSE 0 END) downtown,
       COUNT(*) n
     FROM scored_parcel_leads s LEFT JOIN parcels p ON p.id=s.parcel_id""")

q("outbound ready 6 full",
  """SELECT s.parcel_id, s.address, s.city, s.zip_code, s.owner_name, s.property_type,
            s.building_sqft, s.year_built, s.cad_total_valuation, s.storm_name, s.event_date,
            s.max_hail_inches, s.nearest_hail_distance_mi, s.nearest_hail_size_in,
            s.nearest_hail_location, s.muni_permit_status, s.verification_status,
            s.data_provenance, s.building_sqft_source, s.valuation_source, s.year_built_source,
            s.exposure_score, s.lead_tier, s.why_strong_summary, s.estimated_replacement_mid,
            p.latitude, p.longitude, p.data_source, p.county, p.account_number, p.stories,
            p.footprint_sqft, p.land_sqft, p.is_mock
     FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id
     WHERE s.outbound_ready=1""")

q("storm dates scored",
  """SELECT event_date, storm_name, COUNT(*) n, MIN(nearest_hail_distance_mi), MAX(nearest_hail_distance_mi),
            COUNT(DISTINCT nearest_hail_distance_mi)
     FROM scored_parcel_leads GROUP BY 1,2 ORDER BY n DESC""")

q("storm_swaths",
  """SELECT event_date, storm_name, max_hail_inches, jurisdiction_id, substr(properties,1,180)
     FROM storm_swaths ORDER BY event_date""")

q("why_strong distinct",
  """SELECT why_strong_summary, COUNT(*) n FROM scored_parcel_leads GROUP BY 1 ORDER BY n DESC""")

q("why_weak distinct",
  """SELECT substr(why_weak_summary,1,200), COUNT(*) n FROM scored_parcel_leads GROUP BY 1 ORDER BY n DESC LIMIT 20""")

q("property_type scored top",
  """SELECT COALESCE(property_type,'(null)'), COUNT(*) n
     FROM scored_parcel_leads GROUP BY 1 ORDER BY n DESC LIMIT 40""")

q("property_type parcels top",
  """SELECT COALESCE(property_type,'(null)'), COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC LIMIT 40""")

q("permits jurisdiction geo_quality link",
  """SELECT COALESCE(jurisdiction,'(null)'), COALESCE(geo_quality,'(null)'),
            SUM(CASE WHEN parcel_id IS NOT NULL AND parcel_id!='' THEN 1 ELSE 0 END) linked,
            COUNT(*) n
     FROM normalized_permits GROUP BY 1,2 ORDER BY n DESC""")

q("permits source_system",
  """SELECT COALESCE(source_system,'(null)'), COUNT(*) n,
            SUM(CASE WHEN parcel_id IS NOT NULL AND parcel_id!='' THEN 1 ELSE 0 END) linked
     FROM normalized_permits GROUP BY 1 ORDER BY n DESC""")

q("permit date_quality",
  """SELECT COALESCE(date_quality,'(null)'), COUNT(*) n,
            SUM(CASE WHEN issue_date='2026-10-06' THEN 1 ELSE 0 END) d_20261006,
            SUM(CASE WHEN issue_date='1900-01-01' THEN 1 ELSE 0 END) d_1900,
            SUM(CASE WHEN issue_date IS NULL THEN 1 ELSE 0 END) null_d
     FROM normalized_permits GROUP BY 1""")

q("issue_date top",
  """SELECT issue_date, COUNT(*) n FROM normalized_permits GROUP BY 1 ORDER BY n DESC LIMIT 25""")

q("permit category",
  """SELECT COALESCE(category,'(null)'), COALESCE(permit_scope,'(null)'), COUNT(*) n
     FROM normalized_permits GROUP BY 1,2 ORDER BY n DESC LIMIT 30""")

q("parcels with zero permits",
  """SELECT
       (SELECT COUNT(*) FROM parcels) parcels,
       (SELECT COUNT(DISTINCT parcel_id) FROM normalized_permits WHERE parcel_id IS NOT NULL AND parcel_id!='') parcels_with_any_permit,
       (SELECT COUNT(*) FROM parcels p WHERE NOT EXISTS (
          SELECT 1 FROM normalized_permits n WHERE n.parcel_id=p.id)) zero_permit_parcels
  """)

q("scored permit status",
  """SELECT COALESCE(muni_permit_status,'(null)'), verification_status, COUNT(*) n
     FROM scored_parcel_leads GROUP BY 1,2 ORDER BY n DESC""")

q("exact 0.65 building = round(land*0.65)",
  """SELECT
       SUM(CASE WHEN land_sqft>0 AND building_sqft = CAST(ROUND(land_sqft*0.65) AS INT) THEN 1 ELSE 0 END) eq_round_065,
       SUM(CASE WHEN land_sqft>0 AND building_sqft = CAST(land_sqft*0.65 AS INT) THEN 1 ELSE 0 END) eq_trunc_065,
       SUM(CASE WHEN building_sqft>0 AND ABS(total_valuation - building_sqft*165.0)<1 THEN 1 ELSE 0 END) val165,
       SUM(CASE WHEN building_sqft>0 AND ABS(total_valuation - building_sqft*175.0)<1 THEN 1 ELSE 0 END) val175,
       SUM(CASE WHEN building_sqft>0 AND ABS(total_valuation - building_sqft*45.0)<1 THEN 1 ELSE 0 END) val45,
       COUNT(*) n
     FROM parcels""")

q("scored val = sqft*165 by provenance",
  """SELECT data_provenance, verification_status, outbound_ready,
            SUM(CASE WHEN building_sqft>0 AND ABS(cad_total_valuation - building_sqft*165.0)<1 THEN 1 ELSE 0 END) v165,
            COUNT(*) n
     FROM scored_parcel_leads GROUP BY 1,2,3 ORDER BY v165 DESC""")

q("year_built decade spikes share",
  """SELECT
       SUM(CASE WHEN year_built IN (1900,1910,1920,1925,1930,1931,1940,1950,1955,1960,1965,1970,1975,1980,1985) THEN 1 ELSE 0 END) round_years,
       SUM(CASE WHEN year_built IS NULL THEN 1 ELSE 0 END) nulls,
       COUNT(*) n
     FROM parcels""")

q("round years by data_source",
  """SELECT data_source,
       SUM(CASE WHEN year_built IN (1900,1910,1920,1925,1930,1931) THEN 1 ELSE 0 END) early_round,
       COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")

q("field_provenance status",
  """SELECT status, COUNT(*) n FROM field_provenance GROUP BY 1 ORDER BY n DESC""")

q("field_provenance top column status",
  """SELECT table_name, column_name, status, COUNT(*) n
     FROM field_provenance GROUP BY 1,2,3 ORDER BY n DESC LIMIT 40""")

q("is_mock distribution",
  """SELECT 'parcels' t, is_mock, COUNT(*) FROM parcels GROUP BY 2
     UNION ALL
     SELECT 'scored', is_mock, COUNT(*) FROM scored_parcel_leads GROUP BY 2
     UNION ALL
     SELECT 'permits_mock_col_absent', NULL, COUNT(*) FROM normalized_permits""")

text = "\n".join(L) + "\n"
with open(OUT, "w", encoding="utf-8") as f:
    f.write(text)
print(text[:80000])
print("\n---WROTE", OUT, "chars", len(text))
conn.close()
