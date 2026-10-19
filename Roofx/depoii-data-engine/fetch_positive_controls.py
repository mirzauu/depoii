import httpx
import json
from datetime import datetime

CFW_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"

test_streets = [
    "CAMP BOWIE",
    "CAMP BOWIE WEST",
    "ALTA MERE",
    "DECATUR",
    "28TH",
    "SYLVANIA",
    "HOUSTON",
    "820",
    "LOOP 820",
    "OLD BENBROOK",
    "BENBROOK",
    "SAPPINGTON",
    "4TH",
    "COMMERCE",
    "MEACHAM",
    "TERMINAL"
]

positive_controls = []

print("=" * 85)
print("FETCHING 15-20 COMMERCIAL ROOFING PERMITS ACROSS STREET PATTERNS")
print("=" * 85)

for st in test_streets:
    # Query for commercial permits mentioning roof/reroof
    where = f"Street_Name LIKE '%{st}%' AND (B1_WORK_DESC LIKE '%roof%' OR B1_WORK_DESC LIKE '%Roof%' OR B1_WORK_DESC LIKE '%ROOF%' OR Permit_SubType LIKE '%Roof%')"
    params = {
        "where": where,
        "outFields": "Permit_No,File_Date,Permit_Type,Permit_SubType,Addr_No,Direction,Street_Name,Street_Suffix,Full_Street_Address,B1_WORK_DESC,JobValue",
        "resultRecordCount": 5,
        "orderByFields": "File_Date DESC",
        "f": "json"
    }
    try:
        r = httpx.get(CFW_URL, params=params, timeout=15)
        data = r.json()
        feats = data.get("features", [])
        print(f"Street pattern '{st}': Found {len(feats)} commercial roofing permits")
        for f in feats:
            a = f["attributes"]
            f_date = datetime.fromtimestamp(a["File_Date"] / 1000).strftime("%Y-%m-%d") if a.get("File_Date") else "N/A"
            full_addr = a.get("Full_Street_Address")
            if not full_addr:
                st_parts = [str(a.get("Addr_No") or ""), str(a.get("Direction") or ""), str(a.get("Street_Name") or ""), str(a.get("Street_Suffix") or "")]
                full_addr = " ".join([p for p in st_parts if p]).strip()
            
            p_no = a.get("Permit_No")
            # Deduplicate by permit_no
            if not any(c["permit_no"] == p_no for c in positive_controls):
                positive_controls.append({
                    "permit_no": p_no,
                    "file_date": f_date,
                    "permit_type": a.get("Permit_Type"),
                    "permit_subtype": a.get("Permit_SubType"),
                    "address_on_permit": full_addr,
                    "street_pattern": st,
                    "work_description": a.get("B1_WORK_DESC"),
                    "job_value": a.get("JobValue")
                })
    except Exception as e:
        print(f"Error on {st}: {e}")

print(f"\nCollected {len(positive_controls)} distinct commercial roofing controls.")
for idx, c in enumerate(positive_controls[:25], 1):
    print(f"{idx}. [{c['file_date']}] #{c['permit_no']} at {c['address_on_permit']} (Pattern: {c['street_pattern']}) -> {str(c['work_description'])[:45]}")

with open("positive_commercial_roof_controls.json", "w", encoding="utf-8") as f:
    json.dump(positive_controls, f, indent=2)
