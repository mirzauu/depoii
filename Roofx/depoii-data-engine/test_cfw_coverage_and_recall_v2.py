import urllib.request
import urllib.parse
import json
import sqlite3
from datetime import datetime

url = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query'

# 1. Latest filing date
p_latest = {
    'where': '1=1',
    'outFields': 'File_Date,Permit_No,Permit_Type,Permit_SubType,Full_Street_Address',
    'orderByFields': 'File_Date DESC',
    'resultRecordCount': 5,
    'f': 'json'
}
req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_latest)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
with urllib.request.urlopen(req, timeout=15) as res:
    data = json.loads(res.read().decode())
    feats = data.get('features', [])
    print("=== 1. LATEST FILINGS IN CFW OPEN DATA PERMITS ===")
    for f in feats:
        a = f['attributes']
        dt = datetime.fromtimestamp(a['File_Date']/1000).strftime('%Y-%m-%d') if a.get('File_Date') else 'None'
        print(f"  • Date: {dt} | Permit: {a.get('Permit_No')} | Type: {a.get('Permit_Type')} - {a.get('Permit_SubType')} | Addr: {a.get('Full_Street_Address')}")

# 2. Check roofing subtypes and counts in this layer
p_roof = {
    'where': "Permit_SubType LIKE '%Roof%' OR B1_WORK_DESC LIKE '%roof%'",
    'returnCountOnly': 'true',
    'f': 'json'
}
req_r = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_roof)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
with urllib.request.urlopen(req_r, timeout=15) as res:
    data = json.loads(res.read().decode())
    print(f"\n=== 2. ROOFING PERMITS IN CFW OPEN DATA ===")
    print(f"Total permits matching 'Roof' in CFW FeatureServer: {data.get('count')}")

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

print("\n=== 3. TESTING RECALL: 5 KNOWN COMMERCIAL ROOF PERMITS IN LIVE CFW PORTAL ===")
for p_num, addr, dt, desc in fw_permits:
    p_check = {
        'where': f"Permit_No = '{p_num}'",
        'outFields': 'Permit_No,File_Date,Permit_Type,Permit_SubType,Full_Street_Address',
        'f': 'json'
    }
    req_c = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_check)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
    try:
        with urllib.request.urlopen(req_c, timeout=15) as res:
            res_data = json.loads(res.read().decode())
            feats = res_data.get('features', [])
            found = len(feats) > 0
            live_addr = feats[0]['attributes'].get('Full_Street_Address') if found else 'N/A'
            print(f"  • #{p_num} ({dt}) at {addr[:25]}: Found in live CFW portal? -> {'YES (' + str(live_addr) + ')' if found else 'NO'}")
    except Exception as e:
        print(f"  • #{p_num}: Error {e}")

# 4. Check our 3 candidates with the REAL field name
print("\n=== 4. CHECKING OUR 3 CANDIDATE ADDRESSES WITH EXACT FIELD Full_Street_Address ===")
for q in ['%7912%CAMP BOWIE%', '%7408%CAMP BOWIE%', '%3209%ALTA MERE%']:
    p_cand = {
        'where': f"Full_Street_Address LIKE '{q}'",
        'outFields': 'Permit_No,File_Date,Permit_Type,Permit_SubType,Full_Street_Address',
        'f': 'json'
    }
    req_cand = urllib.request.Request(f"{url}?{urllib.parse.urlencode(p_cand)}", headers={'User-Agent': 'Mozilla/5.0 Depoii/1.0'})
    with urllib.request.urlopen(req_cand, timeout=15) as res:
        res_data = json.loads(res.read().decode())
        feats = res_data.get('features', [])
        print(f"  • Query '{q}': {len(feats)} permits found on live CFW portal")
        for f in feats:
            a = f['attributes']
            f_dt = datetime.fromtimestamp(a['File_Date']/1000).strftime('%Y-%m-%d') if a.get('File_Date') else 'None'
            print(f"     -> [{f_dt}] #{a.get('Permit_No')} ({a.get('Permit_Type')}) at {a.get('Full_Street_Address')}")
