export const dynamic = "force-dynamic";

const READ_PATHS = [
  /^health$/,
  /^permits\/(search|active-jobsites|roof-aging-alarm|multiphase-projects|stats|cities)$/,
  /^permits\/parcels\/[^/]+$/,
  /^parcels(\/(search|dallas|tarrant|dark-market\/overdue|browse))?$/,
  /^parcels\/browse\/[^/]+$/,
  /^parcels\/[^/]+$/,
  /^contractors\/(leaderboard|directory)$/,
  /^storms\/(active-swaths|live-alerts|hail-events)$/,
  /^intelligence\/unresolved-exposure$/,
  /^intelligence\/leads\/ranked$/,
  /^brief$/,
  /^verifications\/(stats|evidence-card\/[^/]+|stream\/[^/]+)$/,
  /^intelligence\/leads\/[^/]+\/dossier$/,
  /^locations\/(hierarchy|states|cities)$/,
];

const WRITE_PATHS = [
  /^verifications\/(trigger-city|verify\/[^/]+)$/,
];

async function orgHeader() {
  const { requireUser } = await import("@/lib/auth");
  try {
    const user = await requireUser();
    return user.orgId;
  } catch {
    return "";
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const route = path.map(encodeURIComponent).join("/");
  if (!READ_PATHS.some((re) => re.test(path.join("/")))) {
    return Response.json({ error: `The data engine route ${path.join("/")} is not available from this app.` }, { status: 404 });
  }
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return Response.json({ error: "DEPOII_ENGINE_URL is not set." }, { status: 503 });

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const search = new URL(req.url).search;
  const isSse = path[0] === "verifications" && path[1] === "stream";

  try {
    const res = await fetch(`${base}/api/v1/${route}${search}`, {
      headers: {
        Accept: isSse ? "text/event-stream" : "application/json",
        "X-Correlation-ID": correlationId,
        "x-depoii-key": process.env.DEPOII_ENGINE_KEY || "",
        "x-depoii-org": await orgHeader(),
      },
      cache: "no-store",
      ...(isSse ? {} : { signal: AbortSignal.timeout(30_000) }),
    });

    if (isSse || res.headers.get("content-type")?.includes("text/event-stream")) {
      return new Response(res.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "x-correlation-id": res.headers.get("x-correlation-id") || correlationId,
        },
      });
    }

    const text = await res.text();
    const headers = { "content-type": "application/json", "x-correlation-id": res.headers.get("x-correlation-id") || correlationId };
    if (res.ok) {
      const joined = path.join("/");
      if (joined === "brief" || joined === "intelligence/leads/ranked") {
        const { filterCustomerPayload } = await import("@/lib/customer-rows");
        let parsed: unknown = {};
        try { parsed = JSON.parse(text); } catch { return new Response(text, { status: 200, headers }); }
        return Response.json(filterCustomerPayload(parsed), { status: 200, headers });
      }
      return new Response(text, { status: 200, headers });
    }
    let detail = `The data engine returned HTTP ${res.status}.`;
    try {
      const body = JSON.parse(text);
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) detail = String(body.detail[0].msg);
    } catch {}
    return Response.json({ error: detail, status: res.status, correlationId }, { status: res.status, headers });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "The data engine did not answer within 30 seconds." : "The data engine could not be reached.";
    return Response.json({ error: message, correlationId }, { status: 502 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const route = path.map(encodeURIComponent).join("/");
  if (!WRITE_PATHS.some((re) => re.test(path.join("/")))) {
    return Response.json({ error: `The data engine route ${path.join("/")} cannot receive POST requests.` }, { status: 404 });
  }
  const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) return Response.json({ error: "DEPOII_ENGINE_URL is not set." }, { status: 503 });

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${base}/api/v1/${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Correlation-ID": correlationId,
        "x-depoii-key": process.env.DEPOII_ENGINE_KEY || "",
        "x-depoii-org": await orgHeader(),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(path[1] === "verify" ? 120_000 : 30_000),
    });

    const text = await res.text();
    const headers = { "content-type": "application/json", "x-correlation-id": res.headers.get("x-correlation-id") || correlationId };
    if (res.ok) return new Response(text, { status: 200, headers });
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
