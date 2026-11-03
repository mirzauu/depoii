"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Search,
  X,
  Check,
  Filter,
  ChevronDown,
  ChevronRight,
  MapPin,
  Building2,
  HardHat,
  Phone,
  DollarSign,
  Layers,
  Info,
  CheckCircle2,
} from "lucide-react";
import { useDepoiiState } from "@/components/depoii-provider";
import { useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { mapLeaderboard } from "@/lib/engine-api";
import { num, pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RealLogo } from "@/components/real-logo";

const LIMIT = 50;

/** Common commercial roof systems seen on Dallas roof filings. */
const ROOF_SYSTEMS = ["TPO", "Metal", "Modified Bitumen", "EPDM", "Built-up", "Shingle", "PVC"];

const SERVED_AREAS = [
  { city: "Dallas", label: "Dallas, TX" },
  { city: "Fort Worth", label: "Fort Worth, TX" },
];

export default function ContractorsBrowsePage() {
  const router = useRouter();
  const { jurisdiction, setJurisdiction } = useDepoiiState();
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const [minPermits, setMinPermits] = useState("");
  const [minVal, setMinVal] = useState("");
  const [roof, setRoof] = useState("");
  const [hasContact, setHasContact] = useState(false);
  const [sort, setSort] = useState("volume_desc");
  const [offset, setOffset] = useState(0);
  const [hideFilters, setHideFilters] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Accordion filter states matching Hot Sheet
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jurisdiction: true,
    search: true,
    roof: true,
    permits: true,
    volume: true,
    contact: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const q = useDebounced(search, 300);
  const minP = useDebounced(minPermits, 300);
  const minV = useDebounced(minVal, 300);

  const page = useEngine(
    "contractors/directory",
    {
      jurisdiction: all ? undefined : jurisdiction,
      search: q || undefined,
      min_permits: minP || undefined,
      min_valuation: minV || undefined,
      roof_system: roof || undefined,
      has_contact: hasContact || undefined,
      sort_by: sort,
      limit: LIMIT,
      offset,
    },
    mapLeaderboard,
  );

  const clearAllFilters = () => {
    setSearch("");
    setMinPermits("");
    setMinVal("");
    setRoof("");
    setHasContact(false);
    setSort("volume_desc");
    setAll(false);
    setOffset(0);
  };

  const activeFiltersCount = [
    Boolean(search),
    Boolean(minPermits),
    Boolean(minVal),
    Boolean(roof),
    hasContact,
    all,
    sort !== "volume_desc",
  ].filter(Boolean).length;

  const rows = page.data?.contractors ?? [];

  const allSelected = rows.length > 0 && rows.every((c) => selectedRowIds.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(rows.map((c) => c.id)));
  };
  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const total = page.data?.total ?? 0;
  const place = all ? "All Locations" : jurisdiction;

  const pageIndex = Math.floor(offset / LIMIT);
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + LIMIT);
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] flex-col bg-[#171714] text-[#FAFAF8] antialiased font-sans overflow-hidden">
      {/* Top Header Row - Fixed */}
      <div className="shrink-0 border-b border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-3 z-20 shrink-0 text-[#FAFAF8]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Contractors Directory</h1>
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/50">
                {place}
              </span>
            </div>
            <p className="text-xs font-medium text-rose-600 dark:text-[#DE7272]">
              Regional commercial roofing contractor directory indexed from municipal permit records across North Texas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {page.data ? `${num(total)} contractors indexed` : "Loading..."}
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
              placeholder="Search company name…"
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
              className="h-8 appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#16171d] pl-3 pr-8 text-xs text-foreground dark:text-neutral-200 outline-none transition-colors focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
            >
              <option value="volume_desc">Volume (High to Low)</option>
              <option value="permits_desc">Permits (High to Low)</option>
              <option value="name_asc">Name (A–Z)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-400" />
          </div>
        </div>
      </div>

      {/* Main Container: Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Filter Sidebar */}
        {!hideFilters && (
          <aside className="w-80 shrink-0 border-r border-[rgba(250,250,248,0.08)] bg-[#171714] text-[#B9B9B2] flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Segmented Filter Pills */}
              <div className="flex rounded-lg border border-[rgba(250,250,248,0.08)] bg-[#1F1F1B] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMinVal("");
                    setHasContact(false);
                    setOffset(0);
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-center font-medium rounded-md transition-colors cursor-pointer",
                    !minVal && !hasContact
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinVal("500000");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-center font-medium rounded-md transition-colors cursor-pointer",
                    minVal === "500000"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  $500k+ Vol
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasContact(true);
                    setOffset(0);
                  }}
                  className={cn(
                    "flex-1 py-1.5 text-center font-medium rounded-md transition-colors cursor-pointer",
                    hasContact
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  Contact
                </button>
              </div>

              {/* Accordion Filter Cards */}
              <div className="space-y-2 text-xs">
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{place}</span>
                      {openSections.jurisdiction ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.jurisdiction && (
                    <div className="mt-2.5 space-y-1">
                      {SERVED_AREAS.map((c) => (
                        <button
                          key={c.city}
                          type="button"
                          onClick={() => {
                            setJurisdiction(c.city);
                            setAll(false);
                            setOffset(0);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                            !all && jurisdiction === c.city
                              ? "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          <span>{c.label}</span>
                          {!all && jurisdiction === c.city && <Check className="size-3" />}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setAll(true);
                          setOffset(0);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                          all
                            ? "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        <span>All Locations (Combined)</span>
                        {all && <Check className="size-3" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Roof System */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("roof")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5 text-sky-600 dark:text-sky-400" />
                      <span>Roof System</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {roof && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">{roof}</span>}
                      {openSections.roof ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.roof && (
                    <div className="mt-2.5 space-y-1">
                      <select
                        value={roof}
                        onChange={(e) => {
                          setRoof(e.target.value);
                          setOffset(0);
                        }}
                        className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2 py-1.5 text-xs text-foreground dark:text-neutral-200 outline-none"
                      >
                        <option value="">Any Roof System</option>
                        {ROOF_SYSTEMS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Min Permits */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("permits")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HardHat className="size-3.5 text-amber-600 dark:text-[#FFCA88]" />
                      <span>Permit Activity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {minPermits && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">{minPermits}+</span>}
                      {openSections.permits ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.permits && (
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {[
                        { label: "Any", val: "" },
                        { label: "2+ permits", val: "2" },
                        { label: "5+ permits", val: "5" },
                        { label: "10+ permits", val: "10" },
                        { label: "25+ permits", val: "25" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setMinPermits(item.val);
                            setOffset(0);
                          }}
                          className={cn(
                            "rounded py-1 text-center text-[10px] transition-colors border cursor-pointer",
                            minPermits === item.val
                              ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Min Valuation */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("volume")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-3.5 text-emerald-600 dark:text-[#B4E4D6]" />
                      <span>Volume Threshold</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {minVal && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">${usd(Number(minVal), true)}</span>}
                      {openSections.volume ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.volume && (
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {[
                        { label: "Any", val: "" },
                        { label: "$100k+", val: "100000" },
                        { label: "$500k+", val: "500000" },
                        { label: "$1M+", val: "1000000" },
                        { label: "$5M+", val: "5000000" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setMinVal(item.val);
                            setOffset(0);
                          }}
                          className={cn(
                            "rounded py-1 text-center text-[10px] transition-colors border cursor-pointer",
                            minVal === item.val
                              ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Contact Details */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("contact")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Contact Details</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {hasContact && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">Active</span>}
                      {openSections.contact ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.contact && (
                    <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#111217] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setHasContact(false);
                          setOffset(0);
                        }}
                        className={cn(
                          "rounded py-1 text-center text-xs font-medium transition-colors cursor-pointer",
                          !hasContact
                            ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasContact(true);
                          setOffset(0);
                        }}
                        className={cn(
                          "rounded py-1 text-center text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer",
                          hasContact
                            ? "border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6] font-semibold shadow-sm"
                            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        <Phone className="size-3" />
                        Phone/Web
                      </button>
                    </div>
                  )}
                </div>
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
            {page.loading && !page.data ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground">
                <div className="size-6 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent mb-2" />
                <p className="text-xs">Loading contractors directory…</p>
              </div>
            ) : page.error ? (
              <div className="p-8 text-center text-rose-500 text-xs">
                <p>Failed to load contractors: {typeof page.error === "string" ? page.error : "Unknown error"}</p>
                <button onClick={page.retry} className="mt-2 underline text-xs">Retry</button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center text-muted-foreground">
                <p className="text-sm font-medium text-foreground dark:text-white">No contractors found</p>
                <p className="text-xs mt-1">Try broadening your search or adjusting your filter criteria.</p>
                <button onClick={clearAllFilters} className="mt-3 text-xs font-medium text-sky-600 dark:text-sky-400 underline">
                  Reset all filters
                </button>
              </div>
            ) : (
              <table className="w-full min-w-max text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#171714]">
                  <tr className="apollo-th h-[39px] border-b border-[rgba(250,250,248,0.08)] bg-[#171714] text-[11px] font-medium uppercase tracking-wider text-[#B9B9B2]">
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider w-12 px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={rows.length === 0}
                        aria-label="Select all contractors"
                        className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky left-12 top-0 z-30 bg-[#171714] px-4 py-2.5 font-medium text-[#B9B9B2] whitespace-nowrap border-b border-[rgba(250,250,248,0.08)] uppercase text-[11px] tracking-wider min-w-[340px]">
                      Contractor
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 whitespace-nowrap min-w-[260px]">
                      Roof System
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 text-right whitespace-nowrap min-w-[130px]">
                      Permits
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 text-right whitespace-nowrap min-w-[150px]">
                      Market Share
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 pr-4 text-right whitespace-nowrap min-w-[160px]">
                      Total Volume
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-neutral-800/50">
                  {rows.map((c) => {
                    const isRowSelected = selectedRowIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/contractors/${encodeURIComponent(c.name)}`)}
                        className={cn(
                          "apollo-row h-14 group transition-colors duration-150 cursor-pointer border-b border-[rgba(250,250,248,0.06)]",
                          isRowSelected
                            ? "bg-[rgba(242,247,100,0.08)] hover:bg-[rgba(242,247,100,0.12)] text-[#FAFAF8]"
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
                            aria-label={`Select ${c.name}`}
                            className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className={cn(
                          "sticky left-12 z-10 px-4 py-2 h-14 align-middle text-[12px] font-medium whitespace-nowrap min-w-[340px] transition-colors duration-150",
                          isRowSelected
                            ? "bg-[rgba(242,247,100,0.08)] group-hover:bg-[rgba(242,247,100,0.12)] text-[#FAFAF8]"
                            : "bg-[#171714] group-hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                        )}>
                        <div className="flex items-center gap-2.5">
                          <RealLogo
                            url={c.logoUrl}
                            alt={c.name}
                            size={28}
                            className="rounded-md bg-white dark:bg-neutral-900 object-contain p-0.5 border border-neutral-200 dark:border-neutral-800 shadow-sm shrink-0"
                            fallback={
                              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-neutral-100 dark:bg-neutral-800/80 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/60 uppercase">
                                {c.name.slice(0, 2)}
                              </span>
                            }
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-[#FAFAF8] group-hover:text-amber-300 transition-colors block truncate">
                              {c.name}
                            </span>
                            {(c.phone || c.hq) && (
                              <p className="mt-0.5 max-w-sm truncate text-[11px] text-[#B9B9B2]">
                                {[c.phone, c.hq].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[260px] whitespace-nowrap text-[#FAFAF8]">
                        {c.roofSystem || "—"}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[130px] text-right font-mono tabular-nums whitespace-nowrap font-medium text-[#FAFAF8]">
                        {num(c.permits)}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[150px] text-right font-mono tabular-nums whitespace-nowrap text-[#B9B9B2]">
                        {c.share > 0 ? pct(c.share, 1) : "—"}
                      </td>
                      <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[160px] pr-4 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-[#FAFAF8]">
                        {c.valuationLabel || (c.valuation ? usd(c.valuation, true) : "—")}
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
                Showing <strong className="text-[#FAFAF8] font-medium">{from}–{to}</strong> of <strong className="text-[#FAFAF8] font-medium">{num(total)}</strong> records
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
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
                className="rounded border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-2.5 py-1 text-[#FAFAF8] hover:bg-[#23231E] disabled:opacity-30 cursor-pointer select-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
