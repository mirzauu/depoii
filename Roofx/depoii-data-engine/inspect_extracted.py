import json

with open(r"Roofx/depoii-data-engine/dallas_aging_candidates_pre_dallasnow.json", encoding="utf-8") as f:
    data = json.load(f)

print("--- 5 Dropped Records with Verified Newer Reroof Permits ---")
for r in data["dropped_local_reroof_sample"]:
    print(f"Address: {r['address']}")
    print(f"  Old Baseline Reroof Date: {r['old_reroof_date']}")
    print(f"  Newer Reroof Date:        {r['newer_reroof_date']} (Permit {r['newer_permit_no']})")
    print(f"  Source:                   {r['source']}")
    print(f"  Description:              {r['description']}")
    print()

print("--- 5 Sample Records Dropped Due to Rebuilt / Newer Construction ---")
for r in data["dropped_rebuilt_sample"][:5]:
    print(f"Address: {r['address']}")
    print(f"  Reroof Date:  {r['last_reroof_date']} (Permit {r['permit_no']})")
    print(f"  Year Built:   {r['year_built']}")
    print(f"  Reason:       {r['reason']}")
    print()
