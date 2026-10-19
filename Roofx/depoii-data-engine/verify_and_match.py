import json
import sqlite3

with open('Roofx/depoii-data-engine/rcat_official_directory.json', 'r', encoding='utf-8') as f:
    rcat = json.loads(f.read())
if isinstance(rcat, str):
    rcat = json.loads(rcat)


contractors = [
    ('CTR-FTW-EMPIREROOFINGIN', 'Empire Roofing'),
    ('CTR-FTW-SUPREMEROOFING', 'Supreme Roofing'),
    ('CTR-FTW-ZENITHROOFINGWA', 'Zenith Roofing'),
    ('CTR-FORT-WORTH-PREMIER-ROOFING-SHEET', 'Premier Roofing'),
    ('CTR-DAL-TEXAS-ROOF-MANAGEMENT', 'Texas Roof Management'),
    ('CTR-FTW-TARRANTROOFING', 'Tarrant Roofing'),
    ('CTR-FTW-PRIORITYROOFING', 'Priority Roofing'),
    ('CTR-DAL-ELITE-ROOFING-CONSULTING', 'Elite Roofing'),
    ('CTR-FTW-BLUSKYRESTORATI', 'BluSky'),
    ('CTR-FTW-DKHANEYROOFING', 'Haney')
]

for cid, name in contractors:
    matches = [c for c in rcat if name.lower() in c['company_name'].lower()]
    print(f"=== {cid}: {name} (Matches: {len(matches)}) ===")
    for m in matches:
        print(f"  Name: {m['company_name']}")
        print(f"  URL: {m['rcat_url']}")
        print(f"  Lic: {m['license_raw']}")
        print(f"  City: {m['city']}")
        print(f"  Website: {m['website']}")
        print(f"  MemberSince: {m['member_since']}")
