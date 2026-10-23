import { readFile } from "node:fs/promises";
import path from "node:path";
import { queryOne } from "@/lib/pg";
import zipcodes from "zipcodes";

export const dynamic = "force-dynamic";

const DIR = process.env.DEPOII_THUMBNAIL_DIR || path.join(process.cwd(), "Roofx", "thumbnails");

async function geocodeAddress(address: string, city = "Dallas", state = "TX"): Promise<{ lat: number; lng: number } | null> {
  try {
    const singleLine = `${address}, ${city}, ${state}`.trim();
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(singleLine)}&f=json&maxLocations=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.candidates?.[0]?.location;
    if (loc?.x != null && loc?.y != null) {
      return { lat: Number(loc.y), lng: Number(loc.x) };
    }
  } catch {
    // Ignore geocode error
  }
  return null;
}

async function fetchEsriSatellite(lat: number, lng: number): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const delta = 0.0016; // ~180m high-resolution rooftop bounding box
    const minx = lng - delta;
    const maxx = lng + delta;
    const miny = lat - delta * 0.75;
    const maxy = lat + delta * 0.75;
    const esriUrl = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minx},${miny},${maxx},${maxy}&bboxSR=4326&size=800,600&f=image`;

    const res = await fetch(esriUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/png";
      return { buffer, contentType };
    }
  } catch (err) {
    console.warn("[aerial] ESRI request failed:", err);
  }
  return null;
}

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

  const stripped = id.replace(/^DCAD-PARCEL-/i, "");
  const prefixed = id.startsWith("DCAD-PARCEL-") ? id : `DCAD-PARCEL-${id}`;

  // 1. Try reading pre-rendered local file if on disk
  for (const filename of [`thumb_${id}.png`, `thumb_${stripped}.png`, `thumb_${prefixed}.png`]) {
    try {
      const file = await readFile(path.join(DIR, filename));
      return new Response(new Uint8Array(file), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" },
      });
    } catch {
      // Continue to database / on-the-fly resolution
    }
  }

  // 2. Query parcel coordinates & address from PostgreSQL database
  try {
    const row = await queryOne<{
      latitude: number | string;
      longitude: number | string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    }>(
      `select latitude, longitude, address, city, state, zip_code from warehouse.parcels
       where id = $1 or id = $2 or id = $3
          or account_number = $1 or account_number = $2 or account_number = $3
       union
       select latitude, longitude, address, city, state, zip_code from warehouse.scored_parcel_leads
       where parcel_id = $1 or parcel_id = $2 or parcel_id = $3
       union
       select lat as latitude, lng as longitude, address, city, state, '' as zip_code from warehouse.live_parcels
       where account = $1 or account = $2 or account = $3 or id::text = $1 or id::text = $2
       limit 1`,
      [id, stripped, prefixed],
    );

    let lat = Number(row?.latitude);
    let lng = Number(row?.longitude);

    // If coordinates are missing from the DB, geocode the address
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      if (row?.address) {
        const coords = await geocodeAddress(row.address, row.city || "Dallas", row.state || "TX");
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }
    }

    // If still missing, check if we have a valid ZIP code
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      if (row?.zip_code) {
        const zipData = zipcodes.lookup(row.zip_code.slice(0, 5));
        if (zipData?.latitude && zipData?.longitude) {
          lat = Number(zipData.latitude);
          lng = Number(zipData.longitude);
        }
      }
    }

    // Default to Dallas metro center coordinates if all else fails
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      lat = 32.7838;
      lng = -96.7824;
    }

    // 3. Fetch real satellite imagery from ESRI World Imagery
    const satellite = await fetchEsriSatellite(lat, lng);
    if (satellite) {
      return new Response(satellite.buffer, {
        headers: {
          "Content-Type": satellite.contentType,
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    }

    // 4. SVG fallback only if ESRI network request completely failed
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
