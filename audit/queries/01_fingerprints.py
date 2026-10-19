"""01 — arithmetic fingerprints, value piles, provenance, eligibility. Read-only."""
import sqlite3
from collections import Counter
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\01_fingerprints.txt"

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
L = []

def q(title, sql, params=()):
    L.append("\n=== " + title + " ===")
    L.append("SQL: " + " ".join(sql.split()))
    rows = cur.execute(sql, params).fetchall()
    L.append(f"ROWS {len(rows)}")
    for r in rows[:80]:
        L.append(" | ".join(str(x) for x in r))
    if len(rows) > 80:
        L.append(f"... truncated {len(rows)-80} more")
    return rows

L.append(f"RUN_UTC {datetime.now(timezone.utc).isoformat()}")

q("release_fields", "SELECT table_name, column_name FROM release_fields ORDER BY 1,2")
q("release_parcels_sql", "SELECT sql FROM sqlite_master WHERE name='release_parcels'")
q("release_permits_sql", "SELECT sql FROM sqlite_master WHERE name='release_permits'")

q("parcel counts by provenance",
  """SELECT COALESCE(data_provenance,'(null)') src, COUNT(*) n,
            SUM(CASE WHEN is_mock=1 THEN 1 ELSE 0 END) mock_n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")

q("scored counts by provenance",
  """SELECT COALESCE(data_provenance,'(null)') src,
            COALESCE(verification_status,'(null)') vst,
            COALESCE(outbound_ready,-1) ready,
            COUNT(*) n
     FROM scored_parcel_leads GROUP BY 1,2,3 ORDER BY n DESC""")

q("scored outbound ready",
  """SELECT outbound_ready, COUNT(*) n,
            SUM(CASE WHEN is_mock=1 THEN 1 ELSE 0 END) mock_n
     FROM scored_parcel_leads GROUP BY 1""")

# Fingerprints on parcels
q("ratio building/land exact constants parcels",
  """SELECT ROUND(1.0*building_sqft/land_sqft, 6) ratio, COUNT(*) n
     FROM parcels
     WHERE land_sqft IS NOT NULL AND land_sqft > 0 AND building_sqft IS NOT NULL
     GROUP BY 1
     HAVING n >= 10
     ORDER BY n DESC
     LIMIT 30""")

q("valuation per sqft exact constants parcels",
  """SELECT ROUND(1.0*total_valuation/building_sqft, 4) usd_per_sf, COUNT(*) n
     FROM parcels
     WHERE building_sqft IS NOT NULL AND building_sqft > 0 AND total_valuation IS NOT NULL
     GROUP BY 1
     HAVING n >= 10
     ORDER BY n DESC
     LIMIT 40""")

q("exact fingerprint counts parcels",
  """SELECT
       SUM(CASE WHEN land_sqft>0 AND ABS(1.0*building_sqft/land_sqft - 0.65) < 1e-9 THEN 1 ELSE 0 END) ratio_065,
       SUM(CASE WHEN building_sqft>0 AND ABS(1.0*total_valuation/building_sqft - 165) < 0.01 THEN 1 ELSE 0 END) val_165,
       SUM(CASE WHEN building_sqft>0 AND ABS(1.0*total_valuation/building_sqft - 175) < 0.01 THEN 1 ELSE 0 END) val_175,
       SUM(CASE WHEN total_valuation = 145000 THEN 1 ELSE 0 END) val_145k,
       SUM(CASE WHEN total_valuation = 95000 THEN 1 ELSE 0 END) val_95k,
       SUM(CASE WHEN year_built IN (1996,1997,1998) THEN 1 ELSE 0 END) yb_9698,
       COUNT(*) n
     FROM parcels""")

q("exact fingerprint counts scored",
  """SELECT
       SUM(CASE WHEN building_sqft>0 AND ABS(1.0*cad_total_valuation/building_sqft - 165) < 0.01 THEN 1 ELSE 0 END) val_165,
       SUM(CASE WHEN building_sqft>0 AND ABS(1.0*cad_total_valuation/building_sqft - 175) < 0.01 THEN 1 ELSE 0 END) val_175,
       SUM(CASE WHEN cad_total_valuation = 145000 THEN 1 ELSE 0 END) val_145k,
       SUM(CASE WHEN cad_total_valuation = 95000 THEN 1 ELSE 0 END) val_95k,
       SUM(CASE WHEN year_built IN (1996,1997,1998) THEN 1 ELSE 0 END) yb_9698,
       COUNT(*) n
     FROM scored_parcel_leads""")

q("year_built histogram parcels top",
  """SELECT year_built, COUNT(*) n FROM parcels GROUP BY 1 ORDER BY n DESC LIMIT 25""")

q("year_built by provenance top spikes",
  """SELECT COALESCE(data_provenance,'(null)'), year_built, COUNT(*) n
     FROM parcels
     WHERE year_built IN (1996,1997,1998) OR year_built IS NULL
     GROUP BY 1,2 ORDER BY n DESC""")

q("building_sqft top values parcels",
  """SELECT building_sqft, COUNT(*) n FROM parcels GROUP BY 1 ORDER BY n DESC LIMIT 20""")

q("valuation top values parcels",
  """SELECT total_valuation, COUNT(*) n FROM parcels GROUP BY 1 ORDER BY n DESC LIMIT 20""")

q("uniqueness rates parcels key cols",
  """SELECT
       COUNT(*) n,
       COUNT(DISTINCT building_sqft) d_sqft,
       COUNT(DISTINCT year_built) d_year,
       COUNT(DISTINCT total_valuation) d_val,
       COUNT(DISTINCT property_type) d_type,
       COUNT(DISTINCT owner_name) d_owner,
       COUNT(DISTINCT address) d_addr
     FROM parcels""")

q("uniqueness scored",
  """SELECT COUNT(*) n,
       COUNT(DISTINCT building_sqft) d_sqft,
       COUNT(DISTINCT year_built) d_year,
       COUNT(DISTINCT cad_total_valuation) d_val,
       COUNT(DISTINCT storm_name) d_storm,
       COUNT(DISTINCT event_date) d_date,
       COUNT(DISTINCT nearest_hail_distance_mi) d_dist,
       COUNT(DISTINCT why_strong_summary) d_why
     FROM scored_parcel_leads""")

q("source columns parcels",
  """SELECT COALESCE(building_sqft_source,'(null)') s, COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")
q("valuation_source parcels",
  """SELECT COALESCE(valuation_source,'(null)') s, COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")
q("year_built_source parcels",
  """SELECT COALESCE(year_built_source,'(null)') s, COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")
q("data_source parcels",
  """SELECT COALESCE(data_source,'(null)') s, COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")
q("area_source parcels",
  """SELECT COALESCE(area_source,'(null)') s, COUNT(*) n
     FROM parcels GROUP BY 1 ORDER BY n DESC""")

q("year_built vs source cross",
  """SELECT COALESCE(year_built_source,'(null)') src, year_built, COUNT(*) n
     FROM parcels
     GROUP BY 1,2
     HAVING n >= 20
     ORDER BY n DESC
     LIMIT 40""")

q("stories vs building vs footprint",
  """SELECT
       SUM(CASE WHEN stories IS NULL THEN 1 ELSE 0 END) stories_null,
       SUM(CASE WHEN stories > 1 THEN 1 ELSE 0 END) stories_gt1,
       SUM(CASE WHEN footprint_sqft IS NOT NULL AND building_sqft IS NOT NULL
                AND footprint_sqft = building_sqft THEN 1 ELSE 0 END) footprint_eq_bldg,
       SUM(CASE WHEN footprint_sqft IS NOT NULL AND building_sqft IS NOT NULL
                AND stories > 1 AND footprint_sqft <> building_sqft THEN 1 ELSE 0 END) multistory_diff,
       SUM(CASE WHEN footprint_sqft IS NULL THEN 1 ELSE 0 END) footprint_null,
       COUNT(*) n
     FROM parcels""")

q("scored stories-like: footprint vs building",
  """SELECT
       SUM(CASE WHEN s.footprint_sqft IS NULL THEN 1 ELSE 0 END) fp_null,
       SUM(CASE WHEN s.footprint_sqft = s.building_sqft THEN 1 ELSE 0 END) eq,
       SUM(CASE WHEN p.stories > 1 THEN 1 ELSE 0 END) stories_gt1,
       SUM(CASE WHEN p.stories > 1 AND s.building_sqft = s.footprint_sqft THEN 1 ELSE 0 END) multi_eq,
       COUNT(*) n
     FROM scored_parcel_leads s
     LEFT JOIN parcels p ON p.id = s.parcel_id""")

text = "\n".join(L) + "\n"
with open(OUT, "w", encoding="utf-8") as f:
    f.write(text)
print(text)
conn.close()
