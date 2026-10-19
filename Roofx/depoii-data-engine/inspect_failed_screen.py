import json

data = json.load(open('audit_15_screening_results.json'))
for d in data:
    if "FAIL" in d["status"]:
        print(f"FAILED: {d['address']}, {d['city']} ({d['sqft']:,} sqft)")
        print(f"  Owner: {d['owner_name']}")
        print(f"  Reason: {d['reason']}\n")
