import urllib.request
import urllib.parse
import json

DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-Audit/1.0",
    "Accept": "application/json"
}

params = {
    "where": "ACCT = '00000768983700000' OR GIS_ACCT = '00000768983700000'",
    "outFields": "*",
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
            print("=== DCAD LIVE VERIFICATION: ACCT 00000768983700000 ===")
            for k, v in sorted(attrs.items()):
                if v is not None and str(v).strip():
                    print(f"  {k}: {v}")
        else:
            print("No feature returned for ACCT 00000768983700000, checking fields...")
            # Let's inspect fields
            fields_url = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0?f=json"
            f_req = urllib.request.Request(fields_url, headers=DEFAULT_HEADERS)
            with urllib.request.urlopen(f_req, timeout=15) as f_res:
                f_data = json.loads(f_res.read().decode())
                print("Fields in layer:", [f['name'] for f in f_data.get('fields', [])][:15])
except Exception as e:
    print(f"Error querying live DCAD: {e}")
