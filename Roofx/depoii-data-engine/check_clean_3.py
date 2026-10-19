import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

properties = [
    ("TAD-PARCEL-00112046", "2720 Cullen St", "Fort Worth", "76107", "Fw Westside Re Investors Llc", 75908, 1987),
    ("TAD-PARCEL-02293810", "4300 Old Benbrook Rd", "Fort Worth", "76116", "Westwind 2013 Vr Associates", 99796, 1984),
    ("DCAD-PARCEL-00000799252000000", "15702 El Estado Dr", "Dallas", "75248", "15534 Monterey Lp", 92882, 1996),
    ("TAD-PARCEL-00036390", "1200 W Risinger Rd", "Fort Worth", "76134", "1200 Risinger Llc", 186750, 1972)
]

for pid, addr, city, zip_code, owner, sqft, yr in properties:
    print(f"\n=======================================================")
    print(f"PROPERTY: {addr}, {city}, TX {zip_code}")
    print(f"Owner: {owner} | Sqft: {sqft:,} | Year Built: {yr}")
    print(f"=======================================================")
    
    # Check text address search
    num = addr.split()[0]
    street_part = addr.split()[1]
    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, category, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{street_part}%"))
    text_matches = cur.fetchall()
    
    print(f"1. Database Address Search: {len(text_matches)} permits found")
    for m in text_matches:
        print(f"   • {m[0]} ({m[1]}): {m[2]} | {m[4][:70]}")
        
    if not text_matches:
        print("   -> ZERO PERMITS ON FILE IN DATABASE.")
