import { readFile } from "node:fs/promises";
import path from "node:path";

const DIST_FILES = new Set(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]);

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  if (!DIST_FILES.has(file)) {
    return new Response("Not found", { status: 404 });
  }

  const full = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", file);
  const source = await readFile(full, "utf8");
  const body = source.replace(/\n\/\/# sourceMappingURL=.*\s*$/, "\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
