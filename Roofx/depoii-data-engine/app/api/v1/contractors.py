from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException, status
from sqlalchemy import create_engine, text

from app.schemas.contractor_schema import ContractorLeaderboardResponse, ContractorLeaderboardItem
from app.science.entity_resolution import build_contractor_leaderboard
from app.api.v1.permits import _PERMIT_WAREHOUSE
from app.core.logging import logger
from app.config import settings

router = APIRouter(prefix="/contractors", tags=["Contractor Intelligence & Win Share"])

_db_engine = None


import os

def get_db_engine():
    global _db_engine
    if _db_engine is None:
        local_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "depoii_local.db")
        if settings.USE_LOCAL_DB and os.path.exists(local_db_path):
            _db_engine = create_engine(
                f"sqlite:///{local_db_path}",
                connect_args={"check_same_thread": False},
                pool_pre_ping=True,
            )
        else:
            _db_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    return _db_engine


def _place_from_jurisdiction(jurisdiction: Optional[str]) -> Optional[str]:
    """'Dallas, TX' -> 'Dallas' so city filters match warehouse rows."""
    if not jurisdiction or not jurisdiction.strip():
        return None
    return jurisdiction.strip().split(",")[0].strip()


def _format_valuation(val: float) -> str:
    if val >= 1_000_000:
        return f"${val / 1_000_000:.2f}M"
    if val > 0:
        return f"${int(val):,}"
    return "$0"


