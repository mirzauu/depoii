"""
Step 4: Staged Hail Commercial Leads Ingestion
Uses verified NOAA SPC hail file `260425_rpts_hail.csv` (April 25, 2026).
Applies the identical commercial filter (no apartments, houses, vacant lots, churches, schools, city).
Calculates exact Haversine distance from each commercial parcel to the nearest Texas SPC hail report.
Enforces the 15.0 mile maximum report display cap.
Converts SPC Size from hundredths of an inch (e.g. 300 -> 3.00 in).
Classifies into two distinct groups:
  - Group A (KNOWN_PRE_STORM): last_reroof_date < storm_date ('2026-04-25').
    Line: 'Stored permit YYYY-MM-DD, which is before the storm' (+ DallasNow if checked in Step 2).
    If last_reroof_date >= storm_date: omitted from both groups.
  - Group B (ROOF_DATE_UNKNOWN): last_reroof_date IS NULL. Roof date left blank.
    Designated as NOT a call list.
"""
import os
import io
import csv
import math
import sqlite3
import httpx

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")
SPC_CODE = "260425"
SPC_FILE_NAME = f"{SPC_CODE}_rpts_hail.csv"
SPC_URL = f"https://www.spc.noaa.gov/climo/reports/{SPC_FILE_NAME}"
STORM_DATE = "2026-04-25"

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Connecting to database: {DB_PATH}")

    # 1. Create table staged_hail_commercial_leads
    cur.execute("""
        CREATE TABLE IF NOT EXISTS staged_hail_commercial_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parcel_id TEXT NOT NULL,
            address TEXT NOT NULL,
            city TEXT DEFAULT 'Dallas',
            zip_code TEXT,
            property_type TEXT,
            owner_name TEXT,
            stories REAL,
            roof_area_sqft INTEGER,
            roof_area_basis TEXT,
            last_reroof_date TEXT,
            last_reroof_permit_no TEXT,
            hail_group TEXT NOT NULL,
            roof_status_line TEXT NOT NULL,
            spc_storm_date TEXT NOT NULL,
            spc_event_time_utc TEXT NOT NULL,
            spc_hail_size_inches REAL NOT NULL,
            spc_distance_miles REAL NOT NULL,
            spc_location_desc TEXT,
            spc_observation_line TEXT NOT NULL,
            spc_source_file TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    print("Ensured table `staged_hail_commercial_leads` exists.")

    # Fresh wipe for staging build
    cur.execute("DELETE FROM staged_hail_commercial_leads")
    conn.commit()

    # 2. Ingest NOAA SPC Hail Reports for 260425
    print(f"Fetching NOAA SPC hail report: {SPC_URL}...")
    resp = httpx.get(SPC_URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0"})
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to fetch SPC file: HTTP {resp.status_code}")

    reader = csv.reader(io.StringIO(resp.text))
    header = next(reader)
    
    # Filter for Texas reports
    tx_reports = []
    for row in reader:
        if len(row) >= 7 and row[4].upper() == "TX":
            time_utc, size_raw, loc, county, st, lat_str, lon_str = row[0], row[1], row[2], row[3], row[4], row[5], row[6]
            try:
                lat = float(lat_str)
                lon = float(lon_str)
                size_hundredths = float(size_raw)
                size_inches = size_hundredths / 100.0
                tx_reports.append({
                    "time": time_utc,
                    "size_inches": size_inches,
                    "location": loc,
                    "county": county,
                    "lat": lat,
                    "lon": lon
                })
            except Exception:
                continue

    print(f"Loaded {len(tx_reports)} Texas hail reports from {SPC_FILE_NAME}.")

    # 3. Query all Dallas commercial parcels with coordinates and improvement details
    # Apply identical commercial filter
    cur.execute("""
        SELECT 
            p.id,
            p.address,
            p.city,
            p.zip_code,
            p.property_type,
            p.owner_name,
            p.stories,
            p.footprint_sqft,
            p.latitude,
            p.longitude,
            p.last_reroof_date,
            p.last_reroof_permit_no
        FROM parcels p
        WHERE p.city = 'Dallas'
          AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
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
    """)
    parcels = cur.fetchall()
    print(f"Total candidate commercial parcels with coordinates: {len(parcels)}")

    # Check which parcels were searched on DallasNow in staged_aging_commercial_leads
    cur.execute("""
        SELECT parcel_id, dallasnow_checked_at
        FROM staged_aging_commercial_leads
        WHERE dallasnow_checked_at IS NOT NULL
    """)
    dallasnow_checked_map = dict(cur.fetchall())

    group_a_count = 0
    group_b_count = 0
    omitted_post_storm_count = 0
    out_of_range_count = 0

    to_insert = []

    for p in parcels:
        pid, addr, city, zip_code, prop_type, owner, stories, footprint, lat, lon, r_date, r_pno = p

        # Find nearest Texas SPC report
        min_dist = 999999.0
        nearest_spc = None

        for rep in tx_reports:
            d = haversine_miles(lat, lon, rep["lat"], rep["lon"])
            if d < min_dist:
                min_dist = d
                nearest_spc = rep

        # 15.0 miles is the maximum query cap
        if min_dist > 15.0 or not nearest_spc:
            out_of_range_count += 1
            continue

        obs_line = f"Nearest Texas SPC report: {nearest_spc['size_inches']:.2f} in, {min_dist:.1f} miles away at {nearest_spc['time']} UTC"

        # Classification into Group A vs Group B
        if r_date:
            # Rule: last_reroof_date < storm_date (strict inequality)
            if r_date < STORM_DATE:
                hail_group = "KNOWN_PRE_STORM"
                status_line = f"Stored permit {r_date}, which is before the storm"
                if pid in dallasnow_checked_map:
                    status_line += f" (DallasNow checked on {dallasnow_checked_map[pid]})"
                group_a_count += 1
            else:
                # Same day or newer than storm -> omit from both groups
                omitted_post_storm_count += 1
                continue
        else:
            # Group B: Roof date unknown (blank)
            hail_group = "ROOF_DATE_UNKNOWN"
            r_date = None
            r_pno = None
            status_line = "Roof date unknown"
            group_b_count += 1

        story_val = float(stories) if stories is not None else 1.0
        is_single_story = (story_val <= 1.01)
        roof_area = footprint if is_single_story and footprint and footprint > 0 else None
        basis = "DCAD_FOUNDATION_SUM" if roof_area else (f"MULTI_STORY_{int(story_val)}_FLOORS" if not is_single_story else "UNMEASURED")

        to_insert.append((
            pid, addr, city, zip_code, prop_type, owner,
            story_val, roof_area, basis,
            r_date, r_pno, hail_group, status_line,
            STORM_DATE, nearest_spc["time"], nearest_spc["size_inches"], round(min_dist, 2),
            f"{nearest_spc['location']}, {nearest_spc['county']} Co.",
            obs_line, SPC_FILE_NAME
        ))

    cur.executemany("""
        INSERT INTO staged_hail_commercial_leads (
            parcel_id, address, city, zip_code, property_type, owner_name,
            stories, roof_area_sqft, roof_area_basis,
            last_reroof_date, last_reroof_permit_no, hail_group, roof_status_line,
            spc_storm_date, spc_event_time_utc, spc_hail_size_inches, spc_distance_miles,
            spc_location_desc, spc_observation_line, spc_source_file
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, to_insert)

    conn.commit()

    print("\n=======================================================")
    print(" STEP 4: STAGED HAIL COMMERCIAL LEADS SUMMARY")
    print("=======================================================")
    print(f"NOAA SPC Storm File Used:               {SPC_FILE_NAME} ({STORM_DATE})")
    print(f"Total Staged Hail Commercial Leads:      {len(to_insert)}")
    print(f"  - Group A (KNOWN_PRE_STORM):          {group_a_count} leads")
    print(f"  - Group B (ROOF_DATE_UNKNOWN - No Call):{group_b_count} records (date left blank)")
    print(f"Parcels reroofed on/after storm (Omitted):{omitted_post_storm_count}")
    print(f"Parcels farther than 15.0 miles (Cap):    {out_of_range_count}")
    print("=======================================================\n")

    conn.close()

if __name__ == "__main__":
    main()
