import json

data = json.load(open('dfw_top_50_audited_leads.json'))
print(f"{'#':<3} | {'Address':<32} | {'City':<14} | {'Sq Ft':<9} | {'Owner':<32} | {'Reroof Range'}")
print("-" * 115)
for d in data[:20]:
    print(f"{d['rank']:<3} | {d['address']:<32} | {d['city']:<14} | {d['building_sqft']:>7,} | {d['owner_entity'][:30]:<32} | {d['estimated_reroof_scope_range']}")
