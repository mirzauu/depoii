import csv
import json
import re

with open(r"Roofx/depoii-data-engine/dallas_aging_candidates_pre_dallasnow.json", "r", encoding="utf-8") as f:
    cand_data = json.load(f)

candidates = cand_data["candidates"]

def clean_addr(a):
    if not a: return ""
    a = a.upper()
    if "," in a:
        a = a.split(",")[0]
    a = re.sub(r"\b(DALLAS|TX|TEXAS|\d{5})\b", "", a)
    a = re.sub(r"[^\w\s]", " ", a)
    parts = a.split()
    if not parts: return ""
    num = parts[0] if parts[0].isdigit() else ""
    rem = parts[1:] if num else parts
    direction = ""
    if rem and rem[0] in ["N", "S", "E", "W", "NORTH", "SOUTH", "EAST", "WEST"]:
        direction = rem[0][0]
        rem = rem[1:]
    SUFFIXES = {"ST", "STREET", "RD", "ROAD", "DR", "DRIVE", "AVE", "AVENUE", "BLVD", "BOULEVARD", 
                "LN", "LANE", "WAY", "PKWY", "PARKWAY", "HWY", "HIGHWAY", "CT", "COURT", "CIR", "CIRCLE",
                "TRL", "TRAIL", "PL", "PLACE", "EXPY", "EXPRESSWAY", "FWY", "FREEWAY", "TER", "TERRACE", "ROW"}
    while rem and rem[-1] in SUFFIXES:
        rem = rem[:-1]
    name = " ".join(rem)
    return f"{num}|{direction}|{name}"

cand_map = {}
for c in candidates:
    k = clean_addr(c["address"])
    if k:
        cand_map[k] = c

print(f"Indexed {len(cand_map)} candidate street keys")

csvs = [
    (r"Roofx/depoii-data-engine/test_win0.csv", "DallasNow Dedicated Roofing"),
    (r"Roofx/depoii-data-engine/test_alt_exported.csv", "DallasNow Alterations/Additions")
]

matched = []
for path, src in csvs:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            k = clean_addr(r.get("Address", ""))
            if k in cand_map:
                matched.append({
                    "candidate": cand_map[k],
                    "permit": r,
                    "source": src
                })

print(f"Total matches found in DallasNow CSVs: {len(matched)}")
for m in matched[:10]:
    cand = m["candidate"]
    p = m["permit"]
    desc = p.get("Description", "")[:90]
    print(f"Match: {cand['address']} (stored reroof: {cand['last_reroof_date']})")
    print(f"   Permit {p.get('Record Number')} on {p.get('Date')}: {p.get('Record Type')}")
    print(f"   Desc: {desc}")
    print()
