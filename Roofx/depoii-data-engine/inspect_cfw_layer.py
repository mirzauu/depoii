import httpx
import json

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0'
r = httpx.get(f"{url}?f=json")
meta = r.json()
print("Layer Name:", meta.get("name"))
print("Fields:")
for f in meta.get("fields", []):
    print(f"  {f['name']} ({f['type']})")

# Sample 5 features
r_sample = httpx.get(f"{url}/query", params={'where': '1=1', 'outFields': '*', 'resultRecordCount': 3, 'f': 'json'})
print("\nSample feature attributes:")
for feat in r_sample.json().get("features", []):
    print(json.dumps(feat['attributes'], indent=2))
