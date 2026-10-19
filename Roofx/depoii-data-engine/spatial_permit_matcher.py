import sqlite3
import math
import time

DB_PATH = "depoii_local.db"

def haversine_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def run_spatial_permit_match(max_distance_meters=45.0):
    start_time = time.time()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("="*70)
    print("SPATIAL PERMIT-TO-PARCEL MATCHER (DFW)")
    print(f"Max Proximity Radius: {max_distance_meters} meters (~150 ft)")
    print("="*70)

    # 1. Load real TX parcels with coordinates
    cur.execute("""
        SELECT id, address, city, building_sqft, latitude, longitude
        FROM parcels
        WHERE state = 'TX' AND is_mock = 0 AND latitude IS NOT NULL AND longitude IS NOT NULL
    """)
    parcels = cur.fetchall()
    print(f"Loaded {len(parcels):,} real DFW parcels with GIS coordinates.")

    # Build spatial grid index (cell size ~ 100m, step = 0.001 degrees)
    GRID_STEP = 0.001
    grid = {}
    for p in parcels:
        pid, addr, city, sqft, lat, lon = p
        cell_x = int(math.floor(lat / GRID_STEP))
        cell_y = int(math.floor(lon / GRID_STEP))
        key = (cell_x, cell_y)
        if key not in grid:
            grid[key] = []
        grid[key].append(p)

    print(f"Constructed spatial hash grid across {len(grid):,} cells.")

    # 2. Load Texas permits with coordinates
    cur.execute("""
        SELECT id, normalized_address, city, square_footage, latitude, longitude, parcel_id
        FROM normalized_permits
        WHERE state = 'TX'
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND geo_quality IN ('source_point', 'geocoded')
    """)
    permits = cur.fetchall()
    print(f"Processing {len(permits):,} Texas permits with GIS coordinates...")

    already_linked = sum(1 for p in permits if p[6])
    print(f"Initial linked permits: {already_linked:,} ({already_linked / len(permits) * 100:.1f}%)")

    matches = []

    for perm in permits:
        pm_id, pm_addr, pm_city, pm_sqft, pm_lat, pm_lon, existing_pid = perm

        # Check candidate cells in 3x3 neighborhood
        cell_x = int(math.floor(pm_lat / GRID_STEP))
        cell_y = int(math.floor(pm_lon / GRID_STEP))

        closest_parcel = None
        closest_dist = max_distance_meters

        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                neighbors = grid.get((cell_x + dx, cell_y + dy), [])
                for parc in neighbors:
                    pr_id, pr_addr, pr_city, pr_sqft, pr_lat, pr_lon = parc
                    dist = haversine_meters(pm_lat, pm_lon, pr_lat, pr_lon)
                    if dist < closest_dist:
                        closest_dist = dist
                        closest_parcel = parc

        if closest_parcel:
            pr_id, pr_addr, pr_city, pr_sqft, pr_lat, pr_lon = closest_parcel
            
            # STRICT ADDRESS INTEGRITY GUARD:
            # Proximity alone is NOT sufficient. Street number and street name must agree.
            from batch_parcel_matcher import clean_address_components
            pm_num, pm_st = clean_address_components(pm_addr)
            pr_num, pr_st = clean_address_components(pr_addr)
            
            if pm_num and pr_num and pm_num == pr_num:
                # Street names must match or share the canonical base with directional integrity
                if pm_st and pr_st and (pm_st == pr_st or pm_st in pr_st or pr_st in pm_st):
                    matches.append((pr_id, pm_id))

    print(f"\n[+] Found {len(matches):,} strictly verified parcel-permit linkages within {max_distance_meters}m!")

    cur.executemany("""
        UPDATE normalized_permits
        SET parcel_id = ?
        WHERE id = ? AND geo_quality IN ('source_point', 'geocoded')
    """, matches)

    conn.commit()

    # Final linkage count for Texas
    cur.execute("""
        SELECT COUNT(*),
               COUNT(CASE WHEN parcel_id IS NOT NULL AND parcel_id != '' THEN 1 END) as linked,
               COUNT(CASE WHEN square_footage > 0 THEN 1 END) as has_sqft
        FROM normalized_permits
        WHERE state = 'TX'
    """)
    tot_tx, linked_tx, sqft_tx = cur.fetchone()

    conn.close()
    elapsed = time.time() - start_time

    print("\n" + "="*70)
    print("TEXAS POST-SPATIAL JOIN RESULTS")
    print("="*70)
    print(f"Total Texas Permits           : {tot_tx:,}")
    print(f"Linked to Real Parcels        : {linked_tx:,} ({linked_tx / tot_tx * 100:.1f}%)")
    print(f"Permits with Square Footage   : {sqft_tx:,} ({sqft_tx / tot_tx * 100:.1f}%)")
    print(f"Elapsed Time                  : {elapsed:.2f} seconds")

if __name__ == "__main__":
    run_spatial_permit_match(max_distance_meters=45.0)
