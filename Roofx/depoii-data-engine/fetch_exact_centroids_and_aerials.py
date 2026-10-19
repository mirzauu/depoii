import os
import json
import urllib.request
import urllib.parse

TAD_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
ESRI_IMAGERY_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
ESRI_METADATA_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/8/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0"}

output_dir = r"d:\Depoii_nextjs\Roofx\thumbnails"
os.makedirs(output_dir, exist_ok=True)

target_leads = [
    # CGJ
    {"name": "CGJ Lead 1", "addr": "6777 Camp Bowie Blvd", "acct": "00788821", "lead_id": "TAD-PARCEL-00788821"},
    {"name": "CGJ Lead 2", "addr": "6353 Camp Bowie Blvd", "acct": "06350739", "lead_id": "TAD-PARCEL-06350739"},
    # Ducker
    {"name": "Ducker Lead 1", "addr": "3209 Alta Mere Dr", "acct": "00028525", "lead_id": "TAD-PARCEL-00028525"},
    {"name": "Ducker Lead 2", "addr": "2020 E 4th St", "acct": "07901224", "lead_id": "TAD-PARCEL-07901224"},
    # MAZE
    {"name": "MAZE Lead 1", "addr": "201 NE 28th St", "acct": "00973742", "lead_id": "TAD-PARCEL-00973742"},
    {"name": "MAZE Lead 2", "addr": "2701 Decatur Ave", "acct": "00973688", "lead_id": "TAD-PARCEL-00973688"},
]

print("=" * 85)
print("FETCHING EXACT TAD CENTROIDS & DATED ESRI AERIAL IMAGES")
print("=" * 85)

for lead in target_leads:
    acct = lead["acct"]
    addr = lead["addr"]
    lead_id = lead["lead_id"]
    
    # 1. Query TAD for exact polygon geometry in WGS84
    tad_params = {
        "where": f"ACCOUNT = '{acct}'",
        "outFields": "ACCOUNT,SITUS_ADDR,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1,LAND_ACRES",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json"
    }
    tad_req = urllib.request.Request(f"{TAD_URL}?{urllib.parse.urlencode(tad_params)}", headers=HEADERS)
    with urllib.request.urlopen(tad_req, timeout=12) as res:
        tad_data = json.loads(res.read().decode())
        feat = tad_data['features'][0]
        attrs = feat['attributes']
        rings = feat['geometry']['rings']
        # Compute centroid
        all_pts = [pt for ring in rings for pt in ring]
        cen_lon = sum(p[0] for p in all_pts) / len(all_pts)
        cen_lat = sum(p[1] for p in all_pts) / len(all_pts)
        
    print(f"\n[{lead['name']}] {addr} (TAD #{acct})")
    print(f"  • Owner: {attrs.get('OWNER_NAME')}")
    print(f"  • Legal: {attrs.get('LEGAL_1')}")
    print(f"  • Living Area: {attrs.get('LIVING_ARE'):,} sq ft | Year Built: {attrs.get('YEAR_BUILT')} | Appraised: ${attrs.get('TOTAL_VALU'):,}")
    print(f"  • Exact TAD Centroid: Lat {cen_lat:.6f}, Lon {cen_lon:.6f}")
    
    # 2. Capture ESRI World Imagery
    delta = 0.0016
    minx, maxx = cen_lon - delta, cen_lon + delta
    miny, maxy = cen_lat - delta * 0.75, cen_lat + delta * 0.75
    out_path = os.path.join(output_dir, f"thumb_{lead_id}.png")
    
    img_url = f"{ESRI_IMAGERY_URL}?bbox={minx},{miny},{maxx},{maxy}&bboxSR=4326&size=600,450&f=image"
    img_req = urllib.request.Request(img_url, headers=HEADERS)
    with urllib.request.urlopen(img_req, timeout=15) as res:
        with open(out_path, "wb") as f:
            f.write(res.read())
            
    # 3. Query ESRI metadata for capture date
    point_geom = json.dumps({'x': cen_lon, 'y': cen_lat, 'spatialReference': {'wkid': 4326}})
    meta_params = {
        'geometry': point_geom,
        'geometryType': 'esriGeometryPoint',
        'spatialRel': 'esriSpatialRelIntersects',
        'outFields': 'SRC_DATE,SRC_DESC',
        'f': 'json'
    }
    meta_req = urllib.request.Request(f"{ESRI_METADATA_URL}?{urllib.parse.urlencode(meta_params)}", headers=HEADERS)
    capture_date = "Unknown"
    with urllib.request.urlopen(meta_req, timeout=10) as meta_res:
        mdata = json.loads(meta_res.read().decode())
        mfeats = mdata.get('features', [])
        if mfeats:
            s_date = str(mfeats[0]['attributes'].get('SRC_DATE') or "")
            if len(s_date) >= 8:
                capture_date = f"{s_date[:4]}-{s_date[4:6]}-{s_date[6:8]}"
            else:
                capture_date = s_date
    print(f"  • Aerial Image Saved: {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")
    print(f"  • ESRI Capture Date: {capture_date}")
