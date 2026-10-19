import sqlite3
import re

conn = sqlite3.connect('depoii_local.db')
cur = conn.cursor()

def classify_permit(desc, cat, val):
    desc_clean = (desc or "").upper()
    cat_clean = (cat or "").upper()

    # Pure Reroof signals
    if any(k in desc_clean for k in ["RE-ROOF", "REROOF", "ROOF REPLACEMENT", "TEAR OFF", "RECOVER", "OVERLAY", "SHINGLES", "TPO", "EPDM", "MOD BIT"]):
        return "COMMERCIAL_REROOF"
    if "RE-ROOF" in cat_clean or "REROOF" in cat_clean:
        return "COMMERCIAL_REROOF"

    # Roof Repair / Maintenance
    if any(k in desc_clean for k in ["ROOF REPAIR", "LEAK REPAIR", "ROOF COATING", "PATCH ROOF"]):
        return "ROOF_REPAIR"

    # New Construction / Shell / Whole Building
    if any(k in desc_clean for k in ["NEW CONSTRUCTION", "NEW:", "CORE AND SHELL", "GROUND UP", "CONSTRUCT A", "NEW BUILDING", "FOOTING", "FOUNDATION"]):
        return "NEW_CONSTRUCTION"

    # General Alteration / Tenant Finish
    if any(k in desc_clean for k in ["FINISH-OUT", "FINISHOUT", "TENANT IMPROVEMENT", "INTERIOR REMODEL", "ALTERATION", "REMODEL", "PLUMBING", "ELECTRICAL", "HVAC"]):
        return "INTERIOR_OR_GENERAL_ALTERATION"

    return "GENERAL_COMMERCIAL"

# Test classification on Fort Worth & Dallas
cur.execute("""
    SELECT id, raw_description, category, valuation, jurisdiction
    FROM normalized_permits
    WHERE state = 'TX'
""")
rows = cur.fetchall()

class_counts = {}
class_val = {}

for pid, desc, cat, val, jur in rows:
    p_class = classify_permit(desc, cat, val)
    class_counts[p_class] = class_counts.get(p_class, 0) + 1
    class_val[p_class] = class_val.get(p_class, 0.0) + (val or 0.0)

print("="*70)
print("TEXAS PERMIT CLASSIFICATION BREAKDOWN")
print("="*70)
for p_class, cnt in sorted(class_counts.items(), key=lambda x: x[1], reverse=True):
    val_m = round(class_val[p_class] / 1e6, 2)
    pct = round(cnt / len(rows) * 100, 1)
    print(f"  • {p_class:<32}: {cnt:>6,} ({pct:>4.1f}%) | ${val_m:>9,.2f}M")
