import urllib.request
import urllib.parse
import json

TARRANT_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0", "Accept": "application/json"}

accounts = ["01132148", "01029134", "04897323", "00008591"]

print("=== LIVE TAD RECORD VERIFICATION FOR PROXIMITY CANDIDATES ===")
for acct in accounts:
    params = {
        "where": f"ACCOUNT = '{acct}'",
        "outFields": "ACCOUNT,SITUS_ADDR,CITY,ZIPCODE,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1",
        "f": "json"
    }
    req = urllib.request.Request(f"{TARRANT_URL}?{urllib.parse.urlencode(params)}", headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            feats = json.loads(res.read().decode()).get("features", [])
            if feats:
                a = feats[0]["attributes"]
                print(f"\nAccount: {a.get('ACCOUNT')}")
                print(f"Address: {a.get('SITUS_ADDR')}, {a.get('CITY')}")
                print(f"Owner:   {a.get('OWNER_NAME')}")
                print(f"Sq Ft:   {a.get('LIVING_ARE'):,} | Year Built: {a.get('YEAR_BUILT')}")
                print(f"Val:     ${a.get('TOTAL_VALU'):,.2f}")
                print(f"Legal:   {a.get('LEGAL_1')}")
    except Exception as e:
        print(f"Error {acct}: {e}")
