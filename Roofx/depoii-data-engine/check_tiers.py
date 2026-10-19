import json

data = json.load(open('dfw_top_50_audited_leads.json'))
print("--- TIER 2 SAMPLES (100K - 250K sq ft) ---")
for d in data[20:25]:
    print(f"#{d['rank']} | {d['address']} | {d['city']} | {d['building_sqft']:,} sqft | {d['owner_entity'][:25]} | {d['estimated_reroof_scope_range']}")

print("\n--- TIER 3 SAMPLES (250K+ sq ft) ---")
for d in data[40:45]:
    print(f"#{d['rank']} | {d['address']} | {d['city']} | {d['building_sqft']:,} sqft | {d['owner_entity'][:25]} | {d['estimated_reroof_scope_range']}")
