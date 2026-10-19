import urllib.request
import urllib.parse
import json

IEM_URL = "https://mesonet.agron.iastate.edu/geojson/lsr.geojson"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0", "Accept": "application/json"}

# Query IEM for April 26 reports in WFO FWD
for yr in [2026, 2024]:
    print(f"\n=======================================================")
    print(f"IEM LSR REPORTS FOR APRIL 26, {yr} (WFO FWD - DALLAS/FORT WORTH)")
    print(f"=======================================================")
    params = {
        "sts": f"{yr}-04-26T00:00:00Z",
        "ets": f"{yr}-04-26T23:59:59Z",
        "wfos": "FWD",
        "types": "H" # Hail only
    }
    url = f"{IEM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            features = data.get("features", [])
            print(f"Found {len(features)} hail reports on April 26, {yr}:")
            for f in features[:15]:
                p = f.get("properties", {})
                g = f.get("geometry", {})
                coords = g.get("coordinates", [0, 0])
                print(f"  • {p.get('valid')}: {p.get('city')}, {p.get('county')} Co. | Hail: {p.get('magf')}\" | Lat/Lon: {coords[1]:.4f}, {coords[0]:.4f} | Remark: {p.get('remark')}")
    except Exception as e:
        print(f"Error querying {yr}: {e}")
