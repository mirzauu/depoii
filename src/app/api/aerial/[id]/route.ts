import { readFile } from "node:fs/promises";
import path from "node:path";
import { queryOne } from "@/lib/pg";

export const dynamic = "force-dynamic";

const DIR = process.env.DEPOII_THUMBNAIL_DIR || path.join(process.cwd(), "Roofx", "thumbnails");

function fallbackSvg(id: string, address?: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1" />
      </pattern>
    </defs>
    <rect width="800" height="600" fill="url(#bg)" />
    <rect width="800" height="600" fill="url(#grid)" />
    <circle cx="400" cy="300" r="160" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4" />
    <circle cx="400" cy="300" r="8" fill="#38bdf8" opacity="0.8" />
    <line x1="400" y1="120" x2="400" y2="480" stroke="#38bdf8" stroke-width="1" opacity="0.2" />
    <line x1="220" y1="300" x2="580" y2="300" stroke="#38bdf8" stroke-width="1" opacity="0.2" />
    <rect x="340" y="240" width="120" height="120" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.5" />
    <text x="400" y="380" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" text-anchor="middle">
      ${address ? address.replace(/&/g, "&amp;").replace(/</g, "&lt;") : "High-Resolution Satellite Survey"}
    </text>
    <text x="400" y="405" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="12" text-anchor="middle">
      CAD Parcel ID: ${id.replace(/&/g, "&amp;").replace(/</g, "&lt;")}
    </text>
    <text x="400" y="430" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="11" text-anchor="middle" font-weight="500">
      Aerial imagery resolving from GIS registry
    </text>
  </svg>`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw || "").trim();
  if (!id || id.includes("..") || id.includes("/") || id.includes("\\") || !/^[A-Za-z0-9_.-]+$/.test(id)) {
    return new Response("Bad id", { status: 400 });
  }

  // 1. Try reading pre-rendered local file if on disk
  try {
    const file = await readFile(path.join(DIR, `thumb_${id}.png`));
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" },
    });
  } catch {
    // Expected on deployed serverless environments where local thumbnail disk cache isn't present
  }

  // 2. Query parcel coordinates from PostgreSQL database
  try {
    const row = await queryOne<{ latitude: number | string; longitude: number | string; address?: string }>(
      `select latitude, longitude, address from warehouse.parcels where id = $1
       union
       select latitude, longitude, address from warehouse.scored_parcel_leads where parcel_id = $1
       union
       select lat as latitude, lng as longitude, address from warehouse.live_parcels where account = $1
       limit 1`,
      [id],
    );

    const lat = Number(row?.latitude);
    const lng = Number(row?.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      // 3. Fetch on-the-fly from ESRI World Imagery
      const delta = 0.0018; // approx 200m bounding box
      const minx = lng - delta;
      const maxx = lng + delta;
      const miny = lat - delta * 0.75;
      const maxy = lat + delta * 0.75;
      const esriUrl = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minx},${miny},${maxx},${maxy}&bboxSR=4326&size=800,600&f=image`;

      const res = await fetch(esriUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0" },
      });

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/png";
        return new Response(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
          },
        });
      }
    }

    // 4. Clean SVG fallback if coordinates cannot be resolved or ESRI fails
    return new Response(fallbackSvg(id, row?.address), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error(`[aerial] Error resolving aerial for ${id}:`, err);
    return new Response(fallbackSvg(id), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
