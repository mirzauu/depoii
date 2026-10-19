"""03 — customer-facing population, eligibility, date defaults, distance piles. Read-only."""
import sqlite3
from datetime import datetime, timezone

DB = r"d:\Depoii_nextjs\audit\depoii_local_audit_copy.db"
OUT = r"d:\Depoii_nextjs\audit\queries\03_customer_surface_and_eligibility.txt"
conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
cur = conn.cursor()
L = [f"RUN_UTC {datetime.now(timezone.utc).isoformat()}"]

def q(title, sql):
    L.append("\n=== " + title + " ===")
    L.append("SQL: " + " ".join(sql.split()))
    rows = cur.execute(sql).fetchall()
    L.append(f"ROWS {len(rows)}")
    for r in rows[:60]:
        L.append(" | ".join("" if x is None else str(x) for x in r))
    if len(rows) > 60:
        L.append(f"... truncated {len(rows)-60}")
    return rows

q("API ranked population exposure>=60 by city state",
  """SELECT COALESCE(city,'(null)'), COALESCE(state,'(null)'), COUNT(*) n,
            SUM(CASE WHEN data_provenance='unverified_seed' THEN 1 ELSE 0 END) seed_n,
            SUM(CASE WHEN outbound_ready=1 THEN 1 ELSE 0 END) ready_n
     FROM scored_parcel_leads
     WHERE exposure_score >= 60 AND COALESCE(is_mock,0)=0
     GROUP BY 1,2 ORDER BY n DESC""")

q("exposure score bands all scored",
  """SELECT
       SUM(CASE WHEN exposure_score>=60 THEN 1 ELSE 0 END) ge60,
       SUM(CASE WHEN exposure_score>=85 THEN 1 ELSE 0 END) ge85,
       SUM(CASE WHEN exposure_score=0 THEN 1 ELSE 0 END) zero,
       MIN(exposure_score), MAX(exposure_score), COUNT(*)
     FROM scored_parcel_leads""")

q("distance value piles",
  """SELECT nearest_hail_distance_mi, COUNT(*) n
     FROM scored_parcel_leads
     GROUP BY 1 ORDER BY n DESC LIMIT 15""")

q("distance exactly 1.5 or 999 by storm",
  """SELECT event_date, storm_name,
            SUM(CASE WHEN nearest_hail_distance_mi=1.5 THEN 1 ELSE 0 END) d15,
            SUM(CASE WHEN nearest_hail_distance_mi=999 THEN 1 ELSE 0 END) d999,
            SUM(CASE WHEN nearest_hail_distance_mi IS NULL THEN 1 ELSE 0 END) dnull,
            COUNT(*) n
     FROM scored_parcel_leads GROUP BY 1,2 ORDER BY n DESC""")

q("scored valuation vs parcel valuation",
  """SELECT
       SUM(CASE WHEN ABS(COALESCE(s.cad_total_valuation,0) - COALESCE(p.total_valuation,0)) < 1 THEN 1 ELSE 0 END) match_val,
       SUM(CASE WHEN s.building_sqft>0 AND ABS(s.cad_total_valuation - s.building_sqft*165.0)<1
                 AND ABS(COALESCE(p.total_valuation,0) - s.building_sqft*165.0)>=1 THEN 1 ELSE 0 END) scored165_parcel_not,
       SUM(CASE WHEN s.building_sqft>0 AND ABS(s.cad_total_valuation - s.building_sqft*165.0)<1 THEN 1 ELSE 0 END) scored165,
       SUM(CASE WHEN s.year_built IS NOT NULL AND p.year_built IS NOT NULL AND s.year_built<>p.year_built THEN 1 ELSE 0 END) year_mismatch,
       COUNT(*) n
     FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id""")

q("165 fingerprint by city",
  """SELECT s.city, COUNT(*) n
     FROM scored_parcel_leads s
     WHERE s.building_sqft>0 AND ABS(s.cad_total_valuation - s.building_sqft*165.0)<1
     GROUP BY 1 ORDER BY n DESC""")

q("0.65 parcels by data_source city",
  """SELECT data_source, city, COUNT(*) n
     FROM parcels
     WHERE land_sqft>0 AND building_sqft = CAST(ROUND(land_sqft*0.65) AS INT)
     GROUP BY 1,2 ORDER BY n DESC""")

