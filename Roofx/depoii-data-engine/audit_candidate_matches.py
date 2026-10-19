import sqlite3
import math

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Load all permits with coordinates in Fort Worth and Dallas
cur.execute("""
    SELECT latitude, longitude, normalized_address, issue_date, raw_description
    FROM normalized_permits
    WHERE city IN ('Fort Worth', 'Dallas') AND latitude IS NOT NULL AND longitude IS NOT NULL
""")
permits = cur.fetchall()

# Candidate test in Fort Worth (e.g. 2720 Cullen St or 590 N Beach St or 4300 Old Benbrook Rd)
candidates = [
    ("TAD-PARCEL-00112046", "2720 Cullen St", "Fort Worth", 75908, 1987, "Fw Westside Re Investors Llc", 32.76176, -97.35614),
    ("TAD-PARCEL-00938807", "590 N Beach St", "Fort Worth", 100000, 1973, "Melvin Evans Properties Ltd", 32.76672, -97.28822),
    ("DCAD-PARCEL-00000799252000000", "15702 El Estado Dr", "Dallas", 92882, 1996, "15534 Monterey Lp", 32.96204, -96.79257),
    ("TAD-PARCEL-02293810", "4300 Old Benbrook Rd", "Fort Worth", 99796, 1984, "Westwind 2013 Vr Associates", 32.70932, -97.43770),
    ("TAD-PARCEL-00036390", "1200 W Risinger Rd", "Fort Worth", 186750, 1972, "1200 Risinger Llc", 32.61719, -97.34685)
]

print("=== CHECKING PERMITS WITHIN 150 METERS FOR CANDIDATES ===")
for cid, addr, city, sqft, yr, owner, lat, lon in candidates:
    print(f"\nChecking: {addr}, {city} (Sqft: {sqft:,}, Owner: {owner})")
    
    # Check text address matches
    num = addr.split()[0]
    street = addr.split()[1]
    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, category, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{street}%"))
    text_matches = cur.fetchall()
    
    # Check spatial distance matches
    dist_matches = []
    for pm in permits:
        p_lat, p_lon, p_addr, p_dt, p_desc = pm
        d = haversine(lat, lon, p_lat, p_lon)
        if d <= 150: # within 150m
            dist_matches.append((p_addr, p_dt, round(d, 1), p_desc))
            
    print(f"  Exact Address Matches: {len(text_matches)}")
    for tm in text_matches:
        print(f"    • {tm[0]} ({tm[1]}): {tm[2]} | {tm[4][:60]}")
        
    print(f"  Permits within 150m: {len(dist_matches)}")
    for dm in dist_matches[:3]:
        print(f"    • {dm[0]} ({dm[1]}, {dm[2]}m away): {dm[3][:60]}")
