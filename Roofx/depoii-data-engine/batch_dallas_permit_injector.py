import os
import sys
import time
import json
import sqlite3
import re
import argparse
from datetime import datetime, timezone
import httpx

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")
STATE_FILE = os.path.join(os.path.dirname(__file__), "dallas_permit_batch_state.json")

DALLAS_ARCGIS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query"

ROOF_KEYWORDS = [
    (r"\btpo\b", "TPO Single-Ply Membrane"),
    (r"\bepdm\b|\brubber roof\b", "EPDM Membrane"),
    (r"\bmodified bitumen\b|\bmod bit\b|\btorch down\b", "Modified Bitumen SBS/APP"),
    (r"\bmetal\b|\bstanding seam\b", "Standing Seam Architectural Metal"),
    (r"\bbuilt[- ]?up\b|\bbur\b|\btar and gravel\b", "Built-Up Roof (BUR) Multi-Ply"),
    (r"\bpvc\b", "PVC Single-Ply Membrane"),
    (r"\bliquid applied\b|\bcoating\b|\belastomeric\b", "Liquid Applied Roofing System"),
    (r"\bshingle\b|\basphalt shingle\b", "Architectural Asphalt Shingle"),
]

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "current_offset": 0,
        "total_fetched": 0,
        "total_inserted": 0,
        "total_duplicates_skipped": 0,
        "last_batch_timestamp": None,
        "status": "INITIALIZED",
        "scope": "all",
        "consecutive_empty": 0,
        "total_target_records": 14336,
        "batch_size": 1000,
    }

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def parse_dallas_date(d_val):
    if not d_val:
        return None
    if isinstance(d_val, (int, float)):
        # Milliseconds timestamp from ArcGIS
        try:
            sec = d_val / 1000.0
            return datetime.fromtimestamp(sec, timezone.utc).strftime("%Y-%m-%d")
        except Exception:
            return None
    d_str = str(d_val).strip()
    # Match MM-DD-YYYY or MM/DD/YYYY
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", d_str)
    if m:
        month, day, year = m.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    # Match YYYY-MM-DD
    m2 = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", d_str)
    if m2:
        year, month, day = m2.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return None

def detect_roof_system(text: str, is_commercial: bool) -> str:
    if not text:
        return "Commercial Flat / Membrane" if is_commercial else "Architectural Asphalt Shingle"
    t_lower = text.lower()
    for pattern, system in ROOF_KEYWORDS:
        if re.search(pattern, t_lower):
            return system
    return "Commercial Flat / Membrane" if is_commercial else "Architectural Asphalt Shingle"

def format_valuation(val: float) -> str:
    if val >= 1_000_000:
        return f"${val / 1_000_000:.2f}M"
    if val >= 1_000:
        return f"${val / 1_000:.1f}k"
    return f"${val:,.0f}"

def clean_tokens(name: str):
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    ignore = {'inc', 'corp', 'llc', 'ltd', 'co', 'group', 'the', 'and', 'roofing', 'construction', 'contractor', 'contractors', 'services', 'systems', 'corporation', 'express', 'p', 'h', 'company', 'solutions', 'enterprises', 'dba'}
    tokens = [w for w in clean.split() if w not in ignore]
    return tokens

def derive_domain(name: str):
    tokens = clean_tokens(name)
    if not tokens:
        base = re.sub(r'[^a-zA-Z0-9]', '', name.lower())[:12]
        return f"{base}roofing.com" if base else "dallasbuildpro.com"
    if len(tokens) == 1:
        return f"{tokens[0]}roofing.com"
    elif len(tokens) == 2:
        return f"{tokens[0]}{tokens[1]}.com"
    return f"{tokens[0]}{tokens[1]}group.com"

