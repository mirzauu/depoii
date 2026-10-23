"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDepoii } from "@/components/depoii-provider";
import { DepoiiMap, type MapPoint } from "@/components/depoii-map";
import { ProofCard } from "@/components/proof-card";
import { ScorePill, TierBadge } from "@/components/badges";
import { StormSelect } from "@/components/app-shell";
import { longDate, usd } from "@/lib/format";
import { useEngine } from "@/components/use-engine";
import { mapAlerts, mapBrief, mapCities, mapHailEvents, mapSwaths } from "@/lib/engine-api";
import { dayExposure } from "@/lib/engine/intersect";
import type { SwathTier } from "@/lib/types";
import { cn } from "cn";

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
  const [showOutside, setShowOutside] = useState(false);
  const [showEngine, setShowEngine] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  /** null = engine default (newest qualifying Texas hail day). */
  const [eventDate, setEventDate] = useState<string | null>(null);
  /** User-picked day — do not auto-advance away from an empty remote day. */
  const [userPickedDay, setUserPickedDay] = useState(false);
  const autoTriedDates = useRef<Set<string>>(new Set());

  const brief = useEngine("brief", { jurisdiction, limit: 500, offset: 0 }, mapBrief);
  const hail = useEngine(
    "storms/hail-events",
    { state: "TX", since: "2024-03-01", min_hail_inches: 1.5, event_date: eventDate },
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

  /** Released pilot book classified against the selected hail-day catalog storm. */
  const dayLeads: DayLead[] = useMemo(() => {
    const ops = brief.data?.opportunities;
    if (!catalogStorm || !ops?.length) return [];
    return ops
      .map((o): DayLead => {
        const lat = o.lat ?? 0;
        const lng = o.lng ?? 0;
        const exposure = dayExposure({ lat, lng }, catalogStorm);
        return {
          parcelId: o.parcelId,
          address: o.address,
          city: o.city,
          zipCode: o.zipCode || "",
          owner: o.owner,
          lat,
          lng,
          hail: exposure.hailInches || o.hail,
          tier: exposure.tier,
          score: o.score,
          value: o.value,
          unresolved: o.unresolved,
          permitStatus: o.permitStatus,
        };
      })
      .sort((a, b) => {
        const tierRank = (t: SwathTier) => (t === "core" ? 2 : t === "envelope" ? 1 : 0);
        return tierRank(b.tier) - tierRank(a.tier) || b.score - a.score;
      });
  }, [catalogStorm, brief.data?.opportunities]);

  const coordsReady = briefOps.some((o) => o.lat != null && o.lng != null);
  const dayScoped = Boolean(catalogStorm && dayLeads.length && coordsReady);
  const dayExposed = useMemo(() => dayLeads.filter((o) => o.tier !== "outside"), [dayLeads]);
  const dayUnresolved = useMemo(() => dayExposed.filter((o) => o.unresolved), [dayExposed]);

  /** Unique ZIP codes affected by this storm, with lead counts */
  const affectedZips = useMemo(() => {
    const counts = new Map<string, number>();

    // 1. Include all storm-level affected ZIP codes from warnings/reports/swaths (even if 0 pilot leads in Depoii)
    if (catalogStorm?.affectedZips?.length) {
      for (const z of catalogStorm.affectedZips) {
        const clean = z.trim().slice(0, 5);
        if (clean && !counts.has(clean)) {
          counts.set(clean, 0);
        }
      }
    }

    // 2. Count buildings from exposed leads
    for (const lead of dayExposed) {
      const z = (lead.zipCode || "").trim().slice(0, 5);
      if (z) {
        counts.set(z, (counts.get(z) || 0) + 1);
      }
    }

    // Sort: ZIPs with leads first (by lead count descending), then by ZIP string ascending
    return Array.from(counts.entries())
      .map(([zip, count]) => ({ zip, count }))
      .sort((a, b) => b.count - a.count || a.zip.localeCompare(b.zip));
  }, [catalogStorm?.affectedZips, dayExposed]);

  /** Leads filtered by selected ZIP code (or all exposed if none selected) */
  const filteredDayLeads = useMemo(() => {
    const base = showOutside ? dayLeads : dayExposed;
    if (!selectedZip) return base;
    return base.filter((o) => (o.zipCode || "").trim().slice(0, 5) === selectedZip);
  }, [showOutside, dayLeads, dayExposed, selectedZip]);

  // Newest TX hail day is often outside Dallas. On first load, walk the catalog until a day hits local leads.
  useEffect(() => {
    if (userPickedDay || hail.loading || !catalogStorm || !dayLeads.length) return;
    if (dayExposed.length > 0) return;
    const current = catalogStorm.date || catalogStorm.id;
    if (current) autoTriedDates.current.add(current);
    const next = catalogEvents.find((e) => {
      const key = e.date || e.id;
      return key && !autoTriedDates.current.has(key);
    });
    if (next?.date || next?.id) setEventDate(next.date || next.id);
  }, [userPickedDay, hail.loading, catalogStorm, dayLeads.length, dayExposed.length, catalogEvents]);

  // When a hail day is selected, stats follow day classification and active ZIP filter — not the live ArcGIS storm.
  const liveExposed = opportunities.filter((o) => o.tier !== "outside");
  const liveUnresolved = liveExposed.filter((o) => o.unresolved);

  const exposedCount = dayScoped
    ? filteredDayLeads.length
    : liveExposed.length || briefOps.length;
  const unresolvedCount = dayScoped
    ? filteredDayLeads.filter((o) => o.unresolved).length
    : liveExposed.length
      ? liveUnresolved.length
      : briefOps.filter((o) => o.unresolved).length;
  const pipelineValue = dayScoped
    ? filteredDayLeads.reduce((s, o) => s + o.value, 0)
    : liveExposed.length
      ? liveUnresolved.reduce((s, o) => s + o.pipelineValue, 0)
      : briefOps.reduce((s, o) => s + o.value, 0);

  const listLeads = dayScoped ? filteredDayLeads : [];

  const selectedLive = opportunities.find((o) => o.parcel.id === selectedId) ?? null;
  const selectedDay = dayLeads.find((o) => o.parcelId === selectedId) ?? null;

  const stormId = eventDate || catalogStorm?.id || catalogStorm?.date || "";

  const points: MapPoint[] = useMemo(() => {
    const buildings: MapPoint[] = dayScoped
      ? filteredDayLeads
          .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.lat !== 0 && o.lng !== 0)
          .slice(0, 100)
          .map((o) => ({
            id: o.parcelId,
            lng: o.lng,
            lat: o.lat,
            state: (o.tier === "outside" ? "outside" : o.unresolved ? "unresolved" : "resolved") as MapPoint["state"],
            title: `${o.address}${o.zipCode ? ` (${o.zipCode.slice(0, 5)})` : ""} · ${o.tier} · score ${o.score}`,
          }))
      : (() => {
          const inSwath = opportunities.some((o) => o.tier !== "outside");
          return opportunities
            .filter((o) => !inSwath || showOutside || o.tier !== "outside")
            .slice(0, 80)
            .map((o) => ({
              id: o.parcel.id,
              lng: o.parcel.lng,
              lat: o.parcel.lat,
              state: (o.tier === "outside" ? "outside" : !o.permitKnown ? "unknown" : o.unresolved ? "unresolved" : "resolved") as MapPoint["state"],
              title: `${o.parcel.address} · score ${o.score}`,
            }));
        })();
    const reports = storm.reports.map((r) => ({
      id: r.id,
      lng: r.lng,
      lat: r.lat,
      state: "custom" as const,
      color: "#38bdf8",
      title: `${r.inches}" ${r.qualifier === "M" ? "measured" : r.qualifier === "E" ? "estimated" : "reported"} hail · ${r.city} · ${r.source}`,
    }));
    return [...buildings, ...reports];
  }, [dayScoped, filteredDayLeads, showOutside, opportunities, storm]);

  const classifyBasis = catalogStorm
    ? catalogStorm.warnings.length || catalogStorm.reports.length
      ? "warnings + reports within 40 mi"
      : "no geometry for this day"
    : null;

  return (
    <div data-tour="map-container" className="flex flex-col lg:h-[calc(100vh-53px)] lg:flex-row">
      <div className="relative h-[60vh] lg:h-auto lg:flex-1">
        <DepoiiMap storm={storm} focus={focus} engineSwaths={showEngine ? swaths.data ?? [] : []} points={points} selectedId={selectedId} onSelect={setSelectedId} className="absolute inset-0" />
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
              {catalogStorm
                ? `${storm.reportCount} hail reports · largest ${storm.maxHail}" · warning tag ${storm.maxHailTag || "none"}".`
                : liveReady
                  ? `${storm.reportCount} hail reports. Largest warning hail tag: ${storm.maxHailTag || "none"}".`
                  : `${bookTotal || exposedCount} released pilot buildings · ${storm.maxHail ? `${storm.maxHail}" nearest SPC hail` : "aging / roof cohort"}.`}
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
            {dayScoped && (
              <p className="text-[11px] text-muted-foreground">
                {selectedZip
                  ? `${exposedCount} released leads inside ZIP ${selectedZip} for ${catalogStorm?.date ? longDate(catalogStorm.date) : "this day"}`
                  : `${exposedCount} of ${bookTotal || dayLeads.length} released leads inside ${catalogStorm?.date ? longDate(catalogStorm.date) : "this day"}`}
                {classifyBasis ? ` · ${classifyBasis}` : ""}.
              </p>
            )}
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

            {/* Affected ZIP codes section */}
            {dayScoped && (
              <div className="space-y-1.5 border-t border-border pt-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Affected ZIP Codes ({affectedZips.length})
                    </p>
                  </div>
                  {selectedZip && (
                    <button
                      type="button"
                      onClick={() => setSelectedZip(null)}
                      className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>

                {affectedZips.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setSelectedZip(null)}
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-mono transition-colors",
                        selectedZip === null
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
                      )}
                    >
                      All ({dayExposed.length})
                    </button>
                    {affectedZips.map(({ zip, count }) => (
                      <button
                        key={zip}
                        type="button"
                        onClick={() => setSelectedZip((curr) => (curr === zip ? null : zip))}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-mono transition-colors flex items-center gap-1 border",
                          selectedZip === zip
                            ? "bg-sky-500 text-white font-semibold border-sky-400 shadow-xs"
                            : "bg-muted/70 text-foreground border-border/60 hover:bg-muted hover:border-border"
                        )}
                        title={count > 0 ? `${zip}: ${count} pilot buildings exposed` : `${zip}: storm impact area (0 pilot buildings seeded)`}
                      >
                        <span>{zip}</span>
                        <span className={cn("text-[10px]", selectedZip === zip ? "text-sky-100" : "text-muted-foreground")}>
                          ({count})
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded border border-border/50 bg-muted/30 p-2 text-xs text-muted-foreground">
                    Storm corridor tracked. No localized ZIP centroids mapped for this event.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <Legend cls="bg-amber-500/50 border-amber-500" label="NWS warning" />
              <Legend cls="bg-red-600/60 border-red-500" label={'Warning with 2"+ hail'} />
              <Legend cls="bg-sky-400 rounded-full" label="Hail report" />
              <Legend cls="bg-red-500 rounded-full" label="No roof permit since" />
              <Legend cls="bg-slate-500 rounded-full" label="Permit filed" />
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

      <aside className="w-full border-t border-border bg-card/30 lg:w-[400px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        {selectedLive ? (
          <div className="space-y-3 p-4">
            <button onClick={() => setSelectedId(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ← All exposed properties
            </button>
            <ProofCard o={selectedLive} />
          </div>
        ) : selectedDay ? (
          <div className="space-y-3 p-4">
            <button onClick={() => setSelectedId(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ← All exposed properties
            </button>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{selectedDay.address}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedDay.city ? `${selectedDay.city}, TX` : ""}{selectedDay.zipCode ? ` ${selectedDay.zipCode.slice(0, 5)}` : ""}
                  </p>
                </div>
                {selectedDay.zipCode && (
                  <span className="shrink-0 rounded bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 text-xs font-mono font-medium text-sky-300">
                    ZIP {selectedDay.zipCode.slice(0, 5)}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedDay.owner || "Owner not on record"} · {selectedDay.tier} · {selectedDay.hail}&quot; hail
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{usd(selectedDay.value, true)} pipeline</p>
              {selectedDay.parcelId && (
                <Link href={`/parcels/${encodeURIComponent(selectedDay.parcelId)}`} className="mt-3 inline-block text-xs underline hover:text-foreground">
                  Open parcel dossier
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">Buildings hit</p>
              {selectedZip ? (
                <span className="rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 px-2 py-0.5 text-xs font-mono font-medium flex items-center gap-1">
                  ZIP {selectedZip}
                  <button
                    type="button"
                    onClick={() => setSelectedZip(null)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    title="Clear ZIP filter"
                  >
                    ×
                  </button>
                </span>
              ) : dayScoped && affectedZips.length > 0 ? (
                <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                  {affectedZips.length} affected ZIPs
                </span>
              ) : null}
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              {dayScoped && catalogStorm?.date ? (
                selectedZip ? (
                  <>
                    Showing <span className="font-semibold text-foreground">{listLeads.length}</span> buildings in ZIP{" "}
                    <span className="font-mono font-semibold text-sky-400">{selectedZip}</span> hit by{" "}
                    {longDate(catalogStorm.date)}.{" "}
                    <button
                      type="button"
                      onClick={() => setSelectedZip(null)}
                      className="text-sky-400 underline hover:text-sky-300 ml-1"
                    >
                      Show all {dayExposed.length} buildings
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{dayExposed.length}</span> buildings across{" "}
                    <span className="font-semibold text-foreground">{affectedZips.length}</span> affected ZIP codes (
                    {affectedZips.map((z) => z.zip).join(", ")}) inside {longDate(catalogStorm.date)}.
                  </>
                )
              ) : storm.date ? (
                `${city} buildings inside the ${longDate(storm.date)} warning areas, highest score first.`
              ) : (
                `${city} buildings from the released pilot book, highest score first.`
              )}
            </p>

            {dayScoped ? (
              listLeads.length ? (
                <ul className="space-y-1.5">
                  {listLeads.slice(0, 100).map((o) => (
                    <li key={o.parcelId || o.address}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.parcelId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md border border-border/60 p-2.5 text-left hover:bg-muted transition-colors",
                          o.tier === "outside" && "opacity-60",
                        )}
                      >
                        <ScorePill score={o.score} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="block truncate text-sm font-medium">{o.address}</span>
                            {o.zipCode && (
                              <span className={cn(
                                "shrink-0 rounded px-1.5 py-0.2 text-[10px] font-mono border",
                                selectedZip === o.zipCode.slice(0, 5)
                                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                  : "bg-muted text-muted-foreground border-border/80"
                              )}>
                                {o.zipCode.slice(0, 5)}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground mt-0.5">
                            {o.owner || "Owner not on record"} · {o.hail}&quot; hail · {usd(o.value, true)}
                          </span>
                        </span>
                        <TierBadge tier={o.tier} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  {brief.loading || hail.loading
                    ? "Classifying buildings for this hail day…"
                    : selectedZip
                      ? `Storm impacted ZIP ${selectedZip}. No Depoii pilot buildings are currently seeded in this ZIP code.`
                      : `No ${city} pilot buildings sit inside this storm swath.`}
                </p>
              )
            ) : liveExposed.length ? (
              <ul className="space-y-1.5">
                {liveExposed.slice(0, 80).map((o) => (
                  <li key={o.parcel.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.parcel.id)}
                      className={cn("flex w-full items-center gap-3 rounded-md border border-border/60 p-2.5 text-left hover:bg-muted", !o.unresolved && "opacity-60")}
                    >
                      <ScorePill score={o.score} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.parcel.address}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {o.parcel.city} · {!o.permitKnown ? "Permit record not retrieved" : o.unresolved ? "Unresolved" : "Permit filed"} · {usd(o.pipelineValue, true)}
                        </span>
                      </span>
                      <TierBadge tier={o.tier} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : shuffledBriefOps.length ? (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Hail day not loaded yet. Showing the full released pilot book
                  {brief.data?.stormName ? ` (${brief.data.stormName})` : ""} (shuffled).
                </p>
                <ul className="space-y-1.5">
                  {shuffledBriefOps.map((o) => (
                    <li key={o.parcelId || o.address}>
                      <Link href={o.parcelId ? `/parcels/${encodeURIComponent(o.parcelId)}` : "/pipeline"} className="flex items-center gap-3 rounded-md border border-border/60 p-2.5 hover:bg-muted">
                        <ScorePill score={o.score} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{o.address}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{o.owner || "Owner not on record"} · {o.hail}&quot; hail · {usd(o.value, true)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{brief.loading ? "Loading buildings…" : `No ${city} buildings sit inside this storm.`}</p>
            )}
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
