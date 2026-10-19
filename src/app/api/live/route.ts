import { loadLive } from "@/lib/live/load";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
      try {
        const data = await loadLive(
          { stormId: url.searchParams.get("storm"), refresh: url.searchParams.get("refresh") === "1", jurisdiction: url.searchParams.get("jurisdiction") },
          (done, total) => send({ done, total }),
        );
        send({ data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The public feeds did not respond.";
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
