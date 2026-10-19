import httpx
import json

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

# Query sample permits on CAMP BOWIE
params = {
    'where': "Street_Name LIKE '%CAMP BOWIE%'",
    'outFields': 'Permit_No,File_Date,Permit_Type,Permit_SubType,Addr_No,Street_Name,Street_Suffix,B1_WORK_DESC',
    'resultRecordCount': 20,
    'orderByFields': 'File_Date DESC',
    'f': 'json'
}
r = httpx.get(url, params=params)
data = r.json()
print("Sample permits on Camp Bowie:")
for f in data.get('features', []):
    a = f['attributes']
    print(f"  #{a.get('Permit_No')} | Type: {a.get('Permit_Type')} | Sub: {a.get('Permit_SubType')} | Addr: {a.get('Addr_No')} {a.get('Street_Name')} {a.get('Street_Suffix')} | Desc: {str(a.get('B1_WORK_DESC'))[:40]}")
