import urllib.request
import urllib.parse
import json

DALLAS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii-DFW-Harvester/1.0",
    "Accept": "application/json"
}

params = {
    "where": "ResCom = 'C' AND AREA_FEET >= 20000",
    "outFields": "ACCT,GIS_ACCT,ST_NUM,ST_NAME,ST_TYPE,CITY,TAXPANAME1,AREA_FEET",
    "returnGeometry": "true",
    "outSR": "4326",  # WGS84 EPSG:4326 for lat/lon!
    "resultRecordCount": 5,
    "f": "json"
}

url = f"{DALLAS_URL}?{urllib.parse.urlencode(params)}"
req = urllib.request.Request(url, headers=DEFAULT_HEADERS)

try:
    with urllib.request.urlopen(req, timeout=10) as res:
        data = json.loads(res.read().decode())
        features = data.get("features", [])
        print(f"Retrieved {len(features)} Dallas features with geometry!")
        for f in features:
            attrs = f.get("attributes", {})
            geom = f.get("geometry", {})
            rings = geom.get("rings", [])
            # calculate centroid from rings
            if rings and rings[0]:
                lons = [pt[0] for pt in rings[0]]
                lats = [pt[1] for pt in rings[0]]
                centroid_lon = sum(lons) / len(lons)
                centroid_lat = sum(lats) / len(lats)
                print(f"  • {attrs.get('ST_NUM')} {attrs.get('ST_NAME')} {attrs.get('ST_TYPE')}, {attrs.get('CITY')} -> Lat: {centroid_lat:.5f}, Lon: {centroid_lon:.5f}")
except Exception as e:
    print(f"Error querying DCAD ArcGIS: {e}")
