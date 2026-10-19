import sqlite3
import urllib.request
import urllib.parse
import json

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()
cur.execute("SELECT raw_permit_number, normalized_address, issue_date, raw_description FROM normalized_permits WHERE jurisdiction = 'Fort Worth, TX' AND category = 'Commercial Re-Roof' LIMIT 5")
rows = cur.fetchall()

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

print("=== TESTING RECALL: 5 KNOWN COMMERCIAL RE-ROOF PERMITS ===")
for p_num, addr, dt, desc in rows:
    p_check = {
        'where': f"Permit_No = '{p_num}'",
        'outFields': 'Permit_No,File_Date,Permit_Type,Permit_SubType,Full_Street_Address',
        'f': 'json'
    }
    req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_check)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            res_data = json.loads(res.read().decode())
            feats = res_data.get('features', [])
            if feats:
                a = feats[0]['attributes']
                print(f"  • #{p_num} ({dt}) at {addr}: FOUND! -> Permit_No={a.get('Permit_No')} | SubType={a.get('Permit_SubType')} | Addr={a.get('Full_Street_Address')}")
            else:
                print(f"  • #{p_num} ({dt}) at {addr}: NOT FOUND in live portal")
    except Exception as e:
        print(f"  • #{p_num}: Error {e}")
