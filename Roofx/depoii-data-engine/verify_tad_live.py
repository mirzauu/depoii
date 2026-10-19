import urllib.request
import urllib.parse
import json

TARRANT_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-Audit/1.0",
    "Accept": "application/json"
}

# Check Account 01077600 (3100 Sappington Pl, Fort Worth)
params = {
    "where": "ACCOUNT = '01077600'",
    "outFields": "*",
    "returnGeometry": "true",
    "outSR": "4326",
    "f": "json"
}

url = f"{TARRANT_URL}?{urllib.parse.urlencode(params)}"
req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

try:
    with urllib.request.urlopen(req, timeout=15) as res:
        data = json.loads(res.read().decode())
        features = data.get("features", [])
        if features:
            attrs = features[0].get("attributes", {})
            print("=== TAD LIVE VERIFICATION: 3100 SAPPINGTON PL ===")
            for k, v in sorted(attrs.items()):
                if v is not None and str(v).strip():
                    print(f"  {k}: {v}")
        else:
            print("No feature returned for ACCOUNT 01077600")
except Exception as e:
    print(f"Error querying live TAD: {e}")
