"""
Dallas County Infill & Border Harvester
---------------------------------------
Harvests the remaining unharvested parcels from DallasTaxParcels:
1. University Park (282 parcels)
2. Highland Park (70 parcels)
3. Cockrell Hill (105 parcels)
4. Blank-City Parcels (608 parcels - saved with fallback to TAXPACITY, not dropped)
5. Plano (Dallas County slice - 612 parcels)
6. Heath (Dallas County slice - 374 parcels)
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-Infill-Harvester/2.0",
    "Accept": "application/json"
}

def harvest_segment(where_clause, segment_name, default_city=None):
    print(f"\n[*] Harvesting segment: {segment_name}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    count_params = {
        "where": where_clause,
        "returnCountOnly": "true",
        "f": "json"
    }
    req = urllib.request.Request(f"{DALLAS_URL}?{urllib.parse.urlencode(count_params)}", headers=DEFAULT_HEADERS)
    with urllib.request.urlopen(req, timeout=20) as res:
        total = json.loads(res.read().decode()).get("count", 0)
    print(f"    Available on ArcGIS server: {total}")

    offset = 0
    page_size = 1000
    stored = 0

    while offset < total:
        params = {
            "where": where_clause,
            "outFields": "ACCT,GIS_ACCT,ST_NUM,ST_NAME,ST_TYPE,CITY,TAXPANAME1,TAXPAADD2,TAXPACITY,TAXPASTA,TAXPAZIP,AREA_FEET,PROP_CL,BUSNAME",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": page_size,
            "f": "json"
        }
        req = urllib.request.Request(f"{DALLAS_URL}?{urllib.parse.urlencode(params)}", headers=DEFAULT_HEADERS)
        with urllib.request.urlopen(req, timeout=30) as res:
            feats = json.loads(res.read().decode()).get("features", [])
            if not feats:
                break

            now_iso = datetime.now(timezone.utc).isoformat()
            batch = []

            for f in feats:
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

                st_num = str(attrs.get("ST_NUM") or "").strip()
                st_name = str(attrs.get("ST_NAME") or "").strip()
                st_type = str(attrs.get("ST_TYPE") or "").strip()
                addr_parts = [p for p in [st_num, st_name, st_type] if p]
                address = " ".join(addr_parts) if addr_parts else "No Address on File"

                raw_city = str(attrs.get("CITY") or "").strip()
                taxpa_city = str(attrs.get("TAXPACITY") or "").strip()

                if raw_city:
                    city = raw_city.title()
                elif taxpa_city:
                    city = taxpa_city.title()
                elif default_city:
                    city = default_city
                else:
                    city = "Dallas County (Unincorporated)"

                raw_zip = str(attrs.get("TAXPAZIP") or "").strip()
                zip_code = raw_zip[:5] if len(raw_zip) >= 5 else "75201"

                owner = str(attrs.get("TAXPANAME1") or attrs.get("BUSNAME") or "Commercial Property Owner").strip()
                prop_type = str(attrs.get("PROP_CL") or "Commercial").strip()
                area_sqft = float(attrs.get("AREA_FEET") or 0.0)

                owner_addr = str(attrs.get("TAXPAADD2") or "").strip()
                owner_city = taxpa_city or city
                owner_state = str(attrs.get("TAXPASTA") or "TX").strip()

                parcel_id = f"DCAD-PARCEL-{acct}"

                batch.append((
                    parcel_id, acct, "JUR-DAL-001", "Dallas, TX", address,
                    city, "Dallas County", "TX", zip_code, None, round(area_sqft) if area_sqft > 0 else None,
                    None, prop_type, owner, owner_addr, owner_city, owner_state, zip_code,
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
                    owner_name = excluded.owner_name,
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    land_sqft = excluded.land_sqft,
                    property_type = excluded.property_type,
                    data_provenance = excluded.data_provenance,
                    provenance_date = excluded.provenance_date,
                    is_mock = 0
            """, batch)
            conn.commit()
            stored += len(batch)
            offset += len(feats)

    print(f"    [OK] Ingested {stored} parcels for {segment_name}.")
    conn.close()
    return stored

def main():
    print("=" * 70)
    print("HARVESTING INFILL CITIES & BLANK-CITY PARCELS")
    print("=" * 70)

    total_infill = 0
    total_infill += harvest_segment("ResCom = 'C' AND CITY = 'UNIVERSITY PARK'", "University Park", "University Park")
    total_infill += harvest_segment("ResCom = 'C' AND CITY = 'HIGHLAND PARK'", "Highland Park", "Highland Park")
    total_infill += harvest_segment("ResCom = 'C' AND CITY = 'COCKRELL HILL'", "Cockrell Hill", "Cockrell Hill")
    total_infill += harvest_segment("ResCom = 'C' AND (CITY IS NULL OR CITY = '' OR CITY = ' ')", "Blank City Parcels", "Dallas County (Unincorporated)")
    total_infill += harvest_segment("ResCom = 'C' AND CITY = 'PLANO'", "Plano (Dallas Co Slice)", "Plano")
    total_infill += harvest_segment("ResCom = 'C' AND CITY = 'HEATH'", "Heath (Dallas Co Slice)", "Heath")

    print("\n" + "=" * 70)
    print(f"[+] Total Infill Commercial Parcels Harvested: {total_infill:,}")
    print("=" * 70)

if __name__ == "__main__":
    main()
