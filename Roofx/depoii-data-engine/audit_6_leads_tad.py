import urllib.request
import urllib.parse
import json

TAD_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0", "Accept": "application/json"}

leads_to_audit = [
    # CGJ
    ("6777 Camp Bowie Blvd", "04944883"),
    ("6353 Camp Bowie Blvd", "02450894"),
    # Ducker Candidates
    ("3209 Alta Mere Dr", "00028525"),
    ("2020 E 4th St", "07901224"),
    # MAZE
    ("201 NE 28th St", "00973742"),
    ("2701 Decatur Ave", "00973688"),
]

for addr, acct in leads_to_audit:
    params = {
        "where": f"ACCOUNT = '{acct}'",
        "outFields": "*",
        "f": "json"
    }
    url = f"{TAD_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    print("=" * 80)
    print(f"AUDITING TAD RECORD: {addr} (Acct: {acct})")
    print("=" * 80)
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode())
            feats = data.get("features", [])
            if feats:
                attrs = feats[0]["attributes"]
                print(f"  • Situs Address : {attrs.get('SITUS_ADDR')}")
                print(f"  • Owner Name    : {attrs.get('OWNER_NAME')}")
                print(f"  • City / Zip    : {attrs.get('CITY')}, {attrs.get('ZIP')}")
                print(f"  • Legal 1       : {attrs.get('LEGAL_1')}")
                print(f"  • State Code    : {attrs.get('STATE_CD')}")
                print(f"  • Living Area   : {attrs.get('LIVING_ARE')} sq ft")
                print(f"  • Year Built    : {attrs.get('YEAR_BUILT')}")
                print(f"  • Total Value   : ${attrs.get('TOTAL_VALU'):,}")
                print(f"  • Land Acres    : {attrs.get('LAND_ACRES')} acres")
                print(f"  • Mapsco        : {attrs.get('MAPSCO')}")
                print(f"  • GIS Centroid  : Lat {attrs.get('LATITUDE')}, Lon {attrs.get('LONGITUDE')}")
            else:
                print("  [ERROR] No features found!")
    except Exception as e:
        print(f"  [ERROR] {e}")
