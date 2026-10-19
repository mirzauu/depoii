import urllib.request
import urllib.parse
import json
from datetime import datetime

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

queries = [
    '%4300%BENBROOK%',
    '%2720%CULLEN%',
    '%7408%CAMP BOWIE%',
    '%6777%CAMP BOWIE%',
    '%3209%ALTA MERE%',
    '%633%MONY%',
    '%3209%GALVEZ%'
]

print("=== LIVE CITY OF FORT WORTH PERMIT PORTAL QUERY ===")
for q in queries:
    p = {
        'where': f"Site_Address LIKE '{q}'",
        'outFields': '*',
        'f': 'json'
    }
    req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode())
            feats = data.get('features', [])
            print(f"\nResults for '{q}': {len(feats)} permits found on live CFW portal")
            for f in feats:
                a = f['attributes']
                file_dt = None
                if a.get('File_Date'):
                    file_dt = datetime.fromtimestamp(a['File_Date']/1000).strftime('%Y-%m-%d')
                p_num = a.get('Permit_Number')
                p_type = a.get('Permit_Type')
                p_sub = a.get('Permit_Subtype')
                status = a.get('Permit_Status')
                addr = a.get('Site_Address')
                desc = (a.get('Work_Description') or '')[:80]
                print(f"  • [{file_dt}] Permit #{p_num} ({p_type} - {p_sub}): Status={status} | Addr={addr} | Desc={desc}")
    except Exception as e:
        print(f"Error querying {q}: {e}")
