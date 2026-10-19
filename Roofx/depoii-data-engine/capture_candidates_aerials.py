import urllib.request
import json
import os

output_dir = r"d:\Depoii_nextjs\Roofx\thumbnails"
ESRI_IMAGERY_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
ESRI_METADATA_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/8/query"
HEADERS = {"User-Agent": "Mozilla/5.0"}

candidates = [
    ("7408 Camp Bowie West Blvd", "00029009", 32.723073, -97.444125),
    ("3201 Marquita Dr", "00028126", 32.725559, -97.443191)
]

for addr, acct, lat, lon in candidates:
    delta = 0.0016
    minx, maxx = lon - delta, lon + delta
    miny, maxy = lat - delta * 0.75, lat + delta * 0.75
    out_path = os.path.join(output_dir, f"thumb_TAD-PARCEL-{acct}.png")
    
    img_url = f"{ESRI_IMAGERY_URL}?bbox={minx},{miny},{maxx},{maxy}&bboxSR=4326&size=600,450&f=image"
    with urllib.request.urlopen(urllib.request.Request(img_url, headers=HEADERS)) as res:
        with open(out_path, "wb") as f:
            f.write(res.read())
            
    # Metadata date
    point_geom = json.dumps({'x': lon, 'y': lat, 'spatialReference': {'wkid': 4326}})
    meta_params = {
        'geometry': point_geom,
        'geometryType': 'esriGeometryPoint',
        'spatialRel': 'esriSpatialRelIntersects',
        'outFields': 'SRC_DATE',
        'f': 'json'
    }
    with urllib.request.urlopen(urllib.request.Request(f"{ESRI_METADATA_URL}?{urllib.parse.urlencode(meta_params)}", headers=HEADERS)) as mres:
        mdata = json.loads(mres.read().decode())
        s_date = str(mdata['features'][0]['attributes'].get('SRC_DATE') or "")
        dt_str = f"{s_date[:4]}-{s_date[4:6]}-{s_date[6:8]}" if len(s_date) >= 8 else s_date
        print(f"Captured {addr}: {out_path} | Date: {dt_str}")
