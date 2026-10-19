import urllib.request
import urllib.parse
import json

TARRANT_URL = 'https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0', 'Accept': 'application/json'}

accounts = [
    '04433254', # 4300 Old Benbrook Rd
    '00112046', # 2720 Cullen St
    '00029009', # 7408 Camp Bowie West Blvd
    '00788821', # 6777 Camp Bowie Blvd
    '00028525', # 3209 Alta Mere Dr
    '00029580', # 7912 Camp Bowie West Blvd
    '01132148', # 633 Mony St
    '01029134', # 3209 Galvez Ave
    '04897323', # 220 S Sylvania Ave
    '00008591'  # 600 N Hays St
]

for acct in accounts:
    p = {
        'where': f"ACCOUNT = '{acct}'",
        'outFields': 'ACCOUNT,SITUS_ADDR,CITY,ZIPCODE,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1,MAPSCO,LAND_ACRES,IMPR_VALUE',
        'f': 'json'
    }
    req = urllib.request.Request(f"{TARRANT_URL}?{urllib.parse.urlencode(p)}", headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            feats = json.loads(res.read().decode()).get('features', [])
            if feats:
                a = feats[0]['attributes']
                situs = (a.get('SITUS_ADDR') or '').strip()
                owner = (a.get('OWNER_NAME') or '').strip()
                living = a.get('LIVING_ARE') or 0
                yr = int(a.get('YEAR_BUILT') or 0)
                val = a.get('TOTAL_VALU') or 0
                impr = a.get('IMPR_VALUE') or 0
                mapsco = (a.get('MAPSCO') or '').strip()
                legal = (a.get('LEGAL_1') or '').strip()
                acres = a.get('LAND_ACRES') or 0
                print(f"Acct: {a.get('ACCOUNT')} | Addr: {situs} | Owner: {owner} | SqFt: {living:,.0f} | Built: {yr} | Val: ${val:,.0f} | Mapsco: {mapsco} | Acres: {acres:.2f}")
    except Exception as e:
        print(f"Error {acct}: {e}")
