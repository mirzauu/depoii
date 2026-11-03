"use client";

import { useEffect, useState } from "react";
import {
  Search,
  X,
  Check,
  HardHat,
  Filter,
  ChevronDown,
  ChevronRight,
  MapPin,
  Building2,
  Calendar,
  Briefcase,
  Zap,
  DollarSign,
  CloudLightning,
  Layers,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { PermitDetailDrawer } from "@/components/permit-detail-drawer";
import { ParcelDetailDrawer } from "@/components/parcel-detail-drawer";
import { mapJobsites, mapMultiphase, mapPermitSearch, mapStats, type EnginePermit } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const LIMIT = 50;

const SERVED_AREAS = [
  { city: "Dallas", label: "Dallas, TX" },
  { city: "Fort Worth", label: "Fort Worth, TX" },
];

function daysSince(iso: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export default function PermitsPage() {
  const { jurisdiction, setJurisdiction } = useDepoiiState();
  const [view, setView] = useState<"all" | "jobsites" | "phases">("all");
  const [selectedPermit, setSelectedPermit] = useState<EnginePermit | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, []);
  const [contractor, setContractor] = useState("");
  const [category, setCategory] = useState("");
  const [roof, setRoof] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("all");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [hail, setHail] = useState(false);
  const [sort, setSort] = useState("date_desc");
  const [offset, setOffset] = useState(0);
  const [hideFilters, setHideFilters] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Accordion filter states matching Hot Sheet
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jurisdiction: true,
    contractor: true,
    roof: true,
    category: true,
    status: true,
    intelligence: true,
    valuation: true,
    hail: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const q = useDebounced(search, 300);
  const c = useDebounced(contractor, 300);
  const lo = useDebounced(minVal, 300);
  const hi = useDebounced(maxVal, 300);

  const stats = useEngine("permits/stats", {}, mapStats);
  const page = useEngine(
    "permits/search",
    {
      jurisdiction: all ? undefined : jurisdiction,
      search: q,
      contractor: c,
      category,
      probable_roof_system: roof,
      status_filter: status,
      intelligence_mode: mode === "all" ? undefined : mode,
      min_valuation: lo,
      max_valuation: hi,
      is_hail_storm_window: hail,
      sort_by: sort,
      limit: LIMIT,
      offset,
    },
    mapPermitSearch,
    view === "all",
  );
  const jobs = useEngine(
    "permits/active-jobsites",
    { jurisdiction: all ? undefined : jurisdiction, search: q, contractor: c, roof_system: roof, min_valuation: lo, limit: LIMIT, offset },
    mapJobsites,
    view === "jobsites",
  );
  const phases = useEngine(
    "permits/multiphase-projects",
    { jurisdiction: all ? undefined : jurisdiction },
    mapMultiphase,
    view === "phases",
  );

  const currentRows: { id: string }[] =
    view === "jobsites"
      ? (jobs.data?.jobsites ?? [])
      : view === "phases"
      ? (phases.data?.campuses ?? [])
      : (page.data?.permits ?? []);

  const allSelected = currentRows.length > 0 && currentRows.every((r) => selectedRowIds.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(currentRows.map((r) => r.id)));
  };
  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearch("");
    setContractor("");
    setCategory("");
    setRoof("");
    setStatus("");
    setMode("all");
    setMinVal("");
    setMaxVal("");
    setHail(false);
    setSort("date_desc");
    setAll(false);
    setOffset(0);
  };

  const activeFiltersCount = [
    Boolean(search),
    Boolean(contractor),
    Boolean(category),
    Boolean(roof),
    Boolean(status),
    mode !== "all",
    Boolean(minVal),
    Boolean(maxVal),
    hail,
    all,
    sort !== "date_desc",
  ].filter(Boolean).length;

  const currentTotal = view === "jobsites"
    ? (jobs.data?.total ?? 0)
    : view === "phases"
    ? (phases.data?.total ?? 0)
    : (page.data?.total ?? 0);

  const pageIndex = Math.floor(offset / LIMIT);
  const from = currentTotal === 0 ? 0 : offset + 1;
  const to = Math.min(currentTotal, offset + LIMIT);
  const pageCount = Math.max(1, Math.ceil(currentTotal / LIMIT));
  const place = all ? "All Locations" : jurisdiction;

  return (
    <div className="flex h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] flex-col bg-[#171714] text-[#FAFAF8] antialiased font-sans overflow-hidden">
      {/* Top Header Row - Fixed */}
      <div className="shrink-0 border-b border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-3 z-20 shrink-0 text-[#FAFAF8]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Municipal Permits</h1>
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/50">
                {place}
              </span>
            </div>
            <p className="text-xs font-medium text-rose-600 dark:text-[#DE7272]">
              Search and audit 30-year municipal building and reroof histories sourced directly from city inspection portals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {stats.data ? `${num(stats.data.totalPermits)} permits indexed` : "Loading..."}
            </span>
          </div>
        </div>
      </div>

      {/* Action & Filter Sub-Bar - Fixed */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-2.5 text-xs z-20 shrink-0 text-[#FAFAF8]">
        {/* Left Side: Toggle Sidebar & Search */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setHideFilters((prev) => !prev)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 px-2.5 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer select-none"
          >
            <Filter className="size-3 text-muted-foreground dark:text-neutral-400" />
            <span>{hideFilters ? "Show Filters" : "Hide Filters"}</span>
          </button>

          {/* Search Input */}
          <div className="relative min-w-[260px] sm:min-w-[340px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Search permit number, address, or scope…"
              className="h-8 w-full rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#16171d] pl-8 pr-3 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none transition-colors focus:border-neutral-400 dark:focus:border-neutral-700 focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setOffset(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Sorting & Reset */}
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="h-8 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 px-2.5 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer select-none"
            >
              Reset filters ({activeFiltersCount})
            </button>
          )}

          {/* Sorting Dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setOffset(0);
              }}
              className="h-8 appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 pl-2.5 pr-7 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white outline-none cursor-pointer"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="valuation_desc">Highest valuation</option>
              <option value="valuation_asc">Lowest valuation</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Filter Sidebar - Hot Sheet Style */}
        {!hideFilters && (
          <aside className="w-80 shrink-0 border-r border-[rgba(250,250,248,0.08)] bg-[#171714] text-[#B9B9B2] flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:thin]">
              {/* Segmented Count Tabs: All, Jobsites, Phases */}
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[rgba(250,250,248,0.08)] bg-[#1F1F1B] p-0.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setView("all");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border cursor-pointer",
                    view === "all"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white border-neutral-300 dark:border-white/20 font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">All</span>
                  <span className="text-xs font-semibold">{page.data ? num(page.data.total) : "…"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setView("jobsites");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border cursor-pointer",
                    view === "jobsites"
                      ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6] font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Jobsites</span>
                  <span className="text-xs font-semibold">{jobs.data ? num(jobs.data.total) : "…"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setView("phases");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border cursor-pointer",
                    view === "phases"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-[#FFCA88] font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Phases</span>
                  <span className="text-xs font-semibold">{phases.data ? num(phases.data.total) : "…"}</span>
                </button>
              </div>

              {/* Accordion Filter Cards */}
              <div className="space-y-2.5">
                {/* 1. Jurisdiction */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("jurisdiction")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Jurisdiction</span>
                    </div>
                    {openSections.jurisdiction ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.jurisdiction && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAll(false);
                            setJurisdiction("Dallas, TX");
                            setOffset(0);
                          }}
                          className={cn(
                            "flex-1 rounded border px-2 py-1.5 text-center text-xs font-medium transition-colors cursor-pointer",
                            !all && jurisdiction === "Dallas, TX"
                              ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold shadow-sm"
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          Dallas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAll(false);
                            setJurisdiction("Fort Worth, TX");
                            setOffset(0);
                          }}
                          className={cn(
                            "flex-1 rounded border px-2 py-1.5 text-center text-xs font-medium transition-colors cursor-pointer",
                            !all && jurisdiction === "Fort Worth, TX"
                              ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold shadow-sm"
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          Ft. Worth
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAll(true);
                            setOffset(0);
                          }}
                          className={cn(
                            "flex-1 rounded border px-2 py-1.5 text-center text-xs font-medium transition-colors cursor-pointer",
                            all
                              ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold shadow-sm"
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          All
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Contractor */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("contractor")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HardHat className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Contractor</span>
                    </div>
                    {openSections.contractor ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.contractor && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={contractor}
                        onChange={(e) => {
                          setContractor(e.target.value);
                          setOffset(0);
                        }}
                        placeholder="Contractor name…"
                        className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Roof System */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("roof")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Roof System</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {roof && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">1 x</span>}
                      {openSections.roof ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.roof && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="relative">
                        <select
                          value={roof}
                          onChange={(e) => {
                            setRoof(e.target.value);
                            setOffset(0);
                          }}
                          className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-foreground dark:text-neutral-200 outline-none focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
                        >
                          <option value="">Any Roof System</option>
                          {(stats.data?.byRoofSystem ?? []).map((x) => (
                            <option key={x.name} value={x.name}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Category */}
                {view === "all" && (
                  <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSection("category")}
                      className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Briefcase className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                        <span>Category</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {category && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">1 x</span>}
                        {openSections.category ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                      </div>
                    </button>

                    {openSections.category && (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="relative">
                          <select
                            value={category}
                            onChange={(e) => {
                              setCategory(e.target.value);
                              setOffset(0);
                            }}
                            className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-foreground dark:text-neutral-200 outline-none focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
                          >
                            <option value="">Any Category</option>
                            {(stats.data?.byCategory ?? []).map((x) => (
                              <option key={x.name} value={x.name}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Status & Intelligence */}
                {view === "all" && (
                  <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSection("intelligence")}
                      className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="size-3.5 text-amber-600 dark:text-[#FFCA88]" />
                        <span>Intelligence Mode</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {mode !== "all" && <span className="rounded bg-amber-500/15 text-amber-700 dark:text-[#FFCA88] px-1 text-[10px]">1 x</span>}
                        {openSections.intelligence ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                      </div>
                    </button>

                    {openSections.intelligence && (
                      <div className="mt-2.5 space-y-2">
                        <div className="relative">
                          <select
                            value={mode}
                            onChange={(e) => {
                              setMode(e.target.value);
                              setOffset(0);
                            }}
                            className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-foreground dark:text-neutral-200 outline-none focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
                          >
                            <option value="all">All permits</option>
                            <option value="pre_permit">Pre-Permit / Bidding Open</option>
                            <option value="storm_matched">Storm matched</option>
                            <option value="unresolved_hail">Unresolved hail</option>
                            <option value="commercial_only">Commercial only</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
                        </div>

                        {/* Status Pills */}
                        <div className="flex gap-1 pt-1">
                          {["", "active", "completed", "expired"].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setStatus(s);
                                setOffset(0);
                              }}
                              className={cn(
                                "flex-1 rounded py-1 text-center text-[10px] capitalize transition-colors border cursor-pointer",
                                status === s
                                  ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                                  : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                              )}
                            >
                              {s === "" ? "Any" : s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Valuation & Storm Window */}
                {view === "all" && (
                  <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSection("valuation")}
                      className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="size-3.5 text-emerald-600 dark:text-[#B4E4D6]" />
                        <span>Valuation & Storm</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(minVal || maxVal || hail) && (
                          <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">Active</span>
                        )}
                        {openSections.valuation ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                      </div>
                    </button>

                    {openSections.valuation && (
                      <div className="mt-2.5 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                            <input
                              value={minVal}
                              inputMode="numeric"
                              onChange={(e) => {
                                setMinVal(e.target.value.replace(/[^\d.]/g, ""));
                                setOffset(0);
                              }}
                              placeholder="Min val"
                              className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] pl-5 pr-2 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none font-mono"
                            />
                          </div>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                            <input
                              value={maxVal}
                              inputMode="numeric"
                              onChange={(e) => {
                                setMaxVal(e.target.value.replace(/[^\d.]/g, ""));
                                setOffset(0);
                              }}
                              placeholder="Max val"
                              className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] pl-5 pr-2 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none font-mono"
                            />
                          </div>
                        </div>

                        {/* Post-Storm Window 180d Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            setHail(!hail);
                            setOffset(0);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between rounded px-2 py-1.5 text-[11px] border transition-colors cursor-pointer",
                            hail
                              ? "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-[#FFCA88] font-semibold"
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <CloudLightning className="size-3" />
                            <span>Post-Storm Window (180d)</span>
                          </span>
                          {hail && <CheckCircle2 className="size-3 text-amber-600 dark:text-[#FFCA88]" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-[rgba(250,250,248,0.08)] p-3 bg-[#171714]">
              <button
                type="button"
                onClick={clearAllFilters}
                className="w-full rounded-md border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-3 py-2 text-xs font-medium text-[#FAFAF8] hover:bg-[#23231E] transition-colors cursor-pointer select-none"
              >
                Clear All Filters
              </button>
            </div>
          </aside>
        )}

        {/* Right Table Container */}
        <main className="min-w-0 flex-1 flex flex-col justify-between overflow-x-auto bg-[#171714] text-[#FAFAF8]">
          {/* Table Scroll Area */}
          <div className="min-w-0 flex-1 overflow-auto relative">
            {view === "jobsites" ? (
              <table className="w-full min-w-max text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#171714]">
                  <tr className="apollo-th h-[39px] border-b border-[rgba(250,250,248,0.08)] bg-[#171714] text-[11px] font-medium uppercase tracking-wider text-[#B9B9B2]">
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider w-12 px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={currentRows.length === 0}
                        aria-label="Select all permits"
                        className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky left-12 top-0 z-30 bg-[#171714] px-4 py-2.5 font-medium text-[#B9B9B2] whitespace-nowrap border-b border-[rgba(250,250,248,0.08)] uppercase text-[11px] tracking-wider min-w-[240px]">
                      Permit
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[300px]">
                      Address
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[260px]">
                      Contractor
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 text-right whitespace-nowrap min-w-[120px]">
                      Days Open
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 pr-4 text-right whitespace-nowrap min-w-[130px]">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-neutral-800/50">
                  {jobs.data?.jobsites.map((j) => {
                    const isRowSelected = selectedRowIds.has(j.id);
                    return (
                    <tr
                      key={j.id}
                      onClick={() => setSelectedPermit({
                        id: j.id,
                        permitNumber: j.permitNumber,
                        jurisdiction: j.jurisdiction,
                        address: j.address,
                        city: "",
                        state: "",
                        zip: "",
                        issued: j.issued,
                        status: j.status || "Active",
                        valuation: j.valuation,
                        category: j.category || "Commercial Re-Roof",
                        roofSystem: j.roofSystem,
                        contractor: j.contractor,
                        description: j.scope || "Active commercial roofing jobsite in progress.",
                        sqft: 0,
                        hailWindow: false,
                        storm: "",
                        parcelId: "",
                        lat: j.lat,
                        lng: j.lng,
                      })}
                      className={cn(
                        "apollo-row h-14 group transition-colors duration-150 cursor-pointer border-b border-[rgba(250,250,248,0.06)]",
                        isRowSelected
                          ? "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                          : "bg-[#171714] hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                      )}
                    >
                      {/* Checkbox with active row indicator */}
                      <td className="w-12 px-4 py-0 text-center sticky left-0 z-10 bg-[#171714] group-hover:bg-[rgb(35,35,30)]">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectRow(j.id);
                          }}
                          aria-label={`Select job ${j.permitNumber || j.id}`}
                          className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className={cn(
                        "sticky left-12 z-10 px-4 py-2 h-14 align-middle text-[12px] font-medium whitespace-nowrap min-w-[240px] transition-colors duration-150",
                        isRowSelected
                          ? "bg-[rgba(255,255,255,0.06)] group-hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                          : "bg-[#171714] group-hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                      )}>
                        <span className="font-semibold text-[#FAFAF8] group-hover:text-amber-300 transition-colors">{j.permitNumber}</span>
                        <span className="block text-[11px] text-[#B9B9B2]">{j.issued ? shortDate(j.issued) : "Issue date blank"}</span>
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[300px] whitespace-nowrap">
                        <span className="block truncate text-[#FAFAF8] group-hover:text-white">{j.address || "Address not published"}</span>
                        <span className="block text-[11px] text-[#B9B9B2]">{j.jurisdiction}</span>
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[260px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <ContractorLink name={j.contractor} />
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[120px] text-right font-mono tabular-nums whitespace-nowrap text-[#B9B9B2]">
                        {daysSince(j.issued) ?? "—"}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[130px] pr-4 text-right font-mono tabular-nums whitespace-nowrap font-medium text-[#FAFAF8]">
                        {j.valuation ? usd(j.valuation, true) : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : view === "phases" ? (
              <table className="w-full min-w-max text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#171714]">
                  <tr className="apollo-th h-[39px] border-b border-[rgba(250,250,248,0.08)] bg-[#171714] text-[11px] font-medium uppercase tracking-wider text-[#B9B9B2]">
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider w-12 px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={currentRows.length === 0}
                        aria-label="Select all campuses"
                        className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky left-12 top-0 z-30 bg-[#171714] px-4 py-2.5 font-medium text-[#B9B9B2] whitespace-nowrap border-b border-[rgba(250,250,248,0.08)] uppercase text-[11px] tracking-wider min-w-[280px]">
                      Campus
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 text-right whitespace-nowrap min-w-[110px]">
                      Phases
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[260px]">
                      Contractors
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 pr-4 text-right whitespace-nowrap min-w-[130px]">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-neutral-800/50">
                  {phases.data?.campuses.map((c) => {
                    const isRowSelected = selectedRowIds.has(c.id);
                    return (
                    <tr
                      key={c.id}
                      className={cn(
                        "apollo-row h-14 group transition-colors duration-150 cursor-pointer border-b border-[rgba(250,250,248,0.06)]",
                        isRowSelected
                          ? "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                          : "bg-[#171714] hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                      )}
                    >
                      {/* Checkbox with active row indicator */}
                      <td className="w-12 px-4 py-0 text-center sticky left-0 z-10 bg-[#171714] group-hover:bg-[rgb(35,35,30)]">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectRow(c.id);
                          }}
                          aria-label={`Select campus ${c.name || c.id}`}
                          className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className={cn(
                        "sticky left-12 z-10 px-4 py-2 h-14 align-middle text-[12px] font-medium whitespace-nowrap min-w-[280px] transition-colors duration-150",
                        isRowSelected
                          ? "bg-[rgba(255,255,255,0.06)] group-hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                          : "bg-[#171714] group-hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                      )}>
                        <span className="font-semibold text-[#FAFAF8] group-hover:text-amber-300 transition-colors">{c.name}</span>
                        <span className="block text-[11px] text-[#B9B9B2]">{c.jurisdiction}</span>
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[110px] text-right font-mono tabular-nums whitespace-nowrap text-[#B9B9B2]">
                        {c.phases}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[260px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {c.contractors.length ? (
                          <div className="flex flex-col gap-1">
                            {c.contractors.map((name) => (
                              <ContractorLink key={name} name={name} />
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[130px] pr-4 text-right font-mono tabular-nums whitespace-nowrap font-medium text-[#FAFAF8]">
                        {c.valuation ? usd(c.valuation, true) : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-max text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#171714]">
                  <tr className="apollo-th h-[39px] border-b border-[rgba(250,250,248,0.08)] bg-[#171714] text-[11px] font-medium uppercase tracking-wider text-[#B9B9B2]">
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider w-12 px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={currentRows.length === 0}
                        aria-label="Select all permits"
                        className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky left-12 top-0 z-30 bg-[#171714] px-4 py-2.5 font-medium text-[#B9B9B2] whitespace-nowrap border-b border-[rgba(250,250,248,0.08)] uppercase text-[11px] tracking-wider min-w-[240px]">
                      Permit
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[300px]">
                      Address
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[260px]">
                      Contractor
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[240px]">
                      Roof System
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[180px]">
                      Category
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[160px]">
                      Status
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 pr-4 text-right whitespace-nowrap min-w-[130px]">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-neutral-800/50">
                  {page.data?.permits.map((p) => {
                    const isRowSelected = selectedRowIds.has(p.id);
                    return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPermit(p)}
                      className={cn(
                        "apollo-row h-14 group transition-colors duration-150 cursor-pointer border-b border-[rgba(250,250,248,0.06)]",
                        isRowSelected
                          ? "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                          : "bg-[#171714] hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                      )}
                    >
                      {/* Checkbox with active row indicator */}
                      <td className="w-12 px-4 py-0 text-center sticky left-0 z-10 bg-[#171714] group-hover:bg-[rgb(35,35,30)]">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectRow(p.id);
                          }}
                          aria-label={`Select permit ${p.permitNumber || p.id}`}
                          className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className={cn(
                        "sticky left-12 z-10 px-4 py-2 h-14 align-middle text-[12px] font-medium whitespace-nowrap min-w-[240px] transition-colors duration-150",
                        isRowSelected
                          ? "bg-[rgba(255,255,255,0.06)] group-hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                          : "bg-[#171714] group-hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                      )}>
                        <span className="font-semibold text-[#FAFAF8] group-hover:text-amber-300 transition-colors">{p.permitNumber}</span>
                        <span className="block text-[11px] text-[#B9B9B2]">
                          {p.isPrePermit && p.appliedDate
                            ? `Applied ${shortDate(p.appliedDate)}`
                            : p.issued
                            ? shortDate(p.issued)
                            : "Issue date blank"}
                          {p.hailWindow ? " · storm window" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[300px] whitespace-nowrap">
                        <span className="block truncate text-[#FAFAF8] group-hover:text-white">{p.address || "Address not published"}</span>
                        <span className="block text-[11px] text-[#B9B9B2]">{p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")}</span>
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[260px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {p.isPrePermit && (!p.contractor || p.contractor.toLowerCase().includes("file") || p.contractor.toLowerCase().includes("licensed")) ? (
                          <span className="text-xs text-[#B9B9B2] italic">Contractor not selected</span>
                        ) : (
                          <ContractorLink name={p.contractor} />
                        )}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[240px] whitespace-nowrap text-[#FAFAF8]">
                        {p.roofSystem || "—"}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[180px] whitespace-nowrap text-[#B9B9B2]">
                        {p.category || "—"}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[160px] whitespace-nowrap">
                        {p.isPrePermit ? (
                          <span className="inline-flex items-center rounded border border-[#B4E4D6]/40 bg-[#B4E4D6]/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-[#B4E4D6]">
                            {p.bidWindowStatus || p.status || "In Review"}
                          </span>
                        ) : (
                          <span className="text-[#B9B9B2]">{p.status || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[130px] pr-4 text-right font-mono tabular-nums whitespace-nowrap font-medium text-[#FAFAF8]">
                        {p.valuation ? usd(p.valuation, true) : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Fixed Pagination Bar */}
          <div className="shrink-0 flex items-center justify-between border-t border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-3 text-xs text-[#B9B9B2] z-10">
            <div>
              <span>
                Showing <strong className="text-[#FAFAF8] font-medium">{from}–{to}</strong> of <strong className="text-[#FAFAF8] font-medium">{num(currentTotal)}</strong> records
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#B9B9B2] mr-2">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                className="rounded border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-2.5 py-1 text-[#FAFAF8] hover:bg-[#23231E] disabled:opacity-30 cursor-pointer select-none transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + LIMIT >= currentTotal}
                onClick={() => setOffset(offset + LIMIT)}
                className="rounded border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-2.5 py-1 text-[#FAFAF8] hover:bg-[#23231E] disabled:opacity-30 cursor-pointer select-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Permit Detail Half Window / Drawer */}
      <PermitDetailDrawer
        permit={selectedPermit}
        onClose={() => setSelectedPermit(null)}
        onViewParcel={(parcelId) => {
          setSelectedPermit(null);
          setSelectedParcelId(parcelId);
        }}
      />

      {/* Connected Parcel Detail Drawer */}
      <ParcelDetailDrawer
        parcelId={selectedParcelId}
        onClose={() => setSelectedParcelId(null)}
      />
    </div>
  );
}