def slugify(text: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', text.upper())
    tokens = clean.split()
    return "-".join(tokens[:5])

def ensure_contractor_profile(conn, contractor_name: str, direct_phone: str, direct_email: str, total_val: float) -> str:
    if not contractor_name or len(contractor_name) < 3:
        return "CTR-LICENSED-COMMERCIAL-CONTRACTOR"
    
    clean_name = re.sub(r"\s+", " ", contractor_name.strip()).title()
    if clean_name.upper() in ["N/A", "NONE", "UNKNOWN", "OWNER", "PERMITTEE", "SELF-CONTRACTED"]:
        return "CTR-PROPERTY-OWNER-SELF-CONTRACTED"
        
    c = conn.cursor()
    c.execute("SELECT id FROM canonical_contractors WHERE LOWER(canonical_name) = LOWER(?)", (clean_name,))
    existing = c.fetchone()
    if existing:
        return existing[0]

    cid = f"CTR-DAL-{slugify(clean_name)}"
    c.execute("SELECT id FROM canonical_contractors WHERE id = ?", (cid,))
    if c.fetchone():
        taken = c.execute(
            "SELECT COUNT(*) FROM canonical_contractors WHERE id LIKE ?",
            (cid + "%",),
        ).fetchone()[0]
        cid = f"{cid}-{taken}"

    now_iso = datetime.now(timezone.utc).isoformat()
    _ = (direct_phone, direct_email, total_val)
    try:
        c.execute("""
            INSERT INTO canonical_contractors (
                id, canonical_name, headquarters_city, headquarters_state,
                total_permits, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            cid, clean_name, "Dallas", "TX",
            1, now_iso, now_iso,
        ))
    except Exception:
        pass

    return cid

def fetch_total_count(client: httpx.Client, scope: str) -> int:
    where = "COMMERCIAL = 'Y'" if scope == "commercial" else "1=1"
    params = {'where': where, 'returnCountOnly': 'true', 'f': 'json'}
    try:
        r = client.get(DALLAS_ARCGIS_URL, params=params, timeout=20.0)
        if r.status_code == 200:
            return int(r.json().get('count', 14336))
    except Exception as e:
        print(f"Error getting total count: {e}")
    return 3630 if scope == "commercial" else 14336

def fetch_batch_from_arcgis(client: httpx.Client, offset: int, limit: int, scope: str) -> list:
    where = "COMMERCIAL = 'Y'" if scope == "commercial" else "1=1"
    params = {
        'where': where,
        'resultOffset': offset,
        'resultRecordCount': limit,
        'orderByFields': 'OBJECTID ASC',
        'outFields': '*',
        'f': 'json'
    }
    max_retries = 3
    for attempt in range(max_retries):
        try:
            res = client.get(DALLAS_ARCGIS_URL, params=params, timeout=30.0)
            if res.status_code == 200:
                features = res.json().get('features', [])
                return [f.get('attributes', {}) for f in features]
            else:
                print(f"[HTTP {res.status_code}] Error fetching offset {offset}")
                time.sleep(3)
        except httpx.RequestError as e:
            print(f"[Attempt {attempt+1}/{max_retries}] Network error: {e}")
            time.sleep(5)
    return []

def normalize_and_save_batch(raw_records: list, conn: sqlite3.Connection) -> tuple:
    c = conn.cursor()
    inserted = 0
    duplicates = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in raw_records:
        permit_num = item.get("PERMIT_No") or item.get("OBJECTID")
        if not permit_num:
            continue
            
        permit_id = f"DAL-BU-{permit_num}"
        
        # Address
        address_raw = (item.get("ADDRESS") or "").strip()
        zip_code = str(item.get("ZIP_CODE") or "").strip()[:5]
        normalized_address = f"{address_raw}, Dallas, TX {zip_code}".strip(", ")
        
        # Dates
        issue_date = parse_dallas_date(item.get("ISSUE_DATE")) or parse_dallas_date(item.get("CREATED_DATE"))
        if not issue_date:
            continue
        applied_date = parse_dallas_date(item.get("CREATED_DATE"))
        
        # Valuation & Sqft
        val_raw = item.get("VALUE") or 0
        try:
            val = float(val_raw)
        except (ValueError, TypeError):
            val = 0.0
            
        is_comm = (str(item.get("COMMERCIAL") or "").upper() == "Y")
        if val <= 0:
            val = None
        val_fmt = format_valuation(val) if val else None
        
        sqft = None
        if item.get("AREA"):
            try:
                sqft = int(float(item.get("AREA")))
            except (ValueError, TypeError):
                sqft = None
                
        # Activity & Category
        activity = item.get("ACTIVITY") or ""
        land_use = item.get("LAND_USE") or ""
        raw_desc = f"{activity}: {land_use}".strip(": ")
        category = "Commercial" if is_comm else "Commercial Alteration / Mixed-Use"
        roof_sys = detect_roof_system(f"{activity} {land_use}", is_comm)
        
        # Contractor
        c_name = item.get("CONTRACTOR_NAME") or ""
        c_phone = item.get("CONTRACTOR_PHONE")
        c_email = item.get("CONTRACTOR_EMAIL")
        
        contractor_id = ensure_contractor_profile(conn, c_name, c_phone, c_email, val)
        clean_c_name = re.sub(r"\s+", " ", c_name.strip()).title()
        
        # Coordinates
        lat = None
        lon = None
        if item.get("POINT_Y"):
            try:
                lat = float(item["POINT_Y"])
            except ValueError:
                pass
        if item.get("POINT_X"):
            try:
                lon = float(item["POINT_X"])
            except ValueError:
                pass
                
        status_name = (item.get("STATUS_NAME") or "ISSUED").upper()
        
        try:
            c.execute("""
                INSERT OR REPLACE INTO normalized_permits (
                    id, raw_permit_number, jurisdiction_id, parcel_id, contractor_id,
                    source_system, jurisdiction, state, city, issue_date, applied_date,
                    expiration_date, status, normalized_address, zip_code, valuation,
                    valuation_formatted, category, probable_roof_system, raw_description,
                    square_footage, contractor_name, contractor_license, contractor_phone,
                    is_hail_storm_window, associated_storm_id, is_competitor_capture,
                    confidence_score, latitude, longitude, normalized_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?
                )
            """, (
                permit_id, str(permit_num), "TX-DALLAS", None, contractor_id,
                "DALLAS_ARCGIS_FY24", "Dallas, TX", "TX", "Dallas", issue_date, applied_date,
                None, status_name, normalized_address, zip_code, val,
                val_fmt, category, roof_sys, raw_desc,
                sqft, clean_c_name, None, c_phone,
                0, None, 1 if val >= 100000 else 0,
                95, lat, lon, now_iso
            ))
            inserted += 1
        except sqlite3.IntegrityError:
            duplicates += 1
        except Exception:
            pass

    conn.commit()
    return inserted, duplicates

def run_single_batch(client: httpx.Client, state: dict) -> dict:
    offset = state["current_offset"]
    batch_size = state.get("batch_size", 1000)
    scope = state.get("scope", "all")
    
    print(f"\n========================================================")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Executing Dallas Batch | Offset: {offset:,} | Size: {batch_size}")
    print(f"========================================================")
    
    raw_records = fetch_batch_from_arcgis(client, offset, batch_size, scope)
    print(f"Downloaded {len(raw_records)} records from Dallas ArcGIS FeatureServer.")
    
    if not raw_records:
        state["consecutive_empty"] = state.get("consecutive_empty", 0) + 1
        print(f"Warning: Batch returned 0 records. Consecutive empty batches: {state['consecutive_empty']}")
        if state["consecutive_empty"] >= 3:
            state["status"] = "COMPLETED"
            print("Reached end of available Dallas records. Process marked as COMPLETED.")
        save_state(state)
        return state
        
    state["consecutive_empty"] = 0
    conn = sqlite3.connect(DB_PATH)
    inserted, duplicates = normalize_and_save_batch(raw_records, conn)
    conn.close()
    
    state["current_offset"] = offset + len(raw_records)
    state["total_fetched"] = state.get("total_fetched", 0) + len(raw_records)
    state["total_inserted"] = state.get("total_inserted", 0) + inserted
    state["total_duplicates_skipped"] = state.get("total_duplicates_skipped", 0) + duplicates
    state["last_batch_timestamp"] = datetime.now(timezone.utc).isoformat()
    state["status"] = "SLEEPING"
    
    target_total = state.get("total_target_records") or 14336
    pct = (state["total_fetched"] / target_total) * 100 if target_total else 0
    print(f"Batch Summary: {inserted:,} inserted/updated, {duplicates:,} skipped.")
    print(f"Overall Progress: {state['total_fetched']:,} / {target_total:,} permits processed ({pct:.1f}%).")
    print(f"New Next Offset: {state['current_offset']:,}")
    
    save_state(state)
    return state

def run_daemon(interval_sec: int, batch_size: int, scope: str):
    state = load_state()
    state["batch_size"] = batch_size
    state["scope"] = scope
    state["status"] = "RUNNING"
    save_state(state)
    
    with httpx.Client(timeout=35.0) as client:
        if not state.get("total_target_records"):
            print("Checking total available records in Dallas FY23-24 dataset...")
            total = fetch_total_count(client, scope)
            state["total_target_records"] = total
            print(f"Target Universe: {total:,} permits.")
            save_state(state)
            
        print(f"\n========================================================")
        print(f" Starting Dallas Permit Batch Ingestion Daemon")
        print(f" Batch Interval : {interval_sec} seconds (5 minutes)")
        print(f" Batch Size     : {batch_size} permits")
        print(f" Scope          : {scope.upper()}")
        print(f" Resuming Offset: {state['current_offset']:,}")
        print(f"========================================================")
        
        while state.get("status") != "COMPLETED":
            try:
                state = run_single_batch(client, state)
                if state.get("status") == "COMPLETED":
                    print("All Dallas permits have been successfully harvested!")
                    break
                    
                print(f"Sleeping for {interval_sec} seconds (5 minutes) before next batch...")
                print(f"Press CTRL+C to pause. Progress is safely checkpointed.")
                time.sleep(interval_sec)
                state = load_state()
                state["status"] = "RUNNING"
                save_state(state)
            except KeyboardInterrupt:
                print("\nReceived stop signal. Checkpointing state and shutting down gracefully...")
                state["status"] = "PAUSED"
                save_state(state)
                break
            except Exception as e:
                print(f"\n[Unexpected Error in loop] {e}")
                print(f"Will retry in 60 seconds...")
                time.sleep(60)

def print_status():
    state = load_state()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM normalized_permits WHERE jurisdiction_id = 'TX-DALLAS'")
    db_dallas_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM canonical_contractors WHERE headquarters_state = 'TX'")
    tx_contractors = c.fetchone()[0]
    conn.close()
    
    target_records = state.get('total_target_records')
    target_str = f"{target_records:,}" if isinstance(target_records, (int, float)) else "14,336"
    
    print("\n========================================================")
    print("  DALLAS FY23-24 PERMIT HARVESTER STATUS")
    print("========================================================")
    print(f"Status                     : {state.get('status')}")
    print(f"Current Offset             : {state.get('current_offset', 0):,}")
    print(f"Total Fetched (API)        : {state.get('total_fetched', 0):,}")
    print(f"Total Target Universe      : {target_str}")
    print(f"Last Batch Time            : {state.get('last_batch_timestamp')}")
    print(f"Dallas Permits in Local DB : {db_dallas_count:,}")
    print(f"TX Canonical Contractors   : {tx_contractors:,}")
    print("========================================================\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Depoii Dallas Permit Batch Ingestor")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in background with interval")
    parser.add_argument("--once", action="store_true", help="Execute exactly one batch and stop")
    parser.add_argument("--status", action="store_true", help="Display current progress and database counts")
    parser.add_argument("--reset", action="store_true", help="Reset state checkpoint to offset 0")
    parser.add_argument("--interval", type=int, default=300, help="Interval between batches in seconds (default: 300 / 5 min)")
    parser.add_argument("--batch-size", type=int, default=1000, help="Number of records per batch (default: 1000)")
    parser.add_argument("--scope", type=str, default="all", choices=["all", "commercial"], help="Filter scope (all or commercial)")
    
    args = parser.parse_args()
    
    if args.reset:
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
        print("Reset Dallas batch state checkpoint to 0.")
        sys.exit(0)
        
    if args.status:
        print_status()
        sys.exit(0)
        
    if args.once:
        s = load_state()
        s["batch_size"] = args.batch_size
        s["scope"] = args.scope
        with httpx.Client(timeout=35.0) as cl:
            run_single_batch(cl, s)
        sys.exit(0)
        
    if args.daemon:
        run_daemon(interval_sec=args.interval, batch_size=args.batch_size, scope=args.scope)
    else:
        parser.print_help()
