import urllib.request
import urllib.parse
import json
from app.science.verification_engine import MunicipalPermitAuditor

candidates = [
    ("3201 Marquita Dr", "00028126"),
    ("7408 Camp Bowie West Blvd", "00029009"),
    ("3225 Alta Mere Dr", "00028533")
]

TAD_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0"}

for addr, acct in candidates:
    print("=" * 80)
    print(f"CHECKING CANDIDATE: {addr} (TAD #{acct})")
    print("=" * 80)
    # 1. TAD
    params = {"where": f"ACCOUNT = '{acct}'", "outFields": "*", "outSR": "4326", "returnGeometry": "true", "f": "json"}
    req = urllib.request.Request(f"{TAD_URL}?{urllib.parse.urlencode(params)}", headers=HEADERS)
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
        feat = data['features'][0]
        a = feat['attributes']
        ring = feat['geometry']['rings'][0]
        cen_lat = sum(p[1] for p in ring)/len(ring)
        cen_lon = sum(p[0] for p in ring)/len(ring)
        print(f"  • Legal: {a.get('LEGAL_1')}")
        print(f"  • Owner: {a.get('OWNER_NAME')}")
        print(f"  • Living Area: {a.get('LIVING_ARE')} sq ft | Year Built: {a.get('YEAR_BUILT')}")
        print(f"  • Total Value: ${a.get('TOTAL_VALU'):,}")
        print(f"  • Centroid: Lat {cen_lat:.6f}, Lon {cen_lon:.6f}")
        
    # 2. Live permit check
    res_perm = MunicipalPermitAuditor.audit_fort_worth(addr, storm_date="2026-04-26")
    print(f"  • Live Permit Status: {res_perm.get('audit_status')}")
    print(f"  • Total Filings: {res_perm.get('total_found')} | Post-storm: {res_perm.get('post_storm_count')}")
