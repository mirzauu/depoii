import urllib.request
import urllib.parse
import json
from datetime import datetime

point = {'x': -97.452, 'y': 32.724, 'spatialReference': {'wkid': 4326}}
for layer in [4, 7, 8, 9, 10]:
    p = {
        'geometry': json.dumps(point),
        'geometryType': 'esriGeometryPoint',
        'spatialRel': 'esriSpatialRelIntersects',
        'outFields': '*',
        'f': 'json'
    }
    url = f"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/{layer}/query?" + urllib.parse.urlencode(p)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read().decode())
            feats = res.get('features', [])
            if feats:
                a = feats[0]['attributes']
                print(f"Layer {layer} hit:")
                for k, v in a.items():
                    if 'date' in k.lower() or 'src' in k.lower() or 'sens' in k.lower():
                        if isinstance(v, (int, float)) and v > 100000000000:
                            print(f"  {k}: {v} -> {datetime.fromtimestamp(v/1000).strftime('%Y-%m-%d')}")
                        else:
                            print(f"  {k}: {v}")
    except Exception as e:
        print(f"Layer {layer}: {e}")
