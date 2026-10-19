import urllib.request
import json

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0?f=json'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
with urllib.request.urlopen(req, timeout=15) as res:
    data = json.loads(res.read().decode())
    print("ALL Fields:", [(f['name'], f['type']) for f in data.get('fields', [])])
