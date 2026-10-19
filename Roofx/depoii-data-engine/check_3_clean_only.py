import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

targets = [
    ("2720 Cullen St", "Fort Worth", "76107"),
    ("4300 Old Benbrook Rd", "Fort Worth", "76116"),
    ("15702 El Estado Dr", "Dallas", "75248")
]

for addr, city, zip_code in targets:
    num, st = addr.split()[0], addr.split()[1]
    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{st}%"))
    matches = cur.fetchall()
    print(f"{addr}, {city} (Zip: {zip_code}): {len(matches)} permits found in database.")
    for m in matches:
        print(f"  • {m[0]} ({m[1]}): {m[2]} | {m[3]}")