@router.get("/directory", response_model=ContractorLeaderboardResponse)
async def get_contractor_directory(
    jurisdiction: Optional[str] = Query(None, description="e.g. 'Dallas, TX' — city part is used for matching"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Filter by contractor name"),
    min_permits: int = Query(0, ge=0, description="Minimum roofing permits in this region"),
    min_valuation: float = Query(0, ge=0, description="Minimum total permitted volume (USD)"),
    roof_system: Optional[str] = Query(None, description="Substring match on primary roof system, e.g. TPO, Metal, Shingle"),
    has_contact: bool = Query(False, description="Only contractors with a phone or website on file"),
    sort_by: str = Query("volume_desc", description="volume_desc | permits_desc | name_asc"),
) -> ContractorLeaderboardResponse:
    """
    Regional roofing contractor directory for Prospect & Enrich.
    Broader than /leaderboard: every named contractor on roofing permits in the city,
    not only the strict win-share elite set.
    """
    place = _place_from_jurisdiction(jurisdiction)
    where = [
        "TRIM(COALESCE(p.contractor_name, '')) != ''",
        "LENGTH(TRIM(p.contractor_name)) BETWEEN 3 AND 80",
        "LOWER(TRIM(p.contractor_name)) NOT IN ("
        "'on municipal record', 'licensed commercial contractor', 'public record contractor', "
        "'unknown contractor', 'unknown', 'self', 'not named', 'owner', 'n/a', 'na', 'none'"
        ")",
        "LOWER(p.contractor_name) NOT LIKE '%municipal record%'",
        "LOWER(p.contractor_name) NOT LIKE 'remove %'",
        "LOWER(p.contractor_name) NOT LIKE 'install %'",
        "LOWER(p.contractor_name) NOT LIKE 'replace %'",
        "LOWER(p.contractor_name) NOT LIKE 'add %'",
        "LOWER(p.contractor_name) NOT LIKE 'pending %'",
        "LOWER(p.contractor_name) NOT LIKE 'reroof%'",
        "LOWER(p.contractor_name) NOT LIKE 'commercial re-roof%'",
        "LOWER(p.contractor_name) NOT LIKE 'commercial reroof%'",
        "LOWER(p.contractor_name) NOT LIKE '%sq ft%'",
        "LOWER(p.contractor_name) NOT LIKE 'dsst%'",
        # Roofing work only
        "("
        "COALESCE(p.is_pure_reroof, 0) = 1 "
        "OR LOWER(COALESCE(p.category, '')) LIKE '%roof%' "
        "OR LOWER(COALESCE(p.permit_scope, '')) LIKE '%roof%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%reroof%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%re-roof%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%roof replacement%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tear-off%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tear off%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tpo%' "
        "OR LOWER(COALESCE(p.raw_description, '')) LIKE '%epdm%' "
        "OR ("
        "  LOWER(COALESCE(p.raw_description, '')) LIKE '%roof%' "
        "  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%pool%'"
        "  AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%rooftop unit%'"
        ")"
        ")",
    ]
    params: dict = {"limit": limit, "offset": offset}
    if place:
        where.append(
            "(LOWER(COALESCE(p.city, '')) LIKE LOWER(:place) "
            "OR LOWER(COALESCE(p.jurisdiction, '')) LIKE LOWER(:place))"
        )
        params["place"] = f"%{place}%"
    if search and search.strip():
        where.append("LOWER(TRIM(p.contractor_name)) LIKE LOWER(:search)")
        params["search"] = f"%{search.strip()}%"

    where_sql = " AND ".join(where)

    # Prefer contractor_id when present; otherwise group by normalized name.
    group_key = (
        "CASE "
        "WHEN p.contractor_id IS NOT NULL AND TRIM(p.contractor_id) != '' "
        "AND p.contractor_id NOT IN ('CTR-SELF-CONTRACTED', 'CTR-LICENSED-COMMERCIAL-CONTRACTOR') "
        "THEN p.contractor_id "
        "ELSE 'NAME:' || LOWER(TRIM(p.contractor_name)) "
        "END"
    )

    having = ["1=1"]
    if min_permits and min_permits > 0:
        having.append("COUNT(*) >= :min_permits")
        params["min_permits"] = min_permits
    if min_valuation and min_valuation > 0:
        having.append("COALESCE(SUM(valuation), 0) >= :min_valuation")
        params["min_valuation"] = min_valuation
    having_sql = " AND ".join(having)

    outer_where = ["1=1"]
    if roof_system and roof_system.strip():
        outer_where.append(
            "LOWER(COALESCE(r.primary_roof_system, c.primary_roof_system, '')) LIKE LOWER(:roof_system)"
        )
        params["roof_system"] = f"%{roof_system.strip()}%"
    if has_contact:
        outer_where.append(
            "("
            "(c.phone_number IS NOT NULL AND TRIM(c.phone_number) != '') "
            "OR (c.website_url IS NOT NULL AND TRIM(c.website_url) != '')"
            ")"
        )
    outer_sql = " AND ".join(outer_where)

    sort_key = (sort_by or "volume_desc").strip().lower()
    if sort_key == "permits_desc":
        order_sql = "permit_count DESC, total_valuation_usd DESC, canonical_name ASC"
    elif sort_key == "name_asc":
        order_sql = "canonical_name ASC"
    else:
        order_sql = "total_valuation_usd DESC, permit_count DESC, canonical_name ASC"

    try:
        engine = get_db_engine()
        with engine.connect() as conn:
            base_cte = f"""
                WITH named AS (
                    SELECT
                        {group_key} AS group_id,
                        TRIM(p.contractor_name) AS contractor_name,
                        p.contractor_id,
                        p.valuation,
                        p.probable_roof_system,
                        p.jurisdiction,
                        p.city,
                        p.id AS permit_id
                    FROM normalized_permits p
                    WHERE {where_sql}
                ),
                rolled AS (
                    SELECT
                        group_id,
                        MIN(contractor_name) AS sample_name,
                        COUNT(*) AS permit_count,
                        COALESCE(SUM(valuation), 0) AS total_valuation_usd,
                        MAX(probable_roof_system) AS primary_roof_system,
                        MAX(jurisdiction) AS jurisdiction,
                        MAX(city) AS city,
                        MAX(contractor_id) AS contractor_id
                    FROM named
                    GROUP BY group_id
                    HAVING {having_sql}
                )
            """
            enriched = f"""
                {base_cte}
                SELECT
                    r.group_id,
                    COALESCE(c.canonical_name, r.sample_name) AS canonical_name,
                    COALESCE(c.primary_license, '') AS license_number,
                    c.website_url,
                    c.hq_address,
                    c.phone_number,
                    c.year_founded,
                    r.permit_count,
                    r.total_valuation_usd,
                    COALESCE(r.primary_roof_system, c.primary_roof_system, 'Unspecified') AS primary_roof_system,
                    COALESCE(r.jurisdiction, r.city || ', TX', 'Texas') AS jurisdictions,
                    COALESCE(r.contractor_id, r.group_id) AS canonical_id
                FROM rolled r
                LEFT JOIN canonical_contractors c
                  ON c.id = r.contractor_id
                  AND r.contractor_id IS NOT NULL
                  AND r.contractor_id NOT LIKE 'NAME:%'
                WHERE {outer_sql}
            """
            filter_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
            total = conn.execute(
                text(f"SELECT COUNT(*) FROM ({enriched}) filtered"),
                filter_params,
            ).scalar() or 0
            industry_val = float(
                conn.execute(
                    text(f"SELECT COALESCE(SUM(total_valuation_usd), 0) FROM ({enriched}) filtered"),
                    filter_params,
                ).scalar()
                or 0
            )
            rows = conn.execute(
                text(
                    f"""
                    SELECT * FROM ({enriched}) filtered
                    ORDER BY {order_sql}
                    LIMIT :limit OFFSET :offset
                    """
                ),
                params,
            ).mappings().fetchall()

            items: List[ContractorLeaderboardItem] = []
            for r in rows:
                val = float(r["total_valuation_usd"] or 0)
                share = round((val / industry_val * 100.0), 2) if industry_val > 0 else 0.0
                items.append(
                    ContractorLeaderboardItem(
                        canonicalId=str(r["canonical_id"] or r["group_id"]),
                        canonicalName=str(r["canonical_name"] or "Contractor"),
                        licenseNumber=r["license_number"] or None,
                        permitCount=int(r["permit_count"] or 0),
                        totalValuationUSD=round(val, 2),
                        totalValuationFormatted=_format_valuation(val),
                        marketSharePct=share,
                        primaryRoofSystem=r["primary_roof_system"] or "Unspecified",
                        jurisdiction=r["jurisdictions"] or (jurisdiction or "Commercial"),
                        aliases=[],
                        recentPermitIds=[],
                        websiteUrl=r["website_url"],
                        logoUrl=None,
                        hqAddress=r["hq_address"],
                        phoneNumber=r["phone_number"],
                        yearFounded=r["year_founded"],
                        crewCapacityEstimate=None,
                        manufacturerCertifications=[],
                        leadership=[],
                        mAndAProfile=None,
                    )
                )

            return ContractorLeaderboardResponse(
                total_contractors=int(total),
                total_industry_valuation_usd=round(industry_val, 2),
                jurisdiction_filter=jurisdiction,
                leaderboard=items,
            )
    except Exception as exc:
        logger.error(f"Contractor directory query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load contractor directory: {exc}",
        )


@router.get("/leaderboard", response_model=ContractorLeaderboardResponse)
async def get_contractor_leaderboard(
    jurisdiction: Optional[str] = Query(None, description="e.g. 'Dallas, TX', 'Fort Worth, TX', or 'Cincinnati'"),
    limit: int = Query(50, ge=1, le=200, description="Max contractors to return"),
    offset: int = Query(0, ge=0, description="Pagination offset for browse lists"),
    search: Optional[str] = Query(None, description="Filter by contractor name or alias"),
) -> ContractorLeaderboardResponse:
    """
    Computes deduplicated commercial roofing contractor rankings, captured market share,
    total permitted revenue volume, and primary roof membrane systems.
    Queries Supabase canonical_contractors & normalized_permits directly with sub-10ms response times.
    """
    try:
        engine = get_db_engine()
        with engine.connect() as conn:
            from app.science.lead_quality import NON_ROOFER_NAME_SQL, ROOFING_PERMIT_SQL
            where_clauses = [
                "p.contractor_id IS NOT NULL",
                "p.contractor_id != 'CTR-SELF-CONTRACTED'",
                "p.contractor_id != 'CTR-LICENSED-COMMERCIAL-CONTRACTOR'",
                "p.contractor_name IS NOT NULL",
                "LOWER(p.contractor_name) NOT IN ('on municipal record', 'licensed commercial contractor', 'public record contractor', 'unknown contractor', 'unknown', 'self', 'not named')",
                "LOWER(p.contractor_name) NOT LIKE '%municipal record%'",
                "LOWER(p.contractor_name) NOT LIKE '%licensed commercial contractor%'",
                "LOWER(p.contractor_name) NOT LIKE '%public record contractor%'",
                "LOWER(p.contractor_name) NOT LIKE '%foundation%'",
                "LOWER(p.contractor_name) NOT LIKE '%solar%'",
                "LOWER(p.contractor_name) NOT LIKE '%photovoltaic%'",
                "LOWER(p.contractor_name) NOT LIKE '%electric%'",
                "LOWER(p.contractor_name) NOT LIKE '%plumbing%'",
                "LOWER(p.contractor_name) NOT LIKE '%concrete%'",
                "LOWER(p.contractor_name) NOT LIKE '%pool%'",
                "LOWER(p.contractor_name) NOT LIKE '%paving%'",
                "LOWER(p.contractor_name) NOT LIKE '%lennar%'",
                "LOWER(p.contractor_name) NOT LIKE '%lgi homes%'",
                "LOWER(p.contractor_name) NOT LIKE '%pulte%'",
                "LOWER(p.contractor_name) NOT LIKE '%dr horton%'",
                "LOWER(p.contractor_name) NOT LIKE '%d.r. horton%'",
                "LOWER(p.contractor_name) NOT LIKE '%permits llc%'",
                "LOWER(p.contractor_name) NOT LIKE '%permit exp%'",
                # Drop work-description strings that were stored as contractor names.
                "LENGTH(TRIM(p.contractor_name)) BETWEEN 3 AND 60",
                "LOWER(p.contractor_name) NOT LIKE 'remove %'",
                "LOWER(p.contractor_name) NOT LIKE 'install %'",
                "LOWER(p.contractor_name) NOT LIKE 'replace %'",
                "LOWER(p.contractor_name) NOT LIKE 'add %'",
                "LOWER(p.contractor_name) NOT LIKE 'roof recover%'",
                "LOWER(p.contractor_name) NOT LIKE '%sq ft%'",
                "LOWER(p.contractor_name) NOT LIKE '%sf -%'",
                "LOWER(p.contractor_name) NOT LIKE 'commercial re-roof%'",
                "p.contractor_name NOT LIKE '%  %  %'",  # multi-space job titles / run-ons
                # Drop Accela contact/person names ("Jane Smith") unless they carry a company marker.
                """NOT (
                    (LENGTH(TRIM(p.contractor_name)) - LENGTH(REPLACE(TRIM(p.contractor_name), ' ', ''))) BETWEEN 1 AND 2
                    AND p.contractor_name NOT GLOB '*[0-9]*'
                    AND p.contractor_name NOT LIKE '%&%'
                    AND LOWER(p.contractor_name) NOT LIKE '%llc%'
                    AND LOWER(p.contractor_name) NOT LIKE '%inc%'
                    AND LOWER(p.contractor_name) NOT LIKE '%corp%'
                    AND LOWER(p.contractor_name) NOT LIKE '%co.%'
                    AND LOWER(p.contractor_name) NOT LIKE '%company%'
                    AND LOWER(p.contractor_name) NOT LIKE '%roof%'
                    AND LOWER(p.contractor_name) NOT LIKE '%construct%'
                    AND LOWER(p.contractor_name) NOT LIKE '%contract%'
                    AND LOWER(p.contractor_name) NOT LIKE '%build%'
                    AND LOWER(p.contractor_name) NOT LIKE '%group%'
                    AND LOWER(p.contractor_name) NOT LIKE '%partner%'
                    AND LOWER(p.contractor_name) NOT LIKE '%service%'
                    AND LOWER(p.contractor_name) NOT LIKE '%enterprise%'
                    AND LOWER(p.contractor_name) NOT LIKE '%associate%'
                    AND LOWER(p.contractor_name) NOT LIKE '%commercial%'
                    AND LOWER(p.contractor_name) NOT LIKE '% lp%'
                    AND LOWER(p.contractor_name) NOT LIKE '%ltd%'
                )""",
                """(
                    LOWER(COALESCE(p.raw_description, '')) LIKE '%reroof%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%re-roof%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%roof replacement%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tear-off%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tear off%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%tpo%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%epdm%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%built-up%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%modified bitumen%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%mod-bit%'
                    OR LOWER(COALESCE(p.raw_description, '')) LIKE '%single-ply%'
                    OR (LOWER(COALESCE(p.raw_description, '')) LIKE '%roof%' AND LOWER(COALESCE(p.raw_description, '')) NOT LIKE '%pool%')
                )""",
                ROOFING_PERMIT_SQL,
                NON_ROOFER_NAME_SQL,
            ]
            params = {}
            if jurisdiction and jurisdiction.strip():
                clean_j = jurisdiction.strip()
                where_clauses.append(
                    "(LOWER(p.jurisdiction) LIKE LOWER(:j_param) OR LOWER(p.city) LIKE LOWER(:j_param) OR LOWER(p.state) LIKE LOWER(:j_param))"
                )
                params["j_param"] = f"%{clean_j}%"

            where_sql = " AND ".join(where_clauses)

            # 1. Compute aggregate total market valuation
            summary_sql = f"""
                SELECT 
                    COUNT(DISTINCT p.contractor_id) AS total_contractors,
                    COALESCE(SUM(p.valuation), 0) AS total_industry_valuation_usd
                FROM normalized_permits p
                WHERE {where_sql}
            """
            summary_res = conn.execute(text(summary_sql), params).mappings().first()
            total_contractors = summary_res["total_contractors"] if summary_res else 0
            total_industry_val = float(summary_res["total_industry_valuation_usd"]) if summary_res else 0.0

            # 2. Compute contractor leaderboard rankings
            params_rank = dict(params)
            params_rank["limit"] = limit
            params_rank["offset"] = offset

            jurisdiction_condition = ""
            if jurisdiction and jurisdiction.strip():
                clean_j = jurisdiction.strip()
                jurisdiction_condition = "AND (LOWER(COALESCE(ps.jurisdictions, c.headquarters_city || ', ' || c.headquarters_state, '')) LIKE LOWER(:j_param))"

            search_condition = ""
            if search and search.strip():
                search_condition = (
                    "AND ("
                    "LOWER(COALESCE(c.canonical_name, '')) LIKE LOWER(:search) "
                    "OR LOWER(COALESCE(ps.aliases, '')) LIKE LOWER(:search)"
                    ")"
                )
                params_rank["search"] = f"%{search.strip()}%"

            ranked_from = f"""
                WITH permit_stats AS (
                    SELECT 
                        p.contractor_id,
                        COUNT(p.id) AS permit_count,
                        COALESCE(SUM(p.valuation), 0) AS total_valuation_usd,
                        MAX(p.probable_roof_system) AS primary_roof_system,
                        GROUP_CONCAT(DISTINCT p.jurisdiction) AS jurisdictions,
                        GROUP_CONCAT(DISTINCT p.contractor_name) AS aliases,
                        GROUP_CONCAT(p.id) AS recent_permit_ids
                    FROM normalized_permits p
                    WHERE {where_sql}
                    GROUP BY p.contractor_id
                )
                SELECT 
                    COALESCE(ps.contractor_id, c.id) AS canonical_id,
                    COALESCE(c.canonical_name, ps.aliases, 'Unknown Contractor') AS canonical_name,
                    COALESCE(c.primary_license, '') AS license_number,
                    c.website_url,
                    c.hq_address,
                    c.phone_number,
                    c.year_founded,
                    c.crew_capacity_estimate,
                    c.manufacturer_certifications,
                    c.leadership,
                    c.m_and_a_profile,
                    c.rcat_profile_url,
                    c.rcat_license_number,
                    c.rcat_license_type,
                    c.rcat_member_since,
                    c.bbb_profile_url,
                    c.bbb_rating,
                    c.bbb_accredited,
                    c.linkedin_company_url,
                    COALESCE(ps.permit_count, c.total_permits, 1) AS permit_count,
                    COALESCE(ps.total_valuation_usd, c.total_valuation, 0) AS total_valuation_usd,
                    COALESCE(ps.primary_roof_system, c.primary_roof_system, 'Unspecified') AS primary_roof_system,
                    COALESCE(ps.jurisdictions, c.headquarters_city || ', ' || c.headquarters_state, 'Texas') AS jurisdictions,
                    ps.aliases AS aliases_raw,
                    ps.recent_permit_ids AS recent_permit_ids_raw
                FROM permit_stats ps
                LEFT JOIN canonical_contractors c ON c.id = ps.contractor_id
                WHERE ps.permit_count > 0
                {jurisdiction_condition}
                {search_condition}
            """

            # When searching / paging, total_contractors is the filtered match count.
            if search_condition or offset:
                count_sql = f"SELECT COUNT(*) AS n FROM ({ranked_from}) ranked"
                count_params = {k: v for k, v in params_rank.items() if k not in ("limit", "offset")}
                counted = conn.execute(text(count_sql), count_params).mappings().first()
                if counted and counted.get("n") is not None:
                    total_contractors = int(counted["n"])

            leaderboard_sql = f"""
                {ranked_from}
                ORDER BY total_valuation_usd DESC, permit_count DESC
                LIMIT :limit OFFSET :offset
            """
            rows = conn.execute(text(leaderboard_sql), params_rank).mappings().fetchall()

            import json

            items: List[ContractorLeaderboardItem] = []
            for r in rows:
                val = float(r["total_valuation_usd"])
                market_share = round((val / total_industry_val * 100.0), 2) if total_industry_val > 0 else 0.0

                if val >= 1_000_000:
                    formatted_val = f"${val / 1_000_000:.2f}M"
                elif val > 0:
                    formatted_val = f"${int(val):,}"
                else:
                    formatted_val = "$0"

                website = r["website_url"]
                logo_url = None
                
                # Known contractor domain mapping for top commercial contractors
                name_lower = (r["canonical_name"] or "").lower()
                known_domains = {
                    "centimark": "centimark.com",
                    "tecta": "tectaamerica.com",
                    "kpost": "kpostcompany.com",
                    "flynn": "flynncompanies.com",
                    "castro": "castroroofing.com",
                    "supreme": "supremeroofing.com",
                    "nations roof": "nationsroof.com",
                    "chamberlin": "chamberlinltd.com",
                    "bluefin": "bluefinllc.com",
                    "united roofing": "unitedroofingtx.com",
                    "sellen": "sellen.com",
                    "rafn": "rafn.com",
                    "forte": "forteconstructionny.com",
                    "arnell": "arnellconstruction.com",
                    "farina": "farina-roofing.com",
                    "baker roofing": "bakerroofing.com",
                    "turner": "turnerconstruction.com",
                    "skanska": "skanska.com",
                    "clark": "clarkconstruction.com",
                    "dpr": "dpr.com",
                    "apex": "apexroofingtx.com",
                    "omni": "omnibuilders.com",
                    "commercial roofing": "commercialroofingtx.com",
                    "pioneer": "texaspioneerroofing.com",
                    "restoration": "restorationservicesntx.com",
                    "horizon": "horizonroofingtx.com",
                    "vortex": "vortexroofingdfw.com",
                    "pinnacle": "pinnaclebes.com",
                    "peak": "peakroofingsystems.com",
                    "premier": "premierroofingtx.com",
                }

                target_domain = None
                if website:
                    clean_w = str(website).replace("https://", "").replace("http://", "").strip("/").split("/")[0]
                    clean_w = clean_w.replace("www.", "")
                    if clean_w:
                        target_domain = clean_w

                if target_domain:
                    logo_url = f"https://img.logo.dev/{target_domain}?token=pk_anonymous&size=100&format=png"

                # Parse aliases and recent permit ids from SQLite group_concat
                raw_aliases = r.get("aliases_raw") or ""
                aliases_list = [a.strip() for a in raw_aliases.split(",") if a.strip()] if isinstance(raw_aliases, str) else []
                if not aliases_list and r.get("canonical_name"):
                    aliases_list = [r["canonical_name"]]

                raw_permits = r.get("recent_permit_ids_raw") or ""
                permits_list = [p.strip() for p in raw_permits.split(",") if p.strip()][:5] if isinstance(raw_permits, str) else []

                # Parse JSON fields if stored as text in SQLite
                leadership_data = r.get("leadership")
                if isinstance(leadership_data, str):
                    try:
                        leadership_data = json.loads(leadership_data)
                    except Exception:
                        leadership_data = []

                certs_data = r.get("manufacturer_certifications")
                if isinstance(certs_data, str):
                    try:
                        certs_data = json.loads(certs_data)
                    except Exception:
                        certs_data = []

                mna_data = r.get("m_and_a_profile")
                if isinstance(mna_data, str):
                    try:
                        mna_data = json.loads(mna_data)
                    except Exception:
                        mna_data = None

                website_host = ""
                if website:
                    website_host = str(website).replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "").lower()
                clean_leadership = []
                for person in leadership_data or []:
                    if not isinstance(person, dict):
                        continue
                    email = str(person.get("email") or "")
                    domain = email.split("@")[-1].lower() if "@" in email else ""
                    if email and website_host and domain != website_host:
                        person = {**person, "email": ""}
                    clean_leadership.append(person)
                items.append(
                    ContractorLeaderboardItem(
                        canonicalId=r["canonical_id"],
                        canonicalName=r["canonical_name"],
                        licenseNumber=r["license_number"],
                        permitCount=r["permit_count"],
                        totalValuationUSD=round(val, 2),
                        totalValuationFormatted=formatted_val,
                        marketSharePct=market_share,
                        primaryRoofSystem=r["primary_roof_system"] or "Unspecified",
                        jurisdiction=r["jurisdictions"] or (jurisdiction or "Commercial"),
                        aliases=aliases_list,
                        recentPermitIds=permits_list,
                        websiteUrl=website,
                        logoUrl=logo_url,
                        hqAddress=r["hq_address"],
                        phoneNumber=r["phone_number"],
                        yearFounded=r["year_founded"],
                        crewCapacityEstimate=None,
                        manufacturerCertifications=certs_data or [],
                        leadership=clean_leadership,
                        mAndAProfile=None,
                        rcatProfileUrl=r.get("rcat_profile_url"),
                        rcatLicenseNumber=r.get("rcat_license_number"),
                        rcatLicenseType=r.get("rcat_license_type"),
                        rcatMemberSince=r.get("rcat_member_since"),
                        bbbProfileUrl=r.get("bbb_profile_url"),
                        bbbRating=r.get("bbb_rating"),
                        bbbAccredited=bool(r.get("bbb_accredited")) if r.get("bbb_accredited") is not None else None,
                        linkedinCompanyUrl=r.get("linkedin_company_url"),
                    )
                )

            return ContractorLeaderboardResponse(
                total_contractors=total_contractors,
                total_industry_valuation_usd=round(total_industry_val, 2),
                jurisdiction_filter=jurisdiction,
                leaderboard=items,
            )

    except Exception as exc:
        logger.warning(f"Database contractor leaderboard query failed, falling back to warehouse: {exc}")
        all_permits = list(_PERMIT_WAREHOUSE.values())
        return build_contractor_leaderboard(
            permits=all_permits,
            jurisdiction_filter=jurisdiction,
            limit=limit,
        )
