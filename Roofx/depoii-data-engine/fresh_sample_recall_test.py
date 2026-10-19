import httpx
import json
import random
import re
import math
from datetime import datetime

CFW_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"

# 1. Fetch a fresh sample of commercial permits with roofing descriptions across ANY street in Fort Worth
params = {
    "where": "(B1_WORK_DESC LIKE '%reroof%' OR B1_WORK_DESC LIKE '%tear off%' OR B1_WORK_DESC LIKE '%roof replacement%') AND Addr_No IS NOT NULL AND Street_Name IS NOT NULL",
    "outFields": "Permit_No,File_Date,Addr_No,Direction,Street_Name,Street_Suffix,Full_Street_Address,B1_WORK_DESC",
    "resultRecordCount": 100,
    "orderByFields": "File_Date DESC",
    "f": "json"
}

r = httpx.get(CFW_URL, params=params, timeout=20)
feats = r.json().get("features", [])
print(f"Pool of available commercial roofing permits: {len(feats)}")

# Pick 30 random permits as a fresh independent sample
random.seed(42)
sample = random.sample(feats, min(30, len(feats)))

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
print(f"RUNNING INDEPENDENT RECALL BENCHMARK ON {len(sample)} RANDOM COMMERCIAL ROOFING PERMITS")
print("=" * 85)

matched_count = 0
for i, f in enumerate(sample, 1):
    a = f["attributes"]
    target_permit = a["Permit_No"]
    full_addr = a.get("Full_Street_Address")
    if not full_addr:
        parts = [str(a.get("Addr_No") or ""), str(a.get("Direction") or ""), str(a.get("Street_Name") or ""), str(a.get("Street_Suffix") or "")]
        full_addr = " ".join([p for p in parts if p]).strip()
        
    num, core = parse_street_tokens(full_addr)
    if num and core:
        query_where = f"(Addr_No = {num} AND Street_Name LIKE '%{core[0]}%') OR Full_Street_Address LIKE '%{num}%{core[0]}%'"
    elif num:
        query_where = f"Addr_No = {num} OR Full_Street_Address LIKE '%{num}%'"
    else:
        query_where = f"Full_Street_Address LIKE '%{full_addr}%'"
        
    p_check = {
        "where": query_where,
        "outFields": "Permit_No",
        "f": "json"
    }
    r_check = httpx.get(CFW_URL, params=p_check, timeout=12)
    ret_permits = [rf["attributes"]["Permit_No"] for rf in r_check.json().get("features", []) if rf.get("attributes")]
    matched = target_permit in ret_permits
    if matched:
        matched_count += 1
        status = "[PASS]"
    else:
        status = "[FAIL]"
    print(f"{i:2d}. #{target_permit} at {full_addr[:35]} -> {status}")

p = matched_count / len(sample)
n = len(sample)
# Wilson score interval at 95% confidence (z = 1.96)
z = 1.96
denom = 1 + (z**2) / n
center = (p + (z**2) / (2 * n)) / denom
margin = (z * math.sqrt((p * (1 - p) / n) + ((z**2) / (4 * n**2)))) / denom
ci_low = max(0.0, center - margin)
ci_high = min(1.0, center + margin)

print("=" * 85)
print(f"INDEPENDENT RANDOM RECALL: {matched_count}/{n} ({p*100:.1f}%)")
print(f"95% Confidence Interval (Wilson Score): [{ci_low*100:.1f}%, {ci_high*100:.1f}%]")
print("=" * 85)
