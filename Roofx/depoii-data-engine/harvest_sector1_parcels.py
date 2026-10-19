"""
Sector 1 Bulk Commercial Harvester
----------------------------------
Harvests all commercial parcels (ResCom = 'C' and AREA_FEET >= 15,000)
for Sector 1 municipalities: IRVING, FARMERS BRANCH, CARROLLTON, COPPELL, ADDISON
from the DallasTaxParcels ArcGIS FeatureServer into depoii_local.db.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import time
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-Sector1-Harvester/2.0",
    "Accept": "application/json"
}

def harvest_sector1():
    print("=" * 70)
    print("HARVESTING SECTOR 1 COMMERCIAL PARCELS (NW LOGISTICS HUB)")
    print("Target Cities: IRVING, FARMERS BRANCH, CARROLLTON, COPPELL, ADDISON")
    print("Criteria: ResCom = 'C' AND AREA_FEET >= 15,000 sq ft")
    print("=" * 70)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    where_clause = "ResCom = 'C' AND CITY IN ('IRVING', 'FARMERS BRANCH', 'CARROLLTON', 'COPPELL', 'ADDISON') AND AREA_FEET >= 15000"
    
    # 1. Get total count on the server first
    count_params = {
        "where": where_clause,
        "returnCountOnly": "true",
        "f": "json"
    }
    url_count = f"{DALLAS_URL}?{urllib.parse.urlencode(count_params)}"
    req_count = urllib.request.Request(url_count, headers=DEFAULT_HEADERS)
    with urllib.request.urlopen(req_count, timeout=20) as res:
        total_available = json.loads(res.read().decode()).get("count", 0)

    print(f"[+] Total qualifying parcels on ArcGIS Server: {total_available:,}")

    offset = 0
    page_size = 1000
    total_stored = 0

    while offset < total_available:
        print(f"[*] Fetching page: offset {offset:,} to {offset + page_size:,}...")
        params = {
            "where": where_clause,
            "outFields": "ACCT,GIS_ACCT,ST_NUM,ST_NAME,ST_TYPE,CITY,TAXPANAME1,TAXPAADD2,TAXPACITY,TAXPASTA,TAXPAZIP,AREA_FEET,PROP_CL,BUSNAME",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": page_size,
            "orderByFields": "AREA_FEET DESC",
            "f": "json"
        }
        url = f"{DALLAS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                data = json.loads(res.read().decode())
                features = data.get("features", [])
                if not features:
                    print("No more features returned.")
                    break

                batch_inserts = []
                now_iso = datetime.now(timezone.utc).isoformat()

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
                    owner = str(attrs.get("TAXPANAME1") or attrs.get("BUSNAME") or "").strip().title() or "Commercial Property Owner"
                    owner_addr = str(attrs.get("TAXPAADD2") or "").strip().title()
                    owner_city = str(attrs.get("TAXPACITY") or "").strip().title()
                    owner_state = str(attrs.get("TAXPASTA") or "TX").strip().upper()

                    raw_zip = str(attrs.get("TAXPAZIP") or "").strip()[:5]
                    zip_code = raw_zip if len(raw_zip) == 5 and raw_zip.isdigit() else "75001"

                    area_raw = attrs.get("AREA_FEET")
                    land_sqft = int(float(area_raw)) if area_raw else None

                    prop_cl = str(attrs.get("PROP_CL") or "Commercial").strip()

                    batch_inserts.append((
                        parcel_id, acct, "JUR-DAL-001", "Dallas, TX", addr,
                        city, "Dallas County", "TX", zip_code, None, land_sqft,
                        None, prop_cl, owner, owner_addr, owner_city, owner_state, zip_code,
                        None, None, centroid_lat, centroid_lon, "Dallas County Appraisal District (DCAD)",
                        "live_dcad_api", now_iso
                    ))

                cur.executemany("""
                    INSERT INTO parcels (
                        id, account_number, jurisdiction_id, jurisdiction, address,
                        city, county, state, zip_code, building_sqft, land_sqft,
                        year_built, property_type, owner_name, owner_address, owner_city, owner_state, owner_zip,
                        total_valuation, improvement_valuation, latitude, longitude, data_source, is_mock,
                        data_provenance, provenance_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        owner_name=excluded.owner_name,
                        latitude=excluded.latitude,
                        longitude=excluded.longitude,
                        land_sqft=excluded.land_sqft,
                        property_type=excluded.property_type,
                        data_provenance=excluded.data_provenance,
                        provenance_date=excluded.provenance_date,
                        is_mock=0
                """, batch_inserts)

                conn.commit()
                total_stored += len(batch_inserts)
                offset += len(features)
                print(f"  [+] Ingested {total_stored:,} / {total_available:,} parcels...")
                time.sleep(0.5)

        except Exception as e:
            print(f"[!] Error fetching page at offset {offset}: {e}")
            time.sleep(2)
            offset += page_size

    # Check city breakdown
    cur.execute("""
        SELECT city, count(*) as count, round(avg(land_sqft)) as avg_land_sqft
        FROM parcels
        WHERE city IN ('Irving', 'Farmers Branch', 'Carrollton', 'Coppell', 'Addison')
        GROUP BY city
        ORDER BY count DESC
    """)
    rows = cur.fetchall()

    print("\n" + "=" * 70)
    print("SECTOR 1 INGESTION COMPLETE")
    print("=" * 70)
    print(f"{'City':<18} | {'Total Parcels in DB':<22} | {'Avg Lot SqFt'}")
    print("-" * 70)
    for r in rows:
        print(f"{r[0]:<18} | {r[1]:<22} | {r[2] or 0:,.0f} sqft")

    conn.close()

if __name__ == "__main__":
    harvest_sector1()
