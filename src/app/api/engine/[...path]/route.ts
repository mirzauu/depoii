export const dynamic = "force-dynamic";

import { engineBackend, pgConfigured } from "@/lib/pg";
import * as wh from "@/lib/warehouse";
import * as intel from "@/lib/warehouse-intelligence";
import { enqueueJob, getJob } from "@/lib/jobs";

const READ_PATHS = [
  /^health$/,
  /^permits\/(search|active-jobsites|roof-aging-alarm|multiphase-projects|stats|pre-permit-stats|cities)$/,
  /^permits\/parcels\/[^/]+$/,
  /^parcels(\/(search|dallas|tarrant|dark-market\/overdue|browse))?$/,
  /^parcels\/browse\/[^/]+$/,
  /^parcels\/[^/]+$/,
  /^contractors\/(leaderboard|directory|profile)$/,
  /^storms\/(active-swaths|live-alerts|hail-events)$/,
  /^intelligence\/unresolved-exposure$/,
  /^intelligence\/leads\/ranked$/,
  /^brief$/,
  /^verifications\/(stats|evidence-card\/[^/]+|stream\/[^/]+|jobs\/[^/]+)$/,
  /^intelligence\/leads\/[^/]+\/dossier$/,
  /^locations\/(hierarchy|states|cities)$/,
];

const WRITE_PATHS = [/^verifications\/(trigger-city|verify\/[^/]+)$/];

type AuthUser = { id: string; orgId: string; platformRole?: string };

async function sessionOrg(): Promise<{ orgId: string; userId: string; platformRole: string }> {
  const { requireUser } = await import("@/lib/auth");
  try {
    const user = await requireUser();
    return { orgId: user.orgId, userId: user.id, platformRole: user.platformRole || "" };
  } catch {
    return { orgId: "", userId: "", platformRole: "" };
  }
}