q("year 1996-1998 by city and source",
  """SELECT city, COALESCE(year_built_source,'(null)'), year_built, COUNT(*) n
     FROM parcels WHERE year_built IN (1996,1997,1998)
     GROUP BY 1,2,3 ORDER BY n DESC LIMIT 30""")

q("residential-like property types in exposure>=60",
  """SELECT COALESCE(property_type,'(null)') pt, COUNT(*) n
     FROM scored_parcel_leads
     WHERE exposure_score>=60 AND (
        UPPER(property_type) LIKE '%APART%'
        OR UPPER(property_type) LIKE '%RESIDENT%'
        OR UPPER(property_type) LIKE '%SINGLE FAMILY%'
        OR UPPER(property_type) LIKE '%CHURCH%'
        OR UPPER(property_type) LIKE '%VACANT%'
        OR UPPER(property_type) LIKE '%EXEMPT%'
        OR property_type IN ('A1','A2','A3','A4','A5','A9','B1','B2','B3','B9','C0','C1','D1','D4','RM')
        OR UPPER(COALESCE(owner_name,'')) LIKE '%APARTMENT%'
        OR UPPER(COALESCE(owner_name,'')) LIKE '%CHURCH%'
        OR UPPER(COALESCE(owner_name,'')) LIKE '% CITY OF%'
        OR UPPER(COALESCE(owner_name,'')) LIKE 'CITY OF%'
        OR UPPER(COALESCE(owner_name,'')) LIKE '%ISD%'
     )
     GROUP BY 1 ORDER BY n DESC LIMIT 40""")

q("eligibility flags all scored",
  """SELECT
       SUM(CASE WHEN UPPER(COALESCE(property_type,'')) LIKE '%APART%' OR UPPER(COALESCE(owner_name,'')) LIKE '%APARTMENT%' THEN 1 ELSE 0 END) apt,
       SUM(CASE WHEN UPPER(COALESCE(property_type,'')) LIKE '%SINGLE FAMILY%' OR UPPER(COALESCE(property_type,'')) LIKE '%RESIDENT%' THEN 1 ELSE 0 END) res_word,
       SUM(CASE WHEN property_type IN ('A1','A2','A3','A4','A5','A9','B1','B2','B3') THEN 1 ELSE 0 END) nyc_small_res_class,
       SUM(CASE WHEN UPPER(COALESCE(owner_name,'')) LIKE '%CHURCH%' OR UPPER(COALESCE(owner_name,'')) LIKE '%BAPTIST%' THEN 1 ELSE 0 END) church,
       SUM(CASE WHEN UPPER(COALESCE(owner_name,'')) LIKE 'CITY OF %' OR UPPER(COALESCE(owner_name,'')) LIKE '% COUNTY' THEN 1 ELSE 0 END) gov,
       SUM(CASE WHEN UPPER(COALESCE(property_type,'')) LIKE '%VACANT%' OR building_sqft=0 THEN 1 ELSE 0 END) vacant_or_zero_sqft,
       COUNT(*) n
     FROM scored_parcel_leads""")

q("same flags inside API ge60",
  """SELECT
       SUM(CASE WHEN property_type IN ('A1','A2','A3','A4','A5','A9','B1','B2','B3','C0','D1') THEN 1 ELSE 0 END) nyc_housing_class,
       SUM(CASE WHEN UPPER(COALESCE(property_type,'')) LIKE '%SINGLE FAMILY%' THEN 1 ELSE 0 END) sf,
       SUM(CASE WHEN UPPER(COALESCE(owner_name,'')) LIKE '%APARTMENT%' THEN 1 ELSE 0 END) apt_owner,
       SUM(CASE WHEN state<>'TX' THEN 1 ELSE 0 END) non_tx,
       COUNT(*) n
     FROM scored_parcel_leads WHERE exposure_score>=60""")

q("issue_date 2026-10-06 by source and jurisdiction",
  """SELECT source_system, jurisdiction, date_quality, COUNT(*) n
     FROM normalized_permits WHERE issue_date='2026-10-06'
     GROUP BY 1,2,3 ORDER BY n DESC""")

