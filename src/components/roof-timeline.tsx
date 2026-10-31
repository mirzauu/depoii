"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Roof3DButton } from "@/components/roof-3d-button";

interface RoofTimelineProps {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  parcelId?: string | null;
  className?: string;
}

interface TimelineEntry {
  year: string;
  releaseId: string;
  vintage: string;
}

const TIMELINE_YEARS: TimelineEntry[] = [
  { year: "2020", releaseId: "18289", vintage: "Jul 2020" },
  { year: "2021", releaseId: "8432", vintage: "Jul 2021" },
  { year: "2022", releaseId: "4905", vintage: "Jun 2022" },
  { year: "2023", releaseId: "47963", vintage: "Jun 2023" },
  { year: "2024", releaseId: "39767", vintage: "Jun 2024" },
];

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
    fullX: x,
    fullY: y,
  };
}

function latLonToTileZXY(lat: number, lon: number, zoom = 19) {
  const { ix: x, iy: y } = latLonToTileFraction(lat, lon, zoom);
  return { z: zoom, x, y };
}

function getWaybackTileUrl(releaseId: string, z: number, y: number, x: number) {
  return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${releaseId}/${z}/${y}/${x}`;
}

interface BoundaryData {
  success: boolean;
  ring: [number, number][];
}

/**
 * Projects GIS coordinates onto 800x600 image:
 * Uses precision tile-fraction transform matching zoom-19 3x3 stitch for all years (2020-2024)
 */
function projectGisToSvg(
  ring: [number, number][],
  centerLat: number,
  centerLng: number,
  width = 800,
  height = 600,
  zoom = 19
): [number, number][] {
  const centerT = latLonToTileFraction(centerLat, centerLng, zoom);
  const centerPixelX = Math.round(256 + centerT.fx * 256);
  const centerPixelY = Math.round(256 + centerT.fy * 256);

  const targetW = Math.min(width, 768);
  const targetH = Math.min(height, 768);

  let cropLeft = Math.max(0, centerPixelX - Math.floor(targetW / 2));
  let cropTop = Math.max(0, centerPixelY - Math.floor(targetH / 2));
  if (cropLeft + targetW > 768) cropLeft = 768 - targetW;
  if (cropTop + targetH > 768) cropTop = 768 - targetH;
  if (cropLeft < 0) cropLeft = 0;
  if (cropTop < 0) cropTop = 0;

  const scaleX = width / targetW;
  const scaleY = height / targetH;

  return ring.map(([ptLng, ptLat]) => {
    const ptT = latLonToTileFraction(ptLat, ptLng, zoom);
    const rawPixelX = (ptT.fullX - (centerT.ix - 1)) * 256;
    const rawPixelY = (ptT.fullY - (centerT.iy - 1)) * 256;
    const imgX = (rawPixelX - cropLeft) * scaleX;
    const imgY = (rawPixelY - cropTop) * scaleY;
    return [Math.round(imgX * 10) / 10, Math.round(imgY * 10) / 10];
  });
}

export function RoofTimeline({ lat, lng, address, parcelId, className }: RoofTimelineProps) {
  const [index, setIndex] = useState(TIMELINE_YEARS.length - 1); // default to latest year (2024)
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [boundary, setBoundary] = useState<BoundaryData | null>(null);

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const { z, x, y } = latLonToTileZXY(lat, lng, 19);
  const current = TIMELINE_YEARS[index];

  // All timeline years (2020-2024) use the consistent Option 1 Lanczos3 unsharp-enhanced composite
  const timelineApiUrl = parcelId
    ? `/api/timeline-aerial/${encodeURIComponent(parcelId)}/${current.year}?lat=${lat}&lng=${lng}&v=hd5`
    : null;
  const wmtsTileUrl = getWaybackTileUrl(current.releaseId, z, y, x);

  const preferredSrc = timelineApiUrl || wmtsTileUrl;
  const [activeSrc, setActiveSrc] = useState(preferredSrc);

  useEffect(() => {
    setActiveSrc(preferredSrc);
    setIsLoading(true);
    setHasError(false);
  }, [preferredSrc, index]);

  // Preload all years in background for instant switching
  useEffect(() => {
    if (parcelId) {
      TIMELINE_YEARS.forEach((item) => {
        const img = new Image();
        img.src = `/api/timeline-aerial/${encodeURIComponent(parcelId)}/${item.year}?lat=${lat}&lng=${lng}&v=hd5`;
      });
    }
  }, [parcelId, lat, lng]);

  // Fetch official CAD legal parcel boundary from City of Dallas GIS
  useEffect(() => {
    if (parcelId) {
      fetch(`/api/parcel-boundary/${encodeURIComponent(parcelId)}?lat=${lat}&lng=${lng}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.ring) && data.ring.length > 2) {
            setBoundary(data);
          }
        })
        .catch(() => {});
    }
  }, [parcelId, lat, lng]);

  const boundaryPoints = useMemo(() => {
    if (!boundary?.ring || !lat || !lng) return [];
    try {
      return projectGisToSvg(boundary.ring, lat, lng, 800, 600, 19);
    } catch {
      return [];
    }
  }, [boundary, lat, lng]);

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(TIMELINE_YEARS.length - 1, i + 1));

  return (
    <div className={cn("w-full", className)}>
      {/* Minimal Header */}
      <div className="flex items-center justify-between pb-2 text-xs">
        <span className="font-medium text-foreground tracking-tight">Roof History</span>

        <div className="flex items-center gap-1.5">
          {/* Minimal Year Tabs */}
          <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-0.5">
            {TIMELINE_YEARS.map((t, idx) => (
              <button
                key={t.year}
                type="button"
                onClick={() => setIndex(idx)}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors cursor-pointer",
                  idx === index
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.year}
              </button>
            ))}
          </div>

          {/* Boundary Line Toggle Button */}
          {boundary && (
            <button
              type="button"
              onClick={() => setShowBoundary(!showBoundary)}
              title={showBoundary ? "Hide parcel boundary" : "Show parcel boundary"}
              className={cn(
                "flex items-center justify-center size-6 rounded border transition cursor-pointer",
                showBoundary
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              <Layers className="size-3" />
            </button>
          )}

          {/* 3D Model Launcher */}
          <Roof3DButton lat={lat} lng={lng} address={address} variant="pill" />
        </div>
      </div>

      {/* Viewport: Clean, borderless chrome, pure image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-neutral-950 select-none">
        {/* Loading Spinner */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30 backdrop-blur-xs">
            <span className="size-4 animate-spin rounded-full border border-foreground/30 border-t-foreground" />
          </div>
        )}

        {hasError ? (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
            Image unavailable
          </div>
        ) : (
          <img
            key={activeSrc}
            src={activeSrc}
            alt={`Aerial capture ${current.vintage} for ${address || "property"}`}
            className="size-full object-cover"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              if (activeSrc !== wmtsTileUrl) {
                setActiveSrc(wmtsTileUrl);
              } else {
                setIsLoading(false);
                setHasError(true);
              }
            }}
          />
        )}

        {/* Boundary Overlay: Bold Red Border around Footprint / Lot */}
        {showBoundary && boundaryPoints.length > 2 && (
          <svg
            viewBox="0 0 800 600"
            className="pointer-events-none absolute inset-0 size-full z-10"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="red-line-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.9" />
              </filter>
            </defs>
            <polygon
              points={boundaryPoints.map(([px, py]) => `${px},${py}`).join(" ")}
              fill="none"
              stroke="#ef4444"
              strokeWidth={3}
              filter="url(#red-line-shadow)"
            />
          </svg>
        )}

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          aria-label="Previous year"
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 z-20 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition hover:bg-black/90 active:scale-95 disabled:opacity-0 disabled:pointer-events-none shadow-sm cursor-pointer"
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={next}
          disabled={index === TIMELINE_YEARS.length - 1}
          aria-label="Next year"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-20 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition hover:bg-black/90 active:scale-95 disabled:opacity-0 disabled:pointer-events-none shadow-sm cursor-pointer"
          )}
        >
          <ChevronRight className="size-4" />
        </button>

        {/* Subtle date stamp bottom right */}
        <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] font-mono text-white/60 drop-shadow-xs">
          {current.vintage}
        </span>
      </div>
    </div>
  );
}
