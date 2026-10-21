"""Depoii Local Engine Worker.

Claims and executes asynchronous jobs from app.engine_jobs queue in Supabase Postgres.
Runs locally (laptop / server) where full local tools, headless browser, and
heavy computation reside.

Usage:
  py -m app.worker
"""
from __future__ import annotations

import asyncio
import json
import os
import signal
import sys
import time
from typing import Any, Dict, Optional

# Ensure package root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core import pg
from app.core.logging import logger
from app.core.sqlite import connect as sqlite_connect

_SHUTDOWN = False


def _sig_handler(signum, frame):
    global _SHUTDOWN
    logger.info("Shutdown signal received. Worker will finish current job and exit.")
    _SHUTDOWN = True


signal.signal(signal.SIGINT, _sig_handler)
signal.signal(signal.SIGTERM, _sig_handler)


def update_job_progress(job_id: str, progress: int, step: str, message: str) -> None:
    try:
        conn = pg.connect()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE app.engine_jobs
                SET progress = %s, step = %s, message = %s, updated_at = now()
                WHERE id = %s
                """,
                (progress, step, message, job_id),
            )
        conn.commit()
    except Exception as exc:
        logger.warning(f"[WORKER] Failed to update progress for job {job_id}: {exc}")


def complete_job(job_id: str, result: Dict[str, Any]) -> None:
    try:
        conn = pg.connect()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE app.engine_jobs
                SET status = 'complete', progress = 100, step = 'COMPLETE',
                    message = 'Completed successfully.', result = %s::jsonb,
                    finished_at = now(), updated_at = now()
                WHERE id = %s
                """,
                (json.dumps(result), job_id),
            )
        conn.commit()
    except Exception as exc:
        logger.error(f"[WORKER] Failed to mark job {job_id} complete: {exc}")


def fail_job(job_id: str, error_msg: str) -> None:
    try:
        conn = pg.connect()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE app.engine_jobs
                SET status = 'error', error = %s,
                    finished_at = now(), updated_at = now()
                WHERE id = %s
                """,
                (error_msg, job_id),
            )
        conn.commit()
    except Exception as exc:
        logger.error(f"[WORKER] Failed to mark job {job_id} failed: {exc}")


async def handle_verify_city(job_id: str, payload: Dict[str, Any]) -> None:
    from app.science.city_verification_runner import CityVerificationRunner

    city = payload.get("jurisdiction", "Fort Worth, TX")
    state = payload.get("state", "TX")
    max_aerials = int(payload.get("max_aerials", 50))

    async def on_progress(event: Dict[str, Any]):
        pct = event.get("pct", 10)
        step = event.get("step", "PROCESSING")
        msg = event.get("message", "Processing stage...")
        update_job_progress(job_id, pct, step, msg)

    logger.info(f"[WORKER] Starting verify_city: {city}, {state} (max_aerials={max_aerials})")
    update_job_progress(job_id, 10, "HYGIENE", f"Starting verification pipeline for {city}...")

    summary = await CityVerificationRunner.run_pipeline(
        city_name=city,
        state=state,
        max_aerials=max_aerials,
        progress_callback=on_progress,
    )
    complete_job(job_id, summary or {})
    logger.info(f"[WORKER] Completed verify_city for {city}")


def handle_verify_lead(job_id: str, payload: Dict[str, Any]) -> None:
    from app.science.verification_engine import VerificationEngine

    lead_id = payload.get("lead_id")
    if not lead_id:
        fail_job(job_id, "Missing lead_id in job payload")
        return

    update_job_progress(job_id, 20, "LOOKUP", f"Fetching parcel details for {lead_id}...")

    # Look up in local SQLite or warehouse
    conn = sqlite_connect(readonly=True)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT p.address, p.city, p.latitude, p.longitude, p.account_number,
                   (SELECT event_date FROM scored_parcel_leads WHERE parcel_id = p.id LIMIT 1) as event_date
            FROM parcels p
            WHERE p.id = ? OR p.account_number = ?
            """,
            (lead_id, lead_id.replace("TAD-PARCEL-", "").replace("DCAD-PARCEL-", "")),
        )
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        fail_job(job_id, f"Lead ID '{lead_id}' not found in parcels database.")
        return

    addr, city, lat, lon, acct, s_date = row
    lat = lat or 32.7239
    lon = lon or -97.4520
    storm_date = s_date if (s_date and str(s_date).strip()) else "2026-04-26"

    update_job_progress(job_id, 50, "AUDITING", f"Auditing evidence for {addr}...")
    result = VerificationEngine.verify_lead(lead_id, addr, city, lat, lon, acct, storm_date)
    complete_job(job_id, result)
    logger.info(f"[WORKER] Completed verify_lead for {lead_id}")


def process_claimed_job(job_id: str, job_type: str, payload: Dict[str, Any]) -> None:
    logger.info(f"[WORKER] Processing job {job_id} (type={job_type})")
    try:
        if job_type in ("verify_city", "city_verification"):
            asyncio.run(handle_verify_city(job_id, payload))
        elif job_type in ("verify_lead", "lead_verification"):
            handle_verify_lead(job_id, payload)
        elif job_type == "permit_sync":
            from app.tasks.permit_sync import sync_all_sources
            update_job_progress(job_id, 20, "SYNCING", "Syncing municipal permits...")
            res = sync_all_sources()
            complete_job(job_id, res or {"status": "ok"})
        else:
            fail_job(job_id, f"Unknown engine job type: '{job_type}'")
    except Exception as exc:
        logger.error(f"[WORKER] Job {job_id} encountered exception: {exc}", exc_info=True)
        fail_job(job_id, str(exc))


def claim_next_job() -> Optional[tuple[str, str, Dict[str, Any]]]:
    """Claim one queued job using SELECT ... FOR UPDATE SKIP LOCKED."""
    conn = pg.connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, type, payload
            FROM app.engine_jobs
            WHERE status = 'queued'
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            conn.commit()
            return None

        job_id, job_type, raw_payload = row
        payload = raw_payload if isinstance(raw_payload, dict) else (json.loads(raw_payload) if raw_payload else {})

        cur.execute(
            """
            UPDATE app.engine_jobs
            SET status = 'running', started_at = now(), progress = 5,
                step = 'CLAIMED', message = 'Claimed by local engine worker',
                updated_at = now()
            WHERE id = %s
            """,
            (job_id,),
        )
        conn.commit()
        return job_id, job_type, payload


def main():
    logger.info("Starting Depoii Local Engine Worker...")
    if not pg.available():
        logger.error("SUPABASE_DB_URL is not set. Please set SUPABASE_DB_URL and retry.")
        sys.exit(1)

    logger.info("Connected to Supabase engine_jobs queue. Polling for tasks...")
    poll_interval = 2.0

    while not _SHUTDOWN:
        try:
            claimed = claim_next_job()
            if claimed:
                job_id, job_type, payload = claimed
                process_claimed_job(job_id, job_type, payload)
            else:
                time.sleep(poll_interval)
        except Exception as exc:
            logger.error(f"[WORKER ERROR] Polling loop error: {exc}", exc_info=True)
            time.sleep(poll_interval)

    logger.info("Worker stopped cleanly.")


if __name__ == "__main__":
    main()
