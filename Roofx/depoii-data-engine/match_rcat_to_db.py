import json
import sqlite3

with open('Roofx/depoii-data-engine/rcat_official_directory.json', 'r', encoding='utf-8') as f:
    rcat = json.loads(f.read())
if isinstance(rcat, str):
    rcat = json.loads(rcat)

conn = sqlite3.connect('Roofx/depoii-data-engine/depoii_local.db')
cur = conn.cursor()

matched = 0
for r in rcat:
    name = r['company_name'].strip()
    cur.execute('SELECT id, canonical_name FROM canonical_contractors WHERE LOWER(canonical_name) = ? OR LOWER(canonical_name) LIKE ?', (name.lower(), f'%{name.lower()}%'))
    rows = cur.fetchall()
    if rows:
        matched += 1
        if matched <= 15:
            print(f'Match: RCAT "{name}" ({r["city"]}) -> DB: {rows[0][0]} "{rows[0][1]}"')

print(f'Total RCAT matches in canonical_contractors: {matched} out of {len(rcat)}')
