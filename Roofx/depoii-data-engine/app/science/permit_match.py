"""Match a permit to a parcel only when the street number and the street name agree.

Direction prefixes are part of the name. A suite on the same number and street
still matches. A shared street number on a different street does not.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Iterable, Optional, Tuple

_DIRECTIONS = {
    "N": "N",
    "S": "S",
    "E": "E",
    "W": "W",
    "NE": "NE",
    "NW": "NW",
    "SE": "SE",
    "SW": "SW",
    "NORTH": "N",
    "SOUTH": "S",
    "EAST": "E",
    "WEST": "W",
}
_SUFFIXES = {
    "ST", "STREET", "DR", "DRIVE", "RD", "ROAD", "AVE", "AVENUE", "BLVD",
    "BOULEVARD", "LN", "LANE", "CT", "COURT", "WAY", "PKWY", "PARKWAY",
    "PL", "PLACE", "HWY", "HIGHWAY", "CIR", "CIRCLE", "TRL", "TRAIL",
}
_SUITE = re.compile(r"\b(?:STE|SUITE|APT|UNIT|BLDG|#)\b.*$", re.I)


def _tokens(address: str) -> list:
    text = _SUITE.sub(" ", address or "")
    text = text.split(",")[0]
    text = re.sub(r"[^A-Za-z0-9 ]", " ", text.upper())
    return [tok for tok in text.split() if tok]


def street_identity(address: str) -> Optional[Tuple[str, str, str]]:
    tokens = _tokens(address)
    if not tokens:
        return None
    number = next((tok for tok in tokens if tok.isdigit()), None)
    if not number:
        return None
    # Direction stays in the identity. LOOP stays in the name so E LOOP 820
    # does not match a different LOOP 820 prefix.
    body = []
    seen_number = False
    for tok in tokens:
        if not seen_number and tok == number:
            seen_number = True
            continue
        if not seen_number:
            continue
        if tok in _SUFFIXES:
            continue
        body.append(tok)
    direction = ""
    if body and body[0] in _DIRECTIONS:
        direction = _DIRECTIONS[body[0]]
        body = body[1:]
    name = " ".join(body)
    if not name:
        return None
    return number, direction, name


def addresses_match(left: str, right: str) -> bool:
    a = street_identity(left)
    b = street_identity(right)
    if not a or not b:
        return False
    return a == b


def search_summary(portal: str, query: str, match_count: int, when: Optional[str] = None) -> str:
    stamp = when or datetime.now(timezone.utc).date().isoformat()
    return f"searched {portal} on {stamp}: {int(match_count)} matches for {query}"


def count_matches(parcel_address: str, permit_addresses: Iterable[str]) -> int:
    return sum(1 for permit in permit_addresses if addresses_match(parcel_address, permit))
