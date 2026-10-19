import os
import sys
import json
import sqlite3
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_PATH = os.path.join(os.path.dirname(__file__), "depoii_local.db")

VERIFIED_CONTRACTORS = {
    "CTR-FTW-EMPIREROOFINGIN": {
        "canonical_name": "Empire Roofing, Inc",
        "rcat_profile_url": "https://web.rcat.net/rcat/Contractor-(Contratista)/Empire-Roofing,-Inc-501",
        "rcat_license_number": "Commercial & Residential License #03-0035 / Commercial #02-0656",
        "rcat_license_type": "Commercial & Residential Roofing License",
        "rcat_member_since": 2017,
        "bbb_profile_url": "https://www.bbb.org/us/tx/everman/profile/roofing-contractors/empire-roofing-inc-0825-150751542",
        "bbb_rating": "A+",
        "bbb_accredited": 1,
        "website_url": "https://www.empireroofing.com",
        "phone_number": "(817) 572-2250",
        "hq_address": "4801 Esco Dr, Fort Worth, TX 76140",
        "linkedin_company_url": "https://www.linkedin.com/company/empire-roofing-inc-",
    },
    "CTR-FTW-SUPREMEROOFING": {
        "canonical_name": "Supreme Roofing",
        "rcat_profile_url": "https://web.rcat.net/rcat/Contractor-(Contratista)/Supreme-Roofing-887",
        "rcat_license_number": "Commercial Roofing License #02-0215",
        "rcat_license_type": "Commercial Roofing License",
        "rcat_member_since": 2017,
        "bbb_profile_url": "https://www.bbb.org/us/tx/dallas/profile/commercial-roofing/supreme-roofing-0875-19000069",
        "bbb_rating": "B",
        "bbb_accredited": 1,
        "website_url": "http://www.supremeroofing.com",
        "phone_number": "(214) 330-8913",
        "hq_address": "1355 N Walton Walker Blvd, Dallas, TX 75211",
        "linkedin_company_url": "https://www.linkedin.com/company/supreme-roofing",
    },
    "CTR-FTW-ZENITHROOFINGWA": {
        "canonical_name": "Zenith Roofing & Waterproofing",
        "rcat_profile_url": "https://web.rcat.net/rcat/Contractor-(Contratista)/Zenith-Roofing-and-Waterproofing,-LLC-982",
        "rcat_license_number": "Commercial Roofing License #02-0651",
        "rcat_license_type": "Commercial Roofing License",
        "rcat_member_since": 2016,
        "bbb_profile_url": "https://www.bbb.org/us/tx/fort-worth/profile/roofing-contractors/zenith-roofing-services-llc-0825-135550232",
        "bbb_rating": "B",
        "bbb_accredited": 1,
        "website_url": "http://www.zenithroofing.com",
        "phone_number": "(817) 529-0600",
        "hq_address": "3200 W Bolt St, Fort Worth, TX 76110",
        "linkedin_company_url": "https://www.linkedin.com/company/zenith-roofing-services-llc",
    },
    "CTR-FTW-TARRANTROOFING": {
        "canonical_name": "Tarrant Roofing",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/fort-worth/profile/roofing-contractors/tarrant-roofing-0825-95050277",
        "bbb_rating": "A+",
        "bbb_accredited": 1,
        "website_url": "https://tarrantroofing.com",
        "phone_number": "(817) 571-7809",
        "hq_address": "1900 Handley Ederville Rd, Fort Worth, TX 76118",
        "linkedin_company_url": "https://www.linkedin.com/company/tarrant-roofing",
    },
    "CTR-FTW-PRIORITYROOFING": {
        "canonical_name": "Priority Roofing Office",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/fort-worth/profile/flat-roofing-contractors/priority-roofing-of-fort-worth-0825-1000215727",
        "bbb_rating": "A+",
        "bbb_accredited": 1,
        "website_url": "https://priorityroofs.com",
        "phone_number": "(469) 615-8193",
        "hq_address": "9433 N Beach St, Fort Worth, TX 76244",
        "linkedin_company_url": "https://www.linkedin.com/company/priorityroofs",
    },
    "CTR-DAL-TEXAS-ROOF-MANAGEMENT": {
        "canonical_name": "Texas Roof Management",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/richardson/profile/roofing-contractors/texas-roof-management-inc-0875-20008218",
        "bbb_rating": "A+",
        "bbb_accredited": 1,
        "website_url": "https://www.texasroof.com",
        "phone_number": "(972) 272-7663",
        "hq_address": "728 Lingco Dr, Richardson, TX 75081",
        "linkedin_company_url": "https://www.linkedin.com/company/texas-roof-management-inc",
    },
    "CTR-DAL-ELITE-ROOFING-CONSULTING": {
        "canonical_name": "Elite Roofing & Consulting",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/midlothian/profile/roofing-contractors/elite-roofing-consulting-0875-90408715",
        "bbb_rating": "A+",
        "bbb_accredited": 1,
        "website_url": "https://www.elitedfw.com",
        "phone_number": "(469) 337-3995",
        "hq_address": "330 N 8th St, Midlothian, TX 76065",
        "linkedin_company_url": "https://www.linkedin.com/company/elite-roofing-and-consulting",
    },
    "CTR-FTW-DKHANEYROOFING": {
        "canonical_name": "Dk Haney Roofing",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/fort-worth/profile/roofing-contractors/dk-haney-roofing-inc-0825-99120567",
        "bbb_rating": "A+",
        "bbb_accredited": 0,
        "website_url": "https://www.dkhaneyroofing.com",
        "phone_number": "(817) 546-2266",
        "hq_address": "1420 Markum Ranch Rd, Fort Worth, TX 76126",
        "linkedin_company_url": "https://www.linkedin.com/company/d-k-haney-roofing-inc-",
    },
    "CTR-FTW-BLUSKYRESTORATI": {
        "canonical_name": "Blusky Restoration Contractors, Llc",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/southlake/profile/fire-water-damage-restoration/blusky-restoration-contractors-llc-0825-1000201119",
        "bbb_rating": "B",
        "bbb_accredited": 1,
        "website_url": "https://goblusky.com",
        "phone_number": "(800) 266-5677",
        "hq_address": "Southlake, TX 76092",
        "linkedin_company_url": "https://www.linkedin.com/company/blusky-restoration-contractors",
    },
    "CTR-FORT-WORTH-PREMIER-ROOFING-SHEET": {
        "canonical_name": "Fort Worth Premier Roofing & Sheet Metal",
        "rcat_profile_url": None,
        "rcat_license_number": None,
        "rcat_license_type": None,
        "rcat_member_since": None,
        "bbb_profile_url": "https://www.bbb.org/us/tx/bedford/profile/roofing-contractors/premier-roofing-company-dallas-0825-1000224128",
        "bbb_rating": "A+",
        "bbb_accredited": 1,
        "website_url": "https://www.premier-roofing.com",
        "phone_number": "(214) 390-7663",
        "hq_address": "315 Harwood Rd, Bedford, TX 76021",
        "linkedin_company_url": "https://www.linkedin.com/company/premier-roofing-company",
    }
}

