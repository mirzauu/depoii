"""Shared rules for a lead a sales manager can hand to a rep."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional, Tuple

from shapely.geometry import Point, Polygon

NRCA_LOW = 7.50
NRCA_HIGH = 12.50
TEXAS_LABOR = 0.94

_PLACEHOLDER = re.compile(r"no name|unknown address|^\s*0\b|n/?a\b", re.I)
_PUBLIC = re.compile(
    r"\b(city of|county of|\bisd\b|school district|university|college|church|baptist|diocese|authority|state of|board of reg)\b",
    re.I,
)
_ROOF_WORD = re.compile(r"roof|reroof|re-roof|tpo|epdm|membrane|shingle|built-?up|\bbur\b|single-?ply|mod bit", re.I)
_NOT_ROOF_JOB = re.compile(
    r"multi-family dwelling|multifamily dwelling|core and shell|core & shell|detention tank|baseball field|softball field",
    re.I,
)

# First three digits of ZIP codes that belong to the city. Unknown cities are kept.
_CITY_ZIP3 = {
    "dallas": {"752"},
    "fort worth": {"761", "760"},
    "grapevine": {"760"},
    "addison": {"750"},
    "rowlett": {"750"},
    "garland": {"750"},
    "richardson": {"750"},
    "irving": {"750"},
    "plano": {"750"},
    "arlington": {"760"},
    "new york": {"100", "101", "102", "103", "104", "111", "112"},
}


def stored_number(value):
    """A number stored on the row. Empty and non-numeric values stay empty."""
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return int(number) if number.is_integer() else number


def money_text(amount, formatted=None):
    label = str(formatted or "").strip()
    if label:
        return label
    number = stored_number(amount)
    if number is None:
        return None
    return f"${number:,.0f}"


def owner_mailing_line(
    street: Optional[str],
    city: Optional[str] = None,
    state: Optional[str] = None,
    postal: Optional[str] = None,
) -> str:
    """Mailing address from the appraisal roll. Empty parts are left out. No phone or email is invented.

    Tarrant stores the city as one field that already includes the state ("Crowley, Tx").
    The state and ZIP columns on those rows are the property, so they are not appended.
    """
    street_text = str(street or "").strip()
    city_text = str(city or "").strip()
    if "," in city_text:
        locality = city_text
    else:
        locality = " ".join(part for part in (city_text, str(state or "").strip(), str(postal or "").strip()) if part)
    return ", ".join(part for part in (street_text, locality) if part)


def is_placeholder_address(address: Optional[str]) -> bool:
    text = (address or "").strip()
    if len(text) < 5:
        return True
    return bool(_PLACEHOLDER.search(text))


def is_public_owner(owner: Optional[str]) -> bool:
    return bool(_PUBLIC.search(owner or ""))


def zip_matches_city(city: Optional[str], zip_code: Optional[str]) -> bool:
    digits = re.sub(r"\D", "", zip_code or "")[:5]
    if len(digits) < 5:
        return False
    key = (city or "").strip().lower()
    prefixes = None
    for name, prefs in _CITY_ZIP3.items():
        if name in key:
            prefixes = prefs
            break
    if prefixes is None:
        return True
    return digits[:3] in prefixes


def is_roofing_text(category: Optional[str], description: Optional[str], roof_system: Optional[str] = None) -> bool:
    blob = f"{category or ''} {description or ''} {roof_system or ''}"
    if _NOT_ROOF_JOB.search(description or "") or _NOT_ROOF_JOB.search(category or ""):
        return False
    if not _ROOF_WORD.search(blob):
        return False
    system = (roof_system or "").strip().lower()
    stated = f"{category or ''} {description or ''}"
    if system == "architectural asphalt shingle" and not re.search(r"shingle|roof", stated, re.I):
        return False
    return True


def stated_roof_system(system: Optional[str], description: Optional[str], category: Optional[str]) -> str:
    """Keep a membrane only when the permit text supports it."""
    text = f"{description or ''} {category or ''}".lower()
    raw = (system or "").strip()
    if not raw or raw.lower() in {"unspecified", "unspecified commercial system"}:
        return "Unspecified" if not _ROOF_WORD.search(text) else "Unspecified Commercial System"
    if raw.lower() == "architectural asphalt shingle" and "shingle" not in text and "roof" not in text:
        return "Unspecified"
    if raw.lower() in {"tpo single-ply", "epdm membrane"} and not re.search(r"tpo|epdm|thermoplastic|rubber", text):
        if "roof" in text or "reroof" in text or "re-roof" in text:
            return "Unspecified Commercial System"
        return "Unspecified"
    return raw


def valuation_is_suspect(valuation: Optional[float], sqft: Optional[float], category: Optional[str]) -> bool:
    if valuation is None or valuation <= 0:
        return False
    if sqft and sqft > 0 and valuation / sqft > 1000:
        return True
    if valuation > 50_000_000 and re.search(r"roof", category or "", re.I):
        return True
    return False


def roof_square_feet(
    building_sqft: int,
    stories: Optional[int] = None,
    footprint_sqft: Optional[int] = None,
    land_sqft: Optional[int] = None,
) -> Tuple[int, str]:
    """Roof area from a measured footprint. Land area is not a roof."""
    if (
        footprint_sqft
        and land_sqft
        and land_sqft > 0
        and int(footprint_sqft) == int(round(float(land_sqft) * 0.65))
    ):
        footprint_sqft = None
    _ = (building_sqft, stories)
    if footprint_sqft and footprint_sqft > 0:
        return int(footprint_sqft), "measured footprint"
    return 0, "roof area unknown"


def exposure_score(
    hail_inches: float,
    distance_miles: Optional[float],
    tier: str,
    roof_age_years: Optional[int],
    roof_sqft: int,
) -> int:
    """0-100 score that moves with hail, swath position, roof age, and roof size."""
    hail = max(0.0, float(hail_inches or 0))
    severity = min(35.0, (hail / 2.75) * 35.0)
    if distance_miles is None:
        proximity = 12.0 if tier == "core" else 6.0 if tier == "envelope" else 0.0
    else:
        proximity = max(0.0, 18.0 - float(distance_miles) * 3.0)
    position = 12.0 if tier == "core" else 4.0 if tier == "envelope" else 0.0
    age = 0.0
    if roof_age_years is not None:
        age = min(16.0, max(0.0, roof_age_years * 0.35))
    size = 0.0
    if roof_sqft and roof_sqft > 0:
        size = min(24.0, roof_sqft / 20_000.0)
    return int(max(0, min(100, round(severity + proximity + position + age + size))))


def replacement_cost(
    building_sqft: int,
    state: str = "TX",
    stories: Optional[int] = None,
    footprint_sqft: Optional[int] = None,
    land_sqft: Optional[int] = None,
    improvement_value: Optional[float] = None,
) -> Dict[str, Any]:
    roof_sqft, basis = roof_square_feet(building_sqft, stories, footprint_sqft, land_sqft)
    multiplier = TEXAS_LABOR if (state or "").upper() == "TX" else 1.0
    low = round(roof_sqft * NRCA_LOW * multiplier)
    high = round(roof_sqft * NRCA_HIGH * multiplier)
    mid = round((low + high) / 2.0)
    flagged = bool(improvement_value and improvement_value > 0 and mid > 1.5 * improvement_value)
    if mid >= 1_000_000:
        formatted = f"${low / 1_000_000:.2f}M – ${high / 1_000_000:.2f}M"
    else:
        formatted = f"${low:,} – ${high:,}"
    return {
        "low": float(low),
        "high": float(high),
        "mid": float(mid),
        "formatted": formatted,
        "roof_sqft": roof_sqft,
        "basis": basis,
        "flagged": flagged,
    }


def swath_polygon(properties: Optional[str]) -> Optional[Polygon]:
    try:
        props = json.loads(properties or "{}")
    except json.JSONDecodeError:
        return None
    coords = props.get("polygon")
    if not isinstance(coords, list) or len(coords) < 3:
        return None
    try:
        poly = Polygon(coords)
    except Exception:
        return None
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty:
        return None
    return poly


def point_in_swath(lat: Optional[float], lon: Optional[float], properties: Optional[str]) -> bool:
    if lat is None or lon is None:
        return False
    poly = swath_polygon(properties)
    if poly is None:
        return False
    return bool(poly.contains(Point(float(lon), float(lat))))


# SQL fragment. Alias the permits table as `p`.
ROOFING_PERMIT_SQL = """
(
  (
    LOWER(COALESCE(p.raw_description, '')) LIKE '%roof replacement%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%roof repair%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%reroof%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%re-roof%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%re roof%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tear-off%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tear off%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tpo%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%epdm%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%shingle%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%single-ply%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%single ply%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%modified bitumen%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%built-up%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%built up roof%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%roof coating%'
    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%roofing%'
  )
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%solar%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%photovoltaic%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%scaffold%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%chain link%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%sidewalk shed%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%hvac%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%multi-family dwelling%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%core and shell%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%core & shell%'
  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%detention tank%'
  AND NOT (
    (p.square_footage IS NOT NULL AND p.square_footage > 0 AND p.valuation / p.square_footage > 1000)
    OR (p.valuation > 50000000 AND (
      LOWER(COALESCE(p.raw_description, '')) LIKE '%roof%'
      OR LOWER(COALESCE(p.category, '')) LIKE '%roof%'
    ))
  )
)
"""

NON_ROOFER_NAME_SQL = """
LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%joint venture%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%homes, llc%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%homes llc%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%intown homes%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%home builder%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%construction group%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%solar%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%scaffold%'
AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%licensed%'
AND (
  LOWER(COALESCE(p.contractor_name, '')) LIKE '%roof%'
  OR (
    LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%constr%'
    AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%builder%'
    AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%interior%'
    AND LOWER(COALESCE(p.contractor_name, '')) NOT LIKE '%housing%'
  )
)
"""
