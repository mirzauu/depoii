import urllib.request
import urllib.parse
import json

TARRANT_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-DFW-Harvester/1.0",
    "Accept": "application/json"
}

params = {
    "where": "LIVING_ARE >= 25000 AND TOTAL_VALU >= 500000",
    "outFields": "ACCOUNT,TAXPIN,OWNER_NAME,SITUS_ADDR,CITY,ZIPCODE,YEAR_BUILT,LIVING_ARE,TOTAL_VALU",
    "returnGeometry": "true",
    "outSR": "4326",
    "resultRecordCount": 5,
    "f": "json"
}

url = f"{TARRANT_URL}?{urllib.parse.urlencode(params)}"
req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

try:
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read().decode())
        features = data.get("features", [])
        print(f"Retrieved {len(features)} Tarrant features with geometry!")
        for f in features:
            attrs = f.get("attributes", {})
            geom = f.get("geometry", {})
            rings = geom.get("rings", [])
            if rings and rings[0]:
                lons = [pt[0] for pt in rings[0]]
                lats = [pt[1] for pt in rings[0]]
                centroid_lon = sum(lons) / len(lons)
                centroid_lat = sum(lats) / len(lats)
                print(f"  • {attrs.get('SITUS_ADDR')}, {attrs.get('CITY')} -> Lat: {centroid_lat:.5f}, Lon: {centroid_lon:.5f} (Sqft: {attrs.get('LIVING_ARE')})")
except Exception as e:
    print(f"Error querying TAD ArcGIS: {e}")
