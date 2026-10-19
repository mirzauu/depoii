import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

proximity_targets = [
    ("220 S Sylvania Ave", "04897323", "220 Sylvania Partners Llc", 42000),
    ("2020 E 4Th St", "07901224", "Fort Industrial Llc", 63795),
    ("633 Mony St", "01132148", "Stugar Lp", 52378),
    ("3209 Galvez Ave", "01029134", "Galvez Property Llc", 162798),
    ("520 Swayne Ave", "02467992", "Big Building Lc", 33897),
    ("600 N Hays St", "00008591", "Spiral Pipe Of Texas Inc", 50392)
]

print("=== CHECKING PERMIT LOGS FOR PROXIMITY TARGETS ===")
for addr, acct, owner, sqft in proximity_targets:
    num = addr.split()[0]
    st = addr.split()[1]
    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, category, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{st}%"))
    matches = cur.fetchall()
    post_permits = [m for m in matches if m[1] >= "2024-04-26"]
    print(f"\n{addr} (Acct: {acct}, Sqft: {sqft:,}, Owner: {owner})")
    print(f"  Post-April 26 Permits: {len(post_permits)}")
    for m in post_permits:
        print(f"    • {m[0]} ({m[1]}): {m[4][:60]}")
    if not post_permits:
        print("  -> ZERO PERMITS POST-STORM")
