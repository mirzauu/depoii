import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const CACHE_DIR = path.join(process.cwd(), "public", "aerial_cache");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
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
    ])
  ).filter(Boolean);

  // 1. Check local cache
  for (const cand of candidates) {
    const cacheFile = path.join(CACHE_DIR, cand, "boundary.json");
    try {
      const data = await readFile(cacheFile, "utf8");
      return new Response(data, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
      });
    } catch {}
  }

  // 2. Query official City of Dallas GIS (DallasTaxParcels)
  try {
    let gisUrl = "";
    if (strippedId && /^\d+$/.test(strippedId)) {
      gisUrl = `https://gis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0/query?where=ACCT='${strippedId}'&outFields=*&returnGeometry=true&outSR=4326&f=json`;
    } else if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
      gisUrl = `https://gis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&outSR=4326&f=json`;
    }

    if (gisUrl) {
      const res = await fetch(gisUrl, {
        headers: { "User-Agent": "Depoii/1.0" },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = await res.json();
        const feature = json.features?.[0];
        if (feature?.geometry?.rings?.length) {
          const ring = feature.geometry.rings[0]; // Primary boundary polygon
          const attrs = feature.attributes || {};

          // Calculate bounding box and centroid
          let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
          let sumLng = 0, sumLat = 0;
          for (const [pLng, pLat] of ring) {
            if (pLng < minLng) minLng = pLng;
            if (pLng > maxLng) maxLng = pLng;
            if (pLat < minLat) minLat = pLat;
            if (pLat > maxLat) maxLat = pLat;
            sumLng += pLng;
            sumLat += pLat;
          }

          const centroidLng = sumLng / ring.length;
          const centroidLat = sumLat / ring.length;

          const boundaryData = {
            success: true,
            account: attrs.ACCT || strippedId,
            address: `${attrs.ST_NUM || ""} ${attrs.ST_NAME || ""}`.trim(),
            legalDescription: attrs.LEGAL_1 || "",
            areaSqFt: attrs.AREA_FEET || attrs["SHAPE.STArea()"] || null,
            ring,
            centroid: { lat: centroidLat, lng: centroidLng },
            bbox: { minLat, minLng, maxLat, maxLng },
          };

          const jsonStr = JSON.stringify(boundaryData);

          // Save to cache
          const targetDir = path.join(CACHE_DIR, id);
          mkdir(targetDir, { recursive: true }).catch(() => {});
          writeFile(path.join(targetDir, "boundary.json"), jsonStr).catch(() => {});

          return new Response(jsonStr, {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=604800",
            },
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[parcel-boundary] GIS query failed for ${id}:`, err);
  }

  return new Response(JSON.stringify({ success: false, error: "Boundary not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