q("default dallas fingerprints",
  """SELECT
       SUM(CASE WHEN issue_date='2024-01-01' THEN 1 ELSE 0 END) d20240101,
       SUM(CASE WHEN valuation=75000 THEN 1 ELSE 0 END) v75k,
       SUM(CASE WHEN valuation=20000 THEN 1 ELSE 0 END) v20k,
       SUM(CASE WHEN valuation=145000 THEN 1 ELSE 0 END) v145,
       SUM(CASE WHEN valuation=95000 THEN 1 ELSE 0 END) v95,
       SUM(CASE WHEN zip_code='75201' THEN 1 ELSE 0 END) zip75201,
       COUNT(*) n
     FROM normalized_permits WHERE source_system='DALLAS_ARCGIS_FY24'""")

q("dallas link rate by source",
  """SELECT source_system,
            SUM(CASE WHEN parcel_id IS NOT NULL AND parcel_id!='' THEN 1 ELSE 0 END) linked,
            COUNT(*) n
     FROM normalized_permits
     WHERE jurisdiction LIKE '%Dallas%' OR city='Dallas'
     GROUP BY 1 ORDER BY n DESC""")

q("fw geo quality link",
  """SELECT geo_quality,
            SUM(CASE WHEN parcel_id IS NOT NULL AND parcel_id!='' THEN 1 ELSE 0 END) linked,
            COUNT(*) n
     FROM normalized_permits WHERE jurisdiction LIKE '%Fort Worth%'
     GROUP BY 1""")

q("zip vs city mismatches scored TX sample counts",
  """SELECT
       SUM(CASE WHEN city='Dallas' AND substr(zip_code,1,3) NOT IN ('752','750','751') THEN 1 ELSE 0 END) dallas_bad_zip3,
       SUM(CASE WHEN city='Fort Worth' AND substr(COALESCE(zip_code,''),1,3) NOT IN ('761','760') THEN 1 ELSE 0 END) fw_bad_zip3,
       SUM(CASE WHEN city='Dallas' THEN 1 ELSE 0 END) dallas_n,
       SUM(CASE WHEN city='Fort Worth' THEN 1 ELSE 0 END) fw_n
     FROM scored_parcel_leads""")

q("outbound zip check",
  """SELECT address, city, zip_code, latitude, longitude FROM (
       SELECT s.address, s.city, s.zip_code, p.latitude, p.longitude
       FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id
       WHERE s.outbound_ready=1
     )""")

q("stories>1 scored with building used as roof proxy",
  """SELECT s.parcel_id, s.address, s.building_sqft, s.footprint_sqft, p.stories, s.estimated_replacement_mid
     FROM scored_parcel_leads s JOIN parcels p ON p.id=s.parcel_id
     WHERE COALESCE(p.stories,1)>1""")

q("may 28 or june 2 in swaths or leads",
  """SELECT 'swath' src, event_date, storm_name, max_hail_inches FROM storm_swaths
     WHERE event_date IN ('2024-05-28','2026-05-28','2026-06-02','2024-06-02')
     UNION ALL
     SELECT 'lead', event_date, storm_name, COUNT(*) FROM scored_parcel_leads
     WHERE event_date IN ('2024-05-28','2026-05-28','2026-06-02','2024-06-02')
     GROUP BY event_date, storm_name""")

q("distinct storm_swath dates count",
  """SELECT COUNT(DISTINCT event_date), COUNT(*), MIN(event_date), MAX(event_date) FROM storm_swaths""")

q("contractor phone nulls and patterns",
  """SELECT
       COUNT(*) n,
       SUM(CASE WHEN phone_number IS NULL OR trim(phone_number)='' THEN 1 ELSE 0 END) null_phone,
       SUM(CASE WHEN phone_number LIKE '%555%' THEN 1 ELSE 0 END) has_555,
       COUNT(DISTINCT phone_number) d_phone
     FROM canonical_contractors""")

q("top repeated contractor phones",
  """SELECT phone_number, COUNT(*) n FROM canonical_contractors
     WHERE phone_number IS NOT NULL AND trim(phone_number)!=''
     GROUP BY 1 HAVING n>=5 ORDER BY n DESC LIMIT 20""")

q("lead tiers",
  """SELECT lead_tier, COUNT(*) FROM scored_parcel_leads GROUP BY 1 ORDER BY 2 DESC""")

q("verification status of ge60",
  """SELECT verification_status, data_provenance, COUNT(*) n
     FROM scored_parcel_leads WHERE exposure_score>=60
     GROUP BY 1,2 ORDER BY n DESC""")

text = "\n".join(L) + "\n"
open(OUT, "w", encoding="utf-8").write(text)
print(text)
conn.close()
