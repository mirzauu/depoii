"""
Phase 1: Candidate Extraction & Pre-Check
Extracts Dallas commercial warehouse/office parcels with last_reroof_date <= 2016-10-14
from depoii_local.db, filters out institutional/residential types, audits year_built
discrepancies, and checks existing normalized_permits for post-2016 DallasNow reroofs.
"""
import os
import json
import sqlite3
import re

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")
OUTPUT_JSON = os.path.join(os.path.dirname(__file__), "dallas_aging_candidates_pre_dallasnow.json")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Connecting to database: {DB_PATH}")

    # Query all candidate parcels in Dallas with last_reroof_date <= '2016-10-14'
    query = """
        SELECT 
            p.id,
            p.account_number,
            p.address,
            p.city,
            p.zip_code,
            p.property_type,
            p.owner_name,
            p.owner_address,
            p.owner_city,
            p.owner_state,
            p.owner_zip,
            p.building_sqft,
            p.stories,
            p.year_built,
            p.improvement_sections,
            p.last_reroof_date,
            p.last_reroof_permit_no
        FROM parcels p
        WHERE p.last_reroof_date <= '2016-10-14'
          AND p.city = 'Dallas'
          AND p.property_type NOT IN (
              'MFR - APARTMENTS', 'MFR - DUPLEXES', 'SINGLE FAMILY RESIDENCES', 
              'Vacant Residential Lots In City', 'COMMERCIAL - VACANT PLOTTED LOTS/TRACTS',
              'RURAL VACANT - LESS THAN 5 ACRES', 'QUALIFIED OPEN SPACE LAND',
              'Church', 'CHURCH BUILDING', 'Govt Owned ISD', 'Govt Owned City', 
              'GOVERNMENTAL BUILDING', 'PARKING GARAGE'
          )
          AND (p.owner_name IS NULL OR (
              p.owner_name NOT LIKE '%CHURCH%' 
              AND p.owner_name NOT LIKE '%MINISTR%' 
              AND p.owner_name NOT LIKE '%BAPTIST%'
              AND p.owner_name NOT LIKE '%METHODIST%'
              AND p.owner_name NOT LIKE '%EPISCOPAL%'
              AND p.owner_name NOT LIKE '%CATHOLIC%'
              AND p.owner_name NOT LIKE '%TEMPLE%'
              AND p.owner_name NOT LIKE '%MOSQUE%'
              AND p.owner_name NOT LIKE '%SCHOOL%' 
              AND p.owner_name NOT LIKE '%ISD%'
              AND p.owner_name NOT LIKE '%ACADEMY%'
              AND p.owner_name NOT LIKE '%HOUSING AUTHORITY%'
              AND p.owner_name NOT LIKE '%APARTMENTS%'
              AND p.owner_name NOT LIKE '%COMMUNITY COLLEGE%'
          ))
        ORDER BY p.last_reroof_date ASC
    """
    cur.execute(query)
    rows = cur.fetchall()
    print(f"Total raw commercial candidates fetched: {len(rows)}")

    candidates = []
    dropped_rebuilt = []
    dropped_local_reroof = []

    for r in rows:
        (
            pid, acct, addr, city, zip_code, prop_type, owner, o_addr, o_city, o_state, o_zip,
            b_sqft, stories, yr_built, sections_raw, r_date, r_pno
        ) = r

        # 1. Parse improvement sections
        sections = []
        if sections_raw:
            try:
                sections = json.loads(sections_raw)
            except Exception:
                pass

        # 2. Check year_built discrepancy (e.g. Shady Trail: reroof 2016, building rebuilt 2026 or year_built > reroof year)
        reroof_year = int(r_date[:4]) if r_date and len(r_date) >= 4 else 1900
        has_rebuild_conflict = False
        rebuild_reason = ""

        if yr_built and yr_built > reroof_year:
            has_rebuild_conflict = True
            rebuild_reason = f"DCAD year_built {yr_built} is after reroof {r_date}"

        # Also inspect sections for newer year_built
        for s in sections:
            s_yr = s.get("year_built")
            if s_yr and s_yr > reroof_year:
                has_rebuild_conflict = True
                rebuild_reason = f"Section {s.get('description', '')} year_built {s_yr} is after reroof {r_date}"
                break

        if has_rebuild_conflict:
            dropped_rebuilt.append({
                "parcel_id": pid,
                "address": addr,
                "last_reroof_date": r_date,
                "permit_no": r_pno,
                "year_built": yr_built,
                "reason": rebuild_reason
            })
            continue

        # 3. Check existing normalized_permits for post-baseline reroofs already in DB
        # Only drop if the raw description actually verifies as a full reroof!
        cur.execute("""
            SELECT raw_permit_number, issue_date, raw_description, source_system
            FROM normalized_permits
            WHERE parcel_id = ?
              AND issue_date > ?
            ORDER BY issue_date DESC
        """, (pid, r_date))
        newer_permits = cur.fetchall()

        newer_reroof_found = None
        # Pure reroof phrases strictly adhering to full replacement rules
        PURE_REROOF_PATTERNS = [
            r"\breroof\b", r"\bre-roof\b", r"\broof replacement\b", r"\bnew roof\b",
            r"\btear[- ]?off\b", r"\btpo\b", r"\bepdm\b", r"\bsingle[- ]?ply\b",
            r"\bbuilt[- ]?up\b", r"\bmodified bitumen\b", r"\bshingle\b",
            r"\bremove existing roof\b", r"\binstall new roof\b", r"\breplace.*roof membrane\b"
        ]
        NON_ROOF_EXCLUDE = [
            r"\bhvac\b", r"\brtu\b", r"\bair condition", r"\bplumbing\b",
            r"\belectrical\b", r"\bantenna\b", r"\bcell\b", r"\bsolar\b",
            r"\bscaffold\b", r"\btrain\b", r"\brailroad\b", r"\bweed\b",
            r"\btree\b", r"\bsidewalk\b"
        ]

        for np in newer_permits:
            np_no, np_date, np_desc, np_source = np
            if not np_desc:
                continue
            d_lower = np_desc.lower()
            is_reroof = any(re.search(pat, d_lower) for pat in PURE_REROOF_PATTERNS)
            if is_reroof:
                newer_reroof_found = {
                    "permit_no": np_no,
                    "issue_date": np_date,
                    "description": np_desc,
                    "source": np_source
                }
                break

        if newer_reroof_found:
            dropped_local_reroof.append({
                "parcel_id": pid,
                "address": addr,
                "old_reroof_date": r_date,
                "newer_reroof_date": newer_reroof_found["issue_date"],
                "newer_permit_no": newer_reroof_found["permit_no"],
                "description": newer_reroof_found["description"],
                "source": newer_reroof_found["source"]
            })
            continue

        # 4. Foundation and stories evaluation
        # Rule: Only show roof size when stories == 1.0 and EVERY section has a foundation.
        # Otherwise, keep the lead with roof size as None.
        roof_area_sqft = None
        roof_area_basis = "UNMEASURED"

        # Determine effective story count
        story_val = float(stories) if stories is not None else 1.0
        is_single_story = (story_val <= 1.01)

        # Check all sections
        if sections:
            all_sections_have_foundation = True
            total_foundation = 0
            for s in sections:
                f_sqft = s.get("foundation_sqft")
                s_story = s.get("stories", 1.0)
                if s_story and s_story > 1.01:
                    is_single_story = False
                if not f_sqft or f_sqft <= 0:
                    all_sections_have_foundation = False
                else:
                    total_foundation += f_sqft

            if is_single_story and all_sections_have_foundation and total_foundation > 0:
                roof_area_sqft = int(total_foundation)
                roof_area_basis = "DCAD_FOUNDATION_SUM"
            elif not is_single_story:
                roof_area_sqft = None
                roof_area_basis = f"MULTI_STORY_{int(story_val)}_FLOORS"
            else:
                roof_area_sqft = None
                roof_area_basis = "MISSING_FOUNDATION_SECTION"
        else:
            if not is_single_story:
                roof_area_sqft = None
                roof_area_basis = f"MULTI_STORY_{int(story_val)}_FLOORS"
            else:
                roof_area_sqft = None
                roof_area_basis = "NO_DCAD_SECTIONS"

        candidates.append({
            "parcel_id": pid,
            "account_number": acct,
            "address": addr,
            "city": city,
            "zip_code": zip_code,
            "property_type": prop_type,
            "owner_name": owner,
            "owner_address": o_addr,
            "owner_city": o_city,
            "owner_state": o_state,
            "owner_zip": o_zip,
            "stories": story_val,
            "building_sqft": b_sqft,
            "roof_area_sqft": roof_area_sqft,
            "roof_area_basis": roof_area_basis,
            "year_built": yr_built,
            "last_reroof_date": r_date,
            "last_reroof_permit_no": r_pno,
            "improvement_sections_count": len(sections)
        })

    conn.close()

    print(f"\n--- Phase 1 Audit Summary ---")
    print(f"Total raw candidates queried: {len(rows)}")
    print(f"Dropped due to Year Built Rebuild Discrepancy (e.g. Shady Trail): {len(dropped_rebuilt)}")
    print(f"Dropped due to Existing DB Newer Reroof Permit: {len(dropped_local_reroof)}")
    print(f"Active Clean Candidates remaining for DallasNow pass: {len(candidates)}")

    # Breakdown of roof_area_basis
    basis_counts = {}
    for c in candidates:
        b = c["roof_area_basis"]
        basis_counts[b] = basis_counts.get(b, 0) + 1
    print("\nRoof Area Measurement Breakdown:")
    for b, cnt in basis_counts.items():
        print(f"  {b}: {cnt}")

    output_payload = {
        "generated_at": "2026-10-14",
        "cutoff_date": "2016-10-14",
        "total_active_candidates": len(candidates),
        "dropped_rebuilt_count": len(dropped_rebuilt),
        "dropped_local_reroof_count": len(dropped_local_reroof),
        "candidates": candidates,
        "dropped_rebuilt": dropped_rebuilt,
        "dropped_local_reroof": dropped_local_reroof
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    print(f"\nSaved candidates to: {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
