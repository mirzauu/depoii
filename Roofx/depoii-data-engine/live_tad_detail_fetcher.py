"""
Live TAD Detail Fetcher
-----------------------
Fetches official appraisal district details for Tarrant County commercial parcels
from live Tarrant County ArcGIS FeatureServer:
https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query

Updates parcels with live provenance ('live_tad_api') and verified values:
- LIVING_ARE -> building_sqft (source: 'TAD LIVING_ARE')
- YEAR_BUILT -> year_built (source: 'TAD YEAR_BUILT')
- TOTAL_VALU -> total_valuation (source: 'TAD TOTAL_VALU')
- OWNER_NAME -> owner_name
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
TAD_PARCELS_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-TAD-LiveVerifier/2.0",
    "Accept": "application/json"
}

def fetch_tad_attributes(account_number: str, timeout: int = 20) -> Optional[Dict[str, Any]]:
    clean_acct = str(account_number).strip().replace("TAD-PARCEL-", "")
    params = {
        "where": f"ACCOUNT = '{clean_acct}'",
        "outFields": "ACCOUNT,SITUS_ADDR,OWNER_NAME,LIVING_ARE,LAND_SQFT,YEAR_BUILT,TOTAL_VALU,IMPR_VALUE,LEGAL_1,MAPSCO",
        "f": "json"
    }
    url = f"{TAD_PARCELS_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read().decode("utf-8"))
            features = data.get("features", [])
            if not features:
                print(f"[-] No TAD features found for account {clean_acct}")
                return None
            return features[0].get("attributes", {})
    except Exception as e:
        print(f"[!] HTTP error querying TAD for {clean_acct}: {e}")
        return None

def update_parcel_with_live_tad(account_number: str, parcel_id: Optional[str] = None) -> bool:
    clean_acct = str(account_number).strip().replace("TAD-PARCEL-", "")
    attrs = fetch_tad_attributes(clean_acct)
    if not attrs:
        return False

    living_raw = attrs.get("LIVING_ARE")
    bldg_sqft = int(float(living_raw)) if living_raw else None
    if not bldg_sqft or bldg_sqft < 1000:
        print(f"[-] Living area {bldg_sqft} below commercial threshold for TAD acct {clean_acct}")
        return False

    land_raw = attrs.get("LAND_SQFT")
    land_sqft = int(float(land_raw)) if land_raw else None

    year_raw = attrs.get("YEAR_BUILT")
    year_built = int(year_raw) if year_raw and int(year_raw) > 1850 else None

    total_raw = attrs.get("TOTAL_VALU")
    total_val = float(total_raw) if total_raw else None

    impr_raw = attrs.get("IMPR_VALUE")
    impr_val = float(impr_raw) if impr_raw else None

    owner_name = (attrs.get("OWNER_NAME") or "").strip()
    situs_addr = (attrs.get("SITUS_ADDR") or "").strip()

    now_iso = datetime.now(timezone.utc).isoformat()
    pid_target = parcel_id or f"TAD-PARCEL-{clean_acct}"

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        UPDATE parcels
        SET building_sqft = ?,
            land_sqft = COALESCE(?, land_sqft),
            year_built = ?,
            owner_name = COALESCE(?, owner_name),
            total_valuation = COALESCE(?, total_valuation),
            improvement_valuation = COALESCE(?, improvement_valuation),
            data_provenance = 'live_tad_api',
            provenance_date = ?,
            building_sqft_source = 'TAD LIVING_ARE',
            valuation_source = 'TAD TOTAL_VALU',
            year_built_source = 'TAD YEAR_BUILT'
        WHERE account_number = ? OR id = ?
    """, (
        bldg_sqft, land_sqft, year_built,
        owner_name.title() if owner_name else None,
        total_val, impr_val,
        now_iso, clean_acct, pid_target
    ))

    if cur.rowcount == 0:
        conn.close()
        print(f"[-] No parcel row for TAD acct {clean_acct}; not inserting a stand-in ZIP or owner")
        return False

    if False:
        cur.execute("""
            INSERT INTO parcels (
                id, account_number, jurisdiction_id, jurisdiction, address,
                city, county, state, zip_code, building_sqft, land_sqft,
                year_built, property_type, owner_name, total_valuation,
                improvement_valuation, data_source, is_mock,
                data_provenance, provenance_date, building_sqft_source,
                valuation_source, year_built_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        """, (
            pid_target, clean_acct, "JUR-FW-001", "Fort Worth, TX",
            situs_addr.title() if situs_addr else "Commercial Facility",
            "Fort Worth", "Tarrant County", "TX", "76106",
            bldg_sqft, land_sqft, year_built, "Commercial Facility",
            owner_name.title() if owner_name else "Commercial Property Owner",
            total_val, impr_val, "Tarrant Appraisal District (TAD)",
            "live_tad_api", now_iso, "TAD LIVING_ARE", "TAD TOTAL_VALU", "TAD YEAR_BUILT"
        ))

    conn.commit()
    conn.close()

    val_disp = f"${int(total_val):,}" if total_val else "N/A"
    print(f"[+] Synced TAD parcel {clean_acct}: {bldg_sqft:,} sqft, built {year_built}, val {val_disp} ({owner_name})")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        print(f"Fetching live TAD details for account: {target}")
        update_parcel_with_live_tad(target)
    else:
        print("Usage: python live_tad_detail_fetcher.py <account_number>")
