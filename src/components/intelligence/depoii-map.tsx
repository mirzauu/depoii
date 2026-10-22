"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import { bbox, featureCollection, feature } from "@turf/turf";
import type { Storm } from "@/lib/types";
import type { SwathFeature } from "@/lib/engine-api";
import { cn } from "cn";
import { DepoiiLoader } from "@/components/depoii-logo";

export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  state: "unresolved" | "resolved" | "outside" | "unknown" | "custom";
  color?: string;
  title: string;
}

const BASE_STYLE = "https://tiles.openfreemap.org/styles/dark";

function swathData(storm: Storm | null) {
  if (!storm) return featureCollection([]);
  return featureCollection(storm.warnings.map((w) => feature(w.geometry, { tier: w.tier })));
}

function usable(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

type ViewPadding = number | { top?: number; bottom?: number; left?: number; right?: number };

function mapPadding(padding: ViewPadding) {
  if (typeof padding === "number") return padding;
  return {
    top: padding.top ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
    right: padding.right ?? 0,
  };
}

export function DepoiiMap({
  storm,
  points,
  selectedId,
  onSelect,
  className,
  engineSwaths,
  focus,
  viewPadding = 60,
}: {
  storm: Storm | null;
  engineSwaths?: SwathFeature[];
  points: MapPoint[];
  focus?: { lat: number; lng: number } | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  /** Extra top padding shifts the settled zoom lower in the frame */
  viewPadding?: ViewPadding;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const padding = mapPadding(viewPadding);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelled || !el.current) return;
        // Turbopack does not place maplibre-gl-worker.mjs next to the bundled chunk, so the default worker URL 404s.
        maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
        const m = new maplibregl.Map({ container: el.current, style: BASE_STYLE, center: [-97.33, 32.75], zoom: 10, attributionControl: { compact: true } });
        map.current = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        m.on("error", (event) => {
          const error = event.error;
          const message = error instanceof Error ? error.message : "";
          if (message.includes("Worker failed to load")) {
            setFailed(true);
            return;
          }
          // OpenFreeMap's sprite omits a few icon names the style still references.
          if (message.includes("could not be loaded")) return;
          console.error(error);
        });
        const resize = () => m.resize();
        observer = new ResizeObserver(resize);
        observer.observe(el.current);
        m.on("load", () => {
          if (cancelled) return;
          resize();
          m.addSource("engine-swath", { type: "geojson", data: featureCollection([]) });
          m.addLayer({ id: "engine-fill", type: "fill", source: "engine-swath", paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.18 } });
          m.addLayer({ id: "engine-line", type: "line", source: "engine-swath", paint: { "line-color": ["get", "stroke"], "line-width": 1.5, "line-dasharray": [2, 1] } });
          m.addSource("swath", { type: "geojson", data: swathData(null) });
          m.addLayer({ id: "env-fill", type: "fill", source: "swath", filter: ["==", ["get", "tier"], "envelope"], paint: { "fill-color": "#f59e0b", "fill-opacity": 0.16 } });
          m.addLayer({ id: "env-line", type: "line", source: "swath", filter: ["==", ["get", "tier"], "envelope"], paint: { "line-color": "#f59e0b", "line-width": 1.5 } });
          m.addLayer({ id: "core-fill", type: "fill", source: "swath", filter: ["==", ["get", "tier"], "core"], paint: { "fill-color": "#dc2626", "fill-opacity": 0.3 } });
          m.addLayer({ id: "core-line", type: "line", source: "swath", filter: ["==", ["get", "tier"], "core"], paint: { "line-color": "#ef4444", "line-width": 2 } });
          setReady(true);
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const framed = useRef("");
  const pointKey = points.map((p) => p.id).join("|");
  const fitRef = useRef<() => void>(() => undefined);
  fitRef.current = () => {
    const m = map.current;
    if (!m) return;
    const data = swathData(storm);
    const here = focus && usable(focus.lat, focus.lng) ? focus : null;
    const near = points.filter((p) => usable(p.lat, p.lng) && (!here || (Math.abs(p.lat - here.lat) < 1.5 && Math.abs(p.lng - here.lng) < 1.5)));
    if (near.length) {
      const [w, s, e, n] = bbox(featureCollection(near.map((p) => feature({ type: "Point", coordinates: [p.lng, p.lat] }))));
      m.fitBounds([[w, s], [e, n]], { padding, duration: 900, maxZoom: 12 });
    } else if (here) {
      m.flyTo({ center: [here.lng, here.lat], zoom: 11, duration: 900, padding });
    } else if (storm && storm.warnings.length) {
      const [w, s, e, n] = bbox(data);
      m.fitBounds([[w, s], [e, n]], { padding, duration: 900, maxZoom: 11 });
    } else if (storm && storm.reports.length) {
      const [w, s, e, n] = bbox(featureCollection(storm.reports.map((r) => feature({ type: "Point", coordinates: [r.lng, r.lat] }))));
      m.fitBounds([[w, s], [e, n]], { padding, duration: 900, maxZoom: 12 });
    }
  };

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("swath") as unknown as { setData: (d: unknown) => void }).setData(swathData(storm));
    const frameKey = `${storm?.id ?? ""}:${focus?.lat ?? ""},${focus?.lng ?? ""}:${pointKey}`;
    if (framed.current === frameKey) return;
    framed.current = frameKey;
    fitRef.current();
  }, [ready, storm, pointKey, focus?.lat, focus?.lng]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !selectedId) return;
    const p = points.find((x) => x.id === selectedId);
    if (p && usable(p.lat, p.lng)) {
      m.easeTo({
        center: [p.lng, p.lat],
        zoom: Math.max(m.getZoom(), 14),
        duration: 600,
        padding,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId, padding]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("engine-swath") as unknown as { setData: (d: unknown) => void }).setData({ type: "FeatureCollection", features: engineSwaths ?? [] });
  }, [ready, engineSwaths]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = points.map((p) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "depoii-pin";
        node.dataset.state = p.state;
        node.dataset.selected = String(p.id === selectedId);
        node.setAttribute("aria-label", p.title);
        if (p.color) node.style.background = p.color;
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "depoii-popup" }).setText(p.title);
        node.addEventListener("mouseenter", () => popup.setLngLat([p.lng, p.lat]).addTo(m));
        node.addEventListener("mouseleave", () => popup.remove());
        node.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (p.state === "custom") return;
          popup.remove();
          onSelectRef.current?.(p.id);
        });
        return new maplibregl.Marker({ element: node }).setLngLat([p.lng, p.lat]).addTo(m);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, points, selectedId]);

  return (
    <div className={cn("relative overflow-hidden bg-[#0b1220]", className)}>
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {ready && (
        <button type="button" onClick={() => fitRef.current()} className="absolute right-3 bottom-8 z-10 rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs shadow hover:bg-muted">
          Fit storm
        </button>
      )}
      {!ready && !failed && <div className="absolute inset-0 grid place-items-center"><DepoiiLoader label="Loading the warning map…" /></div>}
      {failed && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-red-300">The map engine failed to load. Pipeline and briefs remain available.</div>}
    </div>
  );
}
