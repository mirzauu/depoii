import os
import json
import urllib.request
import urllib.parse
from datetime import datetime

ESRI_IMAGERY_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
ESRI_METADATA_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/8/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0"}

output_dir = r"d:\Depoii_nextjs\Roofx\thumbnails"
os.makedirs(output_dir, exist_ok=True)

leads = [
    {"id": "TAD-PARCEL-00788821", "addr": "6777 Camp Bowie Blvd", "lat": 32.720286, "lon": -97.433857},
    {"id": "TAD-PARCEL-06350739", "addr": "6353 Camp Bowie Blvd", "lat": 32.725008, "lon": -97.420798},
    {"id": "TAD-PARCEL-00028525", "addr": "3209 Alta Mere Dr", "lat": 32.725350, "lon": -97.442580},
    {"id": "TAD-PARCEL-07901224", "addr": "2020 E 4th St", "lat": 32.753300, "lon": -97.301200},
    {"id": "TAD-PARCEL-00973742", "addr": "201 NE 28th St", "lat": 32.788500, "lon": -97.348200},
    {"id": "TAD-PARCEL-00973688", "addr": "2701 Decatur Ave", "lat": 32.784200, "lon": -97.352400},
]

print("=" * 80)
print("FETCHING ESRI AERIAL IMAGES & CAPTURE DATES FOR PILOT 3 LEADS")
print("=" * 80)

for lead in leads:
    lat, lon = lead["lat"], lead["lon"]
    lead_id = lead["id"]
    addr = lead["addr"]
    filename = f"thumb_{lead_id}.png"
    out_path = os.path.join(output_dir, filename)
    
    delta = 0.0018
    minx, maxx = lon - delta, lon + delta
    miny, maxy = lat - delta * 0.75, lat + delta * 0.75
    
    img_url = f"{ESRI_IMAGERY_URL}?bbox={minx},{miny},{maxx},{maxy}&bboxSR=4326&size=600,450&f=image"
    try:
        req = urllib.request.Request(img_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as res:
            with open(out_path, "wb") as f:
                f.write(res.read())
        size_kb = os.path.getsize(out_path) / 1024.0
        
        # Query capture date from metadata layer 8
        point_geom = json.dumps({'x': lon, 'y': lat, 'spatialReference': {'wkid': 4326}})
        meta_params = {
            'geometry': point_geom,
            'geometryType': 'esriGeometryPoint',
            'spatialRel': 'esriSpatialRelIntersects',
            'outFields': 'SRC_DATE,SRC_DESC',
            'f': 'json'
        }
        meta_url = f"{ESRI_METADATA_URL}?{urllib.parse.urlencode(meta_params)}"
        meta_req = urllib.request.Request(meta_url, headers=HEADERS)
        capture_date = "Unknown"
        with urllib.request.urlopen(meta_req, timeout=10) as meta_res:
            mdata = json.loads(meta_res.read().decode())
            feats = mdata.get('features', [])
            if feats:
                s_date = str(feats[0]['attributes'].get('SRC_DATE') or "")
                src_desc = feats[0]['attributes'].get('SRC_DESC') or ""
                if len(s_date) >= 8:
                    capture_date = f"{s_date[:4]}-{s_date[4:6]}-{s_date[6:8]}"
                else:
                    capture_date = s_date or src_desc
                    
        print(f"[OK] {addr} ({lead_id})")
        print(f"     -> File: {out_path} ({size_kb:.1f} KB)")
        print(f"     -> Aerial Capture Date: {capture_date}")
    except Exception as e:
        print(f"[ERROR] {addr}: {e}")
