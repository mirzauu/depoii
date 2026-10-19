from fastapi import APIRouter, Query, HTTPException
from app.schemas.brief_schema import MondayBriefResponse
from app.science.brief_service import generate_monday_brief
from app.core.logging import logger

router = APIRouter(tags=["Monday Executive Brief"])


@router.get("/brief", response_model=MondayBriefResponse)
async def get_monday_brief(
    jurisdiction: str = Query("New York City, NY", description="Target market jurisdiction in 'City, ST' format (e.g. 'New York City, NY', 'Dallas, TX')"),
    limit: int = Query(5, ge=1, le=500, description="Page size. Home uses 5. The pipeline uses 500."),
    offset: int = Query(0, ge=0),
) -> MondayBriefResponse:
    """
    Returns the Monday brief for one jurisdiction.
    The home screen asks for 5 rows. The pipeline asks for a page of at most 500.
    """
    try:
        return await generate_monday_brief(jurisdiction=jurisdiction, opportunity_limit=limit, offset=offset)
    except Exception as exc:
        logger.error(f"[MONDAY BRIEF] Error generating brief for '{jurisdiction}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate brief for jurisdiction '{jurisdiction}': {str(exc)}"
        )
