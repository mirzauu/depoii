import sqlite3
import json
import urllib.request
import urllib.parse
import time
import sys
from datetime import datetime, timezone

DB_PATH = "depoii_local.db"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-DFW-Harvester/2.0",
    "Accept": "application/json"
}

DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
TARRANT_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"

def harvest_dallas(target_records=1500, page_size=500):
    print(f"\n=======================================================")
    print(f"HARVESTING REAL DALLAS COUNTY (DCAD) COMMERCIAL PARCELS")
    print(f"Target: {target_records} parcels with GIS Centroids")
    print(f"=======================================================")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    total_inserted = 0
    offset = 0

    while total_records := total_inserted < target_records:
        fetch_count = min(page_size, target_records - total_inserted)
        params = {
            "where": "ResCom = 'C' AND AREA_FEET >= 15000",
            "outFields": "ACCT,GIS_ACCT,ST_NUM,ST_NAME,ST_TYPE,CITY,TAXPANAME1,TAXPAADD2,TAXPACITY,TAXPASTA,TAXPAZIP,AREA_FEET",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": fetch_count,
            "f": "json"
        }
        url = f"{DALLAS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                data = json.loads(res.read().decode())
                features = data.get("features", [])
                if not features:
                    print("No more Dallas records returned.")
                    break

                for f in features:
                    attrs = f.get("attributes", {})
                    geom = f.get("geometry", {})
                    acct = str(attrs.get("ACCT") or attrs.get("GIS_ACCT") or "").strip()
                    if not acct:
                        continue

                    rings = geom.get("rings", [])
                    centroid_lat, centroid_lon = None, None
                    if rings and rings[0]:
                        lons = [pt[0] for pt in rings[0]]
                        lats = [pt[1] for pt in rings[0]]
                        centroid_lon = sum(lons) / len(lons)
                        centroid_lat = sum(lats) / len(lats)

                    parcel_id = f"DCAD-PARCEL-{acct}"
                    st_num = str(attrs.get("ST_NUM") or "").strip()
                    st_name = str(attrs.get("ST_NAME") or "").strip()
                    st_type = str(attrs.get("ST_TYPE") or "").strip()
                    addr = f"{st_num} {st_name} {st_type}".strip().title()
                    if not addr:
                        continue

                    city = str(attrs.get("CITY") or "Dallas").strip().title()
                    owner = str(attrs.get("TAXPANAME1") or "").strip().title() or None
                    owner_addr = str(attrs.get("TAXPAADD2") or "").strip().title()
                    owner_city = str(attrs.get("TAXPACITY") or "").strip().title()
                    owner_state = str(attrs.get("TAXPASTA") or "TX").strip().upper()

                    raw_zip = str(attrs.get("TAXPAZIP") or "").strip()[:5]
                    zip_code = raw_zip if len(raw_zip) == 5 and raw_zip.isdigit() else None

                    area_raw = attrs.get("AREA_FEET")
                    land_sqft = int(float(area_raw)) if area_raw else None

                    cur.execute("""
                        INSERT INTO parcels (
                            id, account_number, jurisdiction_id, jurisdiction, address,
                            city, county, state, zip_code, building_sqft, land_sqft,
                            year_built, property_type, owner_name, owner_address, owner_city, owner_state, owner_zip,
                            total_valuation, improvement_valuation, latitude, longitude, data_source, is_mock,
                            data_provenance, provenance_date, building_sqft_source, valuation_source, year_built_source
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            owner_name=excluded.owner_name,
                            building_sqft=excluded.building_sqft,
                            total_valuation=excluded.total_valuation,
                            latitude=excluded.latitude,
                            longitude=excluded.longitude,
                            data_provenance=excluded.data_provenance,
                            provenance_date=excluded.provenance_date,
                            building_sqft_source=excluded.building_sqft_source,
                            valuation_source=excluded.valuation_source,
                            year_built_source=excluded.year_built_source,
                            is_mock=0
                    """, (
                        parcel_id, acct, "JUR-DAL-001", "Dallas, TX", addr,
                        city, "Dallas County", "TX", zip_code, None, land_sqft,
                        None, None, owner, owner_addr, owner_city, owner_state, zip_code,
                        None, None, centroid_lat, centroid_lon, "Dallas County Appraisal District (DCAD)",
                        "live_dcad_api", datetime.now(timezone.utc).isoformat(), None, None, None
                    ))
                    total_inserted += 1

                conn.commit()
                offset += len(features)
                print(f"  [+] Progress: {total_inserted}/{target_records} Dallas parcels stored...")
                time.sleep(0.5)

        except Exception as e:
            print(f"Error fetching Dallas batch at offset {offset}: {e}")
            break

    conn.close()
    print(f"[OK] Total Dallas commercial parcels ingested: {total_inserted}")


