"""Parse a saved or live DCAD commercial account page.

Stories default is not 1. Roof size is the sum of foundations only when every
section has one and the page says 1 story. Owner is the text after the owner
label, not the words "Owner (Current ...)".
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from app.science.lead_store import ineligible_reason, measured_roof_sqft


def _clean(fragment: str) -> str:
    text = re.sub(r"<[^>]+>", " ", fragment or "")
    text = text.replace("&nbsp;", " ").replace("&#160;", " ")
    return re.sub(r"\s+", " ", text).strip()


def parse_dcad_account(html: str) -> Dict[str, Any]:
    page = html or ""
    addr_m = re.search(r'id="PropAddr1_lblPropAddr"[^>]*>(.*?)</span>', page, re.I | re.S)
    address = _clean(addr_m.group(1) if addr_m else "")
    owner_m = re.search(r'id="lblOwner"[^>]*>.*?</span>\s*([^<]+)', page, re.I | re.S)
    owner = _clean(owner_m.group(1) if owner_m else "")
    if owner.lower().startswith("owner"):
        owner = ""
    val_m = re.search(r'lblTotalVal"[^>]*>\$?([0-9,]+)', page, re.I)
    market_value = float(val_m.group(1).replace(",", "")) if val_m else None
    blocks = re.split(r"(?=<td><b>Desc:</b>)", page, flags=re.I)
    descs: List[str] = []
    areas: List[int] = []
    years: List[int] = []
    foundations: List[Optional[int]] = []
    stories_found: List[int] = []
    units_found: List[int] = []
    for block in blocks:
        desc_m = re.search(r"<b>Desc:</b>(?:&nbsp;|\s)*([^<]+)", block, re.I)
        if not desc_m:
            continue
        area_m = re.search(r"<b>Total Area:</b>(?:&nbsp;|\s)*([0-9,]+)", block, re.I)
        year_m = re.search(r"<b>Year Built:</b>(?:&nbsp;|\s)*([0-9]{4})", block, re.I)
        found_m = re.search(
            r"Foundation(?:&nbsp;|\s)*\(Area\):</TH>\s*<TD>[^(]*\(\s*([0-9,]+)\s*sqft",
            block,
            re.I,
        )
        story_m = re.search(r"#(?:&nbsp;|\s)*Stories:</TH>\s*<TD>\s*(\d+)", block, re.I)
        unit_m = re.search(r"#(?:&nbsp;|\s)*Units:</TH>\s*<TD>\s*(\d+)", block, re.I)
        descs.append(_clean(desc_m.group(1)))
        areas.append(int(area_m.group(1).replace(",", "")) if area_m else None)
        if year_m:
            years.append(int(year_m.group(1)))
        foundations.append(int(found_m.group(1).replace(",", "")) if found_m else None)
        if story_m:
            stories_found.append(int(story_m.group(1)))
        if unit_m:
            units_found.append(int(unit_m.group(1)))
    land_m = re.search(
        r"State Code(?:</b>)?</td>.*?<td>\s*\d+\s*</td>\s*<td>\s*([^<]+?)\s*</td>",
        page,
        re.I | re.S,
    )
    land_use = _clean(land_m.group(1) if land_m else "")
    if stories_found and len(stories_found) == len(descs) and len(set(stories_found)) == 1:
        stories = stories_found[0]
    else:
        stories = None
    sections: List[Dict[str, Any]] = []
    for i, desc in enumerate(descs):
        sections.append(
            {
                "description": desc,
                "area_sqft": areas[i] if i < len(areas) else None,
                "year_built": years[i] if i < len(years) else None,
                "foundation_sqft": foundations[i] if i < len(foundations) else None,
            }
        )
    roof = measured_roof_sqft(stories, [s["foundation_sqft"] for s in sections]) if sections else None
    description = "; ".join(d for d in descs if d)
    return {
        "address": address,
        "owner_name": owner,
        "market_value": market_value,
        "improvement_description": description,
        "land_use_code": land_use,
        "stories": stories,
        "unit_count": units_found[0] if units_found else None,
        "year_built": min(years) if years else None,
        "source_area": sum(a for a in areas if a) if any(areas) else None,
        "source_area_kind": "dcad_improvement_total_area",
        "sections": sections,
        "foundations": foundations,
        "roof_sqft_used": roof,
        "ineligible": ineligible_reason(description, land_use, units_found[0] if units_found else None, stories),
    }
