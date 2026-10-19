import urllib.request
import urllib.parse
import json
import sqlite3
from datetime import datetime

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

# 1. Latest filing date
p_latest = {
    'where': '1=1',
    'outFields': 'File_Date,Permit_Number,Permit_Type,Permit_Subtype,Site_Address',
    'orderByFields': 'File_Date DESC',
    'resultRecordCount': 5,
    'f': 'json'
}
req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_latest)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
with urllib.request.urlopen(req, timeout=15) as res:
    data = json.loads(res.read().decode())
    feats = data.get('features', [])
    print("=== LATEST FILINGS IN CFW OPEN DATA PERMITS ===")
    for f in feats:
        a = f['attributes']
        dt = datetime.fromtimestamp(a['File_Date']/1000).strftime('%Y-%m-%d') if a.get('File_Date') else 'None'
        print(f"  • Date: {dt} | Permit: {a.get('Permit_Number')} | Type: {a.get('Permit_Type')} - {a.get('Permit_Subtype')} | Addr: {a.get('Site_Address')}")

# 2. Check roofing subtypes and counts in this layer
p_roof = {
    'where': "Permit_Subtype LIKE '%Roof%' OR Work_Description LIKE '%roof%'",
    'returnCountOnly': 'true',
    'f': 'json'
}
req_r = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_roof)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
with urllib.request.urlopen(req_r, timeout=15) as res:
    data = json.loads(res.read().decode())
    print(f"\nTotal permits matching 'Roof' in CFW FeatureServer: {data.get('count')}")

# 3. Test recall against 5 Fort Worth commercial roof permits from our normalized_permits table
conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()
cur.execute("""
    SELECT raw_permit_number, normalized_address, issue_date, raw_description
    FROM normalized_permits
    WHERE jurisdiction LIKE '%Fort Worth%' AND category = 'COMMERCIAL_REROOF'
    ORDER BY issue_date DESC
    LIMIT 5
""")
fw_permits = cur.fetchall()

print("\n=== TESTING RECALL: CHECKING 5 KNOWN ROOF PERMITS IN LIVE CFW PORTAL ===")
for p_num, addr, dt, desc in fw_permits:
    # Query live CFW by permit number
    p_check = {
        'where': f"Permit_Number = '{p_num}'",
        'outFields': 'Permit_Number,File_Date,Permit_Type,Permit_Subtype,Site_Address',
        'f': 'json'
    }
    req_c = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_check)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
    try:
        with urllib.request.urlopen(req_c, timeout=15) as res:
            res_data = json.loads(res.read().decode())
            found = len(res_data.get('features', [])) > 0
            print(f"  • #{p_num} ({dt}) at {addr[:30]}: Found in live CFW portal? -> {'YES (EXACT MATCH)' if found else 'NO'}")
    except Exception as e:
        print(f"  • #{p_num}: Error {e}")
