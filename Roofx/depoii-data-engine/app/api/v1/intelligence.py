from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, text

from app.schemas.storm_schema import UnresolvedExposureTarget
from app.schemas.lead_dossier_schema import LeadDossier
from app.science.lead_dossier_builder import build_lead_dossier
from app.science.spatial_queries import (
    calculate_exposure_score,
    calculate_months_unrepaired,
    estimate_nrca_replacement_cost,
    evaluate_spatial_exposure_in_memory,
)
from app.extraction.noaa_client import calculate_hail_physics
from app.api.v1.parcels import _PARCEL_CACHE
from app.api.v1.permits import _PERMIT_WAREHOUSE
from app.config import settings
from app.core.logging import logger
from fastapi import HTTPException
from fastapi.responses import PlainTextResponse

router = APIRouter(prefix="/intelligence", tags=["Commercial Intelligence"])

_db_engine = None


def get_db_engine():
    global _db_engine
    if _db_engine is None:
        _db_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
    return _db_engine


class UnresolvedExposureResponse(BaseModel):
    total_targets: int
    storm_name: str
    event_date: str
    max_hail_inches: float
    total_unresolved_valuation_mid: float
    targets: List[UnresolvedExposureTarget]


@router.get("/unresolved-exposure", response_model=UnresolvedExposureResponse)
async def get_unresolved_exposure(
    min_sqft: int = Query(50000, description="Minimum building square footage filter"),
    min_hail_inches: float = Query(1.75, description="Minimum hail diameter threshold"),
    storm_id: Optional[str] = Query(None, description="Optional specific storm ID filter"),
    limit: int = Query(100, ge=1, le=500, description="Max exposure targets to return"),
) -> UnresolvedExposureResponse:
    """
    This route used to claim buildings had no repair permit inside a hail swath.
    That negative is not measured. It returns an empty list until a separate
    permit-recall study exists. It does not fall back to a hardcoded storm.
    """
    _ = (min_sqft, min_hail_inches, storm_id, limit)
    return UnresolvedExposureResponse(
        total_targets=0,
        storm_name="",
        event_date="",
        max_hail_inches=0,
        total_unresolved_valuation_mid=0,
        targets=[],
    )


@router.get("/leads/{parcel_id}/dossier", response_model=LeadDossier)
async def get_lead_dossier(parcel_id: str, storm_id: Optional[str] = Query(None)) -> LeadDossier:
    """
    Dossier for one parcel. Pass storm_id from the call list so the storm matches that row.
    """
    dossier = build_lead_dossier(parcel_id, storm_id=storm_id)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Parcel ID or Account '{parcel_id}' not found in database.")
    return dossier


@router.get("/leads/{parcel_id}/dossier/markdown", response_class=PlainTextResponse)
async def get_lead_dossier_markdown(parcel_id: str) -> str:
    """
    Returns the formatted Markdown report for export to PDF or field rep briefing documents.
    """
    dossier = build_lead_dossier(parcel_id)
    if not dossier:
        raise HTTPException(status_code=404, detail=f"Parcel ID or Account '{parcel_id}' not found in database.")
    return dossier.markdown_dossier


@router.get("/leads/ranked")
async def get_ranked_scored_leads(
    tier: Optional[str] = Query(None, description="Optional tier filter: TIER_1_HOT_LEAD, TIER_2_QUALIFIED, DEPRIORITIZED"),
    min_score: int = Query(60, ge=60, le=99, description="Minimum exposure score filter"),
    city: Optional[str] = Query(None, description="Optional city filter"),
    limit: int = Query(50, ge=1, le=500, description="Max leads to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    """
    Returns rows on released_leads only. The table starts empty. Scored rows,
    including New York, Seattle, and unverified_seed, are not selected.
    """
    _ = (tier, min_score)
    import os
    import sqlite3
    from app.science.lead_store import ensure_schema, list_released

    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    db_path = os.path.join(repo_root, "depoii_local.db")
    if not os.path.exists(db_path):
        return {"total_matching": 0, "limit": limit, "offset": offset, "leads": []}

    conn = sqlite3.connect(db_path)
    try:
        ensure_schema(conn)
        conn.commit()
        total, leads = list_released(conn, limit=limit, offset=offset, city=city)
    finally:
        conn.close()
    return {
        "total_matching": total,
        "limit": limit,
        "offset": offset,
        "leads": leads,
    }



