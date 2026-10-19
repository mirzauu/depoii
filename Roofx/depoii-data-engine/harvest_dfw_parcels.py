import os
import sqlite3
import json
import urllib.request
import urllib.parse
import time
import sys
from datetime import datetime, timezone

DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
TARRANT_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-DFW-Harvester/1.0",
    "Accept": "application/json"
}

def harvest_dallas_commercial(target_count: int = 250):
    print(f"\n=======================================================")
    print(f"HARVESTING DALLAS COUNTY COMMERCIAL PARCELS (DCAD)...")
    print(f"=======================================================")
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Query commercial parcels in Dallas County with significant area
    where_query = "ResCom = 'C' AND AREA_FEET >= 25000"
    params = {
        "where": where_query,
        "outFields": "ACCT,GIS_ACCT,ST_NUM,ST_NAME,ST_TYPE,CITY,COUNTY,TAXPANAME1,TAXPAADD2,TAXPACITY,TAXPASTA,TAXPAZIP,AREA_FEET,Website",
        "returnGeometry": "false",
        "resultRecordCount": target_count,
        "f": "json"
    }
    
    url = f"{DALLAS_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            features = data.get("features", [])
            print(f"Retrieved {len(features)} Dallas commercial parcel records.")
            
            stored = 0
            for f in features:
                attrs = f["attributes"]
                acct = str(attrs.get("ACCT") or attrs.get("GIS_ACCT") or "").strip()
                if not acct:
                    continue
                    
                parcel_id = f"DCAD-PARCEL-{acct}"
                st_num = str(attrs.get("ST_NUM") or "").strip()
                st_name = str(attrs.get("ST_NAME") or "").strip()
                st_type = str(attrs.get("ST_TYPE") or "").strip()
                addr = f"{st_num} {st_name} {st_type}".strip().title()
                if not addr:
                    continue
                
                city = str(attrs.get("CITY") or "Dallas").strip().title()
                county = str(attrs.get("COUNTY") or "Dallas County").strip().title()
                owner = str(attrs.get("TAXPANAME1") or "").strip().title() or None
                
                raw_zip = str(attrs.get("TAXPAZIP") or "").strip()[:5]
                zip_code = raw_zip if len(raw_zip) == 5 and raw_zip.isdigit() else None
                
                area_raw = attrs.get("AREA_FEET")
                land_sqft = int(float(area_raw)) if area_raw else None
                
                cur.execute("""
                    INSERT INTO parcels (
                        id, account_number, jurisdiction_id, jurisdiction, address, 
                        city, county, state, zip_code, building_sqft, land_sqft, 
                        year_built, property_type, owner_name, total_valuation, 
                        improvement_valuation, data_source,
                        data_provenance, provenance_date, building_sqft_source, valuation_source, year_built_source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        owner_name=excluded.owner_name,
                        building_sqft=excluded.building_sqft,
                        total_valuation=excluded.total_valuation,
                        data_provenance=excluded.data_provenance,
                        provenance_date=excluded.provenance_date,
                        building_sqft_source=excluded.building_sqft_source,
                        valuation_source=excluded.valuation_source,
                        year_built_source=excluded.year_built_source
                """, (
                    parcel_id, acct, "JUR-DAL-001", "Dallas, TX", addr,
                    city, county, "TX", zip_code, None, land_sqft,
                    None, None, owner, None,
                    None, "Dallas County Appraisal District (DCAD)",
                    "live_dcad_api", datetime.now(timezone.utc).isoformat(), None, None, None
                ))
                stored += 1
                
            conn.commit()
            print(f"Stored {stored} Dallas commercial parcels into database.")
            
    except Exception as e:
        print(f"Dallas extraction error: {e}")


