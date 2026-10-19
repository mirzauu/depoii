import httpx
import json
from datetime import datetime

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

# 1. Earliest permit
params_earliest = {
    'where': 'File_Date > 0',
    'outFields': 'Permit_No,File_Date,Permit_Type,Full_Street_Address',
    'orderByFields': 'File_Date ASC',
    'resultRecordCount': 3,
    'f': 'json'
}
r1 = httpx.get(url, params=params_earliest, timeout=15)
earliest = r1.json().get('features', [])
print("=" * 80)
print("EARLIEST PERMITS IN LIVE FORT WORTH PERMIT SYSTEM:")
print("=" * 80)
for e in earliest:
    a = e['attributes']
    f_date = datetime.fromtimestamp(a['File_Date'] / 1000).strftime('%Y-%m-%d') if a.get('File_Date') else 'N/A'
    print(f"  • Date: {f_date} | #{a.get('Permit_No')} | Type: {a.get('Permit_Type')} | Addr: {a.get('Full_Street_Address')}")

# 2. Total count
r_tot = httpx.get(url, params={'where': '1=1', 'returnCountOnly': 'true', 'f': 'json'}, timeout=15)
print(f"\nTotal permits in service: {r_tot.json().get('count'):,}")

# 3. Yearly counts
print("\nYearly permit counts:")
for yr in range(2001, 2027):
    start = f"{yr}-01-01"
    end = f"{yr+1}-01-01" if yr < 2026 else "2027-01-01"
    w = f"File_Date >= date '{start}' AND File_Date < date '{end}'"
    r_yr = httpx.get(url, params={'where': w, 'returnCountOnly': 'true', 'f': 'json'}, timeout=15)
    cnt = r_yr.json().get('count', 0)
    print(f"  {yr}: {cnt:,} permits")
