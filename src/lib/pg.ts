import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Server-only Supabase Postgres access (transaction pooler, port 6543).
 * DATABASE_URL must never be NEXT_PUBLIC_-prefixed. When unset, callers
 * fall back to the legacy FastAPI proxy (ENGINE_BACKEND=fastapi path).
 */

declare global {
  var __depoiiPgPool: Pool | undefined;
}

export function pgConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!globalThis.__depoiiPgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    globalThis.__depoiiPgPool = new Pool({
      connectionString: url,
      max: Number(process.env.DEPOII_PG_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalThis.__depoiiPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(sql, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function closePool(): Promise<void> {
  if (globalThis.__depoiiPgPool) {
    await globalThis.__depoiiPgPool.end();
    globalThis.__depoiiPgPool = undefined;
  }
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** ENGINE_BACKEND=supabase (default when DATABASE_URL set) | fastapi (legacy proxy). */
export function engineBackend(): "supabase" | "fastapi" {
  const flag = (process.env.ENGINE_BACKEND || "").trim().toLowerCase();
  if (flag === "fastapi") return "fastapi";
  if (flag === "supabase") return "supabase";
  return pgConfigured() ? "supabase" : "fastapi";
}
