import json

with open(r"Roofx/depoii-data-engine/dallasnow_reroof_overrides_staged.json", "r", encoding="utf-8") as f:
    ov_data = json.load(f)

print("=== SAMPLE OF VERIFIED POST-2016 DALLASNOW REROOFS (DROPPED FROM CALL LIST) ===")
for r in ov_data["dropped_leads"][:8]:
    print(f"Address: {r['address']}")
    print(f"  Old Historical Date: {r['stored_date']} (Permit {r['stored_permit_no']})")
    print(f"  Newer Reroof Date:   {r['newer_date']} (Permit {r['newer_permit_no']})")
    print(f"  Source:              {r['source']}")
    print(f"  Description:         {r['description']}")
    print()

print("=== SAMPLE OF LOGGED NON-ROOF TRADE PERMITS (ROOF DATE UNCHANGED, KEPT ON CALL LIST) ===")
for r in ov_data["non_roof_hits_sample"][:5]:
    print(f"Address: {r['address']} (Baseline Reroof Date Kept: {r['stored_date']})")
    print(f"  Trade Permit: {r['permit_no']} on {r['date']}")
    print(f"  Description:  {r['description']}")
    print()

with open(r"Roofx/depoii-data-engine/dallas_aging_roof_call_list_staged.json", "r", encoding="utf-8") as f:
    call_data = json.load(f)

print("=== SAMPLE OF 5 FINAL 1-STORY WAREHOUSE CALL LEADS (FOUNDATION SUM SHOWN) ===")
single = [c for c in call_data["leads"] if c["roof_area_sqft"] is not None][:5]
for c in single:
    print(f"Address: {c['address']} (Zip: {c['zip_code']})")
    print(f"  Owner:          {c['owner_name']}")
    print(f"  Roof Age Date:  {c['last_reroof_date']} (Permit {c['last_reroof_permit_no']})")
    print(f"  Building SqFt:  {c['building_sqft']} | Stories: {c['stories']}")
    print(f"  Roof Area:      {c['roof_area_sqft']} sq ft (Basis: {c['roof_area_basis']})")
    print()

print("=== SAMPLE OF 5 FINAL MULTI-STORY OFFICE CALL LEADS (ROOF AREA BLANK) ===")
multi = [c for c in call_data["leads"] if "MULTI_STORY" in c["roof_area_basis"]][:5]
for c in multi:
    print(f"Address: {c['address']} (Zip: {c['zip_code']})")
    print(f"  Owner:          {c['owner_name']}")
    print(f"  Roof Age Date:  {c['last_reroof_date']} (Permit {c['last_reroof_permit_no']})")
    print(f"  Building SqFt:  {c['building_sqft']} | Stories: {c['stories']}")
    print(f"  Roof Area:      {c['roof_area_sqft']} (Basis: {c['roof_area_basis']})")
    print()
