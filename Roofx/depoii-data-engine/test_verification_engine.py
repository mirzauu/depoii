from app.science.verification_engine import VerificationEngine
import json

test_leads = [
    {
        "lead_id": "TAD-PARCEL-00029580",
        "address": "7912 Camp Bowie West Blvd",
        "city": "Fort Worth",
        "lat": 32.72398,
        "lon": -97.45206,
        "account_number": "00029580"
    },
    {
        "lead_id": "DCAD-PARCEL-00000799252000000",
        "address": "15702 El Estado Dr",
        "city": "Dallas",
        "lat": 32.9620,
        "lon": -96.7930,
        "account_number": "00000799252000000"
    },
    {
        "lead_id": "TAD-PARCEL-00028525",
        "address": "3209 Alta Mere Dr",
        "city": "Fort Worth",
        "lat": 32.72587,
        "lon": -97.44012,
        "account_number": "00028525"
    }
]

print("=== RUNNING AUTOMATED VERIFICATION ENGINE ON TEST LEADS ===")
for lead in test_leads:
    res = VerificationEngine.verify_lead(
        lead_id=lead["lead_id"],
        address=lead["address"],
        city=lead["city"],
        lat=lead["lat"],
        lon=lead["lon"],
        account_number=lead["account_number"]
    )
    print(f"\nLead: {lead['address']} ({lead['city']})")
    print(f"Status: {res['verification_status']} | Score: {res['verification_score']}/100")
    print(f"Disqualification: {res.get('disqualification_reason')}")
    print(f"CAD: Acct {res['cad'].get('account')} | Owner: {res['cad'].get('owner')} | Sqft: {res['cad'].get('living_sqft')}")
    print(f"Hail: {res['hail_proximity']['distance_miles']} mi from {res['hail_proximity']['report_location']}")
    print(f"Permits: {res['municipal_permits']['audit_status']}")
    print(f"Aerial: {res['aerial'].get('filename')} (Captured: {res['aerial'].get('capture_date')})")
