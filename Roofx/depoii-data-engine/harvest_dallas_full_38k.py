"""
Full Scale City of Dallas Commercial Parcel Harvester (38,646 Parcels)
----------------------------------------------------------------------
Harvests 100% of commercial parcels where:
  ResCom = 'C' AND CITY = 'DALLAS'
from DallasTaxParcels ArcGIS FeatureServer into depoii_local.db.
Supports resume via checkpoint file.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
CHECKPOINT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dallas_full_harvest_checkpoint.json")
DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-DallasFull-Harvester/2.0",
    "Accept": "application/json"
}

def load_checkpoint():
    if os.path.exists(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("offset", 0), data.get("total_stored", 0)
        except Exception:
            return 0, 0
    return 0, 0

def save_checkpoint(offset, total_stored):
    with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
        json.dump({"offset": offset, "total_stored": total_stored, "updated_at": datetime.now(timezone.utc).isoformat()}, f)

def main():
    print("=" * 70)
    print("STARTING FULL INGESTION: ALL 38,646 DALLAS COMMERCIAL PARCELS")
    print("Criteria: ResCom = 'C' AND CITY = 'DALLAS'")
    print("=" * 70)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    where_clause = "ResCom = 'C' AND CITY = 'DALLAS'"

    # 1. Check total count on server
    count_params = {
        "where": where_clause,
        "returnCountOnly": "true",
        "f": "json"
    }
    req_count = urllib.request.Request(f"{DALLAS_URL}?{urllib.parse.urlencode(count_params)}", headers=DEFAULT_HEADERS)
    with urllib.request.urlopen(req_count, timeout=20) as res:
        total_available = json.loads(res.read().decode()).get("count", 38646)

    print(f"[+] Total target Dallas commercial parcels on server: {total_available:,}")

    offset, total_stored = load_checkpoint()
    if offset > 0:
        print(f"[*] Resuming from checkpoint: offset {offset:,} (already stored: {total_stored:,})")

    page_size = 1000

    while offset < total_available:
        print(f"[*] Fetching page: offset {offset:,} to {min(offset + page_size, total_available):,} / {total_available:,}...")
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

        retries = 3
        features = None
        while retries > 0:
            try:
                with urllib.request.urlopen(req, timeout=35) as res:
                    data = json.loads(res.read().decode())
                    features = data.get("features", [])
                    break
            except Exception as e:
                retries -= 1
                print(f"[!] Warning: request failed at offset {offset:,} ({e}). Retrying in 2s... ({retries} left)")
                time.sleep(2)

        if features is None:
            print(f"[!] Failed to fetch offset {offset} after retries. Aborting to allow resume.")
            break

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
            addr_parts = [p for p in [st_num, st_name, st_type] if p]
            addr = " ".join(addr_parts) if addr_parts else "No Address on File"

            owner = str(attrs.get("TAXPANAME1") or attrs.get("BUSNAME") or "Commercial Property Owner").strip()
            owner_addr = str(attrs.get("TAXPAADD2") or "").strip()
            owner_city = str(attrs.get("TAXPACITY") or "Dallas").strip().title()
            owner_state = str(attrs.get("TAXPASTA") or "TX").strip()

            raw_zip = str(attrs.get("TAXPAZIP") or "").strip()[:5]
            zip_code = raw_zip if len(raw_zip) == 5 and raw_zip.isdigit() else "75201"

            area_raw = attrs.get("AREA_FEET")
            land_sqft = int(float(area_raw)) if area_raw else None
            prop_cl = str(attrs.get("PROP_CL") or "Commercial").strip()

            batch_inserts.append((
                parcel_id, acct, "JUR-DAL-001", "Dallas, TX", addr,
                "Dallas", "Dallas County", "TX", zip_code, None, land_sqft,
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
                latitude=COALESCE(excluded.latitude, parcels.latitude),
                longitude=COALESCE(excluded.longitude, parcels.longitude),
                land_sqft=excluded.land_sqft,
                property_type=excluded.property_type,
                data_provenance=excluded.data_provenance,
                provenance_date=excluded.provenance_date,
                is_mock=0
        """, batch_inserts)

        conn.commit()
        total_stored += len(batch_inserts)
        offset += len(features)
        save_checkpoint(offset, total_stored)
        print(f"  [+] Ingested {total_stored:,} / {total_available:,} Dallas commercial parcels ({total_stored/total_available*100:.1f}%)")
        time.sleep(0.3)

    print("\n" + "=" * 70)
    print(f"[OK] Full harvest completed! Total stored: {total_stored:,}")
    print("=" * 70)

    # Clean up checkpoint on complete success
    if offset >= total_available and os.path.exists(CHECKPOINT_PATH):
        try:
            os.remove(CHECKPOINT_PATH)
        except Exception:
            pass

    conn.close()

if __name__ == "__main__":
    main()
