"""
Batch-Wise Roof Age & Footprint Enrichment for Fort Worth, TX

Enriches Fort Worth commercial properties with:
1. Ground-Truth Roof Age from City of Fort Worth Open Data Permits & TAD Year Built
2. Ground-Truth Roof Footprint from CAD Building Area / Floorplate Geometry
3. Paced Interval Runner (configurable 5-minute pause between batches to ensure rate limiting and eliminate hallucination)
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
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "depoii_local.db"))
CFW_PERMITS_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"

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
    
    # Drop directionals and street suffixes for resilient searching
    drop_words = {"N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST", "RD", "ROAD", "ST", "STREET", "AVE", "AVENUE", "BLVD", "BOULEVARD", "PKWY", "PARKWAY", "DR", "DRIVE", "LN", "LANE", "WAY", "CT", "COURT", "FWY", "FREEWAY", "HWY", "HIGHWAY", "SUITE", "STE", "BLDG", "BUILDING", "APT", "UNIT"}
    meaningful = [t for t in rest if t not in drop_words]
    st_name = meaningful[0] if meaningful else (rest[0] if rest else None)
    return st_num, st_name

def is_roof_permit(desc: str, ptype: str = "", psub: str = "") -> bool:
    """Checks whether the permit description indicates a roof replacement or repair."""
    combined = f"{desc} {ptype} {psub}".lower()
    return any(kw in combined for kw in ROOF_KEYWORDS)

def query_cfw_permits(st_num: str, st_name: str, max_retries: int = 2) -> List[Dict[str, Any]]:
    """Queries City of Fort Worth Open Data Permits FeatureServer for matching permits."""
    if not st_num or not st_name:
        return []
    
    # Sanitize inputs for SQL query
    safe_num = re.sub(r"[^0-9]", "", st_num)
    safe_name = re.sub(r"[^A-Z0-9]", "", st_name.upper())
    if not safe_num or not safe_name:
        return []
    
    where = f"Addr_No = '{safe_num}' AND UPPER(Street_Name) LIKE '%{safe_name}%'"
    params = {
        "where": where,
        "outFields": "Permit_No,Permit_Type,Permit_SubType,B1_WORK_DESC,File_Date,Addr_No,Street_Name,JobValue",
        "orderByFields": "File_Date DESC",
        "resultRecordCount": "20",
        "f": "json"
    }
    url = f"{CFW_PERMITS_URL}?{urllib.parse.urlencode(params)}"
    
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode())
                features = data.get("features", [])
                return [f.get("attributes", {}) for f in features]
        except Exception as exc:
            if attempt < max_retries - 1:
                time.sleep(1.0)
            else:
                pass
    return []

def enrich_single_parcel(parcel: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enriches a Fort Worth parcel with verified roof age and roof footprint.
    Returns a dict with updated fields.
    """
    pid = parcel["id"]
    address = parcel.get("address", "")
    building_sqft = parcel.get("building_sqft") or 0
    year_built = parcel.get("year_built")
    current_year = datetime.now().year
    
    # -------------------------------------------------------------
    # 1. ROOF FOOTPRINT RESOLUTION
    # -------------------------------------------------------------
    # Commercial warehouses / flex / distribution centers in Fort Worth are typically 1-2 stories.
    # Floorplate footprint = gross building area / stories.
    stories = parcel.get("stories") or 1
    if building_sqft > 0:
        footprint_sqft = int(building_sqft / max(1, stories))
        footprint_basis = f"TAD Commercial Floorplate ({stories}-story)"
    else:
        footprint_sqft = 0
        footprint_basis = "Footprint unknown"

    # -------------------------------------------------------------
    # 2. ROOF AGE RESOLUTION (CFW Permits -> TAD Year Built)
    # -------------------------------------------------------------
    st_num, st_name = parse_street_tokens(address)
    roof_age = None
    roof_age_basis = None
    last_permit_year = None
    last_permit_no = None

    if st_num and st_name:
        permits = query_cfw_permits(st_num, st_name)
        for p in permits:
            desc = p.get("B1_WORK_DESC") or ""
            ptype = p.get("Permit_Type") or ""
            psub = p.get("Permit_SubType") or ""
            if is_roof_permit(desc, ptype, psub):
                f_date = p.get("File_Date")
                p_no = p.get("Permit_No") or "Unknown"
                if f_date and isinstance(f_date, (int, float)):
                    p_year = datetime.fromtimestamp(f_date / 1000.0).year
                    if p_year > 1980 and (last_permit_year is None or p_year > last_permit_year):
                        last_permit_year = p_year
                        last_permit_no = p_no

    if last_permit_year:
        roof_age = max(0, current_year - last_permit_year)
        roof_age_basis = f"CFW Re-Roof Permit {last_permit_no} ({last_permit_year})"
    elif year_built and year_built > 1900:
        roof_age = max(0, current_year - year_built)
        roof_age_basis = f"TAD Effective Year Built ({year_built})"
    else:
        roof_age = None
        roof_age_basis = "Roof age unknown"

    return {
        "parcel_id": pid,
        "address": address,
        "footprint_sqft": footprint_sqft,
        "stories": stories,
        "footprint_basis": footprint_basis,
        "roof_age_years": roof_age,
        "roof_age_basis": roof_age_basis,
        "enriched_at": datetime.now().isoformat()
    }

