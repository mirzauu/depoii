import os
import time
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from app.schemas.brief_schema import (
    MondayBriefResponse,
    StormSummary,
    BriefSummary,
    TopOwner,
    PitchBrief,
    CompetitorBrief,
    OpportunityItem,
)
from app.core.logging import logger

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "depoii_local.db")

# Brief response cache: 10-minute TTL per jurisdiction. Cleared after a sync or verification run.
_BRIEF_CACHE: Dict[str, Dict[str, Any]] = {}
_BRIEF_CACHE_TTL = 600  # seconds
_INDEXES_READY = False


def _get_ro_connection() -> Optional[sqlite3.Connection]:
    if not os.path.exists(DB_PATH):
        return None
    try:
        # Connect in read-only mode to prevent transaction lock contention
        return sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    except Exception as exc:
        logger.warning(f"[BRIEF SERVICE] Failed to open read-only sqlite connection: {exc}")
        return None


def parse_jurisdiction(jurisdiction_str: str) -> Tuple[str, str]:
    """
    Parses 'City, ST' into (city, state).
    Defaults state to 'TX' if omitted.
    """
    if not jurisdiction_str:
        return "Dallas", "TX"
    
    parts = jurisdiction_str.split(",", 1)
    city = parts[0].strip()
    if len(parts) > 1:
        state = parts[1].strip().upper()
    else:
        # Fallback mapping for common cities
        city_lower = city.lower()
        if "new york" in city_lower or "nyc" in city_lower:
            state = "NY"
        elif "seattle" in city_lower:
            state = "WA"
        elif "chicago" in city_lower:
            state = "IL"
        elif "cincinnati" in city_lower:
            state = "OH"
        elif "boston" in city_lower:
            state = "MA"
        elif "miami" in city_lower or "tampa" in city_lower:
            state = "FL"
        else:
            state = "TX"
    return city, state


def _detect_corridor(address: str, city: str, zip_code: Optional[str]) -> str:
    """
    Assigns a recognizable commercial corridor or submarket.
    """
    addr_upper = (address or "").upper()
    city_upper = (city or "").upper()
    
    if "NEW YORK" in city_upper or "NY" in city_upper:
        if any(w in addr_upper for w in ["WALL", "BROADWAY", "GREENWICH", "VESEY", "SOUTH END", "MAIDEN", "BARCLAY", "LENOX"]):
            return "Manhattan"
        if any(w in addr_upper for w in ["WILLOUGHBY", "COURT", "FLATBUSH", "ATLANTIC", "FULTON"]):
            return "Brooklyn"
        if any(w in addr_upper for w in ["QUEENS", "ASTORIA", "LONG ISLAND CITY"]):
            return "Queens"
        if any(w in addr_upper for w in ["CONCOURSE", "BRONX", "BELMONT"]):
            return "Bronx"
        return "Manhattan"
    
    if "DALLAS" in city_upper:
        if any(w in addr_upper for w in ["STEMMONS", "HARRY HINES", "REGAL", "EMPIRE"]):
            return "Stemmons Industrial Corridor"
        if any(w in addr_upper for w in ["VALWOOD", "I-35E", "FARMERS BRANCH"]):
            return "Valwood Industrial Corridor"
        if any(w in addr_upper for w in ["TRINITY", "SINGLETON", "COMMERCE"]):
            return "Trinity River Industrial"
        return "Dallas Commercial Core"
        
    if "FORT WORTH" in city_upper:
        return "North Fort Worth Industrial Corridor"
        
    return f"{city} Commercial Core"


def _detect_membrane(year_built: Optional[int], sqft: int) -> str:
    """A blank permit does not name a membrane."""
    _ = (year_built, sqft)
    return "Unspecified"


def invalidate_brief_cache() -> None:
    _BRIEF_CACHE.clear()


def ensure_indexes() -> None:
    global _INDEXES_READY
    if _INDEXES_READY or not os.path.exists(DB_PATH):
        return
    try:
        conn = sqlite3.connect(DB_PATH)
        for sql in (
            "CREATE INDEX IF NOT EXISTS idx_parcels_state_city ON parcels(state, city)",
            "CREATE INDEX IF NOT EXISTS idx_scored_parcel_id ON scored_parcel_leads(parcel_id)",
            "CREATE INDEX IF NOT EXISTS idx_permits_parcel_issue ON normalized_permits(parcel_id, issue_date)",
            "CREATE INDEX IF NOT EXISTS idx_permits_city ON normalized_permits(city)",
        ):
            try:
                conn.execute(sql)
            except sqlite3.OperationalError as exc:
                logger.warning(f"[BRIEF SERVICE] Index skipped: {exc}")
        conn.commit()
        conn.close()
        _INDEXES_READY = True
    except Exception as exc:
        logger.warning(f"[BRIEF SERVICE] Could not create indexes: {exc}")


def _get_competitor_for_market(conn: sqlite3.Connection, city: str, state: str) -> CompetitorBrief:
    """Leading contractor among roofing permits only. No invented share when the roll is empty."""
    try:
        cur = conn.cursor()
        from app.science.lead_quality import NON_ROOFER_NAME_SQL, ROOFING_PERMIT_SQL
        roof = f"{ROOFING_PERMIT_SQL} AND {NON_ROOFER_NAME_SQL}"
        rows = cur.execute(
            f"""
            SELECT p.contractor_name, SUM(p.valuation) as val
            FROM normalized_permits p
            WHERE (LOWER(p.city) LIKE LOWER(?) OR LOWER(p.jurisdiction) LIKE LOWER(?))
              AND p.contractor_name IS NOT NULL
              AND p.contractor_name NOT LIKE '%Self%'
              AND {roof}
            GROUP BY p.contractor_name
            """,
            (f"%{city}%", f"%{city}%"),
        ).fetchall()
        total = sum(float(item[1] or 0) for item in rows)
        if rows and rows[0][0] and total:
            rows.sort(key=lambda item: float(item[1] or 0), reverse=True)
            share = round((float(rows[0][1] or 0.0) / total) * 100.0, 1)
            return CompetitorBrief(name=rows[0][0], share_pct=share, storm_chasers=[])
    except Exception as exc:
        logger.warning(f"[BRIEF SERVICE] Error determining competitor: {exc}")
    return CompetitorBrief(name="", share_pct=0.0, storm_chasers=[])


def _page(response: MondayBriefResponse, limit: int, offset: int) -> MondayBriefResponse:
    total = len(response.opportunities)
    page = response.opportunities[offset:offset + limit]
    return response.model_copy(update={"opportunities": page, "total_opportunities": total, "offset": offset})


async def generate_monday_brief(jurisdiction: str, opportunity_limit: int = 5, offset: int = 0) -> MondayBriefResponse:
    """Cached full brief, then a page. Local swaths only, so Dallas does not wait on NOAA."""
    from app.science.brief_page import build_full_brief

    cache_key = jurisdiction.strip().lower()
    now_ts = time.time()
    cached = _BRIEF_CACHE.get(cache_key)
    if cached and now_ts - cached["timestamp"] < _BRIEF_CACHE_TTL:
        return _page(cached["response"], opportunity_limit, offset)

    city, state = parse_jurisdiction(jurisdiction)
    result = build_full_brief(jurisdiction, city, state)
    _BRIEF_CACHE[cache_key] = {"timestamp": time.time(), "response": result}
    return _page(result, opportunity_limit, offset)


