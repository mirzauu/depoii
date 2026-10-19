from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel

from app.core.logging import logger
from app.extraction.tarrant_parcel_client import TarrantParcelClient
from app.extraction.dallas_parcel_client import DallasParcelClient
from app.science.lead_quality import money_text, owner_mailing_line, stored_number
from app.science.parcel_seed import SEED_COMMERCIAL_PARCELS

router = APIRouter(prefix="/parcels", tags=["Commercial Property Parcels"])

_db_engine = None

def get_db_engine():
    global _db_engine
    if _db_engine is None:
        import os
        from app.config import settings
        from sqlalchemy import create_engine
        local_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "depoii_local.db")
        if settings.USE_LOCAL_DB and os.path.exists(local_db_path):
            _db_engine = create_engine(
                f"sqlite:///{local_db_path}",
                connect_args={"check_same_thread": False},
                pool_pre_ping=True,
            )
        else:
            _db_engine = create_engine(
                settings.SYNC_DATABASE_URL,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                connect_args={"connect_timeout": 3},
            )
    return _db_engine

_tarrant_client = TarrantParcelClient()
_dallas_client = DallasParcelClient()
_PARCEL_CACHE: Dict[str, Dict[str, Any]] = {p["id"]: p for p in SEED_COMMERCIAL_PARCELS}


class ParcelResponse(BaseModel):
    id: str
    address: str
    city: str
    county: str
    state: str
    zip_code: str
    building_sqft: Optional[int] = None
    land_sqft: Optional[float] = None
    year_built: Optional[int] = None
    property_type: str
    owner_name: str
    total_valuation: Optional[float] = None
    data_source: Optional[str] = None
    latitude: float
    longitude: float


class ParcelListResponse(BaseModel):
    total: int
    source: str
    parcels: List[ParcelResponse]


@router.get("/tarrant", response_model=ParcelListResponse)
async def get_tarrant_parcels(
    min_sqft: int = Query(20000, description="Minimum building square footage"),
    city: Optional[str] = Query(None, description="Filter city (e.g., 'Fort Worth', 'Arlington')"),
    limit: int = Query(50, ge=1, le=200, description="Maximum parcels to return"),
) -> ParcelListResponse:
    """
    Harvests live commercial building parcels directly from Tarrant Appraisal District (TAD)
    ESRI ArcGIS REST MapServer at $0 external API cost.
    """
    try:
        results = await _tarrant_client.fetch_commercial_parcels(
            min_sqft=min_sqft,
            city_filter=city,
            limit=limit,
        )
        # Cache for spatial searches
        for p in results:
            _PARCEL_CACHE[p["id"]] = p

        return ParcelListResponse(
            total=len(results),
            source="Tarrant Appraisal District (ESRI ArcGIS REST)",
            parcels=results,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed querying Tarrant County GIS: {str(e)}",
        )


@router.get("/dallas", response_model=ParcelListResponse)
async def get_dallas_parcels(
    min_sqft: int = Query(20000, description="Minimum building square footage"),
    city: Optional[str] = Query(None, description="Filter city (e.g., 'Dallas', 'Addison', 'Irving')"),
    limit: int = Query(50, ge=1, le=200, description="Maximum parcels to return"),
) -> ParcelListResponse:
    """
    Harvests live commercial building parcels directly from Dallas Central Appraisal District (DCAD)
    ESRI ArcGIS REST FeatureServer at $0 external API cost.
    """
    try:
        results = await _dallas_client.fetch_commercial_parcels(
            min_sqft=min_sqft,
            city_filter=city,
            limit=limit,
        )
        for p in results:
            _PARCEL_CACHE[p["id"]] = p

        return ParcelListResponse(
            total=len(results),
            source="Dallas Central Appraisal District (ESRI ArcGIS REST)",
            parcels=results,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed querying Dallas County GIS: {str(e)}",
        )


