from typing import List, Optional
from pydantic import BaseModel, Field


class StormSummary(BaseModel):
    id: str = Field(..., description="Storm event identifier (e.g. '2026-06-11')")
    name: str = Field(..., description="Full descriptive storm name")
    event_date: str = Field(..., description="Date of storm event YYYY-MM-DD")
    max_hail_inches: float = Field(..., description="Peak hail diameter reported in inches")
    report_count: int = Field(..., description="Total verified hail reports")


class BriefSummary(BaseModel):
    exposed_buildings: int = Field(..., description="Total commercial assets inside storm warnings")
    unresolved_buildings: int = Field(..., description="Exposed buildings with zero post-storm permits")
    core_unresolved: int = Field(..., description="Unresolved buildings in core hail severity tier")
    pipeline_value_usd: int = Field(..., description="Total estimated replacement value of unresolved buildings")
    top_corridor: str = Field(..., description="Primary submarket or corridor with highest damage density")
    claim_deadline: str = Field(..., description="Statutory 24-month insurance claim deadline YYYY-MM-DD")
    days_remaining: int = Field(..., description="Days remaining until proof of loss statutory deadline")


class TopOwner(BaseModel):
    name: str = Field(..., description="Legal owner of top opportunity asset")
    address: str = Field(..., description="Property address")
    parcel_id: str = Field(..., description="Tax parcel or PLUTO identifier")


class PitchBrief(BaseModel):
    address: str = Field(..., description="Address of primary pitch opportunity")
    hail_inches: float = Field(..., description="Hail size impact on roof")
    year_built: Optional[int] = Field(None, description="Original year built")
    membrane: str = Field(..., description="Predominant commercial roof assembly")


class CompetitorBrief(BaseModel):
    name: str = Field(..., description="Leading incumbent contractor in market")
    share_pct: float = Field(..., description="Captured municipal market share percentage")
    storm_chasers: List[str] = Field(default_factory=list, description="Out-of-state storm chasing contractors")


class OpportunityItem(BaseModel):
    parcel_id: str = Field(..., description="Tax parcel identifier")
    address: str = Field(..., description="Property address")
    city: str = Field(..., description="City name")
    owner: str = Field(..., description="Property owner name")
    owner_mail: str = Field("", description="Owner mailing address from the appraisal roll")
    year_built: Optional[int] = Field(None, description="Year built")
    sqft: int = Field(..., description="Building square footage")
    hail_inches: float = Field(..., description="Hail diameter impact")
    tier: str = Field(..., description="'core' or 'envelope'")
    score: int = Field(..., description="Shared exposure score from 0 to 100")
    pipeline_value_usd: int = Field(..., description="Midpoint replacement value for the estimated roof area")
    unresolved: bool = Field(True, description="True if no roofing permit was filed after the storm")
    storm_id: str = ""
    price_low: int = 0
    price_high: int = 0
    roof_sqft: int = 0
    price_flagged: bool = False
    permit_status: Optional[str] = None
    recent_activity: Optional[str] = None
    latitude: Optional[float] = Field(None, description="Parcel latitude for map spatial classify")
    longitude: Optional[float] = Field(None, description="Parcel longitude for map spatial classify")


class MondayBriefResponse(BaseModel):
    jurisdiction: str = Field(..., description="Queried jurisdiction (City, ST)")
    as_of: str = Field(..., description="Data snapshot timestamp in ISO-8601 UTC")
    storm: StormSummary = Field(..., description="Primary severe storm event analyzed")
    summary: BriefSummary = Field(..., description="Executive loss pipeline summary")
    top_owner: TopOwner = Field(..., description="Top commercial property owner in pipeline")
    pitch: PitchBrief = Field(..., description="C-suite pitch telemetry for #1 lead")
    competitor: CompetitorBrief = Field(..., description="Market incumbent competitive intelligence")
    opportunities: List[OpportunityItem] = Field(..., description="Paged opportunities, unresolved first")
    total_opportunities: int = 0
    offset: int = 0
