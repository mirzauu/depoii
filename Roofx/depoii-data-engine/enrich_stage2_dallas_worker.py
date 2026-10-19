import os
import sys
import re
import json
import time
import random
import urllib.parse
import sqlite3
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple

DB_PATH = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\depoii_local.db"
STATE_FILE = r"d:\Depoii_nextjs\Roofx\depoii-data-engine\dallas_enrichment_state.json"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
]

NON_CONTRACTOR_PATTERNS = [
    r'\b(apartments?|townhomes?|condos?|flats|lofts|estates|suites)\b',
    r'\b(housing authority|community center|baptist church|presbyterian church|methodist church)\b',
    r'\b(elementary school|middle school|high school|academy)\b',
    r'\b(storage|realty|real estate|holdings?|investments?)\b'
]

def is_disqualified_non_roofer(name: str) -> Tuple[bool, str]:
    name_l = name.lower()
    for pattern in NON_CONTRACTOR_PATTERNS:
        if re.search(pattern, name_l):
            return True, f"Matched non-contractor pattern: {pattern}"
    return False, ""

def format_phone(phone_str: str) -> Optional[str]:
    if not phone_str:
        return None
    digits = re.sub(r'\D', '', phone_str)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    return phone_str.strip()

def search_bbb(client: httpx.Client, company_name: str, city: str = "Dallas", state: str = "TX") -> Dict[str, Any]:
    """Search BBB for the contractor profile and ratings."""
    url = f"https://www.bbb.org/search?find_country=USA&find_loc={city}%2C+{state}&find_text={urllib.parse.quote(company_name)}&page=1"
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    result = {
        "bbb_profile_url": None,
        "bbb_rating": None,
        "bbb_accredited": 0,
        "phone": None,
        "address": None,
        "website": None
    }
    
    try:
        resp = client.get(url, headers=headers, timeout=8.0, follow_redirects=True)
        if resp.status_code == 200:
            html = resp.text
            # Look for exact or top profile link
            profile_matches = re.findall(r'href="(/us/tx/[^"]+/profile/[^"]+)"', html)
            if profile_matches:
                best_profile = f"https://www.bbb.org{profile_matches[0]}"
                result["bbb_profile_url"] = best_profile
                
                # Check for rating in search snippet or profile
                rating_match = re.search(r'Rating\s*([A-F][+-]?|NR)', html, re.I)
                if rating_match:
                    result["bbb_rating"] = rating_match.group(1).upper()
                    
                if "Accredited" in html:
                    result["bbb_accredited"] = 1
                    
                # Look for phone pattern near profile
                phone_match = re.search(r'\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}', html)
                if phone_match:
                    result["phone"] = format_phone(phone_match.group(0))
    except Exception as e:
        pass
        
    return result

def search_duckduckgo(client: httpx.Client, query: str) -> Dict[str, Any]:
    """Search DDG for company website, phone, and address."""
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Referer": "https://html.duckduckgo.com/"
    }
    data = {"q": query}
    
    result = {
        "website": None,
        "phone": None,
        "address": None
    }
    
    try:
        resp = client.post(url, data=data, headers=headers, timeout=8.0)
        if resp.status_code == 200:
            html = resp.text
            # Extract organic result URLs
            urls = re.findall(r'<a class="result__url"[^>]*href="([^"]+)"', html)
            clean_urls = []
            for u in urls:
                # filter out ads, directory hubs like yelp/angi/manta/yellowpages/facebook
                if any(bad in u.lower() for bad in ['duckduckgo', 'bing.com', 'yelp.com', 'angi.com', 'yellowpages', 'facebook.com', 'bbb.org', 'mapquest', 'indeed.com', 'linkedin.com']):
                    continue
                # normalize URL
                if u.startswith('http'):
                    domain = re.match(r'https?://([^/]+)', u)
                    if domain:
                        clean_urls.append(f"https://{domain.group(1)}")
            if clean_urls:
                result["website"] = clean_urls[0]
                
            # Extract Phone from snippet text
            phone_match = re.search(r'\(?(?:214|972|469|817|682)\)?[\s.-]\d{3}[\s.-]\d{4}', html)
            if phone_match:
                result["phone"] = format_phone(phone_match.group(0))
                
            # Extract Dallas street address snippet if present
            addr_match = re.search(r'\b\d{2,5}\s+[A-Za-z0-9\s.,]+(?:Dallas|Fort Worth|Garland|Irving|Richardson|Plano|Carrollton),\s*TX\s*\d{5}?', html)
            if addr_match:
                result["address"] = addr_match.group(0).strip()
    except Exception as e:
        pass
        
    return result

def enrich_contractor(c_id: str, canonical_name: str, client: httpx.Client) -> Dict[str, Any]:
    # 1. Check if disqualified non-roofer
    is_disq, reason = is_disqualified_non_roofer(canonical_name)
    if is_disq:
        return {
            "status": "disqualified_non_roofer",
            "reason": reason,
            "data": {}
        }
        
    # 2. Search BBB
    bbb_res = search_bbb(client, canonical_name)
    
    # 3. Search Web via DDG
    query = f"{canonical_name} roofing Dallas TX"
    web_res = search_duckduckgo(client, query)
    
    # Consolidate results
    website = web_res.get("website") or bbb_res.get("website")
    phone = web_res.get("phone") or bbb_res.get("phone")
    address = web_res.get("address") or bbb_res.get("address")
    bbb_url = bbb_res.get("bbb_profile_url")
    bbb_rating = bbb_res.get("bbb_rating")
    bbb_accredited = bbb_res.get("bbb_accredited", 0)
    
    has_contact = bool(website or phone or bbb_url)
    
    if has_contact:
        return {
            "status": "enriched",
            "reason": "Found verified web or BBB footprint",
            "data": {
                "website_url": website,
                "phone_number": phone,
                "hq_address": address,
                "bbb_profile_url": bbb_url,
                "bbb_rating": bbb_rating,
                "bbb_accredited": bbb_accredited
            }
        }
    else:
        return {
            "status": "no_web_presence",
            "reason": "No public online presence found in Dallas area",
            "data": {}
        }

if __name__ == "__main__":
    print("Testing single contractor enrichment...")
    with httpx.Client(timeout=10.0) as client:
        res = enrich_contractor("TEST-ID", "Castro Roofing of Texas", client)
        print("Test Result:", json.dumps(res, indent=2))
