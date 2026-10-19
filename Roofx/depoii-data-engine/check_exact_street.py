import sqlite3

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

targets = [
    ("220 S Sylvania Ave", "220", "Sylvania"),
    ("633 Mony St", "633", "Mony"),
    ("3209 Galvez Ave", "3209", "Galvez"),
    ("520 Swayne Ave", "520", "Swayne"),
    ("600 N Hays St", "600", "Hays")
]

for full_addr, num, st_name in targets:
    cur.execute("""
        SELECT raw_permit_number, issue_date, normalized_address, category, raw_description
        FROM normalized_permits
        WHERE normalized_address LIKE ? AND normalized_address LIKE ?
    """, (f"%{num}%", f"%{st_name}%"))
    matches = cur.fetchall()
    print(f"\n{full_addr}: {len(matches)} permits found in database")
    for m in matches:
        print(f"  • {m[0]} ({m[1]}): {m[2]} | {m[4][:60]}")