def verify_urls_live():
    print("--- Verifying URLs against live internet ---")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    with httpx.Client(timeout=10.0, follow_redirects=True, headers=headers) as client:
        for cid, data in VERIFIED_CONTRACTORS.items():
            print(f"\nChecking [{cid}] {data['canonical_name']}:")
            if data["rcat_profile_url"]:
                try:
                    resp = client.get(data["rcat_profile_url"])
                    print(f"  RCAT: {resp.status_code} {data['rcat_profile_url']}")
                    if resp.status_code >= 400:
                        print(f"  [ERROR] RCAT returned error status: {resp.status_code}")
                except Exception as e:
                    print(f"  [EXC] RCAT error: {e}")
            else:
                print("  RCAT: None (unlicensed/not holding RCAT voluntary credential)")
                
            if data["bbb_profile_url"]:
                try:
                    resp = client.get(data["bbb_profile_url"])
                    print(f"  BBB:  {resp.status_code} {data['bbb_profile_url']}")
                    if resp.status_code >= 400:
                        print(f"  [ERROR] BBB returned error status: {resp.status_code}")
                except Exception as e:
                    print(f"  [EXC] BBB error: {e}")

def update_db():
    print("\n--- Updating depoii_local.db ---")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    for cid, data in VERIFIED_CONTRACTORS.items():
        cur.execute("""
            UPDATE canonical_contractors
            SET rcat_profile_url = ?,
                rcat_license_number = ?,
                rcat_license_type = ?,
                rcat_member_since = ?,
                bbb_profile_url = ?,
                bbb_rating = ?,
                bbb_accredited = ?,
                website_url = coalesce(?, website_url),
                phone_number = coalesce(?, phone_number),
                hq_address = coalesce(?, hq_address),
                linkedin_company_url = coalesce(?, linkedin_company_url)
            WHERE id = ?
        """, (
            data["rcat_profile_url"],
            data["rcat_license_number"],
            data["rcat_license_type"],
            data["rcat_member_since"],
            data["bbb_profile_url"],
            data["bbb_rating"],
            data["bbb_accredited"],
            data["website_url"],
            data["phone_number"],
            data["hq_address"],
            data["linkedin_company_url"],
            cid
        ))
        print(f"Updated {cid} ({data['canonical_name']}) in DB (rows affected: {cur.rowcount})")
        
    conn.commit()
    conn.close()
    print("Database update committed successfully.")

if __name__ == "__main__":
    verify_urls_live()
    update_db()
