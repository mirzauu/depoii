import sqlite3
import urllib.request
import json

conn = sqlite3.connect(r'd:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db')
cur = conn.cursor()

# TAD Parcels REST API to get exact TAD Property Use Code and Legal Description
TAD_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"

properties_to_verify = [
    ("00788821", "6777 Camp Bowie Blvd"),
    ("06350739", "6353 Camp Bowie Blvd"),
    ("01077848", "3100 Sappington Pl"),
    ("00973742", "201 Ne 28Th St"),
    ("00973688", "2701 Decatur Ave"),
    ("07901224", "2020 E 4Th St"),
    ("04897323", "220 S Sylvania Ave"),
    ("00833053", "2601 N Main St"),
    ("00028525", "3209 Alta Mere Dr")
]

print("=== VERIFYING EXACT TAD USE AND LEGAL DESCRIPTIONS ===")
for account_id, addr in properties_to_verify:
    params = {
        'where': f"TAXPIN = '{account_id}'",
        'outFields': '*',
        'f': 'json'
    }
    req = urllib.request.Request(f"{TAD_URL}?{urllib.parse.urlencode(params)}", headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            features = data.get('features', [])
            if features:
                attr = features[0].get('attributes', {})
                print(f"\nAccount: {account_id} | {addr}")
                print(f"  Owner: {attr.get('OWNERNAME')}")
                print(f"  Property Class: {attr.get('STATECD')} | Prop Type: {attr.get('PROPERTYTYPE')}")
                print(f"  Legal Desc: {attr.get('LEGALDESCRIPTION')}")
                print(f"  Site Address: {attr.get('SITEADD')}, {attr.get('SITECITY')} {attr.get('SITEZIP')}")
            else:
                print(f"\nAccount: {account_id} | {addr} -> NO GIS FEATURE FOUND BY TAXPIN")
    except Exception as e:
        print(f"Error querying {account_id}: {e}")
