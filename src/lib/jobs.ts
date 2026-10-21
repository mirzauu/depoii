import { query, queryOne } from "@/lib/pg";

/**
 * engine_jobs queue: Next.js enqueues, the local Python worker
 * (py -m app.worker) claims rows with FOR UPDATE SKIP LOCKED and runs
 * the heavy verification/sync pipelines. Replaces the hosted FastAPI
 * in-memory jobs + SSE stream.
 */

export interface EngineJob {
  id: string;
  type: string;
  status: "queued" | "running" | "complete" | "error";
  progress: number;
  step: string;
  message: string;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const map = (r: Record<string, unknown>): EngineJob => ({
  id: String(r.id),
  type: String(r.type),
  status: r.status as EngineJob["status"],
  progress: Number(r.progress || 0),
  step: String(r.step || ""),
  message: String(r.message || ""),
  result: (r.result as Record<string, unknown>) ?? null,
  error: r.error ? String(r.error) : null,
  createdAt: String(r.created_at || ""),
  updatedAt: String(r.updated_at || ""),
});

export async function enqueueJob(input: { type: string; payload: Record<string, unknown>; orgId: string; userId: string }): Promise<EngineJob> {
  const id = `job-${crypto.randomUUID().slice(0, 12)}`;
  const row = await queryOne(
    `insert into app.engine_jobs (id, org_id, requested_by, type, payload) values ($1,$2,$3,$4,$5::jsonb) returning *`,
    [id, input.orgId, input.userId, input.type, JSON.stringify(input.payload)],
  );
  return map(row as Record<string, unknown>);
}

export async function getJob(id: string, orgId: string): Promise<EngineJob | null> {
  const row = await queryOne(`select * from app.engine_jobs where id = $1 and ($2 = '' or org_id = $2)`, [id, orgId]);
  return row ? map(row as Record<string, unknown>) : null;
}

export async function listJobs(orgId: string, limit = 20): Promise<EngineJob[]> {
  const rows = await query(`select * from app.engine_jobs where ($1 = '' or org_id = $1) order by created_at desc limit $2`, [orgId, limit]);
  return rows.map(map);
}
