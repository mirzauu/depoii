import sys
sys.path.append('Roofx/depoii-data-engine')
import sqlite3
from app.science.verification_engine import AerialSnapshotService

conn = sqlite3.connect(r'd:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db')
cur = conn.cursor()

candidates = [
    ("TAD-PARCEL-00788821", "6777 Camp Bowie Blvd"),
    ("TAD-PARCEL-06350739", "6353 Camp Bowie Blvd"),
    ("TAD-PARCEL-00028525", "3209 Alta Mere Dr"),
    ("TAD-PARCEL-07901224", "2020 E 4Th St"),
    ("TAD-PARCEL-00973742", "201 Ne 28Th St"),
    ("TAD-PARCEL-00973688", "2701 Decatur Ave"),
]

print("=== VERIFYING AERIAL SNAPSHOTS & ACQUISITION DATES ===")
for pid, addr in candidates:
    row = cur.execute("SELECT latitude, longitude FROM parcels WHERE id = ?", (pid,)).fetchone()
    if not row or row[0] is None or row[1] is None:
        print(f"[{pid}] {addr} -> NO COORDS IN DB!")
        continue
    lat, lon = float(row[0]), float(row[1])
    res = AerialSnapshotService.capture_snapshot(lat, lon, pid)
    print(f"\nAddress: {addr} ({pid})")
    print(f"  Coordinates: {lat:.5f}, {lon:.5f}")
    print(f"  Capture Result: {res.get('success')}")
    print(f"  Local Image: {res.get('local_path')}")
    print(f"  ESRI Image Capture Date: {res.get('capture_date')}")
