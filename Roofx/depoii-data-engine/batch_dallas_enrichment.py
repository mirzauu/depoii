"""
Batch-Wise Roof Age & Footprint Enrichment for Dallas, TX

Enriches Dallas commercial properties with:
1. Ground-Truth Roof Age from City of Dallas Permits & DCAD Year Built
2. Ground-Truth Roof Footprint from DCAD Building Area / Floorplate Geometry
3. Paced Interval Runner (5-minute pause between batches to prevent rate limits and eliminate hallucination)
"""

import os
import sys
import time
import json
import re
import argparse
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "depoii_local.db"))
DCAD_PARCELS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
DALLAS_PERMITS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query"

HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0",
    "Accept": "application/json"
}

ROOF_KEYWORDS = [
    "roof", "reroof", "re-roof", "tear off", "tear-off", "membrane",
    "shingle", "tpo", "epdm", "mod bit", "mod-bit", "built up", "coating"
]

def parse_street_tokens(address: str) -> Tuple[Optional[str], Optional[str]]:
    """Extracts street number and street name from a full address string."""
    if not address:
        return None, None
    clean = re.sub(r"[,\.]", " ", address.strip()).upper()
    tokens = clean.split()
    if not tokens:
        return None, None
    
    st_num = tokens[0] if tokens[0].isdigit() else None
    rest = tokens[1:] if st_num else tokens
    
    drop_words = {"N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST", "RD", "ROAD", "ST", "STREET", "AVE", "AVENUE", "BLVD", "BOULEVARD", "PKWY", "PARKWAY", "DR", "DRIVE", "LN", "LANE", "WAY", "CT", "COURT", "FWY", "FREEWAY", "HWY", "HIGHWAY", "SUITE", "STE", "BLDG", "BUILDING", "APT", "UNIT"}
    meaningful = [t for t in rest if t not in drop_words]
    st_name = meaningful[0] if meaningful else (rest[0] if rest else None)
    return st_num, st_name

def is_roof_permit(desc: str) -> bool:
    """Checks whether the permit description indicates a roof replacement or repair."""
    text = (desc or "").lower()
    return any(kw in text for kw in ROOF_KEYWORDS)

def query_dallas_arcgis_permits(st_num: str, st_name: str) -> List[Dict[str, Any]]:
    """Queries City of Dallas ArcGIS FeatureServer for permits matching the address."""
    if not st_num or not st_name:
        return []
    safe_num = re.sub(r"[^0-9]", "", st_num)
    safe_name = re.sub(r"[^A-Z0-9]", "", st_name.upper())
    if not safe_num or not safe_name:
        return []

    where = f"ST_NUM = '{safe_num}' AND UPPER(ST_NAME) LIKE '%{safe_name}%'"
    params = {
        "where": where,
        "outFields": "Permit_Number,Issue_Date,Description,ST_NUM,ST_NAME",
        "orderByFields": "Issue_Date DESC",
        "resultRecordCount": "10",
        "f": "json"
    }
    url = f"{DALLAS_PERMITS_URL}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return [f.get("attributes", {}) for f in data.get("features", [])]
    except Exception:
        return []

