"use client";

import { useEffect, useRef, useState } from "react";
import { X, Key, ZoomIn, ZoomOut, Layers, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoofInspector3DProps {
  lat: number;
  lng: number;
  address?: string;
  onClose: () => void;
  className?: string;
}

function loadGoogleMapsScript(apiKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps) {
      return resolve((window as any).google);
    }

    const existingScript = document.getElementById("depoii-google-maps-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve((window as any).google));
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "depoii-google-maps-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google);
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

export function RoofInspector3D({ lat, lng, address, onClose, className }: RoofInspector3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useEmbedFallback, setUseEmbedFallback] = useState(false);

  // Check for API key from env or localStorage
  const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const [apiKey, setApiKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [isSettingKey, setIsSettingKey] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("depoii_google_maps_api_key") : null;
    const activeKey = envKey || stored || "";
    setApiKey(activeKey);
    if (!activeKey) {
      setIsSettingKey(true);
      setIsLoading(false);
    }
  }, [envKey]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let active = true;
    setIsLoading(true);

    loadGoogleMapsScript(apiKey)
      .then((google) => {
        if (!active || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 19,
          mapTypeId: "hybrid",
          tilt: 0,
          heading: 0,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT,
          },
          rotateControl: true,
          scaleControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });

        // Add precision marker for the roof structure
        new google.maps.Marker({
          position: { lat, lng },
          map,
          title: address || "Property Roof",
        });

        mapInstanceRef.current = map;
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn("Maps SDK direct load error, using Google Maps Embed inside window:", err);
        if (active) {
          setUseEmbedFallback(true);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiKey, lat, lng]);

  const handleZoom = (delta: number) => {
    if (!mapInstanceRef.current) return;
    const currentZoom = mapInstanceRef.current.getZoom() || 19;
    mapInstanceRef.current.setZoom(currentZoom + delta);
  };

  const handleSaveKey = () => {
    if (inputKey.trim()) {
      localStorage.setItem("depoii_google_maps_api_key", inputKey.trim());
      setApiKey(inputKey.trim());
      setIsSettingKey(false);
    }
  };

  const embedUrl = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=19&maptype=satellite`;

  return (
    <div className={cn("relative flex flex-col h-full w-full overflow-hidden rounded-xl border border-border/80 bg-neutral-950 text-white shadow-2xl", className)}>
      {/* Top Header Bar */}
      <div className="z-20 flex items-center justify-between border-b border-white/10 bg-black/75 px-3.5 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80">
            <Layers className="size-4" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-tight text-white">Latest Aerial Imagery</span>
            <p className="text-[11px] text-white/60 truncate max-w-xs sm:max-w-md">
              {address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </p>
          </div>
        </div>

        {/* Action Controls inside the window */}
        <div className="flex items-center gap-1.5">
          {!useEmbedFallback && (
            <div className="hidden sm:flex items-center rounded-md border border-white/10 bg-white/5 p-0.5">
              <button
                type="button"
                onClick={() => handleZoom(1)}
                className="flex size-6 items-center justify-center rounded text-white/70 hover:bg-white/15 hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-1)}
                className="flex size-6 items-center justify-center rounded text-white/70 hover:bg-white/15 hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="size-3" />
              </button>
            </div>
          )}

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md bg-white/10 text-white/80 hover:bg-red-500/80 hover:text-white transition cursor-pointer ml-1"
            title="Close Aerial View"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area - Loaded directly inside the window */}
      <div className="relative flex-1 w-full overflow-hidden bg-neutral-900">
        {/* Loading Overlay */}
        {isLoading && !isSettingKey && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-xs">
            <span className="size-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <p className="mt-3 text-xs font-medium text-white/80 animate-pulse">
              Loading Latest Aerial Imagery…
            </p>
            <p className="text-[11px] text-white/40 mt-1">Streaming high-resolution satellite imagery</p>
          </div>
        )}

        {/* API Key Configuration Overlay if needed */}
        {isSettingKey && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/90 p-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900/90 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2.5 text-amber-400">
                <Key className="size-5" />
                <h3 className="font-semibold text-sm text-white">Google Maps API Key Required</h3>
              </div>
              <p className="mt-2 text-xs text-white/70 leading-relaxed">
                Enter your Google Maps API key below to load high-resolution satellite imagery directly inside this window:
              </p>

              <div className="mt-3.5 space-y-2">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/50 focus:outline-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-white/40">
                    Saved locally in your browser session.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={!inputKey.trim()}
                    className="rounded-lg bg-neutral-100 hover:bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow disabled:opacity-40 transition cursor-pointer"
                  >
                    Load Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Embed Fallback if Maps SDK has network issues */}
        {useEmbedFallback ? (
          <iframe
            src={embedUrl}
            className="size-full border-0"
            allowFullScreen
            loading="lazy"
            title="Google Maps Satellite View"
          />
        ) : (
          /* Google Maps Interactive WebGL Container */
          <div ref={containerRef} className="size-full" />
        )}

        {/* Coordinates Reticle Indicator */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded bg-black/75 px-2 py-1 text-[11px] font-mono text-white/80 backdrop-blur-xs">
          <MapPin className="size-3 text-red-400" />
          <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        </div>
      </div>
    </div>
  );
}
