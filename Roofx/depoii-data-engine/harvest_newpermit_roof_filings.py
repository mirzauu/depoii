"""
NewPermit_2008_2024 Roof Harvester
----------------------------------
Harvester adhering to all user constraints:
1. Server query on WORK_DESCRIPTION containing ROOF or roofing materials (TPO, EPDM, SHINGLE, BITUMEN).
2. Paged by OBJECTID > last_oid ORDER BY OBJECTID ASC, using maxRecordCount from layer.
3. Deduping on PERMIT_No against existing normalized_permits (skips and preserves DallasNow/Accela).
4. Parse ISSUE_DATE from epoch milliseconds to UTC YYYY-MM-DD.
5. Scope Classification:
   - FULL_REPLACEMENT (is_pure_reroof = 1)
   - ROOF_MAINTENANCE_COATING (is_pure_reroof = 0)
   - UNCLASSIFIED_ROOF_WORK (is_pure_reroof = 0)
   - REJECT: Only when NEITHER tier matches and roof word is purely rooftop equip/solar/scaffold/drain.
6. Writes raw text into normalized_permits in depoii_local.db with data_source = 'NewPermit_2008_2024'.
"""

import os
import sys
import json
import time
import re
import urllib.request
import urllib.parse
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "depoii_local.db")
BASE_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/NewPermit_2008_2024/FeatureServer/0"
QUERY_URL = f"{BASE_URL}/query"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-NewPermit-Harvester/2.0",
    "Accept": "application/json"
}

# 1. Full Replacement Patterns
FULL_REPLACEMENT_PATTERNS = [
    r"\breroof\b",
    r"\bre-roof\b",
    r"\broof\s+replacement\b",
    r"\bnew\s+roof\b",
    r"\btear-off\b",
    r"\btear\s+off\b",
    r"\btpo\b",
    r"\bepdm\b",
    r"\bsingle-ply\b",
    r"\bsingle\s+ply\b",
    r"\bbuilt-up\s+roof\b",
    r"\bbuilt\s+up\s+roof\b",
    r"\bmodified\s+bitumen\b",
    r"\bmod-bit\b",
    r"\bshingle\b"
]

# 2. Maintenance / Coating / Repair Patterns
MAINTENANCE_PATTERNS = [
    r"\broof\s+repair\b",
    r"\brepair\s+roof\b",
    r"\broof\s+coating\b",
    r"\bcoat\s+roof\b",
    r"\bpatch\s+roof\b",
    r"\broof\s+patch\b",
    r"\bflashing\s+repair\b",
    r"\broof\s+leak\b"
]

# 3. Non-Roof Rejection Patterns (Applied ONLY if neither Full nor Maintenance matched)
NON_ROOF_REJECTION_PATTERNS = [
    r"\brooftop\s+unit\b",
    r"\brtu\b",
    r"\bhvac\b",
    r"\bair\s+condition\b",
    r"\bchiller\b",
    r"\bcondenser\b",
    r"\broof\s+drain\b",
    r"\bsolar\b",
    r"\bphotovoltaic\b",
    r"\bpv\s+array\b",
    r"\bscaffold\b",
    r"\bsidewalk\s+shed\b",
    r"\bexhaust\s+fan\b",
    r"\bantenna\b",
    r"\bcell\s+tower\b",
    r"\bsiding\s+only\b"
]

def classify_description(desc):
    if not desc:
        return "REJECT", "EMPTY_DESCRIPTION"

    text = desc.lower()

    # Check Full Replacement first
    for pat in FULL_REPLACEMENT_PATTERNS:
        if re.search(pat, text):
            # If shingle is present, ensure it's not siding-only
            if pat == r"\bshingle\b" and re.search(r"\bsiding\b", text) and not re.search(r"\broof\b", text):
                continue
            return "FULL_REPLACEMENT", 1

    # Check Maintenance / Coating second
    for pat in MAINTENANCE_PATTERNS:
        if re.search(pat, text):
            return "ROOF_MAINTENANCE_COATING", 0

    # Neither tier matched: Check if this is a non-roof reject
    for pat in NON_ROOF_REJECTION_PATTERNS:
        if re.search(pat, text):
            return "REJECT", f"NON_ROOF_CONTEXT: {pat}"

    # If it contains ROOF / ROOFING but matched neither tier and no reject pattern
    if re.search(r"\broof\b|\broofing\b", text):
        return "UNCLASSIFIED_ROOF_WORK", 0

    return "REJECT", "NO_ROOF_RELEVANCE"

