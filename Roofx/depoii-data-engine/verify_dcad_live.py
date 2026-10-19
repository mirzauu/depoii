import urllib.request
import urllib.parse
import json

DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-Audit/1.0",
    "Accept": "application/json"
}

# Check 13999 Goldmark Dr on live DCAD
params = {
    "where": "ST_NUM = '13999' AND ST_NAME = 'GOLDMARK'",
    "outFields": "*",
    "returnGeometry": "true",
    "outSR": "4326",
    "f": "json"
}

url = f"{DALLAS_URL}?{urllib.parse.urlencode(params)}"
req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

try:
    with urllib.request.urlopen(req, timeout=15) as res:
        data = json.loads(res.read().decode())
        features = data.get("features", [])
        if features:
            attrs = features[0].get("attributes", {})
            print("=== DCAD LIVE VERIFICATION: 13999 GOLDMARK DR ===")
            for k, v in sorted(attrs.items()):
                if v is not None and str(v).strip():
                    print(f"  {k}: {v}")
        else:
            print("No feature returned for 13999 Goldmark Dr")
except Exception as e:
    print(f"Error querying live DCAD: {e}")