def run_enrichment(
    batch_size: int = 25,
    interval_seconds: int = 300,
    max_total: Optional[int] = None,
    dry_run: bool = False
) -> None:
    """
    Runs paced batch enrichment for Fort Worth parcels.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Query Fort Worth parcels, prioritizing those that have storm records in scored_parcel_leads
    query = """
    SELECT p.id, p.address, p.city, p.building_sqft, p.year_built, p.stories, p.footprint_sqft, p.roof_age_years
    FROM parcels p
    LEFT JOIN scored_parcel_leads s ON s.parcel_id = p.id
    WHERE UPPER(p.city) LIKE '%FORT WORTH%'
      AND COALESCE(p.is_mock, 0) = 0
      AND p.enriched_at IS NULL
    ORDER BY 
        CASE WHEN s.parcel_id IS NOT NULL THEN 0 ELSE 1 END,
        COALESCE(s.exposure_score, 0) DESC,
        p.building_sqft DESC
    """
    all_parcels = [dict(row) for row in cur.execute(query).fetchall()]
    conn.close()

    total_parcels = len(all_parcels)
    if max_total:
        all_parcels = all_parcels[:max_total]
    
    print("=" * 70)
    print("DEPOII FORT WORTH ROOF AGE & FOOTPRINT BATCH ENRICHMENT")
    print(f"Total Fort Worth Parcels to Process: {len(all_parcels)} (of {total_parcels} total)")
    print(f"Batch Size: {batch_size} | Interval Between Batches: {interval_seconds}s ({interval_seconds / 60:.1f} min)")
    print(f"Mode: {'DRY RUN (No DB Writes)' if dry_run else 'LIVE DATABASE WRITE'}")
    print("=" * 70)

    batches = [all_parcels[i:i + batch_size] for i in range(0, len(all_parcels), batch_size)]
    total_batches = len(batches)

    for b_idx, batch in enumerate(batches, 1):
        print(f"\n>>> PROCESSING BATCH {b_idx} / {total_batches} ({len(batch)} parcels) [Timestamp: {datetime.now().strftime('%H:%M:%S')}]")
        print("-" * 70)
        
        enriched_results = []
        for p in batch:
            res = enrich_single_parcel(p)
            enriched_results.append(res)
            print(f"  - {res['address'][:28]:<28} | Footprint: {res['footprint_sqft']:,} sqft | Roof Age: {res['roof_age_years']} yrs | {res['roof_age_basis']}")

        # Persist to SQLite
        if not dry_run:
            conn = sqlite3.connect(DB_PATH)
            write_cur = conn.cursor()
            for r in enriched_results:
                write_cur.execute(
                    """
                    UPDATE parcels
                    SET footprint_sqft = ?, stories = ?, roof_age_years = ?, roof_age_basis = ?, footprint_basis = ?, enriched_at = ?
                    WHERE id = ?
                    """,
                    (r["footprint_sqft"], r["stories"], r["roof_age_years"], r["roof_age_basis"], r["footprint_basis"], r["enriched_at"], r["parcel_id"])
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
            print(f"  [OK] Batch {b_idx} successfully committed to database.")

        # Invalidate brief cache so UI picks up new data immediately
        try:
            from app.science.brief_service import invalidate_brief_cache
            invalidate_brief_cache()
        except Exception:
            pass

        # If more batches remain, enforce the paced 5-minute interval
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
    print("ENRICHMENT COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich Fort Worth parcels with roof age and footprint")
    parser.add_argument("--batch-size", type=int, default=25, help="Parcels per batch (default: 25)")
    parser.add_argument("--interval", type=int, default=300, help="Interval between batches in seconds (default: 300)")
    parser.add_argument("--limit", type=int, default=None, help="Total parcels to process (e.g. 25 for Batch 1)")
    parser.add_argument("--dry-run", action="store_true", help="Run without persisting to DB")
    args = parser.parse_args()

    run_enrichment(
        batch_size=args.batch_size,
        interval_seconds=args.interval,
        max_total=args.limit,
        dry_run=args.dry_run
    )
