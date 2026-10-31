"use client";

import { useEffect, useRef, useState } from "react";
import { Box, RotateCcw, X, Key, ExternalLink, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

// Point Cesium to our locally hosted assets
if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "/cesium/";
}

interface RoofInspector3DProps {
  lat: number;
  lng: number;
  address?: string;
  onClose: () => void;
  className?: string;
}

export function RoofInspector3D({ lat, lng, address, onClose, className }: RoofInspector3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    let destroyed = false;
    setIsLoading(true);
    setError(null);

    async function initCesium() {
      try {
        // Dynamically import Cesium client-side
        const Cesium = await import("cesium");

        if (destroyed || !containerRef.current) return;

        // Clean up previous viewer if any
        if (viewerRef.current) {
          try {
            viewerRef.current.destroy();
          } catch {}
          viewerRef.current = null;
        }

        // Initialize viewer
        const viewer = new Cesium.Viewer(containerRef.current, {
          globe: false,
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
          creditContainer: document.createElement("div"), // Hide default credit container to customize
        });

        if (destroyed) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;

        // Add Google Photorealistic 3D Tileset
        const tileset = await Cesium.createGooglePhotorealistic3DTileset({ key: apiKey });
        viewer.scene.primitives.add(tileset);

        // Fly camera directly to building roof
        // 45 degree pitch, ~180m height looking down
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, 180),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 1.5,
          complete: () => {
            if (!destroyed) setIsLoading(false);
          },
        });
      } catch (err: any) {
        if (!destroyed) {
          console.error("Cesium 3D initialization error:", err);
          setError(err.message || "Failed to load Google 3D tiles. Check API key permissions.");
          setIsLoading(false);
        }
      }
    }

    initCesium();

    return () => {
      destroyed = true;
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch {}
        viewerRef.current = null;
      }
    };
  }, [apiKey, lat, lng]);

  const resetCamera = async (pitchDeg = -45) => {
    if (!viewerRef.current) return;
    const Cesium = await import("cesium");
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 180),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(pitchDeg),
        roll: 0,
      },
      duration: 1.0,
    });
  };

  const handleSaveKey = () => {
    if (inputKey.trim()) {
      localStorage.setItem("depoii_google_maps_api_key", inputKey.trim());
      setApiKey(inputKey.trim());
      setIsSettingKey(false);
    }
  };

  const googleEarthUrl = `https://earth.google.com/web/search/${lat.toFixed(6)},${lng.toFixed(6)}`;

  return (
    <div className={cn("relative flex flex-col h-full w-full overflow-hidden rounded-xl border border-border/80 bg-neutral-950 text-white shadow-2xl", className)}>
      {/* Link widgets.css */}
      <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />

      {/* Top Header Bar */}
      <div className="z-20 flex items-center justify-between border-b border-white/10 bg-black/60 px-3.5 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
            <Box className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-white">3D Roof Inspector</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                Google Photorealistic 3D
              </span>
            </div>
            <p className="text-[11px] text-white/50 truncate max-w-xs sm:max-w-md">
              {address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {apiKey && !isSettingKey && (
            <>
              <button
                type="button"
                onClick={() => resetCamera(-45)}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/15 transition cursor-pointer"
                title="Reset to 45° Oblique View"
              >
                <RotateCcw className="size-3 text-sky-400" />
                <span className="hidden sm:inline">45° Oblique</span>
              </button>

              <button
                type="button"
                onClick={() => resetCamera(-90)}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/15 transition cursor-pointer"
                title="Top-Down Plan View"
              >
                <Compass className="size-3 text-sky-400" />
                <span className="hidden sm:inline">Top-Down</span>
              </button>
            </>
          )}

          <a
            href={googleEarthUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/70 hover:bg-white/15 hover:text-white transition"
            title="Open in external Google Earth Web"
          >
            <span className="hidden sm:inline">Earth Web</span>
            <ExternalLink className="size-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md bg-white/10 text-white/80 hover:bg-red-500/80 hover:text-white transition cursor-pointer ml-1"
            title="Close 3D View"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div className="relative flex-1 w-full overflow-hidden bg-neutral-900">
        {/* Loading Overlay */}
        {isLoading && !isSettingKey && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-xs">
            <span className="size-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            <p className="mt-3 text-xs font-medium text-white/80 animate-pulse">
              Streaming Google 3D Tiles…
            </p>
            <p className="text-[11px] text-white/40 mt-1">Rendering roof structure & mechanical RTUs</p>
          </div>
        )}

        {/* API Key Configuration Overlay */}
        {isSettingKey && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/90 p-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900/90 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2.5 text-amber-400">
                <Key className="size-5" />
                <h3 className="font-semibold text-sm text-white">Google Maps API Key Required</h3>
              </div>
              <p className="mt-2 text-xs text-white/70 leading-relaxed">
                To stream high-resolution Google Photorealistic 3D Tiles directly inside Depoii, enter your Google Maps Platform API key below:
              </p>

              <div className="mt-3.5 space-y-2">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-sky-400 focus:outline-none"
                />
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-white/40">
                    Saved locally in your browser session.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={!inputKey.trim()}
                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-400 disabled:opacity-40 transition cursor-pointer"
                  >
                    Activate 3D Tiles
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
                <span>Or add to <code className="text-white/80">.env</code> as <code className="text-sky-300">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></span>
              </div>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && !isSettingKey && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-950/90 p-6 text-center">
            <div className="size-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
              <Box className="size-5" />
            </div>
            <h4 className="text-sm font-semibold text-white">3D Tiles Load Error</h4>
            <p className="mt-1 max-w-sm text-xs text-white/60">{error}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsSettingKey(true)}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition cursor-pointer"
              >
                Change API Key
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* CesiumJS WebGL Container */}
        <div ref={containerRef} className="h-full w-full" />

        {/* Subdued Google Logo / Attribution Badge */}
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/60 backdrop-blur-xs flex items-center gap-1">
          <span>© Google 3D</span>
          <span>·</span>
          <span>Depoii Engine</span>
        </div>
      </div>
    </div>
  );
}
