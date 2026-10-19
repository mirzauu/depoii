import json
import sqlite3
import urllib.parse
import urllib.request

c = sqlite3.connect("depoii_local.db")
ids = [
    "DCAD-PARCEL-00000799950250000",
    "DCAD-PARCEL-14105100010080000",
    "DCAD-PARCEL-004643000A0010000",
    "TAD-PARCEL-07532598",
]
fields = (
    "roof_sqft_used",
    "stories",
    "spc_file",
    "spc_time_utc",
    "spc_size_in",
    "spc_comment",
    "hail_distance_mi",
    "permit_query",
)
for parcel_id in ids:
    print("---", parcel_id)
    q = "SELECT field_name, stored_value FROM lead_evidence WHERE parcel_id = ? AND field_name IN ({})".format(
        ",".join("?" for _ in fields)
    )
    for row in c.execute(q, (parcel_id, *fields)):
        print(row)

url = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/T_BU_Permits_FY2023_24/FeatureServer/0/query"
params = {
    "where": "1=1",
    "outFields": "ACTIVITY",
    "returnGeometry": "false",
    "resultRecordCount": "15",
    "f": "json",
}
req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "depoii-release-check"})
with urllib.request.urlopen(req, timeout=30) as resp:
    payload = json.loads(resp.read().decode())
print("sample_error", payload.get("error"))
seen = []
for feature in payload.get("features") or []:
    seen.append((feature.get("attributes") or {}).get("ACTIVITY"))
print("sample_activities", seen)