/** Local (Supabase) handlers. Returns undefined to fall through to proxy. */
async function localGet(path: string[], q: URLSearchParams, user?: AuthUser | null): Promise<unknown | undefined> {
  const joined = path.join("/");
  switch (joined) {
    case "health":
      return { status: "healthy", engine: "nextjs-warehouse", database: pgConfigured() ? "supabase" : "unset" };
    case "permits/search": return wh.permitsSearch(q);
    case "permits/stats": return wh.permitsStats();
    case "permits/pre-permit-stats": return wh.prePermitStats(q);
    case "permits/cities": return wh.permitsCities();
    case "permits/active-jobsites": return wh.activeJobsites(q);
    case "permits/roof-aging-alarm": {
      if (!q.get("jurisdiction")) q.set("jurisdiction", "Dallas, TX");
      return wh.roofAging(q, user ?? undefined);
    }
    case "permits/multiphase-projects": return wh.multiphase(q);
    case "contractors/leaderboard":
    case "contractors/directory": return wh.contractors(q);
    case "contractors/profile": return wh.contractorProfile(q);
    case "locations/hierarchy": return wh.locations("hierarchy");
    case "locations/states": return wh.locations("states");
    case "locations/cities": return wh.locations("cities");
    case "parcels":
    case "parcels/search":
    case "parcels/dallas":
    case "parcels/tarrant": {
      if (joined === "parcels/dallas") q.set("city", "Dallas");
      if (joined === "parcels/tarrant") q.set("city", "Fort Worth");
      return wh.parcelsSearch(q);
    }
    case "parcels/browse": return wh.parcelsBrowse(q);
    case "parcels/dark-market/overdue": {
      if (!q.get("jurisdiction")) q.set("jurisdiction", "Dallas, TX");
      return wh.darkMarket(q, user ?? undefined);
    }
    case "storms/active-swaths": return intel.activeSwaths();
    case "storms/live-alerts": return intel.liveAlerts(q);
    case "storms/hail-events": return intel.hailEvents(q);
    case "intelligence/unresolved-exposure": return intel.unresolvedExposure(q, user ?? undefined);
    case "intelligence/leads/ranked": return intel.rankedLeads(q, user ?? undefined);
    case "brief": return intel.mondayBrief(q, user ?? undefined);
    case "verifications/stats": return intel.verificationStats();
  }
  if (path[0] === "permits" && path[1] === "parcels" && path[2]) {
    const parcelId = decodeURIComponent(path[2]);
    if (user && user.platformRole !== "superadmin") {
      const { canOrgAccessParcel } = await import("@/lib/territories");
      const access = await canOrgAccessParcel(user.orgId, parcelId, false);
      if (!access.allowed) {
        return { __status: 403, error: access.reason || "This property is outside your subscribed territories." };
      }
    }
    return (await wh.permitsParcel(parcelId)) ?? notFound();
  }
  if (path[0] === "parcels" && path[1] === "browse" && path[2]) {
    const parcelId = decodeURIComponent(path[2]);
    if (user && user.platformRole !== "superadmin") {
      const { canOrgAccessParcel } = await import("@/lib/territories");
      const access = await canOrgAccessParcel(user.orgId, parcelId, false);
      if (!access.allowed) {
        return { __status: 403, error: access.reason || "This property is outside your subscribed territories." };
      }
    }
    return (await wh.parcelBrowseDetail(parcelId)) ?? notFound();
  }
  if (path[0] === "parcels" && path[1]) {
    const parcelId = decodeURIComponent(path[1]);
    if (user && user.platformRole !== "superadmin") {
      const { canOrgAccessParcel } = await import("@/lib/territories");
      const access = await canOrgAccessParcel(user.orgId, parcelId, false);
      if (!access.allowed) {
        return { __status: 403, error: access.reason || "This property is outside your subscribed territories." };
      }
    }
    return (await wh.permitsParcel(parcelId)) ?? notFound();
  }
  if (path[0] === "intelligence" && path[1] === "leads" && path[3] === "dossier") {
    const parcelId = decodeURIComponent(path[2]);
    if (user && user.platformRole !== "superadmin") {
      const { canOrgAccessParcel } = await import("@/lib/territories");
      const access = await canOrgAccessParcel(user.orgId, parcelId, false);
      if (!access.allowed) {
        return { __status: 403, error: access.reason || "This property is outside your subscribed territories." };
      }
    }
    return (await intel.leadDossier(parcelId)) ?? notFound();
  }
  if (path[0] === "verifications" && path[1] === "evidence-card" && path[2]) {
    const parcelId = decodeURIComponent(path[2]);
    if (user && user.platformRole !== "superadmin") {
      const { canOrgAccessParcel } = await import("@/lib/territories");
      const access = await canOrgAccessParcel(user.orgId, parcelId, false);
      if (!access.allowed) {
        return { __status: 403, error: access.reason || "This property is outside your subscribed territories." };
      }
    }
    return (await intel.evidenceCard(parcelId)) ?? notFound();
  }
  if (path[0] === "verifications" && (path[1] === "jobs" || path[1] === "stream") && path[2]) {
    const orgId = user?.orgId || (await sessionOrg()).orgId;
    const job = await getJob(decodeURIComponent(path[2]), orgId);
    if (!job) return notFound();
    return { job_id: job.id, status: job.status, progress: job.progress, step: job.step, message: job.message, result: job.result, error: job.error, type: job.type };
  }
  return undefined;
}

function notFound(): { __status: number; error: string } {
  return { __status: 404, error: "Not found in the warehouse." };
}

async function localPost(path: string[], body: Record<string, unknown>): Promise<unknown | undefined> {
  const joined = path.join("/");
  const { orgId, userId } = await sessionOrg();
  if (!orgId) return { __status: 401, error: "Sign in required." };
  if (joined === "verifications/trigger-city") {
    const job = await enqueueJob({
      type: "verify_city",
      orgId, userId,
      payload: { jurisdiction: String(body.jurisdiction || "Fort Worth, TX"), state: String(body.state || "TX"), max_aerials: Number(body.max_aerials || 50) },
    });
    return { job_id: job.id, jurisdiction: String(body.jurisdiction || ""), status: job.status, stream_url: `/api/engine/verifications/jobs/${job.id}` };
  }
  if (path[0] === "verifications" && path[1] === "verify" && path[2]) {
    const job = await enqueueJob({ type: "verify_lead", orgId, userId, payload: { lead_id: decodeURIComponent(path[2]) } });
    return { job_id: job.id, status: job.status, stream_url: `/api/engine/verifications/jobs/${job.id}` };
  }
  return undefined;
}

