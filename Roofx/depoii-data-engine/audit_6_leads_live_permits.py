import json
from app.science.verification_engine import MunicipalPermitAuditor

leads = [
    "6777 Camp Bowie Blvd",
    "6353 Camp Bowie Blvd",
    "3209 Alta Mere Dr",
    "2020 E 4th St",
    "201 NE 28th St",
    "2701 Decatur Ave"
]

print("=" * 85)
print("FINAL LIVE PERMIT AUDIT AS OF TODAY FOR ALL 6 PILOT LEADS")
print("=" * 85)

for addr in leads:
    res = MunicipalPermitAuditor.audit_fort_worth(addr, storm_date="2026-04-26")
    print(f"\nLead: {addr}")
    print(f"  • Audit Status      : {res.get('audit_status')}")
    print(f"  • Total Filings     : {res.get('total_found')}")
    print(f"  • Post-Storm Filings: {res.get('post_storm_count')}")
    print(f"  • Post-Storm Permits: {res.get('post_storm_permits')}")
    print(f"  • Check Date        : {res.get('portal_check_date')}")
