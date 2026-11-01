"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDepoii } from "@/components/depoii-provider";
import { DepoiiMap, type MapPoint } from "@/components/depoii-map";
import { ProofCard } from "@/components/proof-card";
import { ScorePill, TierBadge } from "@/components/badges";
import { StormSelect } from "@/components/app-shell";
import { longDate, usd, num } from "@/lib/format";
import { useEngine } from "@/components/use-engine";
import { mapAlerts, mapBrief, mapCities, mapHailEvents, mapSwaths, mapParcelBrowse, type BrowseParcel } from "@/lib/engine-api";
import { dayExposure } from "@/lib/engine/intersect";
import type { SwathTier } from "@/lib/types";
import { cn } from "cn";
import { Building2, ChevronRight, ExternalLink, MapPin, Lock, ArrowRight } from "lucide-react";

type DayLead = {
  parcelId: string;
  address: string;
  city: string;
  zipCode?: string;
  owner: string;
  lat: number;
  lng: number;
  hail: number;
  tier: SwathTier;
  score: number;
  value: number;
  unresolved: boolean;
  permitStatus?: string;
};

export default function MapPage() {
  const { storm: liveStorm, opportunities, jurisdiction } = useDepoii();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<BrowseParcel | null>(null);
  const [showOutside, setShowOutside] = useState(false);
  const [showEngine, setShowEngine] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  /** null = engine default (newest qualifying Texas hail day). */
  const [eventDate, setEventDate] = useState<string | null>(null);
  /** User-picked day — do not auto-advance away from an empty remote day. */
  const [userPickedDay, setUserPickedDay] = useState(false);
  const autoTriedDates = useRef<Set<string>>(new Set());

  const brief = useEngine("brief", { jurisdiction, limit: 500, offset: 0 }, mapBrief);
  const hail = useEngine(
    "storms/hail-events",
    { state: "TX", jurisdiction, since: "2024-03-01", min_hail_inches: 1.5, event_date: eventDate },
    mapHailEvents,
  );
  const city = jurisdiction.split(",")[0];
  const swaths = useEngine("storms/active-swaths", {}, mapSwaths);
  const alerts = useEngine("storms/live-alerts", { metro: jurisdiction }, mapAlerts);
  const cities = useEngine("locations/cities", {}, mapCities);
  const place = cities.data?.find((c) => c.jurisdiction === jurisdiction);
  const focus = useMemo(() => (place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null), [place?.lat, place?.lng]);

  const catalog = hail.data;
  const catalogStorm = catalog?.selected ?? null;
  const catalogEvents = catalog?.events ?? [];
  const liveReady = Boolean(liveStorm?.id && liveStorm.name && liveStorm.name !== "Loading Storm...");
  const stormReady = Boolean(catalogStorm?.id) || liveReady;

  const storm = catalogStorm
    ? catalogStorm
    : liveReady
      ? liveStorm
      : {
          id: "engine-brief",
          name: brief.data?.stormName || `${city} commercial opportunity map`,
          shortName: city,
          date: brief.data?.stormDate || "",
          maxHail: brief.data?.maxHail || brief.data?.opportunities?.[0]?.hail || 0,
          reportCount: brief.data?.totalOpportunities || brief.data?.opportunities?.length || 0,
          region: jurisdiction,
          maxHailTag: 0,
          center: (focus ? [focus.lng, focus.lat] : [-96.8, 32.78]) as [number, number],
          source: "Depoii data engine brief",
          reports: [],
          warnings: [],
        };

  const briefOps = brief.data?.opportunities ?? [];
  const bookTotal = brief.data?.totalOpportunities || briefOps.length;

  /** Reset ZIP and property selection when storm changes */
  useEffect(() => {
    setSelectedZip(null);
    setSelectedId(null);
  }, [catalogStorm?.id, catalogStorm?.date]);

  /** Full pilot book in a stable shuffled order (reshuffles when the book reloads). */
  const shuffledBriefOps = useMemo(() => {
    const list = [...briefOps];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
    // Intentionally reshuffle only when the opportunity set identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.data?.opportunities]);

  /** Real database commercial buildings for the selected storm */
  const dayLeads: DayLead[] = useMemo(() => {
    if (catalogStorm?.buildings && catalogStorm.buildings.length > 0) {
      return catalogStorm.buildings.map((b): DayLead => ({
        parcelId: b.parcelId,
        address: b.address,
        city: b.city,
        zipCode: b.zipCode || "",
        owner: b.owner,
        lat: b.lat ?? 0,
        lng: b.lng ?? 0,
        hail: b.hail || catalogStorm.maxHail || 1.75,
        tier: b.tier || "core",
        score: b.score,
        value: b.value,
        unresolved: b.unresolved,
        permitStatus: b.permitStatus,
      }));
    }
    return [];
  }, [catalogStorm]);

  const coordsReady = (catalogStorm?.buildings?.length ?? 0) > 0 || briefOps.some((o) => o.lat != null && o.lng != null);
  const dayScoped = Boolean(catalogStorm && dayLeads.length && coordsReady);
  const dayExposed = useMemo(() => dayLeads.filter((o) => o.tier !== "outside"), [dayLeads]);
  const dayUnresolved = useMemo(() => dayExposed.filter((o) => o.unresolved), [dayExposed]);

  /** Unique ZIP codes with real commercial buildings affected by this storm */
  const affectedZips = useMemo(() => {
    const counts = new Map<string, number>();

    if (catalogStorm?.zipBuildingCounts) {
      for (const [z, info] of Object.entries(catalogStorm.zipBuildingCounts)) {
        const clean = z.trim().slice(0, 5);
        if (clean && clean !== "00000" && /^7[5-9]\d{3}$/.test(clean) && info.count > 0) {
          counts.set(clean, info.count);
        }
      }
    }

    return Array.from(counts.entries())
      .map(([zip, count]) => ({ zip, count }))
      .sort((a, b) => b.count - a.count || a.zip.localeCompare(b.zip));
  }, [catalogStorm?.zipBuildingCounts]);

  const [territories, setTerritories] = useState<Array<{ id: string; name: string; zipCodes: string[]; isSubscribed: boolean }>>([]);
  useEffect(() => {
    fetch("/api/territories?market=dallas")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.territories && Array.isArray(d.territories)) {
          setTerritories(d.territories);
        }
      })
      .catch(() => {});
  }, []);

  const subscribedZips = useMemo(() => {
    const zips = new Set<string>();
    for (const t of territories) {
      if (t.isSubscribed && Array.isArray(t.zipCodes)) {
        for (const z of t.zipCodes) zips.add(z.slice(0, 5));
      }
    }
    return zips;
  }, [territories]);

  const hasTerritorySubscriptions = useMemo(() => {
    return territories.some((t) => t.isSubscribed);
  }, [territories]);

  const topBuildingZip = affectedZips.find((z) => z.count > 0)?.zip || null;
  const activeZip = selectedZip || topBuildingZip;

  const zipBuildings = useEngine(
    "parcels/browse",
    {
      jurisdiction,
      zip: activeZip || undefined,
      limit: 6,
    },
    mapParcelBrowse,
    true,
  );

  useEffect(() => {
    setSelectedParcel(null);
  }, [catalogStorm?.id, catalogStorm?.date, selectedZip]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedParcel(null);
      return;
    }
    const found = zipBuildings.data?.parcels.find((p) => p.id === selectedId);
    if (found) setSelectedParcel(found);
  }, [selectedId, zipBuildings.data?.parcels]);

  /** Leads filtered by selected ZIP code (or all exposed if none selected) */
  const filteredDayLeads = useMemo(() => {
    if (selectedZip) {
      const zipMatches = dayLeads.filter((o) => (o.zipCode || "").trim().slice(0, 5) === selectedZip);
      if (zipMatches.length > 0) return zipMatches;
    }
    const base = showOutside ? dayLeads : dayExposed;
    if (!selectedZip) return base;
    return base.filter((o) => (o.zipCode || "").trim().slice(0, 5) === selectedZip);
  }, [showOutside, dayLeads, dayExposed, selectedZip]);

  // On first load, advance until a storm has local commercial buildings in county inventory
  useEffect(() => {
    if (userPickedDay || hail.loading || !catalogStorm) return;
    const hasBuildings = Object.values(catalogStorm.zipBuildingCounts || {}).some((z) => z.count > 0);
    if (hasBuildings) return;
    const current = catalogStorm.date || catalogStorm.id;
    if (current) autoTriedDates.current.add(current);
    const next = catalogEvents.find((e) => {
      const key = e.date || e.id;
      return key && !autoTriedDates.current.has(key);
    });
    if (next?.date || next?.id) setEventDate(next.date || next.id);
  }, [userPickedDay, hail.loading, catalogStorm, catalogEvents]);

  // Calculate stats strictly from real commercial buildings in inventory
  const totalAllBuildings = useMemo(() => {
    if (catalogStorm?.zipBuildingCounts) {
      return Object.values(catalogStorm.zipBuildingCounts).reduce((sum, z) => sum + z.count, 0);
    }
    return dayLeads.length;
  }, [catalogStorm?.zipBuildingCounts, dayLeads.length]);

  const totalAllPipeline = useMemo(() => {
    if (catalogStorm?.zipBuildingCounts) {
      return Object.values(catalogStorm.zipBuildingCounts).reduce((sum, z) => sum + z.pipeline, 0);
    }
    return dayLeads.reduce((s, o) => s + o.value, 0);
  }, [catalogStorm?.zipBuildingCounts, dayLeads]);

  const activeZipStats = selectedZip ? catalogStorm?.zipBuildingCounts?.[selectedZip] : undefined;

  const exposedCount = activeZipStats ? activeZipStats.count : totalAllBuildings;
  const pipelineValue = activeZipStats ? activeZipStats.pipeline : totalAllPipeline;
  const unresolvedCount = exposedCount; // All commercial buildings without competing reroof permit

  const selectedLive = opportunities.find((o) => o.parcel.id === selectedId) ?? null;
  const selectedDay = dayLeads.find((o) => o.parcelId === selectedId) ?? null;

  const stormId = eventDate || catalogStorm?.id || catalogStorm?.date || "";

  const points: MapPoint[] = useMemo(() => {
    const bList = zipBuildings.data?.parcels ?? [];
    const ptsSource = bList.length > 0 ? bList : (catalogStorm?.buildings ?? []);

    const realPts: MapPoint[] = (ptsSource as any[])
      .filter((b) => (b.lat != null || b.latitude != null) && (b.lng != null || b.longitude != null))
      .slice(0, 100)
      .map((b) => {
        const lat = Number(b.lat ?? b.latitude);
        const lng = Number(b.lng ?? b.longitude);
        const zip = (b.zip || b.zipCode || b.zip_code || "").slice(0, 5);
        const isLocked = hasTerritorySubscriptions && zip && !subscribedZips.has(zip);

        if (isLocked) {
          return {
            id: b.id || b.parcelId,
            lng,
            lat,
            state: "locked" as MapPoint["state"],
            color: "#f59e0b",
            title: `🔒 Commercial Property · ZIP ${zip || "Locked"} (Subscribed Territory Required)`,
          };
        }

        const addr = b.address || "Commercial Building";
        return {
          id: b.id || b.parcelId,
          lng,
          lat,
          state: (b.hasContact ? "resolved" : "unresolved") as MapPoint["state"],
          title: `${addr}${zip ? ` (${zip})` : ""} · ${b.propertyType || "Commercial"} · ${usd(b.valuation || b.value || 0, true)}`,
        };
      });

    const reports = storm.reports.map((r) => ({
      id: r.id,
      lng: r.lng,
      lat: r.lat,
      state: "custom" as const,
      color: "#38bdf8",
      title: `${r.inches}" ${r.qualifier === "M" ? "measured" : r.qualifier === "E" ? "estimated" : "reported"} hail · ${r.city} · ${r.source}`,
    }));
    return [...realPts, ...reports];
  }, [zipBuildings.data?.parcels, catalogStorm?.buildings, storm.reports, hasTerritorySubscriptions, subscribedZips]);

  const classifyBasis = catalogStorm
    ? catalogStorm.warnings.length || catalogStorm.reports.length
      ? "warnings + reports within 40 mi"
      : "no geometry for this day"
    : null;

  return (
    <div data-tour="map-container" className="flex flex-col lg:h-[calc(100vh-53px)] lg:flex-row">
      <div className="relative h-[60vh] lg:h-auto lg:flex-1">
        <DepoiiMap
          storm={storm}
          focus={focus}
          engineSwaths={showEngine ? swaths.data ?? [] : []}
          points={points}
          selectedId={selectedId}
          onSelect={(id) => {
            const clickedLead = (catalogStorm?.buildings ?? []).find((b: any) => (b.parcelId || b.id) === id);
            const zip = clickedLead ? (((clickedLead as any).zipCode || (clickedLead as any).zip || "") as string).slice(0, 5) : "";
            const isLocked = hasTerritorySubscriptions && zip && !subscribedZips.has(zip);
            if (isLocked) {
              if (zip) setSelectedZip(zip);
              setSelectedParcel(null);
              setSelectedId(null);
              return;
            }
            setSelectedId(id);
          }}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute top-3 left-3 right-14 z-10 max-w-sm">
          <div className="pointer-events-auto space-y-3 rounded-lg border border-border bg-background/90 p-3 shadow-xl backdrop-blur">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-red-400">Storm</p>
                <p className="text-sm font-semibold leading-tight">{storm.name}</p>
              </div>
              <button type="button" onClick={() => setPanelOpen((v) => !v)} className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
                {panelOpen ? "Hide" : "Show"}
              </button>
            </div>
            {panelOpen && <>
            <p className="text-[11px] text-muted-foreground">
              {storm.maxHail ? `${storm.maxHail}" max hail recorded · ${storm.reportCount} SPC storm reports.` : "Commercial roof hail impact zone."}
            </p>
            <StormSelect
              storms={catalogEvents}
              stormId={stormId}
              loading={hail.loading}
              emptyLabel={hail.error ? "Hail catalog unavailable" : "No Texas hail days in catalog"}
              onSelect={(id) => {
                const match = catalogEvents.find((s) => s.id === id);
                setUserPickedDay(true);
                setEventDate(match?.date || id);
                setSelectedZip(null);
                setSelectedId(null);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              {selectedZip
                ? `${num(exposedCount)} commercial buildings in ZIP ${selectedZip} · ${storm.maxHail}" hail impact.`
                : `${num(exposedCount)} commercial buildings across ${affectedZips.length} impact ZIPs for ${catalogStorm?.date ? longDate(catalogStorm.date) : "this storm"}.`}
            </p>
            {!stormReady && !hail.loading && briefOps.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Building list is the released pilot book until a hail day loads.
              </p>
            )}
            {hail.error && (
              <p className="text-[11px] text-muted-foreground">Hail day unavailable — showing unfiltered pilot book counts.</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Exposed" value={exposedCount} />
              <Stat label="Unresolved" value={unresolvedCount} accent />
              <Stat label="Pipeline" value={usd(pipelineValue, true)} />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <Legend cls="bg-amber-500/50 border-amber-500" label="NWS warning" />
              <Legend cls="bg-red-600/60 border-red-500" label={'Warning with 2"+ hail'} />
              <Legend cls="bg-sky-400 rounded-full" label="Hail report" />
              <Legend cls="bg-red-500 rounded-full" label="No roof permit since" />
              <Legend cls="bg-slate-500 rounded-full" label="Permit filed" />
              {hasTerritorySubscriptions && <Legend cls="bg-amber-500 rounded-full" label="Locked territory" />}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showOutside} onChange={(e) => setShowOutside(e.target.checked)} className="accent-red-500" />
              Show unexposed pilot parcels
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showEngine} onChange={(e) => setShowEngine(e.target.checked)} className="accent-blue-500" />
              Engine storm swaths ({swaths.error ? "unavailable" : swaths.data?.length ?? "…"}, dashed)
            </label>
            {!!alerts.data?.length && (
              <div className="space-y-1 border-t border-border pt-2">
                <p className="text-[10px] font-medium uppercase tracking-widest text-amber-400">Live NWS alerts · {alerts.data.length}</p>
                {alerts.data.slice(0, 4).map((a) => (
                  <p key={a.id} className="truncate text-[11px] text-muted-foreground" title={a.headline}>
                    <span className="text-foreground">{a.event}</span> · {a.area}
                  </p>
                ))}
              </div>
            )}
            </>}
          </div>
        </div>
      </div>

      <aside className="w-full border-t border-border bg-card/30 lg:w-[420px] lg:overflow-y-auto lg:border-t-0 lg:border-l [scrollbar-width:thin]">
        {selectedParcel ? (
          <div className="space-y-4 p-4">
            <button
              type="button"
              onClick={() => {
                setSelectedParcel(null);
                setSelectedId(null);
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
            >
              ← Back to {activeZip ? `ZIP ${activeZip}` : "buildings"}
            </button>

            <div className="rounded-lg border border-border bg-card dark:bg-[#121319] p-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-foreground leading-snug">{selectedParcel.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedParcel.city}, {selectedParcel.state} {selectedParcel.zip || activeZip}
                  </p>
                </div>
                {selectedParcel.propertyType && (
                  <span className="shrink-0 rounded bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 px-2 py-0.5 text-xs font-medium uppercase">
                    {selectedParcel.propertyType.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <div className="mt-3.5 space-y-2 border-t border-border/70 dark:border-neutral-800/80 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40 dark:border-neutral-800/40">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium text-foreground text-right">{selectedParcel.owner || "Owner not on record"}</span>
                </div>
                {selectedParcel.ownerAddress && (
                  <div className="flex justify-between py-1 border-b border-border/40 dark:border-neutral-800/40">
                    <span className="text-muted-foreground">Mailing Address</span>
                    <span className="text-foreground text-right">{selectedParcel.ownerAddress}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-border/40 dark:border-neutral-800/40">
                  <span className="text-muted-foreground">Building Sq Ft</span>
                  <span className="font-mono font-medium text-foreground">{selectedParcel.sqft ? `${num(selectedParcel.sqft)} sq ft` : "N/A"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 dark:border-neutral-800/40">
                  <span className="text-muted-foreground">Year Built</span>
                  <span className="font-mono font-medium text-foreground">{selectedParcel.yearBuilt || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 dark:border-neutral-800/40">
                  <span className="text-muted-foreground">Appraisal Valuation</span>
                  <span className="font-mono font-semibold text-foreground">{selectedParcel.valuation > 0 ? usd(selectedParcel.valuation, true) : "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Appraisal ID</span>
                  <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">{selectedParcel.id}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 pt-2">
                <Link
                  href={`/parcels/${encodeURIComponent(selectedParcel.id)}${stormId ? `?storm=${encodeURIComponent(stormId)}` : ""}`}
                  className="flex items-center justify-center gap-1.5 w-full rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2 px-3 text-xs font-semibold shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                >
                  <span>Open full parcel dossier</span>
                  <ChevronRight className="size-3.5" />
                </Link>

                {activeZip && (
                  <Link
                    href={`/buildings?zip=${encodeURIComponent(activeZip)}`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-md border border-border bg-muted/40 hover:bg-muted py-2 px-3 text-xs font-medium text-foreground transition-colors"
                  >
                    <span>View all {num(zipBuildings.data?.total || 0)} buildings in ZIP {activeZip}</span>
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-sm font-bold text-foreground">Commercial Buildings</h2>
                <p className="text-[11px] text-muted-foreground">
                  Real appraisal inventory in hail impact zone · {city}
                </p>
              </div>
              {activeZip && (
                <span className="rounded-full bg-sky-500/15 dark:bg-sky-500/20 border border-sky-400/40 text-sky-700 dark:text-sky-300 px-2.5 py-0.5 text-xs font-mono font-bold flex items-center gap-1.5">
                  <MapPin className="size-3" />
                  ZIP {activeZip}
                </span>
              )}
            </div>

            {/* Affected ZIP Code Pill Selector */}
            <div className="mt-3 space-y-1.5 border-t border-border/70 dark:border-neutral-800 pt-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Storm Affected ZIP Codes ({affectedZips.length})
                </p>
                {selectedZip && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedZip(null);
                      setSelectedParcel(null);
                      setSelectedId(null);
                    }}
                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    Reset to top ZIP
                  </button>
                )}
              </div>

              {affectedZips.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {affectedZips.map(({ zip, count }) => {
                    const isCurrent = activeZip === zip;
                    const isLocked = hasTerritorySubscriptions && !subscribedZips.has(zip);
                    return (
                      <button
                        key={zip}
                        type="button"
                        onClick={() => {
                          setSelectedZip(zip);
                          setSelectedParcel(null);
                          setSelectedId(null);
                        }}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-mono transition-colors flex items-center gap-1 border cursor-pointer",
                          isCurrent
                            ? isLocked
                              ? "bg-amber-500 text-black font-semibold border-amber-400 shadow-xs"
                              : "bg-sky-500 text-white font-semibold border-sky-400 shadow-xs"
                            : isLocked
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                              : "bg-muted/70 dark:bg-[#15161c] text-foreground dark:text-neutral-300 border-border/60 dark:border-neutral-800 hover:bg-muted dark:hover:bg-[#1e2028]"
                        )}
                      >
                        {isLocked && <Lock className="size-2.5 shrink-0" />}
                        <span>{zip}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "text-[10px]",
                              isCurrent
                                ? isLocked
                                  ? "text-black/80"
                                  : "text-sky-100"
                                : isLocked
                                  ? "text-amber-700/80 dark:text-amber-300/80"
                                  : "text-muted-foreground"
                            )}
                          >
                            ({count})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No specific ZIP centroids for this storm.</p>
              )}
            </div>

            {/* List of a few real buildings */}
            <div className="mt-3">
              {zipBuildings.loading || (hail.loading && !zipBuildings.data) ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-lg border border-border/50 bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : zipBuildings.data?.territoryLocked ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] p-4 space-y-3.5 mt-2">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Lock className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>ZIP {activeZip} is in another zone</span>
                        <span className="rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[9px] px-1.5 py-0.2 font-semibold uppercase tracking-wider">
                          Locked
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {zipBuildings.data.targetZone?.name
                          ? `Assigned to: ${zipBuildings.data.targetZone.name}`
                          : "Outside your subscribed coverage area"}
                      </p>
                    </div>
                  </div>

                  {/* Stat Callouts */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-amber-500/20 bg-background/60 p-2.5">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Commercial Buildings
                      </div>
                      <div className="text-base font-bold text-foreground font-mono">
                        {num(zipBuildings.data.total || activeZipStats?.count || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Storm Pipeline
                      </div>
                      <div className="text-base font-bold text-foreground font-mono">
                        {usd(activeZipStats?.pipeline || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Explanatory Message */}
                  <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1.5 leading-relaxed">
                    <p>
                      There are <strong className="text-foreground">{num(zipBuildings.data.total || activeZipStats?.count || 0)} commercial buildings</strong> in ZIP {activeZip} impacted by this hail event.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Your organization is subscribed to{" "}
                      <strong className="text-foreground">
                        {zipBuildings.data.subscribedZones?.map((z) => z.name).join(", ") || "a different zone"}
                      </strong>
                      . To access property records, verified decision-maker contacts, and full dossiers for this ZIP, subscribe to {zipBuildings.data.targetZone?.name || "this territory"}.
                    </p>
                  </div>

                  {/* CTA Button */}
                  <div className="pt-1">
                    <Link
                      href={zipBuildings.data.targetZone ? `/territory/${encodeURIComponent(zipBuildings.data.targetZone.id)}` : "/territory"}
                      className="w-full flex items-center justify-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black py-2 px-3 text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Lock className="size-3.5" />
                      <span>{zipBuildings.data.targetZone ? `Unlock ${zipBuildings.data.targetZone.name}` : "View Territory Subscriptions"}</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </Link>
                    <p className="text-center text-[10px] text-muted-foreground mt-1.5">
                      Expand your exclusive territory to claim and contact buildings in this zone.
                    </p>
                  </div>
                </div>
              ) : zipBuildings.data?.parcels && zipBuildings.data.parcels.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Showing {Math.min(5, zipBuildings.data.parcels.length)} preview buildings:</span>
                    <span className="text-[10px]">Click building for details</span>
                  </p>
                  <ul className="space-y-2">
                    {zipBuildings.data.parcels.slice(0, 5).map((b) => (
                      <li key={b.id}>
                        <div
                          onClick={() => {
                            setSelectedParcel(b);
                            setSelectedId(b.id);
                          }}
                          className="group rounded-lg border border-border/70 dark:border-neutral-800 bg-card dark:bg-[#121319] p-3 text-left transition-all hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-xs cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-foreground dark:text-neutral-100 group-hover:text-sky-500 transition-colors">
                                {b.address}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {b.city}, {b.state} {b.zip || activeZip}
                              </p>
                            </div>
                            {b.propertyType && (
                              <span className="shrink-0 rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/60 uppercase">
                                {b.propertyType.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-xs text-muted-foreground truncate">
                            <span className="font-medium text-foreground/80 dark:text-neutral-300">Owner:</span> {b.owner || "Owner not on record"}
                          </div>

                          <div className="mt-2.5 flex items-center justify-between border-t border-border/50 dark:border-neutral-800/60 pt-2 text-[11px] font-mono">
                            <span className="text-muted-foreground">
                              {b.sqft ? `${num(b.sqft)} sq ft` : "Sqft N/A"} · {b.yearBuilt ? `Built ${b.yearBuilt}` : "Year N/A"}
                            </span>
                            <span className="font-semibold text-foreground dark:text-neutral-200">
                              {b.valuation > 0 ? usd(b.valuation, true) : "—"}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between pt-1 text-[11px]">
                            <span className="text-[10px] text-muted-foreground">Appraisal parcel</span>
                            <Link
                              href={`/parcels/${encodeURIComponent(b.id)}${stormId ? `?storm=${encodeURIComponent(stormId)}` : ""}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                            >
                              <span>Dossier</span>
                              <ChevronRight className="size-3" />
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Prominent View All Button */}
                  <div className="mt-4 pt-1">
                    <Link
                      href={activeZip ? `/buildings?zip=${encodeURIComponent(activeZip)}` : "/buildings"}
                      className="flex items-center justify-center gap-2 w-full rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 px-4 text-xs font-semibold shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                    >
                      <span>View all {num(zipBuildings.data?.total || 0)} buildings {activeZip ? `in ZIP ${activeZip}` : `in ${city}`}</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                    <p className="text-center text-[10px] text-muted-foreground mt-1.5">
                      {activeZip ? `Opens Building Browse with ZIP ${activeZip} filter applied` : `Opens Building Browse for ${city} commercial inventory`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center space-y-2 mt-2">
                  <Building2 className="mx-auto size-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {activeZip
                      ? `No commercial buildings currently indexed in ZIP ${activeZip}.`
                      : "Select an affected ZIP code above to view commercial buildings."}
                  </p>
                  <Link
                    href="/buildings"
                    className="inline-flex items-center gap-1 text-xs font-medium text-sky-500 hover:underline"
                  >
                    <span>Browse all {city} commercial buildings</span>
                    <ChevronRight className="size-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <p className={cn("font-mono text-base font-semibold tabular-nums", accent && "text-red-400")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm border border-transparent", cls)} />
      {label}
    </span>
  );
}
