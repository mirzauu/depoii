"""
Step 1: Staged Aging Commercial Leads Ingestion
Creates table `staged_aging_commercial_leads` in depoii_local.db.
Extracts all Dallas commercial warehouse/office parcels with last_reroof_date <= '2016-10-14'.
Filters out residential/institutional properties.
Flags (does NOT drop) rebuild discrepancies (e.g. 10900 Shady Trl).
Calculates roof_area_sqft = sum(foundation_sqft) only for single-story with sections;
leaves null for multi-story and unsectioned.
"""
import os
import json
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Connecting to database: {DB_PATH}")

    # 1. Create table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS staged_aging_commercial_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parcel_id TEXT NOT NULL UNIQUE,
            account_number TEXT,
            address TEXT NOT NULL,
            city TEXT DEFAULT 'Dallas',
            zip_code TEXT,
            property_type TEXT,
            owner_name TEXT,
            owner_address TEXT,
            owner_city TEXT,
            owner_state TEXT,
            owner_zip TEXT,
            stories REAL,
            building_sqft INTEGER,
            roof_area_sqft INTEGER,
            roof_area_basis TEXT,
            year_built INTEGER,
            last_reroof_date TEXT NOT NULL,
            last_reroof_permit_no TEXT,
            flag_rebuild_discrepancy INTEGER DEFAULT 0,
            dcad_account_checked_at TEXT,
            dallasnow_checked_at TEXT,
            dallasnow_filings_count INTEGER,
            dallasnow_newest_filing_no TEXT,
            dallasnow_newest_filing_date TEXT,
            dallasnow_newest_filing_desc TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    print("Ensured table `staged_aging_commercial_leads` exists.")

    # Clear table for a fresh, clean staging build
    cur.execute("DELETE FROM staged_aging_commercial_leads")
    conn.commit()

    # 2. Query Dallas commercial parcels with last_reroof_date <= '2016-10-14'
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
    print(f"Total candidate commercial parcels queried: {len(rows)}")

    inserted_count = 0
    flagged_discrepancy_count = 0
    single_story_measured_count = 0
    multi_story_count = 0
    unmeasured_other_count = 0

    for r in rows:
        (
            pid, acct, addr, city, zip_code, prop_type, owner, o_addr, o_city, o_state, o_zip,
            b_sqft, stories, yr_built, sections_raw, r_date, r_pno
        ) = r

        # Parse improvement sections
        sections = []
        if sections_raw:
            try:
                sections = json.loads(sections_raw)
            except Exception:
                pass

        # Check for year_built / rebuild discrepancy (FLAG, DO NOT DROP)
        reroof_year = int(r_date[:4]) if r_date and len(r_date) >= 4 else 1900
        flag_rebuild = 0

        if yr_built and yr_built > reroof_year:
            flag_rebuild = 1
        else:
            for s in sections:
                s_yr = s.get("year_built")
                if s_yr and s_yr > reroof_year:
                    flag_rebuild = 1
                    break

        if flag_rebuild:
            flagged_discrepancy_count += 1

        # Roof area measurement
        roof_area_sqft = None
        roof_area_basis = "UNMEASURED"

        story_val = float(stories) if stories is not None else 1.0
        is_single_story = (story_val <= 1.01)

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
                single_story_measured_count += 1
            elif not is_single_story:
                roof_area_sqft = None
                roof_area_basis = f"MULTI_STORY_{int(story_val)}_FLOORS"
                multi_story_count += 1
            else:
                roof_area_sqft = None
                roof_area_basis = "MISSING_FOUNDATION_SECTION"
                unmeasured_other_count += 1
        else:
            if not is_single_story:
                roof_area_sqft = None
                roof_area_basis = f"MULTI_STORY_{int(story_val)}_FLOORS"
                multi_story_count += 1
            else:
                roof_area_sqft = None
                roof_area_basis = "NO_DCAD_SECTIONS"
                unmeasured_other_count += 1

        cur.execute("""
            INSERT INTO staged_aging_commercial_leads (
                parcel_id, account_number, address, city, zip_code,
                property_type, owner_name, owner_address, owner_city, owner_state, owner_zip,
                stories, building_sqft, roof_area_sqft, roof_area_basis,
                year_built, last_reroof_date, last_reroof_permit_no,
                flag_rebuild_discrepancy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pid, acct, addr, city, zip_code,
            prop_type, owner, o_addr, o_city, o_state, o_zip,
            story_val, b_sqft, roof_area_sqft, roof_area_basis,
            yr_built, r_date, r_pno,
            flag_rebuild
        ))
        inserted_count += 1

    conn.commit()

    # Verify counts in table
    cur.execute("SELECT count(*) FROM staged_aging_commercial_leads")
    total_in_table = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM staged_aging_commercial_leads WHERE flag_rebuild_discrepancy = 1")
    total_flagged = cur.fetchone()[0]

    # Check Shady Trail
    cur.execute("""
        SELECT parcel_id, address, year_built, last_reroof_date, last_reroof_permit_no, flag_rebuild_discrepancy
        FROM staged_aging_commercial_leads
        WHERE address LIKE '%10900 SHADY%'
    """)
    shady_row = cur.fetchone()

    conn.close()

    print("\n=======================================================")
    print(" STEP 1: STAGED AGING COMMERCIAL LEADS SUMMARY")
    print("=======================================================")
    print(f"Total rows inserted into `staged_aging_commercial_leads`: {total_in_table}")
    print(f"  - Single-Story Warehouses with Foundation Sum:         {single_story_measured_count}")
    print(f"  - Multi-Story Commercial Offices (Roof Area NULL):      {multi_story_count}")
    print(f"  - Other Commercial Assets (Roof Area NULL):            {unmeasured_other_count}")
    print(f"Parcels flagged with Rebuild Discrepancy (KEPT):         {total_flagged}")
    print(f"10900 SHADY TRL row verified in table:                   {shady_row}")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
