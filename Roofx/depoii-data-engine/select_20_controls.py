import json

with open("positive_commercial_roof_controls.json", "r", encoding="utf-8") as f:
    controls = json.load(f)

print(f"Total controls available: {len(controls)}")
selected = []
target_streets = ["CAMP BOWIE", "CAMP BOWIE WEST", "ALTA MERE", "DECATUR", "28TH", "SYLVANIA", "HOUSTON", "LOOP 820", "BENBROOK", "SAPPINGTON"]

for t in target_streets:
    matches = [c for c in controls if t in c["street_pattern"] or t in c["address_on_permit"].upper()]
    for m in matches[:2]:
        if m not in selected:
            selected.append(m)

print(f"Selected {len(selected)} diverse positive controls across target streets:")
for i, s in enumerate(selected, 1):
    print(f"{i:2d}. [{s['file_date']}] #{s['permit_no']} | Addr: {s['address_on_permit']} (Pattern: {s['street_pattern']}) | Scope: {str(s['work_description'])[:45]}")

with open("selected_20_positive_controls.json", "w", encoding="utf-8") as f:
    json.dump(selected, f, indent=2)