def harvest_tarrant_commercial(target_count: int = 250):
    print(f"\n=======================================================")
    print(f"HARVESTING TARRANT COUNTY COMMERCIAL PARCELS (TAD)...")
    print(f"=======================================================")
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Query commercial / large square footage buildings in Tarrant County (Fort Worth / Arlington)
    where_query = "LIVING_ARE >= 25000 AND TOTAL_VALU >= 500000"
    params = {
        "where": where_query,
        "outFields": "ACCOUNT,TAXPIN,OWNER_NAME,OWNER_ADDR,OWNER_CITY,OWNER_ZIP,SITUS_ADDR,CITY,ZIPCODE,YEAR_BUILT,LIVING_ARE,LAND_SQFT,TOTAL_VALU,IMPR_VALUE",
        "returnGeometry": "false",
        "resultRecordCount": target_count,
        "f": "json"
    }
    
    url = f"{TARRANT_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            features = data.get("features", [])
            print(f"Retrieved {len(features)} Tarrant commercial parcel records.")
            
            stored = 0
            for f in features:
                attrs = f["attributes"]
                acct = str(attrs.get("ACCOUNT") or attrs.get("TAXPIN") or "").strip()
                if not acct:
                    continue
                    
                parcel_id = f"TAD-PARCEL-{acct}"
                situs = str(attrs.get("SITUS_ADDR") or "").strip()
                if not situs:
                    continue
                addr = situs.title()
                city = str(attrs.get("CITY") or "Fort Worth").strip().title()
                owner = str(attrs.get("OWNER_NAME") or "").strip().title() or None
                
                raw_zip = str(attrs.get("ZIPCODE") or attrs.get("OWNER_ZIP") or "").strip()[:5]
                zip_code = raw_zip if len(raw_zip) == 5 and raw_zip.isdigit() else None
                
                living = attrs.get("LIVING_ARE")
                bldg_sqft = int(float(living)) if living else None
                land_raw = attrs.get("LAND_SQFT")
                land_sqft = int(float(land_raw)) if land_raw else None
                year_raw = attrs.get("YEAR_BUILT")
                year_built = int(year_raw) if year_raw and int(year_raw) > 1850 else None
                
                total_raw = attrs.get("TOTAL_VALU")
                total_val = float(total_raw) if total_raw else None
                impr_raw = attrs.get("IMPR_VALUE")
                impr_val = float(impr_raw) if impr_raw else None
                
                cur.execute("""
                    INSERT INTO parcels (
                        id, account_number, jurisdiction_id, jurisdiction, address, 
                        city, county, state, zip_code, building_sqft, land_sqft, 
                        year_built, property_type, owner_name, total_valuation, 
                        improvement_valuation, data_source,
                        data_provenance, provenance_date, building_sqft_source, valuation_source, year_built_source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        owner_name=excluded.owner_name,
                        building_sqft=excluded.building_sqft,
                        year_built=excluded.year_built,
                        total_valuation=excluded.total_valuation,
                        data_provenance=excluded.data_provenance,
                        provenance_date=excluded.provenance_date,
                        building_sqft_source=excluded.building_sqft_source,
                        valuation_source=excluded.valuation_source,
                        year_built_source=excluded.year_built_source
                """, (
                    parcel_id, acct, "JUR-FW-001", "Fort Worth, TX", addr,
                    city, "Tarrant County", "TX", zip_code, bldg_sqft, land_sqft,
                    year_built, None, owner,
                    total_val, impr_val, "Tarrant Appraisal District (TAD)",
                    "live_tad_api", datetime.now(timezone.utc).isoformat(), "TAD LIVING_ARE", "TAD TOTAL_VALU", "TAD YEAR_BUILT"
                ))
                stored += 1
                
            conn.commit()
            print(f"Stored {stored} Tarrant commercial parcels into database.")
            
    except Exception as e:
        print(f"Tarrant extraction error: {e}")


def link_dfw_permits_to_parcels():
    print(f"\n=======================================================")
    print(f"LINKING TEXAS PERMITS TO NEW DFW PARCEL REGISTRY...")
    print(f"=======================================================")
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # 1. Exact address matching for Addison / Dallas / Fort Worth
    cur.execute("""
        UPDATE normalized_permits
        SET parcel_id = (
            SELECT pa.id 
            FROM parcels pa 
            WHERE pa.state = 'TX' 
              AND (
                  LOWER(pa.address) = LOWER(normalized_permits.normalized_address)
                  OR LOWER(pa.address) LIKE '%' || LOWER(SUBSTR(normalized_permits.normalized_address, 1, 12)) || '%'
              )
            LIMIT 1
        )
        WHERE jurisdiction LIKE '%TX%' AND (parcel_id IS NULL OR length(trim(parcel_id)) = 0);
    """)
    conn.commit()
    
    cur.execute("""
        SELECT COUNT(*) FROM normalized_permits 
        WHERE jurisdiction LIKE '%TX%' AND parcel_id IS NOT NULL AND length(trim(parcel_id)) > 0
    """)
    linked_tx = cur.fetchone()[0]
    print(f"Texas permits with confirmed parcel links: {linked_tx}")


if __name__ == "__main__":
    harvest_dallas_commercial(target_count=300)
    harvest_tarrant_commercial(target_count=300)
    link_dfw_permits_to_parcels()