@router.get("", response_model=ParcelListResponse)
@router.get("/search", response_model=ParcelListResponse)
async def search_parcels(
    city: Optional[str] = Query(None, description="City filter (e.g. 'Dallas', 'Fort Worth', 'Arlington')"),
    county: Optional[str] = Query(None, description="County filter (e.g. 'Dallas County', 'Tarrant County')"),
    min_sqft: int = Query(20000, description="Minimum building sqft"),
    source: Optional[str] = Query(None, description="Data source filter (e.g. 'TAD' or 'DCAD')"),
    limit: int = Query(50, ge=1, le=200),
) -> ParcelListResponse:
    """
    Unified Commercial Property Parcel search directly from Supabase PostgreSQL.
    Searches across all appraisal districts (DCAD, TAD, etc.) with city, county, and size filters.
    """
    city_str = city if isinstance(city, str) else None
    county_str = county if isinstance(county, str) else None
    source_str = source if isinstance(source, str) else None
    min_sqft_val = min_sqft if isinstance(min_sqft, int) else 20000
    limit_val = limit if isinstance(limit, int) else 50

    # Try querying Supabase database first
    try:
        from sqlalchemy import text
        engine = get_db_engine()
        with engine.connect() as conn:
            where_clauses = ["(building_sqft >= :min_sqft OR land_sqft >= :min_sqft)", "COALESCE(is_mock, 0) = 0"]
            params: Dict[str, Any] = {"min_sqft": min_sqft_val, "limit": limit_val}

            if city_str:
                where_clauses.append("UPPER(city) LIKE :city")
                params["city"] = f"%{city_str.upper()}%"
            if county_str:
                where_clauses.append("UPPER(county) LIKE :county")
                params["county"] = f"%{county_str.upper()}%"
            if source_str:
                where_clauses.append("UPPER(data_source) LIKE :source")
                params["source"] = f"%{source_str.upper()}%"

            is_sqlite = "sqlite" in str(engine.url)
            lat_expr = "latitude" if is_sqlite else "ST_Y(geom_point) as latitude"
            lon_expr = "longitude" if is_sqlite else "ST_X(geom_point) as longitude"
            order_expr = "total_valuation DESC" if is_sqlite else "total_valuation DESC NULLS LAST"
            where_clauses.append("id IN (SELECT parcel_id FROM released_leads WHERE state = 'TX')")
            where_clauses.append("latitude IS NOT NULL AND longitude IS NOT NULL")

            query_sql = f"""
                SELECT 
                    id, address, city, COALESCE(county, 'Dallas County') as county,
                    state, zip_code, building_sqft, land_sqft, year_built,
                    property_type, owner_name, total_valuation, data_source,
                    {lat_expr}, {lon_expr}
                FROM parcels
                WHERE {' AND '.join(where_clauses)}
                ORDER BY {order_expr}, building_sqft DESC
                LIMIT :limit;
            """
            rows = conn.execute(text(query_sql), params).mappings().fetchall()

            if rows:
                parcels = [ParcelResponse(**dict(r)) for r in rows]
                return ParcelListResponse(
                    total=len(parcels),
                    source="Supabase PostgreSQL Commercial Parcel Warehouse (DFW Metro)",
                    parcels=parcels,
                )
    except Exception as e:
        logger.warning(f"[ParcelsAPI] released lead search failed ({e}).")
        return ParcelListResponse(total=0, source="released_leads", parcels=[])


