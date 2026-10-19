import json
import urllib.request
import urllib.parse
import re

CFW_PERMITS_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0"}

with open("selected_20_positive_controls.json", "r", encoding="utf-8") as f:
    controls = json.load(f)

def parse_street_tokens(raw: str):
    cleaned = raw.split(',')[0].strip().upper()
    cleaned = re.sub(r'#.*$', '', cleaned).strip()
    cleaned = re.sub(r'\b(SUITE|STE|APT|UNIT|BLDG|BUILDING)\b.*$', '', cleaned).strip()
    m = re.match(r'^(\d+)\s+(.+)$', cleaned)
    if not m:
        tokens = [t for t in re.findall(r'[A-Z0-9]+', cleaned) if t]
        return "", tokens
    num = m.group(1)
    tokens = [t for t in re.findall(r'[A-Z0-9]+', m.group(2)) if t]
    directions = {'N', 'S', 'E', 'W', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'NE', 'NW', 'SE', 'SW'}
    suffixes = {'ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'BLVD', 'BOULEVARD', 'DR', 'DRIVE', 'HWY', 'HIGHWAY', 'PKWY', 'PARKWAY', 'FWY', 'FREEWAY', 'TRL', 'TRAIL', 'LN', 'LANE', 'PL', 'PLACE', 'CT', 'COURT', 'WAY', 'EXPY', 'EXPRESSWAY', 'CIR', 'CIRCLE'}
    core = []
    for i, t in enumerate(tokens):
        if t in directions and (i == 0 or i == len(tokens) - 1):
            continue
        if t in suffixes and i == len(tokens) - 1:
            continue
        core.append(t)
    if not core and tokens:
        core = [tokens[0]]
    return num, core

print("=" * 85)
print("TESTING RECALL ON 18 KNOWN COMMERCIAL ROOFING PERMITS")
print("=" * 85)

success_count = 0
results = []

for idx, c in enumerate(controls, 1):
    addr = c["address_on_permit"]
    target_permit = c["permit_no"]
    num, core = parse_street_tokens(addr)
    
    # Resilient query handling both Addr_No + Street_Name AND Full_Street_Address
    if num and core:
        query_where = f"(Addr_No = {num} AND Street_Name LIKE '%{core[0]}%') OR Full_Street_Address LIKE '%{num}%{core[0]}%'"
    elif num:
        query_where = f"Addr_No = {num} OR Full_Street_Address LIKE '%{num}%'"
    else:
        query_where = f"Full_Street_Address LIKE '%{addr}%'"
        
    params = {
        "where": query_where,
        "outFields": "Permit_No,File_Date,Permit_Type,Permit_SubType,Addr_No,Street_Name,Full_Street_Address,B1_WORK_DESC",
        "f": "json"
    }
    url = f"{CFW_PERMITS_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode())
            feats = data.get("features", [])
            returned_permits = [f["attributes"]["Permit_No"] for f in feats if f.get("attributes")]
            matched = target_permit in returned_permits
            if matched:
                success_count += 1
                status_str = "MATCHED [PASS]"
            else:
                status_str = f"MISSED (Returned {len(feats)} permits: {returned_permits[:3]})"
            print(f"{idx:2d}. Target #{target_permit} at {addr} (Pattern: {c['street_pattern']}) -> {status_str}")
            results.append({"target": target_permit, "address": addr, "pattern": c["street_pattern"], "matched": matched, "returned_count": len(feats)})
    except Exception as e:
        print(f"{idx:2d}. Error querying {addr}: {e}")

print("\n" + "=" * 85)
print(f"POSITIVE CONTROLS AUDIT RESULT: {success_count}/{len(controls)} FOUND ({success_count/len(controls)*100:.1f}%)")
print("=" * 85)

with open("positive_controls_audit_results.json", "w", encoding="utf-8") as f:
    json.dump({"total": len(controls), "matched": success_count, "results": results}, f, indent=2)
