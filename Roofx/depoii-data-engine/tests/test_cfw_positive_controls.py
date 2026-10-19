"""
Test Suite: Live Municipal Positive Controls Across Complex Street Patterns
Verifies that 18 known commercial roofing permits across Camp Bowie, Alta Mere,
Decatur, 28th St, Sylvania, Houston St, Loop 820, Old Benbrook, and Sappington
are 100% matched by Depoii's municipal permit search logic.
"""

import json
import re
import urllib.request
import urllib.parse
from pathlib import Path
import pytest

CFW_PERMITS_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0"}

CONTROLS_FILE = Path(__file__).resolve().parents[1] / "selected_20_positive_controls.json"


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


def test_positive_controls_18_permits():
    assert CONTROLS_FILE.exists(), f"Controls file not found at {CONTROLS_FILE}"
    with open(CONTROLS_FILE, "r", encoding="utf-8") as f:
        controls = json.load(f)

    assert len(controls) >= 15, "Expected at least 15 positive controls"

    matched_count = 0
    for c in controls:
        addr = c["address_on_permit"]
        target_permit = c["permit_no"]
        num, core = parse_street_tokens(addr)

        if num and core:
            query_where = f"(Addr_No = {num} AND Street_Name LIKE '%{core[0]}%') OR Full_Street_Address LIKE '%{num}%{core[0]}%'"
        elif num:
            query_where = f"Addr_No = {num} OR Full_Street_Address LIKE '%{num}%'"
        else:
            query_where = f"Full_Street_Address LIKE '%{addr}%'"

        params = {
            "where": query_where,
            "outFields": "Permit_No,File_Date,Permit_Type,Permit_SubType,Addr_No,Street_Name,Full_Street_Address",
            "f": "json"
        }
        url = f"{CFW_PERMITS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as res:
                data = json.loads(res.read().decode())
                feats = data.get("features", [])
                returned_permits = [f["attributes"]["Permit_No"] for f in feats if f.get("attributes")]
                if target_permit in returned_permits:
                    matched_count += 1
        except Exception:
            pass

    assert matched_count == len(controls), f"Expected all {len(controls)} controls to match, but only {matched_count} matched."
