"""Allowlist of leads whose customer fields are copies of named sources.

released_leads starts empty. A row is inserted only by try_release after every
required lead_evidence field is present. Customer reads must use this table.
"""

from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

REQUIRED_FIELDS = (
    "address",
    "owner_name",
    "year_built",
    "stories",
    "market_value",
    "improvement_description",
    "land_use_code",
    "source_area",
    "source_area_kind",
    "roof_sqft_used",
    "spc_file",
    "spc_time_utc",
    "spc_lat",
    "spc_lon",
    "spc_size_in",
    "spc_comment",
    "hail_distance_mi",
    "permit_query",
    "permit_match_count",
    "permit_portal",
)

_INELIGIBLE = re.compile(
    r"apartment|apts?\b|multi-?family|\bmfr\b|church|baptist|synagogue|mosque|"
    r"diocese|government|\bcity of\b|\bcounty of\b|parkland|\bvacant\b|"
    r"\bschool\b|university|\bisd\b",
    re.I,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS lead_evidence (
    parcel_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    stored_value TEXT,
    source_system TEXT NOT NULL,
    source_url TEXT,
    source_field TEXT,
    retrieved_at TEXT NOT NULL,
    raw_excerpt TEXT,
    PRIMARY KEY (parcel_id, field_name)
);
CREATE TABLE IF NOT EXISTS released_leads (
    parcel_id TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    released_at TEXT NOT NULL,
    release_reason TEXT
);
"""


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)


def upsert_evidence(
    conn: sqlite3.Connection,
    parcel_id: str,
    field_name: str,
    stored_value: Any,
    source_system: str,
    source_url: str = "",
    source_field: str = "",
    retrieved_at: str = "",
    raw_excerpt: str = "",
) -> None:
    if field_name not in REQUIRED_FIELDS and not field_name:
        raise ValueError("field_name is required")
    when = retrieved_at or datetime.now(timezone.utc).isoformat()
    value = "" if stored_value is None else str(stored_value)
    conn.execute(
        """
        INSERT INTO lead_evidence (
            parcel_id, field_name, stored_value, source_system, source_url,
            source_field, retrieved_at, raw_excerpt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(parcel_id, field_name) DO UPDATE SET
            stored_value = excluded.stored_value,
            source_system = excluded.source_system,
            source_url = excluded.source_url,
            source_field = excluded.source_field,
            retrieved_at = excluded.retrieved_at,
            raw_excerpt = excluded.raw_excerpt
        """,
        (parcel_id, field_name, value, source_system, source_url, source_field, when, raw_excerpt[:500]),
    )


def evidence_map(conn: sqlite3.Connection, parcel_id: str) -> Dict[str, str]:
    rows = conn.execute(
        "SELECT field_name, stored_value FROM lead_evidence WHERE parcel_id = ?",
        (parcel_id,),
    ).fetchall()
    return {name: value for name, value in rows}


def missing_fields(evidence: Dict[str, Any]) -> List[str]:
    missing = []
    for name in REQUIRED_FIELDS:
        value = evidence.get(name)
        if value is None or str(value).strip() == "":
            missing.append(name)
    return missing


def ineligible_reason(
    description: str = "",
    land_use: str = "",
    units: Optional[int] = None,
    stories: Optional[int] = None,
) -> Optional[str]:
    text = f"{description or ''} {land_use or ''}"
    if _INELIGIBLE.search(text):
        return "improvement description or land use is not a commercial roof lead"
    if units is not None and int(units) > 4:
        return "unit count above 4"
    if stories is not None and int(stories) > 2:
        return "more than 2 stories"
    return None


def measured_roof_sqft(stories: Optional[int], foundations: List[Optional[int]]) -> Optional[int]:
    """Sum of section foundations only for a one-story building with every section measured."""
    if stories != 1:
        return None
    if not foundations:
        return None
    if any(item is None or int(item) <= 0 for item in foundations):
        return None
    return int(sum(int(item) for item in foundations))


def release_block_reason(evidence: Dict[str, Any], state: str = "TX") -> Optional[str]:
    if (state or "").upper() != "TX":
        return "state is not TX"
    missing = missing_fields(evidence)
    if missing:
        return "missing evidence: " + ", ".join(missing)
    try:
        stories = int(float(evidence["stories"]))
    except (TypeError, ValueError):
        return "stories is not a number"
    units = evidence.get("unit_count")
    unit_n = None
    if units not in (None, ""):
        try:
            unit_n = int(float(units))
        except (TypeError, ValueError):
            unit_n = None
    blocked = ineligible_reason(
        str(evidence.get("improvement_description") or ""),
        str(evidence.get("land_use_code") or ""),
        unit_n,
        stories,
    )
    if blocked:
        return blocked
    try:
        roof = int(float(evidence["roof_sqft_used"]))
    except (TypeError, ValueError):
        return "roof size is not a number"
    if roof <= 0:
        return "roof size is empty"
    if stories != 1:
        return "roof size is withheld unless the roll says 1 story"
    try:
        miles = float(evidence["hail_distance_mi"])
    except (TypeError, ValueError):
        return "hail distance is not a number"
    if miles > 15:
        return "nearest Texas SPC report is more than 15 miles away"
    comment = str(evidence.get("spc_comment") or "").lower()
    if any(word in comment for word in ("delayed", "facebook", "mping", "social")):
        return "SPC report is delayed or social, not a spotter report"
    return None


def try_release(conn: sqlite3.Connection, parcel_id: str, state: str = "TX") -> Tuple[bool, str]:
    ensure_schema(conn)
    evidence = evidence_map(conn, parcel_id)
    reason = release_block_reason(evidence, state=state)
    if reason:
        conn.execute("DELETE FROM released_leads WHERE parcel_id = ?", (parcel_id,))
        return False, reason
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO released_leads (parcel_id, state, released_at, release_reason)
        VALUES (?, 'TX', ?, 'every required evidence field is present')
        ON CONFLICT(parcel_id) DO UPDATE SET
            state = 'TX',
            released_at = excluded.released_at,
            release_reason = excluded.release_reason
        """,
        (parcel_id, now),
    )
    return True, "every required evidence field is present"


def is_released(conn: sqlite3.Connection, parcel_id: str) -> bool:
    try:
        row = conn.execute(
            """
            SELECT 1 FROM released_leads
            WHERE state = 'TX' AND (parcel_id = ? OR parcel_id = (
                SELECT id FROM parcels WHERE account_number = ? LIMIT 1
            ))
            """,
            (parcel_id, parcel_id),
        ).fetchone()
    except sqlite3.OperationalError:
        return False
    return row is not None


def _exposure_from_fields(fields: Dict[str, Any]) -> Optional[int]:
    from app.science.lead_quality import exposure_score

    try:
        hail = float(fields.get("spc_size_in", {}).get("value"))
        miles = float(fields.get("hail_distance_mi", {}).get("value"))
        roof = int(float(fields.get("roof_sqft_used", {}).get("value")))
        year = int(float(fields.get("year_built", {}).get("value")))
    except (TypeError, ValueError):
        return None
    age = max(0, datetime.now(timezone.utc).year - year)
    return exposure_score(hail, miles, "envelope", age, roof)


def list_released(
    conn: sqlite3.Connection,
    limit: int = 50,
    offset: int = 0,
    city: Optional[str] = None,
) -> Tuple[int, List[Dict[str, Any]]]:
    ensure_schema(conn)
    rows = conn.execute(
        """
        SELECT r.parcel_id, r.released_at, r.release_reason,
               e.field_name, e.stored_value, e.source_system, e.retrieved_at
        FROM released_leads r
        LEFT JOIN lead_evidence e ON e.parcel_id = r.parcel_id
        WHERE r.state = 'TX'
        ORDER BY r.parcel_id
        """
    ).fetchall()
    grouped: Dict[str, Dict[str, Any]] = {}
    for parcel_id, released_at, release_reason, field_name, stored_value, source_system, retrieved_at in rows:
        lead = grouped.setdefault(
            parcel_id,
            {
                "parcel_id": parcel_id,
                "state": "TX",
                "released_at": released_at,
                "release_reason": release_reason,
                "fields": {},
            },
        )
        if field_name:
            lead["fields"][field_name] = {
                "value": stored_value,
                "source_system": source_system,
                "retrieved_at": retrieved_at,
            }
    leads = []
    for lead in grouped.values():
        fields = lead["fields"]
        city_value = fields.get("city", {}).get("value") or ""
        if city and city.lower() not in str(fields.get("address", {}).get("value") or "").lower() and city.lower() not in city_value.lower():
            address = str(fields.get("address", {}).get("value") or "")
            if city.lower() not in address.lower():
                continue
        permit_query = str(fields.get("permit_query", {}).get("value") or "")
        score = _exposure_from_fields(fields)
        leads.append(
            {
                "parcel_id": lead["parcel_id"],
                "state": "TX",
                "address": fields.get("address", {}).get("value"),
                "owner_name": fields.get("owner_name", {}).get("value"),
                "year_built": fields.get("year_built", {}).get("value"),
                "market_value": fields.get("market_value", {}).get("value"),
                "roof_sqft_used": fields.get("roof_sqft_used", {}).get("value"),
                "improvement_description": fields.get("improvement_description", {}).get("value"),
                "spc_file": fields.get("spc_file", {}).get("value"),
                "spc_time_utc": fields.get("spc_time_utc", {}).get("value"),
                "spc_size_in": fields.get("spc_size_in", {}).get("value"),
                "spc_comment": fields.get("spc_comment", {}).get("value"),
                "hail_distance_mi": fields.get("hail_distance_mi", {}).get("value"),
                "permit_summary": permit_query,
                "exposure_score": score,
                "source_system": fields.get("address", {}).get("source_system"),
                "retrieved_at": fields.get("address", {}).get("retrieved_at"),
                "released_at": lead["released_at"],
            }
        )
    total = len(leads)
    return total, leads[offset:offset + limit]
