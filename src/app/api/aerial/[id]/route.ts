import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = process.env.DEPOII_THUMBNAIL_DIR || path.join(process.cwd(), "Roofx", "thumbnails");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw || "").trim();
  // Parcel ids are DCAD-/TAD-PARCEL-… or account numbers. Reject path traversal only.
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\") || !/^[A-Za-z0-9_.-]+$/.test(id)) {
    return new Response("Bad id", { status: 400 });
  }
  try {
    const file = await readFile(path.join(DIR, `thumb_${id}.png`));
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
