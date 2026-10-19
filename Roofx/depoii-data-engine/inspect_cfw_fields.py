import urllib.request
import urllib.parse
import json

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

# Let's inspect layer fields
req = urllib.request.Request(f"{url.replace('/query', '')}?f=json", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
with urllib.request.urlopen(req, timeout=15) as res:
    data = json.loads(res.read().decode())
    print("Layer Name:", data.get('name'))
    print("Fields:", [f['name'] for f in data.get('fields', [])][:15])
