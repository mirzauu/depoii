"""
Phase 2: DallasNow Address Verifier & Final Call List Generator
Cross-references candidate parcels against the full DallasNow live permit exports
(test_win0.csv and test_alt_exported.csv) using 3-token street address matching.

Rules:
1. Only permits issued AFTER the parcel's stored last_reroof_date are considered overrides.
2. The permit description must be a verified full replacement (reroof, re-roof, TPO, EPDM,
   tear-off, new roof, layover, single-ply, etc.).
3. If an override is found:
   - Updates last_reroof_date and last_reroof_permit_no in depoii_local.db.
   - If the newer date is after 2016-10-14, DROPS the building from the call list.
4. Rooftop HVAC, plumbing, electrical, and general non-roof alterations are logged, but
   do NOT change the roof date.
5. Produces final verified call list:
   - Single-story with complete foundation -> roof_area_sqft = sum(foundation_sqft)
   - Multi-story commercial offices -> roof_area_sqft = NULL (kept on call list!)
"""
import os
import csv
import json
import sqlite3
import re
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")
CANDIDATES_JSON = os.path.join(os.path.dirname(__file__), "dallas_aging_candidates_pre_dallasnow.json")
OUTPUT_CALL_LIST_JSON = os.path.join(os.path.dirname(__file__), "dallas_aging_roof_call_list_staged.json")
OUTPUT_OVERRIDES_JSON = os.path.join(os.path.dirname(__file__), "dallasnow_reroof_overrides_staged.json")

ROOF_CSV_PATH = os.path.join(os.path.dirname(__file__), "test_win0.csv")
ALT_CSV_PATH = os.path.join(os.path.dirname(__file__), "test_alt_exported.csv")

PURE_REROOF_PATTERNS = [
    r"\breroof\b", r"\bre-roof\b", r"\broof replacement\b", r"\bnew roof\b",
    r"\btear[- ]?off\b", r"\btpo\b", r"\bepdm\b", r"\bsingle[- ]?ply\b",
    r"\bbuilt[- ]?up\b", r"\bmodified bitumen\b", r"\bshingle\b",
    r"\bremove existing roof\b", r"\binstall new roof\b", r"\broof layover\b",
    r"\broof recover\b", r"\bremove.*down to.*deck\b"
]

NON_ROOF_REJECTS = [
    r"\bhvac\b", r"\brtu\b", r"\bair condition", r"\bplumbing\b",
    r"\belectrical\b", r"\bantenna\b", r"\bcell tower\b", r"\bexhaust fan\b",
    r"\bchiller\b", r"\bcompressor\b"
]

def parse_date(date_str: str) -> str:
    if not date_str:
        return ""
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", date_str.strip())
    if m:
        month, day, year = m.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return ""

def clean_addr(a: str) -> str:
    if not a: return ""
    a = a.upper()
    if "," in a:
        a = a.split(",")[0]
    a = re.sub(r"\b(DALLAS|TX|TEXAS|\d{5})\b", "", a)
    a = re.sub(r"[^\w\s]", " ", a)
    parts = a.split()
    if not parts: return ""
    num = parts[0] if parts[0].isdigit() else ""
    rem = parts[1:] if num else parts
    direction = ""
    if rem and rem[0] in ["N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST"]:
        direction = rem[0][0]
        rem = rem[1:]
    SUFFIXES = {"ST", "STREET", "RD", "ROAD", "DR", "DRIVE", "AVE", "AVENUE", "BLVD", "BOULEVARD", 
                "LN", "LANE", "WAY", "PKWY", "PARKWAY", "HWY", "HIGHWAY", "CT", "COURT", "CIR", "CIRCLE",
                "TRL", "TRAIL", "PL", "PLACE", "EXPY", "EXPRESSWAY", "FWY", "FREEWAY", "TER", "TERRACE", "ROW"}
    while rem and rem[-1] in SUFFIXES:
        rem = rem[:-1]
    name = " ".join(rem)
    return f"{num}|{direction}|{name}"

def classify_description(desc: str) -> bool:
    if not desc:
        return False
    d = desc.lower()
    is_reroof = any(re.search(pat, d) for pat in PURE_REROOF_PATTERNS)
    if not is_reroof:
        return False
    # If reject word present, ensure positive reroof phrase is explicit
    has_reject = any(re.search(pat, d) for pat in NON_ROOF_REJECTS)
    if has_reject:
        # Check if it has a strong pure reroof phrase override
        strong = any(re.search(pat, d) for pat in [
            r"\btpo\b", r"\bepdm\b", r"\breroof\b", r"\bre-roof\b", 
            r"\btear[- ]?off\b", r"\bnew roof\b", r"\broof replacement\b",
            r"\broof layover\b", r"\broof recover\b"
        ])
        return strong
    return True

