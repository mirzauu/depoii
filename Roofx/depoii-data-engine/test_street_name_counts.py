import httpx

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

for st in ['CAMP BOWIE', 'ALTA MERE', 'DECATUR', '28TH', 'SYLVANIA', 'HOUSTON', '820', 'BENBROOK', '4TH', 'COMMERCE', 'MEACHAM']:
    r = httpx.get(url, params={'where': f"Street_Name LIKE '%{st}%'", 'returnCountOnly': 'true', 'f': 'json'})
    print(f"Street_Name '{st}': {r.json().get('count')} total permits")
