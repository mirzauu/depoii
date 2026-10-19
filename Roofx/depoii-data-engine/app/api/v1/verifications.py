import asyncio
import uuid
import json
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Query, Path
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.science.verification_engine import VerificationEngine
from app.science.city_verification_runner import CityVerificationRunner
from app.core.logging import logger
from app.core.sqlite import connect as sqlite_connect

router = APIRouter(prefix="/verifications", tags=["Lead Verification Engine"])


@router.post("/verify/{lead_id}")
async def verify_lead(
    lead_id: str = Path(..., description="The parcel_id or lead identifier (e.g. 'TAD-PARCEL-00029580')")
) -> Dict[str, Any]:
    """
    Executes the 5-Pillar Live Verification Audit on a single candidate lead:
    1. County Appraisal District Live Check (TAD/DCAD)
    2. NOAA SPC Ground-Truth Hail Radial Distance
    3. Municipal Permit Open Data Live Search
    4. ESRI High-Resolution Satellite Rooftop Snapshot
    5. 100-Point Confidence Score & Evidence Persistence
    """
    conn = sqlite_connect(readonly=True)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT p.address, p.city, p.latitude, p.longitude, p.account_number,
                   (SELECT event_date FROM scored_parcel_leads WHERE parcel_id = p.id LIMIT 1) as event_date
            FROM parcels p
            WHERE p.id = ? OR p.account_number = ?
        """, (lead_id, lead_id.replace("TAD-PARCEL-", "").replace("DCAD-PARCEL-", "")))
        row = cur.fetchone()
    finally:
        conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Lead with ID '{lead_id}' not found in parcels database.")
        
    addr, city, lat, lon, acct, s_date = row
    lat = lat or 32.7239
    lon = lon or -97.4520
    storm_date = s_date if (s_date and str(s_date).strip()) else "2026-04-26"
    
    try:
        result = await asyncio.to_thread(
            VerificationEngine.verify_lead,
            lead_id,
            addr,
            city,
            lat,
            lon,
            acct,
            storm_date,
        )
        return result
    except Exception as exc:
        logger.error(f"[VERIFICATION ERROR] Failed to verify lead {lead_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/evidence-card/{lead_id}")
async def get_evidence_card(
    lead_id: str = Path(..., description="The parcel_id or lead identifier")
) -> Dict[str, Any]:
    """
    Returns the persistent Evidence Dossier for a verified lead.
    """
    conn = sqlite_connect(readonly=True)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT parcel_id, address, city, verification_status, verification_score,
                   cad_account_id, nearest_hail_distance_mi, nearest_hail_size_in,
                   nearest_hail_location, muni_permit_check_date, muni_permit_status,
                   aerial_snapshot_url, aerial_capture_date, evidence_payload_json
            FROM scored_parcel_leads
            WHERE parcel_id = ?
        """, (lead_id,))
        row = cur.fetchone()
    finally:
        conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"No verification record found for '{lead_id}'.")
        
    payload = json.loads(row[13]) if row[13] else {}
    return {
        "lead_id": row[0],
        "address": row[1],
        "city": row[2],
        "verification_status": row[3],
        "verification_score": row[4],
        "cad_account_id": row[5],
        "nearest_hail_distance_mi": row[6],
        "nearest_hail_size_in": row[7],
        "nearest_hail_location": row[8],
        "muni_permit_check_date": row[9],
        "muni_permit_status": row[10],
        "aerial_snapshot_url": row[11],
        "aerial_capture_date": row[12],
        "full_evidence": payload
    }


@router.get("/stats")
async def get_verification_stats() -> Dict[str, Any]:
    """
    Returns high-level statistics across all audited leads.
    """
    conn = sqlite_connect(readonly=True)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT verification_status, count(*)
            FROM scored_parcel_leads
            GROUP BY verification_status
        """)
        rows = cur.fetchall()
    finally:
        conn.close()

    return {
        "breakdown": {r[0]: r[1] for r in rows}
    }


class TriggerCityVerificationRequest(BaseModel):
    jurisdiction: str = "Fort Worth, TX"
    state: str = "TX"
    max_aerials: int = 50


class TriggerCityVerificationResponse(BaseModel):
    job_id: str
    jurisdiction: str
    status: str
    stream_url: str


_VERIFICATION_JOBS: Dict[str, Dict[str, Any]] = {}


async def _run_job_worker(job_id: str, queue: asyncio.Queue, city: str, state: str, max_aerials: int):
    """Runs the audit off the server event loop. The pipeline uses blocking HTTP, which would otherwise freeze every other request."""
    loop = asyncio.get_running_loop()

    def publish(kind: str, data: Optional[Dict[str, Any]]):
        loop.call_soon_threadsafe(queue.put_nowait, None if kind == "end" else {"type": kind, "data": data})

    def runner():
        async def on_progress(event: Dict[str, Any]):
            publish("progress", event)

        async def main():
            try:
                summary = await CityVerificationRunner.run_pipeline(
                    city_name=city,
                    state=state,
                    max_aerials=max_aerials,
                    progress_callback=on_progress,
                )
                publish("complete", summary)
            except Exception as exc:
                logger.error(f"[VERIFICATION JOB ERROR] {exc}", exc_info=True)
                publish("error", {"error": str(exc)})
            finally:
                publish("end", None)

        asyncio.run(main())

    await asyncio.to_thread(runner)


@router.post("/trigger-city", response_model=TriggerCityVerificationResponse)
async def trigger_city_verification(payload: TriggerCityVerificationRequest) -> TriggerCityVerificationResponse:
    """
    Asynchronously triggers the 5-Stage Verification Pipeline for a given jurisdiction.
    """
    try:
        from app.science.brief_service import invalidate_brief_cache
        invalidate_brief_cache()
    except Exception:
        pass
    job_id = f"vjob-{uuid.uuid4().hex[:8]}"
    queue = asyncio.Queue()
    _VERIFICATION_JOBS[job_id] = {
        "queue": queue,
        "jurisdiction": payload.jurisdiction,
        "status": "RUNNING",
    }

    # Run in background task
    asyncio.create_task(
        _run_job_worker(job_id, queue, payload.jurisdiction, payload.state, payload.max_aerials)
    )

    return TriggerCityVerificationResponse(
        job_id=job_id,
        jurisdiction=payload.jurisdiction,
        status="RUNNING",
        stream_url=f"/api/v1/verifications/stream/{job_id}",
    )


@router.get("/stream/{job_id}")
async def stream_verification_progress(job_id: str):
    """
    SSE stream endpoint for live real-time verification progress across the 5 stages.
    """
    job = _VERIFICATION_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Verification job '{job_id}' not found.")

    queue: asyncio.Queue = job["queue"]

    async def event_generator():
        while True:
            item = await queue.get()
            if item is None:
                break
            msg_type = item.get("type", "progress")
            msg_data = item.get("data", {})
            yield f"event: {msg_type}\ndata: {json.dumps(msg_data)}\n\n"

        # Cleanup job after stream ends
        _VERIFICATION_JOBS.pop(job_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