function respond(body: unknown, path: string[]) {
  if (body && typeof body === "object" && "__status" in body) {
    const b = body as { __status: number; error: string };
    return Response.json({ error: b.error }, { status: b.__status });
  }
  const joined = path.join("/");
  if (joined === "brief" || joined === "intelligence/leads/ranked") {
    // Keep the customer-release filter the proxy applied before.
    return import("@/lib/customer-rows").then(({ filterCustomerPayload }) => Response.json(filterCustomerPayload(body)));
  }
  return Response.json(body);
}

/* ---------------- legacy FastAPI proxy (ENGINE_BACKEND=fastapi) ---------------- */

async function proxy(req: Request, path: string[], method: "GET" | "POST") {
  const route = path.map(encodeURIComponent).join("/");
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return Response.json({ error: "DEPOII_ENGINE_URL is not set." }, { status: 503 });
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const { orgId } = await sessionOrg();
  try {
    const search = method === "GET" ? new URL(req.url).search : "";
    const res = await fetch(`${base}/api/v1/${route}${search}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
        "x-depoii-key": process.env.DEPOII_ENGINE_KEY || "",
        "x-depoii-org": orgId,
      },
      ...(method === "POST" ? { body: JSON.stringify(await req.json().catch(() => ({}))) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    const headers = { "content-type": "application/json", "x-correlation-id": res.headers.get("x-correlation-id") || correlationId };
    if (res.ok) {
      const joined = path.join("/");
      if (method === "GET" && (joined === "brief" || joined === "intelligence/leads/ranked")) {
        const { filterCustomerPayload } = await import("@/lib/customer-rows");
        try { return Response.json(filterCustomerPayload(JSON.parse(text)), { status: 200, headers }); } catch { return new Response(text, { status: 200, headers }); }
      }
      return new Response(text, { status: 200, headers });
    }
    let detail = `The data engine returned HTTP ${res.status}.`;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.detail === "string") detail = parsed.detail;
      else if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) detail = String(parsed.detail[0].msg);
    } catch {}
    return Response.json({ error: detail, status: res.status, correlationId }, { status: res.status, headers });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "The data engine did not answer within 30 seconds." : "The data engine could not be reached.";
    return Response.json({ error: message, correlationId }, { status: 502 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!READ_PATHS.some((re) => re.test(path.join("/")))) {
    return Response.json({ error: `The data engine route ${path.join("/")} is not available from this app.` }, { status: 404 });
  }

  let user: AuthUser | null = null;
  const isHealth = path.length === 1 && path[0] === "health";
  if (!isHealth) {
    try {
      const { requireUser } = await import("@/lib/auth");
      user = await requireUser();
    } catch {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }
  }

  if (engineBackend() === "supabase") {
    try {
      const body = await localGet(path, new URL(req.url).searchParams, user);
      if (body !== undefined) return respond(body, path);
    } catch (err) {
      console.error("[engine] warehouse query failed", path.join("/"), err);
      return Response.json({ error: "The warehouse query failed." }, { status: 502 });
    }
  }
  return proxy(req, path, "GET");
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!WRITE_PATHS.some((re) => re.test(path.join("/")))) {
    return Response.json({ error: `The data engine route ${path.join("/")} cannot receive POST requests.` }, { status: 404 });
  }

  try {
    const { requireUser } = await import("@/lib/auth");
    await requireUser();
  } catch {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  if (engineBackend() === "supabase") {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const result = await localPost(path, body);
      if (result !== undefined) return respond(result, path);
    } catch (err) {
      console.error("[engine] job enqueue failed", err);
      return Response.json({ error: "Could not queue the job." }, { status: 502 });
    }
    return Response.json({ error: "Not available." }, { status: 404 });
  }
  return proxy(req, path, "POST");
}
