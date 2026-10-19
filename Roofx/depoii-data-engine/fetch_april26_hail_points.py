import urllib.request
import urllib.parse
import json

IEM_URL = "https://mesonet.agron.iastate.edu/geojson/lsr.geojson"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0", "Accept": "application/json"}

# Fetch all hail reports in Texas for April 26, 2026 and April 26, 2024
for yr in [2026, 2024]:
    params = {
        "sts": f"{yr}-04-26T00:00:00Z",
        "ets": f"{yr}-04-26T23:59:59Z",
        "states": "TX",
        "types": "H"
    }
    url = f"{IEM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.loads(res.read().decode())
            features = data.get("features", [])
            print(f"\n=======================================================")
            print(f"ALL TEXAS HAIL REPORTS ON APRIL 26, {yr} ({len(features)} total)")
            print(f"=======================================================")
            for f in features:
                p = f.get("properties", {})
                g = f.get("geometry", {})
                coords = g.get("coordinates", [0, 0])
                county = p.get("county", "")
                city = p.get("city", "")
                mag = p.get("magf") or 0.0
                remark = p.get("remark", "")
                # Filter to DFW area counties: Tarrant, Dallas, Parker, Denton, Collin, Johnson, Ellis
                if county in ["Tarrant", "Dallas", "Parker", "Denton", "Collin", "Johnson", "Ellis", "Wise"]:
                    print(f"  • [{p.get('valid')}] {city}, {county} Co. | Hail: {mag}\" | ({coords[1]:.4f}, {coords[0]:.4f}) | {remark[:60]}")
    except Exception as e:
        print(f"Error {yr}: {e}")
