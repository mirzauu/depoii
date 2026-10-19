import httpx
import json
from datetime import datetime

CFW_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"

# Test streets
streets = [
    "Camp Bowie",
    "Alta Mere",
    "Decatur",
    "28th",
    "Sylvania",
    "Houston",
    "820",
    "Benbrook",
    "4th",
    "Commerce",
    "Terminal",
    "Meacham"
]

all_roofing_permits = []

for st in streets:
    where = f"(Full_Street_Address LIKE '%{st}%') AND (Permit_SubType LIKE '%Roof%' OR B1_WORK_DESC LIKE '%roof%' OR B1_WORK_DESC LIKE '%Roof%' OR B1_WORK_DESC LIKE '%ROOF%')"
    params = {
        "where": where,
        "outFields": "Permit_No,File_Date,Permit_Type,Permit_SubType,Full_Street_Address,B1_WORK_DESC",
        "resultRecordCount": 15,
        "orderByFields": "File_Date DESC",
        "f": "json"
    }
    r = httpx.get(CFW_URL, params=params, timeout=20)
    data = r.json()
    feats = data.get("features", [])
    print(f"Street '{st}': Found {len(feats)} roofing permits in CFW portal")
    for f in feats:
        a = f["attributes"]
        f_date = datetime.fromtimestamp(a["File_Date"] / 1000).strftime("%Y-%m-%d") if a.get("File_Date") else "N/A"
        all_roofing_permits.append({
            "permit_no": a.get("Permit_No"),
            "date": f_date,
            "type": a.get("Permit_Type"),
            "subtype": a.get("Permit_SubType"),
            "address": a.get("Full_Street_Address"),
            "desc": a.get("B1_WORK_DESC"),
            "matched_street": st
        })

print(f"\nTotal collected: {len(all_roofing_permits)}")
with open("cfw_roofing_controls_raw.json", "w", encoding="utf-8") as f:
    json.dump(all_roofing_permits, f, indent=2)
