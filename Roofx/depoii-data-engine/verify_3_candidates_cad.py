import urllib.request
import urllib.parse
import json

TARRANT_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0", "Accept": "application/json"}

# 1. Fort Worth 76116: 4300 Old Benbrook Rd
print("=== LIVE TAD CHECK: 4300 OLD BENBROOK RD (76116) ===")
p1 = {
    "where": "SITUS_ADDR LIKE '%4300 OLD BENBROOK%'",
    "outFields": "ACCOUNT,SITUS_ADDR,CITY,ZIPCODE,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1",
    "f": "json"
}
req1 = urllib.request.Request(f"{TARRANT_URL}?{urllib.parse.urlencode(p1)}", headers=HEADERS)
try:
    with urllib.request.urlopen(req1, timeout=10) as res:
        feats = json.loads(res.read().decode()).get("features", [])
        if feats:
            print(json.dumps(feats[0]["attributes"], indent=2))
        else:
            print("No TAD feature found.")
except Exception as e:
    print(e)

# 2. Dallas: 15702 El Estado Dr
print("\n=== LIVE DCAD CHECK: 15702 EL ESTADO DR (DALLAS) ===")
p2 = {
    "where": "ST_NUM = '15702' AND ST_NAME = 'EL ESTADO DR'",
    "outFields": "ACCT,ST_NUM,ST_NAME,CITY,BLDG_CL,TAXPANAME1,AREA_FEET,Website",
    "f": "json"
}
req2 = urllib.request.Request(f"{DALLAS_URL}?{urllib.parse.urlencode(p2)}", headers=HEADERS)
try:
    with urllib.request.urlopen(req2, timeout=10) as res:
        feats = json.loads(res.read().decode()).get("features", [])
        if feats:
            print(json.dumps(feats[0]["attributes"], indent=2))
        else:
            print("No DCAD feature found.")
except Exception as e:
    print(e)

# 3. Fort Worth Tier 1/2: 2720 Cullen St
print("\n=== LIVE TAD CHECK: 2720 CULLEN ST (FORT WORTH) ===")
p3 = {
    "where": "SITUS_ADDR LIKE '%2720 CULLEN%'",
    "outFields": "ACCOUNT,SITUS_ADDR,CITY,ZIPCODE,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1",
    "f": "json"
}
req3 = urllib.request.Request(f"{TARRANT_URL}?{urllib.parse.urlencode(p3)}", headers=HEADERS)
try:
    with urllib.request.urlopen(req3, timeout=10) as res:
        feats = json.loads(res.read().decode()).get("features", [])
        if feats:
            print(json.dumps(feats[0]["attributes"], indent=2))
        else:
            print("No TAD feature found.")
except Exception as e:
    print(e)