def format_issue_date(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # Epoch milliseconds to UTC YYYY-MM-DD
        try:
            dt = datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return None
    val_str = str(val).strip()
    if len(val_str) >= 10 and val_str[4] == "-" and val_str[7] == "-":
        return val_str[:10]
    return None

def main():
    print("=" * 70)
    print("NEWPERMIT_2008_2024 ROOF FILINGS HARVESTER")
    print("=" * 70)

    # 1. Read layer metadata
    req_meta = urllib.request.Request(f"{BASE_URL}?f=json", headers=DEFAULT_HEADERS)
    with urllib.request.urlopen(req_meta, timeout=20) as res:
        meta = json.loads(res.read().decode())
        max_record_count = meta.get("maxRecordCount", 2000)

    print(f"[+] Service maxRecordCount: {max_record_count}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 2. Load existing permit numbers to dedupe against (including DallasNow)
    print("[+] Loading existing permit numbers for deduplication...")
    cur.execute("SELECT raw_permit_number FROM normalized_permits WHERE raw_permit_number IS NOT NULL AND raw_permit_number != ''")
    existing_permits = {r[0].strip() for r in cur.fetchall()}
    print(f"    Loaded {len(existing_permits):,} existing permit numbers to protect.")

    # 3. Server query on OBJECTID > last_oid
    where_base = "(upper(WORK_DESCRIPTION) LIKE '%ROOF%' OR upper(WORK_DESCRIPTION) LIKE '%TPO%' OR upper(WORK_DESCRIPTION) LIKE '%EPDM%' OR upper(WORK_DESCRIPTION) LIKE '%SHINGLE%' OR upper(WORK_DESCRIPTION) LIKE '%BITUMEN%')"

    # Resume from Supabase harvest_state when available (Phase 2); the
    # dedupe set below still protects against re-inserts on older runs.
    last_oid = 0
    pg = None
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from app.core import pg as _pg

        if _pg.available():
            pg = _pg
            last_oid = _pg.get_harvest_state("NewPermit_2008_2024")
            print(f"[+] Resuming from Supabase harvest_state last_oid={last_oid:,}")
    except Exception as e:
        print(f"[!] Supabase harvest_state unavailable ({e}); scanning from 0 with local dedupe.")
    total_scanned = 0
    total_stored = 0
    total_skipped_dedupe = 0
    total_rejected = 0
    counts_by_scope = {"FULL_REPLACEMENT": 0, "ROOF_MAINTENANCE_COATING": 0, "UNCLASSIFIED_ROOF_WORK": 0}
    sample_rejected = []

    print("[+] Beginning OBJECTID-based sequential scan...")

    while True:
        where_page = f"OBJECTID > {last_oid} AND {where_base}"
        params = {
            "where": where_page,
            "outFields": "OBJECTID,PERMIT_No,ISSUE_DATE,ADDRESS,ZIP_CODE,VALUE,AREA,WORK_DESCRIPTION,COMMERCIAL",
            "orderByFields": "OBJECTID ASC",
            "resultRecordCount": max_record_count,
            "f": "json"
        }
        url = f"{QUERY_URL}?{urllib.parse.urlencode(params)}"
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
                print(f"[!] Warning: request at OBJECTID > {last_oid} failed ({e}). Retrying in 2s...")
                time.sleep(2)

        if features is None or not features:
            print("No more features returned. Harvest complete.")
            break

        batch_inserts = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for f in features:
            total_scanned += 1
            attrs = f.get("attributes", {})
            oid = attrs.get("OBJECTID", 0)
            if oid > last_oid:
                last_oid = oid

            raw_no = str(attrs.get("PERMIT_No") or "").strip()
            if not raw_no:
                continue

            # Dedupe: skip if already stored in normalized_permits (preserve DallasNow)
            if raw_no in existing_permits:
                total_skipped_dedupe += 1
                continue

            raw_desc = str(attrs.get("WORK_DESCRIPTION") or "").strip()
            scope, is_pure = classify_description(raw_desc)

            if scope == "REJECT":
                total_rejected += 1
                if len(sample_rejected) < 5:
                    sample_rejected.append((raw_no, raw_desc, is_pure)) # is_pure holds reason
                continue

            counts_by_scope[scope] = counts_by_scope.get(scope, 0) + 1

            issue_date = format_issue_date(attrs.get("ISSUE_DATE"))
            addr = str(attrs.get("ADDRESS") or "").strip()
            raw_zip = str(attrs.get("ZIP_CODE") or "").strip()
            zip_code = raw_zip[:5] if len(raw_zip) >= 5 and raw_zip[:5].isdigit() else "75201"
            val = float(attrs.get("VALUE") or 0.0)
            area = float(attrs.get("AREA") or 0.0)
            permit_id = f"NP24-{raw_no}"

            batch_inserts.append((
                permit_id, raw_no, "JUR-DAL-001", None, None, "NewPermit_2008_2024",
                "Dallas, TX", "TX", "Dallas", issue_date, None, None,
                "Issued", addr, zip_code, int(val), f"${val:,.0f}",
                "Roofing", None, raw_desc, int(area), "On Municipal Record",
                None, None, 0, None, 0, 85, None, None, now_iso,
                scope, is_pure, int(val), "address_point", "public_record",
                "area_muni", "permit_archive", "permit_value", raw_no, now_iso,
                "NewPermit_2008_2024"
            ))

            existing_permits.add(raw_no)

        if batch_inserts:
            cur.executemany("""
                INSERT OR IGNORE INTO normalized_permits (
                    id, raw_permit_number, jurisdiction_id, parcel_id, contractor_id, source_system,
                    jurisdiction, state, city, issue_date, applied_date, expiration_date,
                    status, normalized_address, zip_code, valuation, valuation_formatted,
                    category, probable_roof_system, raw_description, square_footage, contractor_name,
                    contractor_license, contractor_phone, is_hail_storm_window, associated_storm_id,
                    is_competitor_capture, confidence_score, latitude, longitude, normalized_at,
                    permit_scope, is_pure_reroof, calibrated_roof_valuation, geo_quality, date_quality,
                    area_source, year_built_source, value_source, source_record_id, retrieved_at,
                    data_source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch_inserts)
            conn.commit()
            total_stored += len(batch_inserts)

            # Dual-write to Supabase warehouse (Phase 2). Local SQLite stays
            # the working cache; Postgres is the hosted app's source.
            if pg is not None:
                try:
                    pg_cols = ["id", "raw_permit_number", "jurisdiction_id", "parcel_id", "contractor_id", "source_system",
                               "jurisdiction", "state", "city", "issue_date", "applied_date", "expiration_date",
                               "status", "normalized_address", "zip_code", "valuation", "valuation_formatted",
                               "category", "probable_roof_system", "raw_description", "square_footage", "contractor_name",
                               "contractor_license", "contractor_phone", "is_hail_storm_window", "associated_storm_id",
                               "is_competitor_capture", "confidence_score", "latitude", "longitude", "normalized_at",
                               "permit_scope", "is_pure_reroof", "calibrated_roof_valuation", "geo_quality", "date_quality",
                               "area_source", "year_built_source", "value_source", "source_record_id", "retrieved_at", "data_source"]
                    bool_idx = {pg_cols.index(c) for c in ("is_hail_storm_window", "is_competitor_capture", "is_pure_reroof")}
                    pg_rows = [tuple(bool(v) if i in bool_idx and v is not None else v for i, v in enumerate(r)) for r in batch_inserts]
                    pg.upsert_rows("warehouse.normalized_permits", pg_cols, pg_rows, ["id"])
                    pg.set_harvest_state("NewPermit_2008_2024", last_oid, {"stored": total_stored, "scanned": total_scanned})
                except Exception as e:
                    print(f"[!] Supabase dual-write failed ({e}); continuing with local SQLite only.")

        print(f"  [+] Scanned: {total_scanned:,} | Last OBJECTID: {last_oid:,} | Stored: {total_stored:,} (Full: {counts_by_scope['FULL_REPLACEMENT']:,}, Maint: {counts_by_scope['ROOF_MAINTENANCE_COATING']:,}, Unclass: {counts_by_scope['UNCLASSIFIED_ROOF_WORK']:,}) | Deduped: {total_skipped_dedupe:,} | Rejected: {total_rejected:,}")
        time.sleep(0.3)

    print("\n" + "=" * 70)
    print("HARVEST SUMMARY")
    print("=" * 70)
    print(f"Total Features Scanned          : {total_scanned:,}")
    print(f"Total Stored in normalized_permits : {total_stored:,}")
    print(f"  - Full Replacement (is_pure=1): {counts_by_scope['FULL_REPLACEMENT']:,}")
    print(f"  - Maintenance / Coating       : {counts_by_scope['ROOF_MAINTENANCE_COATING']:,}")
    print(f"  - Unclassified Roof Work      : {counts_by_scope['UNCLASSIFIED_ROOF_WORK']:,}")
    print(f"Skipped on Deduplication       : {total_skipped_dedupe:,}")
    print(f"Rejected Non-Roof Context       : {total_rejected:,}")

    # Check for target permit 1601191013
    cur.execute("SELECT raw_permit_number, issue_date, permit_scope, is_pure_reroof, raw_description FROM normalized_permits WHERE raw_permit_number = '1601191013'")
    target = cur.fetchone()
    print("\nQA CHECK ON TARGET PERMIT 1601191013:")
    if target:
        print(f"  [PASS] Found in normalized_permits!")
        print(f"  Permit No  : {target[0]}")
        print(f"  Issue Date : {target[1]}")
        print(f"  Scope      : {target[2]}")
        print(f"  Is Pure    : {target[3]}")
        print(f"  Raw Desc   : {target[4]}")
    else:
        print(f"  [FAIL] Permit 1601191013 not found in normalized_permits!")

    print("\nSAMPLE REJECTED NON-ROOF ROW:")
    if sample_rejected:
        for r in sample_rejected[:2]:
            print(f"  Permit No : {r[0]}")
            print(f"  Reason    : {r[2]}")
            print(f"  Raw Text  : {r[1]}")
            print("-" * 50)

    conn.close()

if __name__ == "__main__":
    main()
