import { readFile, writeFile, mkdir } from "node:fs/promises";
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

  try {
    const { requireUser } = await import("@/lib/auth");
    const user = await requireUser();
    if (user.platformRole !== "superadmin") {
      const { canOrgAccessParcel } = await import("@/lib/territories");
      const access = await canOrgAccessParcel(user.orgId, id, false);
      if (!access.allowed) {
        return new Response(fallbackSvg(id, "Restricted Territory"), {
          headers: { "Content-Type": "image/svg+xml" },
          status: 403,
        });
      }
    }
  } catch {
    return new Response(fallbackSvg(id, "Sign In Required"), {
      headers: { "Content-Type": "image/svg+xml" },
      status: 401,
    });
  }

  const stripped = id
    .replace(/^DCAD-PARCEL-/i, "")
    .replace(/^TAD-PARCEL-/i, "")
    .replace(/^NYC-PLUTO-/i, "");
  const prefixedDcad = id.startsWith("DCAD-PARCEL-") ? id : `DCAD-PARCEL-${stripped}`;
  const prefixedTad = id.startsWith("TAD-PARCEL-") ? id : `TAD-PARCEL-${stripped}`;
  const prefixedPluto = id.startsWith("NYC-PLUTO-") ? id : `NYC-PLUTO-${stripped}`;

  const candidates = Array.from(new Set([id, stripped, prefixedDcad, prefixedTad, prefixedPluto])).filter(Boolean);

  // 1. Try reading pre-rendered local file if on disk
  for (const cand of candidates) {
    for (const prefix of ["thumb_", ""]) {
      for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
        const filePath = path.join(DIR, `${prefix}${cand}${ext}`);
        try {
          const file = await readFile(filePath);
          const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
          return new Response(new Uint8Array(file), {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
            },
          });
        } catch {
          // not found on disk, continue
        }
      }
    }
  }

  // 2. Check warehouse.scored_parcel_leads for aerial_snapshot_url
  let scoredAddress: string | undefined;
  let scoredCity: string | undefined;
  let scoredState: string | undefined;
  let scoredZip: string | undefined;

  try {
    const scoredRow = await queryOne<{
      aerial_snapshot_url?: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    }>(
      `SELECT aerial_snapshot_url, address, city, state, zip_code
       FROM warehouse.scored_parcel_leads
       WHERE parcel_id = ANY($1::text[])
       LIMIT 1`,
      [candidates],
    );

    if (scoredRow) {
      scoredAddress = scoredRow.address;
      scoredCity = scoredRow.city;
      scoredState = scoredRow.state;
      scoredZip = scoredRow.zip_code;

      if (scoredRow.aerial_snapshot_url) {
        const urlStr = scoredRow.aerial_snapshot_url.trim();

        // 2a. If file path on disk
        if (urlStr.includes("/") || urlStr.includes("\\")) {
          const resolvedPath = path.isAbsolute(urlStr) ? urlStr : path.join(process.cwd(), urlStr);
          try {
            const diskFile = await readFile(resolvedPath);
            const ext = path.extname(resolvedPath).toLowerCase();
            const ct = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
            return new Response(new Uint8Array(diskFile), {
              headers: {
                "Content-Type": ct,
                "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
              },
            });
          } catch {
            // disk path in DB not present on this machine, fall through to live fetch
          }
        }

        // 2b. If base64 data URI
        if (urlStr.startsWith("data:image/")) {
          const commaIdx = urlStr.indexOf(",");
          if (commaIdx !== -1) {
            const meta = urlStr.slice(5, commaIdx);
            const ct = meta.split(";")[0] || "image/png";
            const b64 = urlStr.slice(commaIdx + 1);
            const buf = Buffer.from(b64, "base64");
            return new Response(buf, {
              headers: {
                "Content-Type": ct,
                "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
              },
            });
          }
        }

        // 2c. If remote HTTP URL
        if (/^https?:\/\//i.test(urlStr)) {
          try {
            const remoteRes = await fetch(urlStr, { signal: AbortSignal.timeout(6000) });
            if (remoteRes.ok) {
              const remoteBuf = await remoteRes.arrayBuffer();
              const ct = remoteRes.headers.get("content-type") || "image/png";
              return new Response(remoteBuf, {
                headers: {
                  "Content-Type": ct,
                  "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
                },
              });
            }
          } catch {
            // remote fetch failed, continue to coordinates
          }
        }
      }
    }
  } catch (err) {
    console.warn("[aerial] Error querying scored_parcel_leads:", err);
  }

  // 3. Query parcel coordinates from warehouse.parcels or warehouse.live_parcels
  let lat: number = NaN;
  let lng: number = NaN;
  let address = scoredAddress;
  let city = scoredCity || "Dallas";
  let state = scoredState || "TX";
  let zipCode = scoredZip;

  try {
    const parcelRow = await queryOne<{
      latitude: number | string;
      longitude: number | string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    }>(
      `SELECT latitude, longitude, address, city, state, zip_code
       FROM warehouse.parcels
       WHERE id = ANY($1::text[]) OR account_number = ANY($1::text[])
       LIMIT 1`,
      [candidates],
    );

    if (parcelRow) {
      lat = Number(parcelRow.latitude);
      lng = Number(parcelRow.longitude);
      if (parcelRow.address) address = parcelRow.address;
      if (parcelRow.city) city = parcelRow.city;
      if (parcelRow.state) state = parcelRow.state;
      if (parcelRow.zip_code) zipCode = parcelRow.zip_code;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      const liveRow = await queryOne<{ lat: number; lng: number; address?: string; city?: string }>(
        `SELECT lat, lng, address, city
         FROM warehouse.live_parcels
         WHERE account = ANY($1::text[])
         LIMIT 1`,
        [candidates],
      );
      if (liveRow?.lat && liveRow?.lng) {
        lat = Number(liveRow.lat);
        lng = Number(liveRow.lng);
        if (liveRow.address) address = liveRow.address;
        if (liveRow.city) city = liveRow.city;
      }
    }
  } catch (err) {
    console.warn("[aerial] Error querying coordinates:", err);
  }

  // 4. Geocode fallback if coordinates not found in DB
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    if (address) {
      const coords = await geocodeAddress(address, city, state);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    if (zipCode) {
      const zipData = zipcodes.lookup(zipCode.slice(0, 5));
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

  // 5. Fetch real satellite imagery from ESRI World Imagery
  try {
    const satellite = await fetchEsriSatellite(lat, lng);
    if (satellite) {
      // Opportunistically cache to local thumbnails folder
      try {
        await mkdir(DIR, { recursive: true });
        await writeFile(path.join(DIR, `thumb_${id}.png`), Buffer.from(satellite.buffer));
      } catch {
        // Silently skip if disk caching is restricted or read-only
      }

      return new Response(satellite.buffer, {
        headers: {
          "Content-Type": satellite.contentType,
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    }
  } catch (err) {
    console.error(`[aerial] Failed fetching ESRI satellite for ${id}:`, err);
  }

  // 6. Clean SVG fallback only as absolute last resort
  return new Response(fallbackSvg(id, address), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