def main():
    print(f"Loading candidates from: {CANDIDATES_JSON}")
    with open(CANDIDATES_JSON, "r", encoding="utf-8") as f:
        cand_payload = json.load(f)

    candidates = cand_payload["candidates"]
    print(f"Loaded {len(candidates)} active pre-DallasNow candidates.")

    # Index candidates by normalized street key
    cand_by_key = {}
    for c in candidates:
        k = clean_addr(c["address"])
        if k:
            if k not in cand_by_key:
                cand_by_key[k] = []
            cand_by_key[k].append(c)

    print(f"Indexed {len(cand_by_key)} distinct street keys.")

    # Read DallasNow permit rows
    sources = [
        (ROOF_CSV_PATH, "DALLASNOW_ROOFING"),
        (ALT_CSV_PATH, "DALLASNOW_ALTERATIONS")
    ]

    all_dallasnow_rows = []
    for path, src in sources:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    r["_source_feed"] = src
                    all_dallasnow_rows.append(r)

    print(f"Total DallasNow records available: {len(all_dallasnow_rows)}")

    # Check matches and detect newer full reroofs
    overrides_by_parcel = {}
    non_roof_hits = []

    for r in all_dallasnow_rows:
        raw_addr = r.get("Address", "").strip()
        k = clean_addr(raw_addr)
        if not k or k not in cand_by_key:
            continue

        c_list = cand_by_key[k]
        p_date = parse_date(r.get("Date", ""))
        p_no = r.get("Record Number", "").strip()
        desc = r.get("Description", "").strip()
        rec_type = r.get("Record Type", "").strip()
        full_text = f"{rec_type}: {desc}".strip(": ")

        is_full_reroof = classify_description(f"{rec_type} {desc}")

        for cand in c_list:
            pid = cand["parcel_id"]
            stored_date = cand["last_reroof_date"]

            # Only consider permits issued AFTER the stored baseline reroof date
            if p_date and stored_date and p_date > stored_date:
                if is_full_reroof:
                    # Check if this is the newest override for this parcel
                    prev = overrides_by_parcel.get(pid)
                    if not prev or p_date > prev["newer_date"]:
                        overrides_by_parcel[pid] = {
                            "parcel_id": pid,
                            "address": cand["address"],
                            "stored_date": stored_date,
                            "stored_permit_no": cand["last_reroof_permit_no"],
                            "newer_date": p_date,
                            "newer_permit_no": p_no,
                            "description": full_text,
                            "source": r["_source_feed"]
                        }
                else:
                    non_roof_hits.append({
                        "parcel_id": pid,
                        "address": cand["address"],
                        "stored_date": stored_date,
                        "permit_no": p_no,
                        "date": p_date,
                        "description": full_text
                    })

    print(f"\n--- DallasNow Matching Results ---")
    print(f"Total Candidate Parcels with newer Full Reroofs: {len(overrides_by_parcel)}")
    print(f"Total Non-Roof Trade Hits logged (HVAC, plumbing, electrical, etc.): {len(non_roof_hits)}")

    # Update depoii_local.db with verified newer reroofs
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    db_updated_count = 0
    for pid, ov in overrides_by_parcel.items():
        cur.execute("""
            UPDATE parcels
            SET last_reroof_date = ?,
                last_reroof_permit_no = ?
            WHERE id = ?
        """, (ov["newer_date"], ov["newer_permit_no"], pid))
        db_updated_count += 1

    conn.commit()
    conn.close()
    print(f"Updated {db_updated_count} parcels in depoii_local.db with newer reroof dates.")

    # Filter call list: Drop parcels whose updated date is > '2016-10-14'
    final_call_list = []
    dropped_newer_dallasnow = []

    for cand in candidates:
        pid = cand["parcel_id"]
        if pid in overrides_by_parcel:
            ov = overrides_by_parcel[pid]
            # If the newer reroof is > 2016-10-14, drop from call list!
            if ov["newer_date"] > "2016-10-14":
                dropped_newer_dallasnow.append(ov)
                continue
            else:
                # If newer reroof was still <= 2016-10-14, update candidate's date and keep
                cand["last_reroof_date"] = ov["newer_date"]
                cand["last_reroof_permit_no"] = ov["newer_permit_no"]

        final_call_list.append(cand)

    print(f"\n--- Final Call List Summary ---")
    print(f"Total Initial Clean Candidates: {len(candidates)}")
    print(f"Dropped due to newer post-2016 DallasNow reroofs: {len(dropped_newer_dallasnow)}")
    print(f"Final Verified Aging Commercial Roof Call List: {len(final_call_list)}")

    # Final breakdown
    single_story_measured = [c for c in final_call_list if c["roof_area_sqft"] is not None]
    multi_story_leads = [c for c in final_call_list if "MULTI_STORY" in c["roof_area_basis"]]
    other_leads = [c for c in final_call_list if c not in single_story_measured and c not in multi_story_leads]

    print(f"  - Single-Story Warehouses with Foundation Sum: {len(single_story_measured)}")
    print(f"  - Multi-Story Commercial Offices (Roof Area Blank): {len(multi_story_leads)}")
    print(f"  - Other Commercial Assets (Roof Area Blank): {len(other_leads)}")

    # Save artifacts
    with open(OUTPUT_CALL_LIST_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "target_cutoff": "2016-10-14",
            "total_leads": len(final_call_list),
            "single_story_measured_count": len(single_story_measured),
            "multi_story_leads_count": len(multi_story_leads),
            "leads": final_call_list
        }, f, indent=2)

    with open(OUTPUT_OVERRIDES_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "total_overrides_applied": len(overrides_by_parcel),
            "dropped_from_call_list_count": len(dropped_newer_dallasnow),
            "dropped_leads": dropped_newer_dallasnow,
            "non_roof_hits_sample": non_roof_hits[:30]
        }, f, indent=2)

    print(f"\nSaved final call list to: {OUTPUT_CALL_LIST_JSON}")
    print(f"Saved overrides report to: {OUTPUT_OVERRIDES_JSON}")

if __name__ == "__main__":
    main()