@router.get("/dark-market/overdue")
async def get_dark_market_overdue_parcels(
    min_age: int = Query(15, description="Minimum building roof age in years"),
    min_sqft: int = Query(20000, description="Minimum building square footage"),
    limit: int = Query(50, ge=1, le=200, description="Maximum parcels to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    jurisdiction: Optional[str] = Query(None, description="City, ST. Limits the list to that city."),
    include_public: bool = Query(False, description="Include cities, schools, and churches."),
):
    """
    A missing permit join is not evidence that no permit exists.
    This list stays empty until permit recall is measured.
    """
    _ = (min_age, min_sqft, limit, offset, jurisdiction, include_public)
    return {
        "total": 0,
        "count": 0,
        "minAge": min_age,
        "minSqft": min_sqft,
        "limit": limit,
        "offset": offset,
        "overdueParcels": [],
    }

    from app.api.v1.permits import get_db_engine  # noqa: F401
    from sqlalchemy import text
    from datetime import datetime, timezone
    try:
        current_year = datetime.now(timezone.utc).year
        cutoff_year = current_year - min_age

        engine = get_db_engine()
        city_name = (jurisdiction or "").split(",")[0].strip().lower()
        hygiene = """
              AND LOWER(COALESCE(pa.address, '')) NOT LIKE '%no name%'
              AND pa.address NOT LIKE '0 %'
              AND pa.id IN (SELECT MIN(id) FROM parcels GROUP BY LOWER(address), LOWER(city))
              AND (
                pa.zip_code IS NULL OR length(pa.zip_code) < 5
                OR (
                  (LOWER(pa.city) NOT LIKE '%rowlett%' OR pa.zip_code LIKE '750%')
                  AND (LOWER(pa.city) NOT LIKE '%richardson%' OR pa.zip_code LIKE '750%')
                  AND (LOWER(pa.city) NOT LIKE '%garland%' OR pa.zip_code LIKE '750%')
                  AND (LOWER(pa.city) NOT LIKE '%addison%' OR pa.zip_code LIKE '750%')
                  AND (LOWER(pa.city) NOT LIKE '%grapevine%' OR pa.zip_code LIKE '760%')
                  AND (LOWER(pa.city) NOT LIKE '%dallas%' OR pa.zip_code LIKE '752%')
                  AND (LOWER(pa.city) NOT LIKE '%fort worth%' OR pa.zip_code LIKE '761%' OR pa.zip_code LIKE '760%')
                )
              )
        """
        if city_name:
            hygiene += " AND (LOWER(pa.city) LIKE :city OR LOWER(COALESCE(pa.jurisdiction, '')) LIKE :city)"
        if not include_public:
            hygiene += """
              AND UPPER(COALESCE(pa.owner_name, '')) NOT LIKE '%CITY OF%'
              AND UPPER(COALESCE(pa.owner_name, '')) NOT LIKE '% ISD%'
              AND UPPER(COALESCE(pa.owner_name, '')) NOT LIKE '%SCHOOL%'
              AND UPPER(COALESCE(pa.owner_name, '')) NOT LIKE '%UNIVERSITY%'
              AND UPPER(COALESCE(pa.owner_name, '')) NOT LIKE '%CHURCH%'
              AND UPPER(COALESCE(pa.owner_name, '')) NOT LIKE '%AUTHORITY%'
            """
        params = {"cutoff_year": cutoff_year, "min_sqft": min_sqft}
        if city_name:
            params["city"] = f"%{city_name}%"
        with engine.connect() as conn:
            count_sql = text(f"""
                SELECT COUNT(DISTINCT pa.id)
                FROM parcels pa
                LEFT JOIN normalized_permits p ON pa.id = p.parcel_id
                WHERE pa.year_built IS NOT NULL 
                  AND pa.year_built <= :cutoff_year
                  AND pa.building_sqft >= :min_sqft
                  AND p.id IS NULL
                  AND COALESCE(pa.is_mock, 0) = 0
                  {hygiene}
            """)
            total_count = conn.execute(count_sql, params).scalar() or 0

            fetch_sql = text(f"""
                SELECT 
                    pa.id, pa.account_number, pa.jurisdiction, pa.address, pa.city,
                    pa.state, pa.zip_code, pa.building_sqft, pa.year_built, pa.property_type,
                    pa.owner_name, pa.owner_address, pa.owner_city, pa.owner_state, pa.owner_zip,
                    pa.total_valuation, pa.improvement_valuation, pa.data_source,
                    pa.latitude, pa.longitude
                FROM parcels pa
                LEFT JOIN normalized_permits p ON pa.id = p.parcel_id
                WHERE pa.year_built IS NOT NULL 
                  AND pa.year_built <= :cutoff_year
                  AND pa.building_sqft >= :min_sqft
                  AND p.id IS NULL
                  AND COALESCE(pa.is_mock, 0) = 0
                  {hygiene}
                ORDER BY pa.building_sqft DESC, pa.year_built ASC
                LIMIT :limit OFFSET :offset
            """)
            page_params = dict(params)
            page_params["limit"] = limit
            page_params["offset"] = offset
            rows = conn.execute(fetch_sql, page_params).mappings().fetchall()

            overdue_list = []
            this_year = datetime.now().year
            for r in rows:
                year_built = stored_number(r["year_built"])
                building_sqft = stored_number(r["building_sqft"])
                roof_age = this_year - int(year_built) if year_built and year_built > 1800 else None
                overdue_list.append({
                    "parcelId": r["id"],
                    "address": r["address"],
                    "city": r["city"],
                    "state": r["state"],
                    "zipCode": r["zip_code"],
                    "jurisdiction": r["jurisdiction"],
                    "buildingSqft": building_sqft,
                    "buildingSqftFormatted": f"{int(building_sqft):,}" if building_sqft else None,
                    "yearBuilt": year_built,
                    "roofAgeYears": roof_age,
                    "urgency": None,
                    "ownerName": r["owner_name"],
                    "ownerMail": owner_mailing_line(r["owner_address"], r["owner_city"], r["owner_state"], r["owner_zip"]),
                    "propertyType": r["property_type"],
                    "estimatedReroofValuation": None,
                    "estimatedReroofValuationFormatted": None,
                    "totalPropertyValuation": stored_number(r["total_valuation"]),
                    "permitCount": 0,
                    "hasPermitHistory": False,
                    "outreachAngle": "Roof age and roof area are not on the release record.",
                    "dataSource": r["data_source"],
                })

            return {
                "total": total_count,
                "count": len(overdue_list),
                "minAge": min_age,
                "minSqft": min_sqft,
                "limit": limit,
                "offset": offset,
                "overdueParcels": overdue_list,
            }
    except Exception as e:
        logger.error(f"Error fetching dark market overdue parcels: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query overdue parcels: {str(e)}"
        )


class BrowseParcelItem(BaseModel):
    id: str
    address: str
    city: str
    county: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    building_sqft: Optional[int] = None
    land_sqft: Optional[float] = None
    year_built: Optional[int] = None
    property_type: Optional[str] = None
    owner_name: Optional[str] = None
    owner_address: Optional[str] = None
    stories: Optional[float] = None
    total_valuation: Optional[float] = None
    data_source: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    released: bool = False


class BrowseParcelListResponse(BaseModel):
    total: int
    source: str
    parcels: List[BrowseParcelItem]


class BrowsePermitItem(BaseModel):
    id: str
    permit_number: str
    issue_date: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    valuation: Optional[float] = None
    valuation_formatted: Optional[str] = None
    description: Optional[str] = None
    contractor_name: Optional[str] = None
    contractor_phone: Optional[str] = None
    contractor_license: Optional[str] = None
    roof_system: Optional[str] = None
    is_pure_reroof: bool = False
    source_system: Optional[str] = None
    match: str = "parcel_id"  # parcel_id | address


class BrowseSourceLink(BaseModel):
    label: str
    url: str
    system: Optional[str] = None


class BrowseContact(BaseModel):
    role: str
    name: str
    phone: Optional[str] = None
    license: Optional[str] = None
    address: Optional[str] = None
    note: Optional[str] = None


class BrowseParcelDetail(BrowseParcelItem):
    account_number: Optional[str] = None
    owner_city: Optional[str] = None
    owner_state: Optional[str] = None
    owner_zip: Optional[str] = None
    improvement_valuation: Optional[float] = None
    improvement_sections: Optional[str] = None
    last_reroof_date: Optional[str] = None
    last_reroof_permit_no: Optional[str] = None
    permits: List[BrowsePermitItem] = []
    permit_count: int = 0
    contacts: List[BrowseContact] = []
    sources: List[BrowseSourceLink] = []
    maps_url: Optional[str] = None
    cad_url: Optional[str] = None
    permit_portal_url: Optional[str] = None


def _city_from_jurisdiction(jurisdiction: Optional[str], city: Optional[str]) -> Optional[str]:
    raw = (city or jurisdiction or "").strip()
    if not raw:
        return None
    return raw.split(",")[0].strip()


def _browse_class_clause(property_class: str, alias: str = "") -> str:
    """Commercial/industrial improvements only; never vacant lots."""
    col = f"{alias}.property_type" if alias else "property_type"
    base = f"UPPER(COALESCE({col}, '')) NOT LIKE '%VACANT%'"
    key = (property_class or "all").strip().lower()
    if key == "commercial":
        return f"{base} AND UPPER(COALESCE({col}, '')) LIKE '%COMMERCIAL%IMPROVEMENT%'"
    if key == "industrial":
        return f"{base} AND UPPER(COALESCE({col}, '')) LIKE '%INDUSTRIAL%IMPROVEMENT%'"
    return (
        f"{base} AND ("
        f"UPPER(COALESCE({col}, '')) LIKE '%COMMERCIAL%IMPROVEMENT%' "
        f"OR UPPER(COALESCE({col}, '')) LIKE '%INDUSTRIAL%IMPROVEMENT%'"
        ")"
    )


def _browse_sort(sort_by: str, alias: str = "") -> str:
    p = f"{alias}." if alias else ""
    key = (sort_by or "sqft_desc").strip().lower()
    if key == "year_asc":
        return (
            f"CASE WHEN {p}year_built IS NULL OR {p}year_built = 0 THEN 1 ELSE 0 END, "
            f"{p}year_built ASC, {p}building_sqft DESC"
        )
    if key == "address_asc":
        return f"LOWER(COALESCE({p}address, '')) ASC"
    return f"COALESCE({p}building_sqft, 0) DESC, LOWER(COALESCE({p}address, '')) ASC"


def _row_to_browse_item(row: Dict[str, Any], released: bool = False) -> BrowseParcelItem:
    def as_int(value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    def as_float(value: Any) -> Optional[float]:
        if value is None or value == "":
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    return BrowseParcelItem(
        id=str(row.get("id") or ""),
        address=str(row.get("address") or ""),
        city=str(row.get("city") or ""),
        county=row.get("county"),
        state=row.get("state"),
        zip_code=str(row.get("zip_code") or "") or None,
        building_sqft=as_int(row.get("building_sqft")),
        land_sqft=as_float(row.get("land_sqft")),
        year_built=as_int(row.get("year_built")),
        property_type=row.get("property_type"),
        owner_name=row.get("owner_name"),
        owner_address=row.get("owner_address"),
        stories=as_float(row.get("stories")),
        total_valuation=as_float(row.get("total_valuation")),
        data_source=row.get("data_source"),
        latitude=as_float(row.get("latitude")),
        longitude=as_float(row.get("longitude")),
        released=released,
    )


@router.get("/browse", response_model=BrowseParcelListResponse)
async def browse_parcels(
    jurisdiction: Optional[str] = Query(None, description="City, ST from the app city selector"),
    city: Optional[str] = Query(None, description="City filter override"),
    property_class: str = Query("all", description="all | commercial | industrial"),
    min_sqft: int = Query(0, ge=0, description="Minimum building square footage"),
    max_sqft: Optional[int] = Query(None, ge=0, description="Maximum building square footage"),
    min_year: Optional[int] = Query(None, description="Minimum year built"),
    max_year: Optional[int] = Query(None, description="Maximum year built"),
    search: Optional[str] = Query(None, description="Address or owner search"),
    sort_by: str = Query("sqft_desc", description="sqft_desc | year_asc | address_asc"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> BrowseParcelListResponse:
    """
    County appraisal inventory for commercial/industrial improvements.
    Not gated by released_leads — this is browse inventory, not the opportunity pipeline.
    """
    from sqlalchemy import text

    place = _city_from_jurisdiction(jurisdiction, city)
    where = [
        "COALESCE(p.is_mock, 0) = 0",
        _browse_class_clause(property_class, alias="p"),
    ]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if place:
        where.append("UPPER(COALESCE(p.city, '')) LIKE :city")
        params["city"] = f"%{place.upper()}%"
    if min_sqft and min_sqft > 0:
        where.append("COALESCE(p.building_sqft, 0) >= :min_sqft")
        params["min_sqft"] = min_sqft
    if max_sqft is not None:
        where.append("COALESCE(p.building_sqft, 0) <= :max_sqft")
        params["max_sqft"] = max_sqft
    if min_year is not None:
        where.append("COALESCE(p.year_built, 0) >= :min_year")
        params["min_year"] = min_year
    if max_year is not None:
        where.append(
            "COALESCE(p.year_built, 0) <= :max_year AND p.year_built IS NOT NULL AND p.year_built > 0"
        )
        params["max_year"] = max_year
    if search and search.strip():
        where.append(
            "(UPPER(COALESCE(p.address, '')) LIKE :q OR UPPER(COALESCE(p.owner_name, '')) LIKE :q)"
        )
        params["q"] = f"%{search.strip().upper()}%"

    where_sql = " AND ".join(where)
    order_sql = _browse_sort(sort_by, alias="p")
    filter_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}

    try:
        engine = get_db_engine()
        with engine.connect() as conn:
            total = conn.execute(
                text(f"SELECT COUNT(*) FROM parcels p WHERE {where_sql}"),
                filter_params,
            ).scalar() or 0
            rows = conn.execute(
                text(
                    f"""
                    SELECT
                        p.id, p.address, p.city, p.county, p.state, p.zip_code,
                        p.building_sqft, p.land_sqft, p.year_built, p.property_type,
                        p.owner_name, p.owner_address, p.stories, p.total_valuation,
                        p.data_source, p.latitude, p.longitude,
                        CASE WHEN r.parcel_id IS NOT NULL THEN 1 ELSE 0 END AS is_released
                    FROM parcels p
                    LEFT JOIN released_leads r ON r.parcel_id = p.id AND r.state = 'TX'
                    WHERE {where_sql}
                    ORDER BY {order_sql}
                    LIMIT :limit OFFSET :offset
                    """
                ),
                params,
            ).mappings().fetchall()

            parcels = [
                _row_to_browse_item(dict(row), released=bool(row.get("is_released")))
                for row in rows
            ]
            return BrowseParcelListResponse(
                total=int(total),
                source="County appraisal warehouse (commercial/industrial improvements)",
                parcels=parcels,
            )
    except Exception as e:
        logger.error(f"Error browsing parcels: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to browse parcels: {str(e)}",
        )


def _cad_url_for(account_number: Optional[str], parcel_id: str, city: str) -> Optional[str]:
    acct = (account_number or "").strip()
    if not acct and parcel_id:
        for prefix in ("DCAD-PARCEL-", "DAL-DCAD-", "TAD-PARCEL-"):
            if parcel_id.upper().startswith(prefix):
                acct = parcel_id[len(prefix):]
                break
    if not acct:
        return None
    if "fort worth" in (city or "").lower() or parcel_id.upper().startswith("TAD-"):
        return f"https://www.tad.org/property-search?account={acct}"
    return f"https://www.dallascad.org/AcctDetailCom.aspx?ID={acct}"


def _permit_row_to_item(row: Dict[str, Any], match: str) -> BrowsePermitItem:
    val = row.get("valuation")
    try:
        valuation = float(val) if val is not None and val != "" else None
    except (TypeError, ValueError):
        valuation = None
    issued = row.get("issue_date")
    return BrowsePermitItem(
        id=str(row.get("id") or row.get("raw_permit_number") or ""),
        permit_number=str(row.get("raw_permit_number") or row.get("id") or ""),
        issue_date=str(issued)[:10] if issued else None,
        status=row.get("status"),
        category=row.get("category"),
        valuation=valuation,
        valuation_formatted=row.get("valuation_formatted"),
        description=(str(row.get("raw_description") or "")[:500] or None),
        contractor_name=row.get("contractor_name"),
        contractor_phone=row.get("contractor_phone"),
        contractor_license=row.get("contractor_license"),
        roof_system=row.get("probable_roof_system"),
        is_pure_reroof=bool(row.get("is_pure_reroof")),
        source_system=row.get("source_system") or row.get("data_source"),
        match=match,
    )


@router.get("/browse/{parcel_id}", response_model=BrowseParcelDetail)
async def browse_parcel_detail(parcel_id: str) -> BrowseParcelDetail:
    """Full directory card for Building Browse: CAD parcel, permits, contacts, source links."""
    from sqlalchemy import text
    from urllib.parse import unquote, quote_plus

    pid = unquote(parcel_id)
    try:
        engine = get_db_engine()
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT
                        p.id, p.account_number, p.address, p.city, p.county, p.state, p.zip_code,
                        p.building_sqft, p.land_sqft, p.year_built, p.property_type,
                        p.owner_name, p.owner_address, p.owner_city, p.owner_state, p.owner_zip,
                        p.stories, p.total_valuation, p.improvement_valuation,
                        p.data_source, p.latitude, p.longitude, p.improvement_sections,
                        p.last_reroof_date, p.last_reroof_permit_no,
                        CASE WHEN r.parcel_id IS NOT NULL THEN 1 ELSE 0 END AS is_released
                    FROM parcels p
                    LEFT JOIN released_leads r ON r.parcel_id = p.id AND r.state = 'TX'
                    WHERE p.id = :parcel_id
                      AND COALESCE(p.is_mock, 0) = 0
                      AND UPPER(COALESCE(p.property_type, '')) NOT LIKE '%VACANT%'
                      AND (
                        UPPER(COALESCE(p.property_type, '')) LIKE '%COMMERCIAL%IMPROVEMENT%'
                        OR UPPER(COALESCE(p.property_type, '')) LIKE '%INDUSTRIAL%IMPROVEMENT%'
                      )
                    LIMIT 1
                    """
                ),
                {"parcel_id": pid},
            ).mappings().fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parcel {pid} not found in commercial/industrial inventory.",
                )
            data = dict(row)
            item = _row_to_browse_item(data, released=bool(data.get("is_released")))
            acct = str(data.get("account_number") or "").strip()
            ids = [pid]
            if acct:
                ids.extend([acct, f"DCAD-PARCEL-{acct}", f"DAL-DCAD-{acct}", f"TAD-PARCEL-{acct}"])
            # de-dupe while preserving order
            seen_ids = set()
            id_list = []
            for value in ids:
                if value and value not in seen_ids:
                    seen_ids.add(value)
                    id_list.append(value)

            placeholders = ", ".join(f":pid{i}" for i in range(len(id_list)))
            pid_params = {f"pid{i}": value for i, value in enumerate(id_list)}
            permit_rows = conn.execute(
                text(
                    f"""
                    SELECT id, raw_permit_number, issue_date, status, category, valuation,
                           valuation_formatted, raw_description, contractor_name, contractor_phone,
                           contractor_license, probable_roof_system, is_pure_reroof,
                           source_system, data_source
                    FROM normalized_permits
                    WHERE parcel_id IN ({placeholders})
                    ORDER BY CASE WHEN issue_date IS NULL OR issue_date = '' THEN 1 ELSE 0 END,
                             issue_date DESC, raw_permit_number DESC
                    LIMIT 40
                    """
                ),
                pid_params,
            ).mappings().fetchall()

            permits = [_permit_row_to_item(dict(p), "parcel_id") for p in permit_rows]
            have_numbers = {p.permit_number for p in permits if p.permit_number}

            # Light address fallback when no parcel_id join (common on NewPermit harvest)
            if not permits and data.get("address"):
                street = str(data.get("address") or "").strip().upper()
                city_name = str(data.get("city") or "").strip().upper()
                # take house number + first street token for a conservative match
                parts = [t for t in street.replace(",", " ").split() if t]
                if len(parts) >= 2:
                    house, road = parts[0], parts[1]
                    addr_rows = conn.execute(
                        text(
                            """
                            SELECT id, raw_permit_number, issue_date, status, category, valuation,
                                   valuation_formatted, raw_description, contractor_name, contractor_phone,
                                   contractor_license, probable_roof_system, is_pure_reroof,
                                   source_system, data_source
                            FROM normalized_permits
                            WHERE UPPER(COALESCE(city, '')) LIKE :city
                              AND UPPER(COALESCE(normalized_address, '')) LIKE :house
                              AND UPPER(COALESCE(normalized_address, '')) LIKE :road
                            ORDER BY CASE WHEN issue_date IS NULL OR issue_date = '' THEN 1 ELSE 0 END,
                                     issue_date DESC
                            LIMIT 15
                            """
                        ),
                        {
                            "city": f"%{city_name}%",
                            "house": f"%{house}%",
                            "road": f"%{road}%",
                        },
                    ).mappings().fetchall()
                    for p in addr_rows:
                        item_p = _permit_row_to_item(dict(p), "address")
                        if item_p.permit_number in have_numbers:
                            continue
                        have_numbers.add(item_p.permit_number)
                        permits.append(item_p)

            contacts: List[BrowseContact] = []
            owner_name = str(data.get("owner_name") or "").strip()
            if owner_name:
                mail_bits = [
                    str(data.get("owner_address") or "").strip(),
                    str(data.get("owner_city") or "").strip(),
                    str(data.get("owner_state") or "").strip(),
                    str(data.get("owner_zip") or "").strip(),
                ]
                mail = ", ".join([b for b in mail_bits if b]) or None
                contacts.append(
                    BrowseContact(
                        role="Property owner (CAD)",
                        name=owner_name,
                        address=mail,
                        note="From county appraisal roll — mailing address, not a verified phone.",
                    )
                )
            seen_contractors = set()
            for p in permits:
                name = (p.contractor_name or "").strip()
                if not name or name.lower() in ("on municipal record", "licensed commercial contractor", "unknown"):
                    continue
                key = name.lower()
                if key in seen_contractors:
                    continue
                seen_contractors.add(key)
                contacts.append(
                    BrowseContact(
                        role="Permit contractor",
                        name=name,
                        phone=p.contractor_phone,
                        license=p.contractor_license,
                        note=f"From permit {p.permit_number}" if p.permit_number else None,
                    )
                )

            evidence_sources = conn.execute(
                text(
                    """
                    SELECT DISTINCT source_system, source_url
                    FROM lead_evidence
                    WHERE parcel_id = :parcel_id
                      AND source_url IS NOT NULL AND TRIM(source_url) != ''
                    """
                ),
                {"parcel_id": pid},
            ).mappings().fetchall()

            cad_url = _cad_url_for(acct, pid, str(data.get("city") or ""))
            city_l = str(data.get("city") or "").lower()
            permit_portal = (
                "https://aca-prod.accela.com/DALLASTX/"
                if "dallas" in city_l
                else "https://fortworthtexas.gov/departments/development-services/"
                if "fort worth" in city_l
                else None
            )
            lat, lng = data.get("latitude"), data.get("longitude")
            maps_url = None
            try:
                if lat is not None and lng is not None:
                    maps_url = f"https://www.google.com/maps?q={float(lat)},{float(lng)}"
                elif data.get("address"):
                    maps_url = (
                        "https://www.google.com/maps/search/?api=1&query="
                        + quote_plus(f"{data.get('address')}, {data.get('city') or ''} {data.get('state') or ''}")
                    )
            except (TypeError, ValueError):
                maps_url = None

            sources: List[BrowseSourceLink] = []
            if cad_url:
                sources.append(BrowseSourceLink(label="County CAD account", url=cad_url, system=str(data.get("data_source") or "CAD")))
            if permit_portal:
                sources.append(BrowseSourceLink(label="City permit portal", url=permit_portal, system="Municipal Accela / open data"))
            if maps_url:
                sources.append(BrowseSourceLink(label="Map location", url=maps_url, system="Google Maps"))
            for ev in evidence_sources:
                url = str(ev.get("source_url") or "").strip()
                if not url or any(s.url == url for s in sources):
                    continue
                sources.append(
                    BrowseSourceLink(
                        label=str(ev.get("source_system") or "Evidence source"),
                        url=url,
                        system=str(ev.get("source_system") or ""),
                    )
                )

            reroof = data.get("last_reroof_date")
            return BrowseParcelDetail(
                **item.model_dump(),
                account_number=acct or None,
                owner_city=data.get("owner_city"),
                owner_state=data.get("owner_state"),
                owner_zip=str(data.get("owner_zip") or "") or None,
                improvement_valuation=(
                    float(data["improvement_valuation"])
                    if data.get("improvement_valuation") not in (None, "")
                    else None
                ),
                improvement_sections=data.get("improvement_sections"),
                last_reroof_date=str(reroof)[:10] if reroof else None,
                last_reroof_permit_no=data.get("last_reroof_permit_no"),
                permits=permits,
                permit_count=len(permits),
                contacts=contacts,
                sources=sources,
                maps_url=maps_url,
                cad_url=cad_url,
                permit_portal_url=permit_portal,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing parcel {pid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load parcel detail: {str(e)}",
        )


@router.get("/{parcel_id}")
async def get_single_parcel(parcel_id: str):
    """
    Returns one parcel only when it is on released_leads.
    """
    from app.api.v1.permits import get_db_engine
    from sqlalchemy import text
    try:
        engine = get_db_engine()
        with engine.connect() as conn:
            query = text("""
                SELECT 
                    id, account_number, jurisdiction_id, jurisdiction, address, city, county,
                    state, zip_code, building_sqft, land_sqft, year_built, property_type,
                    owner_name, owner_address, owner_city, owner_state, owner_zip,
                    total_valuation, improvement_valuation, latitude, longitude, data_source
                FROM parcels
                WHERE id = :parcel_id
                  AND id IN (SELECT parcel_id FROM released_leads WHERE state = 'TX')
                LIMIT 1
            """)
            row = conn.execute(query, {"parcel_id": parcel_id}).mappings().fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parcel {parcel_id} not found."
                )

            perm_rows = []
            evidence_rows = conn.execute(
                text("SELECT field_name, stored_value FROM lead_evidence WHERE parcel_id = :parcel_id"),
                {"parcel_id": row["id"]},
            ).mappings().fetchall()
            evidence = {item["field_name"]: item["stored_value"] for item in evidence_rows}

            def evidence_number(name: str):
                raw = evidence.get(name)
                if raw in (None, ""):
                    return None
                return stored_number(raw)

            return {
                "id": row["id"],
                "accountNumber": row["account_number"],
                "jurisdiction": row["jurisdiction"],
                "address": evidence.get("address") or row["address"],
                "city": row["city"],
                "county": row["county"],
                "state": row["state"],
                "zipCode": None,
                "jurisdictionId": row["jurisdiction_id"],
                "buildingSqft": evidence_number("roof_sqft_used"),
                "landSqft": None,
                "yearBuilt": evidence_number("year_built"),
                "propertyType": evidence.get("improvement_description"),
                "ownerName": evidence.get("owner_name"),
                "ownerAddress": None,
                "totalValuation": evidence_number("market_value"),
                "improvementValuation": None,
                "dataSource": "lead_evidence",
                "latitude": stored_number(row["latitude"]),
                "longitude": stored_number(row["longitude"]),
                "linkedPermitsCount": len(perm_rows),
                "permits": [
                    {
                        "id": p["id"],
                        "permitNumber": p["raw_permit_number"],
                        "issueDate": str(p["issue_date"]) if p["issue_date"] else None,
                        "valuationFormatted": money_text(p["valuation"], p["valuation_formatted"]),
                        "status": p["status"],
                        "roofSystem": p["probable_roof_system"],
                        "contractorName": p["contractor_name"],
                        "scopeDescription": p["raw_description"],
                    }
                    for p in perm_rows
                ]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching parcel {parcel_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query parcel: {str(e)}"
        )