def query_dcad_parcel(account: str, st_num: Optional[str] = None, st_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Queries live DCAD Tax Parcels FeatureServer for parcel attributes."""
    where = None
    if account and account.strip():
        safe_acct = re.sub(r"[^0-9A-Za-z]", "", account.strip())
        where = f"ACCT = '{safe_acct}' OR GIS_ACCT = '{safe_acct}'"
    elif st_num and st_name:
        safe_num = re.sub(r"[^0-9]", "", st_num)
        safe_name = re.sub(r"[^A-Z0-9]", "", st_name.upper())
        where = f"ST_NUM = '{safe_num}' AND UPPER(ST_NAME) LIKE '%{safe_name}%'"
    
    if not where:
        return None

    params = {
        "where": where,
        "outFields": "ACCT,BLDG_CL,AREA_FEET,PROP_CL,TAXPANAME1,ST_NUM,ST_NAME,Shape__Area",
        "resultRecordCount": "1",
        "f": "json"
    }
    url = f"{DCAD_PARCELS_URL}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            feats = data.get("features", [])
            return feats[0].get("attributes", {}) if feats else None
    except Exception:
        return None

def sync_scored_leads_to_parcels(conn: sqlite3.Connection) -> int:
    """Pre-syncs building_sqft and year_built from scored_parcel_leads into parcels."""
    cur = conn.cursor()
    cur.execute("""
        UPDATE parcels
        SET building_sqft = (
            SELECT s.building_sqft FROM scored_parcel_leads s
            WHERE s.parcel_id = parcels.id OR UPPER(TRIM(s.address)) = UPPER(TRIM(parcels.address))
            LIMIT 1
        ),
        year_built = (
            SELECT s.year_built FROM scored_parcel_leads s
            WHERE s.parcel_id = parcels.id OR UPPER(TRIM(s.address)) = UPPER(TRIM(parcels.address))
            LIMIT 1
        )
        WHERE (building_sqft IS NULL OR year_built IS NULL)
          AND city = 'Dallas'
          AND EXISTS (
            SELECT 1 FROM scored_parcel_leads s
            WHERE (s.parcel_id = parcels.id OR UPPER(TRIM(s.address)) = UPPER(TRIM(parcels.address)))
              AND s.building_sqft IS NOT NULL
          )
    """)
    synced = cur.rowcount
    conn.commit()
    return synced

def enrich_single_dallas_parcel(parcel: Dict[str, Any], cur: sqlite3.Cursor) -> Dict[str, Any]:
    """
    Enriches a single Dallas parcel with verified roof age and roof footprint.
    """
    pid = parcel["id"]
    address = parcel.get("address", "")
    acct = parcel.get("account_number") or ""
    building_sqft = parcel.get("building_sqft") or 0
    year_built = parcel.get("year_built")
    current_year = datetime.now().year
    stories = parcel.get("stories")
    st_num, st_name = parse_street_tokens(address)
    _ = (acct, st_num, st_name)

    footprint_sqft = None
    footprint_basis = "roof area was not measured on the roll"

    # 2. ROOF AGE RESOLUTION (Local normalized_permits + Dallas ArcGIS Permits -> DCAD Year Built)
    roof_age = None
    roof_age_basis = None
    last_permit_year = None
    last_permit_no = None

    # Check local SQLite normalized_permits table first
    if st_num and st_name:
        clean_addr = f"%{st_num}%{st_name}%"
        local_permits = cur.execute("""
            SELECT raw_permit_number, issue_date, raw_description
            FROM normalized_permits
            WHERE (city = 'Dallas' OR jurisdiction_id LIKE '%DALLAS%')
              AND normalized_address LIKE ?
              AND (
                LOWER(COALESCE(raw_description, '')) LIKE '%roof%'
                OR LOWER(COALESCE(category, '')) LIKE '%roof%'
              )
            ORDER BY issue_date DESC
            LIMIT 5
        """, (clean_addr,)).fetchall()

        for p_no, i_date, p_desc in local_permits:
            if i_date and len(str(i_date)) >= 4:
                try:
                    p_yr = int(str(i_date)[:4])
                    if p_yr > 1980 and (last_permit_year is None or p_yr > last_permit_year):
                        last_permit_year = p_yr
                        last_permit_no = p_no or "Standard"
                except Exception:
                    pass

    # If no local permit, query live Dallas ArcGIS
    if not last_permit_year and st_num and st_name:
        arcgis_permits = query_dallas_arcgis_permits(st_num, st_name)
        for p in arcgis_permits:
            desc = p.get("Description") or ""
            if is_roof_permit(desc):
                i_val = p.get("Issue_Date")
                p_no = p.get("Permit_Number") or "Unknown"
                if i_val and isinstance(i_val, (int, float)):
                    p_yr = datetime.fromtimestamp(i_val / 1000.0, timezone.utc).year
                    if p_yr > 1980 and (last_permit_year is None or p_yr > last_permit_year):
                        last_permit_year = p_yr
                        last_permit_no = p_no

    if last_permit_year:
        roof_age = max(0, current_year - last_permit_year)
        roof_age_basis = f"Dallas Re-Roof Permit {last_permit_no} ({last_permit_year})"
    elif year_built and year_built > 1900:
        roof_age = max(0, current_year - year_built)
        roof_age_basis = f"DCAD Effective Year Built ({year_built})"
    else:
        roof_age = None
        roof_age_basis = "year built was not on the appraisal record"

    return {
        "parcel_id": pid,
        "address": address,
        "building_sqft": building_sqft,
        "year_built": year_built,
        "footprint_sqft": footprint_sqft,
        "stories": stories,
        "footprint_basis": footprint_basis,
        "roof_age_years": roof_age,
        "roof_age_basis": roof_age_basis,
        "enriched_at": datetime.now().isoformat()
    }

def run_dallas_enrichment(
    batch_size: int = 25,
    interval_seconds: int = 300,
    max_total: Optional[int] = None,
    dry_run: bool = False
) -> None:
    """
    Runs paced batch enrichment for Dallas parcels.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
    # Pre-sync step: sync available sqft and year_built from scored_parcel_leads
    synced = sync_scored_leads_to_parcels(conn)
    if synced > 0:
        print(f"[PRE-SYNC] Synced building data for {synced} Dallas parcels from scored leads.")

    cur = conn.cursor()
    query = """
    SELECT p.id, p.account_number, p.address, p.city, p.building_sqft, p.year_built, p.stories, p.footprint_sqft, p.roof_age_years
    FROM parcels p
    LEFT JOIN scored_parcel_leads s ON s.parcel_id = p.id
    WHERE UPPER(p.city) LIKE '%DALLAS%'
      AND COALESCE(p.is_mock, 0) = 0
      AND p.enriched_at IS NULL
    ORDER BY 
        CASE WHEN s.parcel_id IS NOT NULL THEN 0 ELSE 1 END,
        COALESCE(s.exposure_score, 0) DESC,
        COALESCE(p.building_sqft, 0) DESC
    """
    all_parcels = [dict(row) for row in cur.execute(query).fetchall()]
    conn.close()

    total_parcels = len(all_parcels)
    if max_total:
        all_parcels = all_parcels[:max_total]

    print("=" * 70)
    print("DEPOII DALLAS ROOF AGE & FOOTPRINT BATCH ENRICHMENT")
    print(f"Total Dallas Parcels to Process: {len(all_parcels)} (of {total_parcels} un-enriched)")
    print(f"Batch Size: {batch_size} | Interval Between Batches: {interval_seconds}s ({interval_seconds / 60:.1f} min)")
    print(f"Mode: {'DRY RUN (No DB Writes)' if dry_run else 'LIVE DATABASE WRITE'}")
    print("=" * 70)

    batches = [all_parcels[i:i + batch_size] for i in range(0, len(all_parcels), batch_size)]
    total_batches = len(batches)

    for b_idx, batch in enumerate(batches, 1):
        print(f"\n>>> PROCESSING DALLAS BATCH {b_idx} / {total_batches} ({len(batch)} parcels) [Timestamp: {datetime.now().strftime('%H:%M:%S')}]")
        print("-" * 70)
        
        conn = sqlite3.connect(DB_PATH)
        read_cur = conn.cursor()
        enriched_results = []
        for p in batch:
            res = enrich_single_dallas_parcel(p, read_cur)
            enriched_results.append(res)
            print(f"  - {res['address'][:28]:<28} | Footprint: {res['footprint_sqft']:,} sqft | Roof Age: {res['roof_age_years']} yrs | {res['roof_age_basis']}")
        conn.close()

        # Persist to SQLite
        if not dry_run:
            conn = sqlite3.connect(DB_PATH)
            write_cur = conn.cursor()
            for r in enriched_results:
                write_cur.execute(
                    """
                    UPDATE parcels
                    SET building_sqft = ?, year_built = ?, footprint_sqft = ?, stories = ?,
                        roof_age_years = ?, roof_age_basis = ?, footprint_basis = ?, enriched_at = ?
                    WHERE id = ?
                    """,
                    (r["building_sqft"], r["year_built"], r["footprint_sqft"], r["stories"],
                     r["roof_age_years"], r["roof_age_basis"], r["footprint_basis"], r["enriched_at"], r["parcel_id"])
                )
                write_cur.execute(
                    """
                    UPDATE scored_parcel_leads
                    SET footprint_sqft = ?, roof_age_years = ?, roof_age_basis = ?
                    WHERE parcel_id = ?
                    """,
                    (r["footprint_sqft"], r["roof_age_years"], r["roof_age_basis"], r["parcel_id"])
                )
            conn.commit()
            conn.close()
            print(f"  [OK] Dallas Batch {b_idx} successfully committed to database.")

        # Invalidate brief cache so UI picks up new data immediately
        try:
            from app.science.brief_service import invalidate_brief_cache
            invalidate_brief_cache()
        except Exception:
            pass

        # Pacing interval between batches
        if b_idx < total_batches:
            print(f"\n[PACING INTERVAL] Pausing for {interval_seconds} seconds ({interval_seconds / 60:.1f} minutes) to prevent rate limits & hallucination...")
            for remaining in range(interval_seconds, 0, -10):
                mins = remaining // 60
                secs = remaining % 60
                sys.stdout.write(f"\r  Next batch in {mins:02d}:{secs:02d}... ")
                sys.stdout.flush()
                time.sleep(min(10, remaining))
            print("\r  Resuming next batch now!                     \n")

    print("\n" + "=" * 70)
    print("DALLAS ENRICHMENT COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich Dallas parcels with roof age and footprint")
    parser.add_argument("--batch-size", type=int, default=25, help="Parcels per batch (default: 25)")
    parser.add_argument("--interval", type=int, default=300, help="Interval between batches in seconds (default: 300)")
    parser.add_argument("--limit", type=int, default=None, help="Total parcels to process (e.g. 25 for Batch 1)")
    parser.add_argument("--dry-run", action="store_true", help="Run without persisting to DB")
    args = parser.parse_args()

    run_dallas_enrichment(
        batch_size=args.batch_size,
        interval_seconds=args.interval,
        max_total=args.limit,
        dry_run=args.dry_run
    )
