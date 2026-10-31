import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const CACHE_DIR = path.join(process.cwd(), "public", "aerial_cache");
const THUMB_DIR = process.env.DEPOII_THUMBNAIL_DIR || path.join(process.cwd(), "Roofx", "thumbnails");

const TIMELINE_RELEASES: Record<string, string> = {
  "2020": "18289",
  "2021": "8432",
  "2022": "4905",
  "2023": "47963",
  "2024": "39767",
  "latest": "39767",
};

function latLonToTileFraction(lat: number, lon: number, zoom = 19) {
  const x = ((lon + 180) / 360) * Math.pow(2, zoom);
  const y =
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
    Math.pow(2, zoom);
  return {
    ix: Math.floor(x),
    iy: Math.floor(y),
    fx: x - Math.floor(x),
    fy: y - Math.floor(y),
  };
}

async function fetchTile(releaseId: string, z: number, y: number, x: number): Promise<Buffer> {
  const url = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${releaseId}/${z}/${y}/${x}`;
  const res = await fetch(url, { headers: { "User-Agent": "Depoii/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Enhanced historical rooftop rendering pipeline:
 * 1. 3x3 tile fetch at zoom 19
 * 2. Precision sub-pixel center extraction
 * 3. Lanczos3 sinc kernel interpolation up to 800x600
 * 4. Contrast normalization & glare reduction (recovering white membrane details)
 * 5. High-frequency unsharp mask sharpening roof parapets & HVAC units
 * 6. High quality 95% JPEG output with 4:4:4 chroma (lossless color detail)
 */
async function renderEnhancedPrecisionStitched(lat: number, lng: number, year: string, width = 800, height = 600): Promise<Buffer> {
  const releaseId = TIMELINE_RELEASES[year] || "39767";
  const zoom = 19;
  const { ix, iy, fx, fy } = latLonToTileFraction(lat, lng, zoom);

  const compositeList: { input: Buffer; left: number; top: number }[] = [];
  const fetches: Promise<void>[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tileX = ix + dx;
      const tileY = iy + dy;
      const left = (dx + 1) * 256;
      const top = (dy + 1) * 256;

      fetches.push(
        fetchTile(releaseId, zoom, tileY, tileX)
          .then((buf) => {
            compositeList.push({ input: buf, left, top });
          })
          .catch(() => {})
      );
    }
  }

  await Promise.all(fetches);

  if (compositeList.length < 5) {
    throw new Error(`Insufficient tiles fetched for ${year}: got ${compositeList.length}/9`);
  }

  const centerPixelX = Math.round(256 + fx * 256);
  const centerPixelY = Math.round(256 + fy * 256);

  const targetW = Math.min(width, 768);
  const targetH = Math.min(height, 768);

  let cropLeft = Math.max(0, centerPixelX - Math.floor(targetW / 2));
  let cropTop = Math.max(0, centerPixelY - Math.floor(targetH / 2));

  if (cropLeft + targetW > 768) cropLeft = 768 - targetW;
  if (cropTop + targetH > 768) cropTop = 768 - targetH;
  if (cropLeft < 0) cropLeft = 0;
  if (cropTop < 0) cropTop = 0;

  return await sharp({
    create: {
      width: 768,
      height: 768,
      channels: 3,
      background: { r: 30, g: 30, b: 30 },
    },
  })
    .composite(compositeList)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: targetW,
      height: targetH,
    })
    .resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({
      brightness: 0.94,
      saturation: 1.10,
    })
    .linear(1.08, -10)
    .sharpen({
      sigma: 0.85,
      m1: 1.0,
      m2: 1.8,
    })
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; year: string }> }
) {
  const { id: rawId, year } = await params;
  const id = decodeURIComponent(rawId || "").trim();

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  const strippedId = id
    .replace(/^DCAD-PARCEL-/i, "")
    .replace(/^TAD-PARCEL-/i, "")
    .replace(/^NYC-PLUTO-/i, "");

  const candidates = Array.from(
    new Set([
      id,
      strippedId,
      `DCAD-PARCEL-${strippedId}`,
      `TAD-PARCEL-${strippedId}`,
      `NYC-PLUTO-${strippedId}`,
    ])
  ).filter(Boolean);

  // 1. For all timeline years (2020-2024), check for enhanced stitched cache file (hd_opt_{year}.jpg)
  for (const cand of candidates) {
    const enhancedYearPath = path.join(CACHE_DIR, cand, `hd_opt_${year}.jpg`);
    try {
      const file = await readFile(enhancedYearPath);
      if (file.byteLength > 15000) {
        return new Response(new Uint8Array(file), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
          },
        });
      }
    } catch {}
  }

  // 3. Generate on-the-fly enhanced precision 800x600 stitched rooftop for historical years
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    try {
      const stitchedBuf = await renderEnhancedPrecisionStitched(lat, lng, year, 800, 600);
      const targetPath = path.join(CACHE_DIR, id, `hd_opt_${year}.jpg`);
      mkdir(path.dirname(targetPath), { recursive: true }).catch(() => {});
      writeFile(targetPath, stitchedBuf).catch(() => {});
      return new Response(new Uint8Array(stitchedBuf), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    } catch (err) {
      console.warn(`[timeline-aerial] on-the-fly stitching failed for ${id}/${year}:`, err);
    }
  }

  // 4. Fallback to older tile cache if available
  for (const cand of candidates) {
    const localYearPath = path.join(CACHE_DIR, cand, `${year}.jpg`);
    try {
      const file = await readFile(localYearPath);
      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=604800",
        },
      });
    } catch {}
  }

  return new Response("Not found", { status: 404 });
}