def harvest_tarrant(target_records=1500, page_size=500):
    print(f"\n=======================================================")
    print(f"HARVESTING REAL TARRANT COUNTY (TAD) COMMERCIAL PARCELS")
    print(f"Target: {target_records} parcels with GIS Centroids")
    print(f"=======================================================")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    total_inserted = 0
    offset = 0

    while total_records := total_inserted < target_records:
        fetch_count = min(page_size, target_records - total_inserted)
        params = {
            "where": "LIVING_ARE >= 15000 AND TOTAL_VALU >= 350000",
            "outFields": "ACCOUNT,TAXPIN,OWNER_NAME,OWNER_ADDR,OWNER_CITY,OWNER_ZIP,SITUS_ADDR,CITY,ZIPCODE,YEAR_BUILT,LIVING_ARE,LAND_SQFT,TOTAL_VALU,IMPR_VALUE",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": fetch_count,
            "f": "json"
        }
        url = f"{TARRANT_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                data = json.loads(res.read().decode())
                features = data.get("features", [])
                if not features:
                    print("No more Tarrant records returned.")
                    break

                for f in features:
                    attrs = f.get("attributes", {})
                    geom = f.get("geometry", {})
                    acct = str(attrs.get("ACCOUNT") or attrs.get("TAXPIN") or "").strip()
                    if not acct:
                        continue

                    rings = geom.get("rings", [])
                    centroid_lat, centroid_lon = None, None
                    if rings and rings[0]:
                        lons = [pt[0] for pt in rings[0]]
                        lats = [pt[1] for pt in rings[0]]
                        centroid_lon = sum(lons) / len(lons)
                        centroid_lat = sum(lats) / len(lats)

                    parcel_id = f"TAD-PARCEL-{acct}"
                    situs = str(attrs.get("SITUS_ADDR") or "").strip()
                    if not situs:
                        continue
                    addr = situs.title()
                    city = str(attrs.get("CITY") or "Fort Worth").strip().title()
                    owner = str(attrs.get("OWNER_NAME") or "").strip().title() or None
                    owner_addr = str(attrs.get("OWNER_ADDR") or "").strip().title()
                    owner_city = str(attrs.get("OWNER_CITY") or "").strip().title()

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
                            year_built, property_type, owner_name, owner_address, owner_city, owner_state, owner_zip,
                            total_valuation, improvement_valuation, latitude, longitude, data_source, is_mock,
                            data_provenance, provenance_date, building_sqft_source, valuation_source, year_built_source
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            owner_name=excluded.owner_name,
                            building_sqft=excluded.building_sqft,
                            year_built=excluded.year_built,
                            total_valuation=excluded.total_valuation,
                            latitude=excluded.latitude,
                            longitude=excluded.longitude,
                            data_provenance=excluded.data_provenance,
                            provenance_date=excluded.provenance_date,
                            building_sqft_source=excluded.building_sqft_source,
                            valuation_source=excluded.valuation_source,
                            year_built_source=excluded.year_built_source,
                            is_mock=0
                    """, (
                        parcel_id, acct, "JUR-FW-001", "Fort Worth, TX", addr,
                        city, "Tarrant County", "TX", zip_code, bldg_sqft, land_sqft,
                        year_built, None, owner, owner_addr, owner_city, "TX", zip_code,
                        total_val, impr_val, centroid_lat, centroid_lon, "Tarrant Appraisal District (TAD)",
                        "live_tad_api", datetime.now(timezone.utc).isoformat(), "TAD LIVING_ARE", "TAD TOTAL_VALU", "TAD YEAR_BUILT"
                    ))
                    total_inserted += 1

                conn.commit()
                offset += len(features)
                print(f"  [+] Progress: {total_inserted}/{target_records} Tarrant parcels stored...")
                time.sleep(0.5)

        except Exception as e:
            print(f"Error fetching Tarrant batch at offset {offset}: {e}")
            break

    conn.close()
    print(f"[OK] Total Tarrant commercial parcels ingested: {total_inserted}")


if __name__ == "__main__":
    harvest_tarrant(target_records=1500, page_size=500)
