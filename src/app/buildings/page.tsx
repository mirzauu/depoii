"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Search,
  X,
  Phone,
  Mail,
  Globe,
  Building2,
  ShieldCheck,
  Filter,
  ChevronDown,
  ChevronRight,
  MapPin,
  Briefcase,
  Calendar,
  UserCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useDepoiiState } from "@/components/depoii-provider";
import { useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ParcelDossierView } from "@/components/parcel-dossier-view";
import { engineGet, mapBrowseParcelDetail, mapParcelBrowse, type BrowseParcel } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const LIMIT = 50;

const SERVED_AREAS = [
  { city: "Dallas", label: "Dallas, TX" },
  { city: "Fort Worth", label: "Fort Worth, TX" },
];

function parseSections(raw?: string): { description?: string; area_sqft?: number; year_built?: number; stories?: number }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as { description?: string; area_sqft?: number; year_built?: number; stories?: number }[]) : [];
  } catch {
    return [];
  }
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "" || value === 0) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function BuildingsPage() {
  const { jurisdiction, setJurisdiction } = useDepoiiState();
  const [propertyClass, setPropertyClass] = useState<"all" | "commercial" | "industrial">("all");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("");
  const [selectedZips, setSelectedZips] = useState<string[]>([]);
  const [zipInput, setZipInput] = useState("");

  const handleAddZip = (raw?: string) => {
    const text = (raw ?? zipInput).trim();
    if (!text) return;
    const matches = text.match(/\b\d{5}\b/g);
    if (matches && matches.length > 0) {
      setSelectedZips((prev) => {
        const next = new Set(prev);
        matches.forEach((m) => next.add(m));
        return Array.from(next);
      });
      setZipInput("");
      setOffset(0);
    } else {
      const digits = text.replace(/\D/g, "").slice(0, 5);
      if (digits.length === 5) {
        setSelectedZips((prev) => Array.from(new Set([...prev, digits])));
        setZipInput("");
        setOffset(0);
      }
    }
  };

  const removeZip = (zToRemove: string) => {
    setSelectedZips((prev) => prev.filter((z) => z !== zToRemove));
    setOffset(0);
  };
  const [minSqft, setMinSqft] = useState("0");
  const [minYear, setMinYear] = useState<number>(0);
  const [hasContact, setHasContact] = useState<boolean>(false);
  const [releasedOnly, setReleasedOnly] = useState<boolean>(false);
  const [sort, setSort] = useState("sqft_desc");
  const [offset, setOffset] = useState(0);
  const [hideFilters, setHideFilters] = useState(false);

  // Accordion filter toggles matching Hot Sheet
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jurisdiction: true,
    zipcode: true,
    sqft: true,
    propertyClass: true,
    year: true,
    owner: true,
    verification: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullDetailId, setFullDetailId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<BrowseParcel | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const qSearch = useDebounced(search, 300);
  const qOwner = useDebounced(owner, 300);
  const qSqft = useDebounced(minSqft, 300);
  const qZip = useDebounced(selectedZips.join(","), 300);

  // Read URL query params on mount (e.g. from Hail Map /buildings?zip=75201,75207)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const z = params.get("zip") || params.get("zipcode");
    if (z) {
      const parsed = z
        .split(/[,\s]+/)
        .map((item) => item.replace(/\D/g, "").slice(0, 5))
        .filter((item) => item.length === 5);
      if (parsed.length > 0) {
        setSelectedZips(Array.from(new Set(parsed)));
      }
    }
  }, []);

  const page = useEngine(
    "parcels/browse",
    {
      jurisdiction,
      property_class: propertyClass,
      search: qSearch || undefined,
      owner: qOwner || undefined,
      zip: qZip || undefined,
      min_sqft: qSqft ? Number(qSqft) || 0 : 0,
      min_year: minYear || undefined,
      has_contact: hasContact ? "true" : undefined,
      released: releasedOnly ? "true" : undefined,
      sort_by: sort,
      limit: LIMIT,
      offset,
    },
    mapParcelBrowse,
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void engineGet(`parcels/browse/${encodeURIComponent(selectedId)}`, {}, mapBrowseParcelDetail)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : "Could not load building detail.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const rows = page.data?.parcels ?? [];

  const allSelected = rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(rows.map((r) => r.id)));
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
  const city = jurisdiction.split(",")[0] || "Dallas";
  const sections = parseSections(detail?.improvementSections);

  const clearAllFilters = () => {
    setPropertyClass("all");
    setSearch("");
    setOwner("");
    setSelectedZips([]);
    setZipInput("");
    setMinSqft("0");
    setMinYear(0);
    setHasContact(false);
    setReleasedOnly(false);
    setSort("sqft_desc");
    setOffset(0);
  };

  const activeFiltersCount = [
    propertyClass !== "all",
    Boolean(search),
    Boolean(owner),
    selectedZips.length > 0,
    Boolean(minSqft && minSqft !== "0"),
    minYear > 0,
    hasContact,
    releasedOnly,
    sort !== "sqft_desc",
  ].filter(Boolean).length;

  const pageIndex = Math.floor(offset / LIMIT);
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + LIMIT);
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  if (fullDetailId) {
    return (
      <div className="flex h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] flex-col bg-background dark:bg-[#0b0c0e] text-foreground dark:text-neutral-100 antialiased font-sans overflow-hidden">
        <ParcelDossierView
          parcelId={fullDetailId}
          onBack={() => setFullDetailId(null)}
          backLabel="Back to buildings table"
          rawBuilding={true}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] flex-col bg-background dark:bg-[#0b0c0e] text-foreground dark:text-neutral-100 antialiased font-sans overflow-hidden">
      {/* Top Header Row - Fixed */}
      <div className="shrink-0 border-b border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f12] px-5 py-3.5 z-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Building Browse</h1>
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/50">
                {jurisdiction}
              </span>
            </div>
            <p className="text-xs font-medium text-muted-foreground dark:text-neutral-400">
              County appraisal inventory for {city}{selectedZips.length > 0 ? ` · ZIP ${selectedZips.join(", ")}` : ""} ({num(total)} commercial properties). Includes all qualified Opportunity Pipeline buildings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {num(total)} buildings in inventory{page.data?.territoryLocked ? " (Locked)" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Action & Filter Sub-Bar - Fixed */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#111216] px-5 py-2.5 text-xs z-20">
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
              placeholder="Search address, owner, or parcel"
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
              <option value="sqft_desc">Largest roof area</option>
              <option value="sqft_asc">Smallest roof area</option>
              <option value="year_asc">Oldest year built</option>
              <option value="year_desc">Newest year built</option>
              <option value="address_asc">Address A–Z</option>
              <option value="val_desc">Highest valuation</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Filter Sidebar - Hot Sheet Layout & Style */}
        {!hideFilters && (
          <aside className="w-64 shrink-0 border-r border-border dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-[#0d0e12] p-3 text-xs flex flex-col justify-between overflow-y-auto h-full z-10 [scrollbar-width:thin]">
            <div className="space-y-4">
              {/* Segmented Count Tabs: All, Commercial, Industrial */}
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-200/50 dark:bg-[#13141a] p-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setPropertyClass("all");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    propertyClass === "all"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white border-neutral-300 dark:border-white/20 font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">All</span>
                  <span className="text-xs font-semibold">{num(total)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPropertyClass("commercial");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    propertyClass === "commercial"
                      ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6] font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Commercial</span>
                  <span className="text-xs font-semibold">Comm</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPropertyClass("industrial");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    propertyClass === "industrial"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-[#FFCA88] font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Industrial</span>
                  <span className="text-xs font-semibold">Ind</span>
                </button>
              </div>

              {/* Accordion Filter Cards with Hot Sheet Headings */}
              <div className="space-y-2.5">
                {/* 1. Jurisdiction */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
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
                        {SERVED_AREAS.map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            onClick={() => {
                              setJurisdiction(a.label);
                              setOffset(0);
                            }}
                            className={cn(
                              "flex-1 rounded border px-2 py-1.5 text-center text-xs font-medium transition-colors cursor-pointer",
                              jurisdiction === a.label
                                ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold shadow-sm"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {a.city}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <select
                          value={jurisdiction}
                          onChange={(e) => {
                            setJurisdiction(e.target.value);
                            setOffset(0);
                          }}
                          className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-foreground dark:text-neutral-200 outline-none focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
                        >
                          {SERVED_AREAS.map((a) => (
                            <option key={a.label} value={a.label}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Zip Code */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("zipcode")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Zip Code</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedZips.length > 0 && (
                        <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono px-1.5 py-0.2 text-[10px] font-semibold border border-amber-500/30">
                          {selectedZips.length === 1 ? selectedZips[0] : `${selectedZips.length} ZIPs`}
                        </span>
                      )}
                      {openSections.zipcode ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.zipcode && (
                    <div className="mt-2.5 space-y-2">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={zipInput}
                          onChange={(e) => setZipInput(e.target.value.replace(/[^\d,\s]/g, ""))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              handleAddZip();
                            }
                          }}
                          placeholder="Type 5-digit ZIP & press Enter"
                          className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] pl-2.5 pr-14 py-1.5 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-amber-500/70 dark:focus:border-amber-400/50 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddZip()}
                          disabled={!zipInput.trim()}
                          className="absolute right-1 px-2 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-[10px] font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {/* Active ZIP Pills */}
                      {selectedZips.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex flex-wrap gap-1.5">
                            {selectedZips.map((z) => (
                              <span
                                key={z}
                                className="inline-flex items-center gap-1 rounded bg-[#F5EADB] dark:bg-[#201C17] border border-[#ECD5BC] dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 px-2 py-0.5 text-[11px] font-mono font-medium shadow-xs"
                              >
                                <span>{z}</span>
                                <button
                                  type="button"
                                  onClick={() => removeZip(z)}
                                  className="text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 transition-colors cursor-pointer ml-0.5"
                                  title={`Remove ${z}`}
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[10px] text-muted-foreground dark:text-neutral-500">
                              Filtering {selectedZips.length} ZIP code{selectedZips.length > 1 ? "s" : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedZips([]);
                                setOffset(0);
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground dark:hover:text-white underline cursor-pointer"
                            >
                              Clear ZIPs
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Square feet */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("sqft")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Square feet</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {minSqft && minSqft !== "0" && (
                        <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">1 x</span>
                      )}
                      {openSections.sqft ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.sqft && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {["0", "5000", "10000", "25000", "50000", "100000", "200000"].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setMinSqft(size);
                              setOffset(0);
                            }}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] transition-colors border cursor-pointer",
                              minSqft === size || (size === "0" && (!minSqft || minSqft === "0"))
                                ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {size === "0" ? "Any" : `${Number(size) >= 1000 ? `${Number(size) / 1000}k+` : `${size}+`}`}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={minSqft === "0" ? "" : minSqft}
                          onChange={(e) => {
                            setMinSqft(e.target.value.replace(/\D/g, ""));
                            setOffset(0);
                          }}
                          placeholder="Min sq ft (Any)"
                          className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none pr-12 font-mono"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-[10px]">sq ft</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Property Class */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("propertyClass")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Property Class</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {propertyClass !== "all" && (
                        <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">1 x</span>
                      )}
                      {openSections.propertyClass ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.propertyClass && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex gap-1">
                        {(["all", "commercial", "industrial"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setPropertyClass(c);
                              setOffset(0);
                            }}
                            className={cn(
                              "flex-1 rounded py-1 text-center text-[10px] font-medium capitalize transition-colors border cursor-pointer",
                              propertyClass === c
                                ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Year Built */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("year")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Year Built</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {minYear > 0 && (
                        <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">1 x</span>
                      )}
                      {openSections.year ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.year && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {[0, 1980, 1990, 2000, 2010, 2020].map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => {
                              setMinYear(yr);
                              setOffset(0);
                            }}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] transition-colors border cursor-pointer",
                              minYear === yr
                                ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {yr === 0 ? "Any" : `${yr}+`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Owner */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("owner")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Owner</span>
                    </div>
                    {openSections.owner ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.owner && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={owner}
                        onChange={(e) => {
                          setOwner(e.target.value);
                          setOffset(0);
                        }}
                        placeholder="Owner or entity name"
                        className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Verification & Pipeline */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("verification")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-3.5 text-emerald-600 dark:text-[#B4E4D6]" />
                      <span>Lead Status</span>
                    </div>
                    {openSections.verification ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.verification && (
                    <div className="mt-2.5 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHasContact(!hasContact);
                          setOffset(0);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded px-2 py-1.5 text-[11px] border transition-colors cursor-pointer",
                          hasContact
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-[#B4E4D6] font-semibold"
                            : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3" />
                          <span>Direct Phone / Email</span>
                        </span>
                        {hasContact && <CheckCircle2 className="size-3 text-emerald-600 dark:text-[#B4E4D6]" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReleasedOnly(!releasedOnly);
                          setOffset(0);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between rounded px-2 py-1.5 text-[11px] border transition-colors cursor-pointer",
                          releasedOnly
                            ? "border-sky-500/50 bg-sky-500/15 text-sky-800 dark:text-sky-300 font-semibold"
                            : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3" />
                          <span>In Pipeline Book</span>
                        </span>
                        {releasedOnly && <CheckCircle2 className="size-3 text-sky-600 dark:text-sky-300" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-border dark:border-neutral-800/80 flex items-center justify-between text-xs text-muted-foreground dark:text-neutral-400">
              <button
                type="button"
                onClick={clearAllFilters}
                className="hover:text-foreground dark:hover:text-white underline decoration-neutral-300 dark:decoration-neutral-600 transition-colors cursor-pointer"
              >
                Reset filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
              </button>
            </div>
          </aside>
        )}

        {/* Right Table Container */}
        <main className="min-w-0 flex-1 flex flex-col justify-between overflow-x-auto bg-background dark:bg-[#0a0b0d]">

          {/* Table Scroll Area */}
          <div className="min-w-0 flex-1 overflow-auto relative">
            {page.loading && !page.data ? (
              <div className="p-16 text-center text-xs text-muted-foreground dark:text-neutral-400 space-y-2">
                <div className="flex items-center justify-center gap-2 text-foreground dark:text-neutral-200">
                  <span className="size-2 rounded-full bg-[#B4E4D6] animate-ping" />
                  <span className="font-medium text-xs">Loading {jurisdiction} building inventory...</span>
                </div>
              </div>
            ) : page.data?.territoryLocked ? (
              <div className="p-8 max-w-xl mx-auto my-12 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] text-center space-y-4">
                <div className="mx-auto size-12 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Lock className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {page.data.targetZone?.name || "Territory Subscription Required"}
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                    {num(page.data.total)} Commercial Buildings in ZIP {selectedZips.join(", ")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                  ZIP {selectedZips.join(", ")} is part of <strong className="text-foreground">{page.data.targetZone?.name || "another zone"}</strong>.
                  Your organization is currently subscribed to{" "}
                  <strong className="text-foreground">
                    {page.data.subscribedZones?.map((z) => z.name).join(", ") || "a different zone"}
                  </strong>
                  . Add this territory to view complete appraisal property records, roof permit history, and owner contacts.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <Link
                    href={page.data.targetZone ? `/territory/${encodeURIComponent(page.data.targetZone.id)}` : "/territory"}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Lock className="size-3.5" />
                    <span>{page.data.targetZone ? `Unlock ${page.data.targetZone.name}` : "Manage Subscriptions"}</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </Link>
                  {selectedZips.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedZips([]);
                        setOffset(0);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium text-foreground dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <span>Clear ZIP filter</span>
                    </button>
                  )}
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-16 text-center text-xs text-muted-foreground dark:text-neutral-400 space-y-2">
                <p>No buildings in {jurisdiction} match these filters.</p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-foreground dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-border dark:border-neutral-800/80 bg-neutral-100 dark:bg-[#0e0f14] text-[11px] font-semibold tracking-wider text-neutral-600 dark:text-neutral-400">
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] w-10 px-3 py-3 text-center border-b border-border dark:border-neutral-800/80">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={rows.length === 0}
                        aria-label="Select all buildings"
                        className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky left-0 top-0 z-30 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap border-b border-border dark:border-neutral-800/80 shadow-[1px_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_1px_0_0_rgba(255,255,255,0.06)]">
                      Address
                    </th>
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap border-b border-border dark:border-neutral-800/80">
                      Owner
                    </th>
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap border-b border-border dark:border-neutral-800/80">
                      Type
                    </th>
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap border-b border-border dark:border-neutral-800/80">
                      <button
                        type="button"
                        onClick={() => setSort(sort === "sqft_desc" ? "sqft_asc" : "sqft_desc")}
                        className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors cursor-pointer"
                        title="Click to sort by square feet"
                      >
                        <span>Sq ft</span>
                        {sort.startsWith("sqft") && (
                          <span className="text-[10px] text-amber-500">{sort === "sqft_desc" ? "▼" : "▲"}</span>
                        )}
                      </button>
                    </th>
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap border-b border-border dark:border-neutral-800/80">
                      <button
                        type="button"
                        onClick={() => setSort(sort === "year_desc" ? "year_asc" : "year_desc")}
                        className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors cursor-pointer"
                        title="Click to sort by year built"
                      >
                        <span>Year</span>
                        {sort.startsWith("year") && (
                          <span className="text-[10px] text-amber-500">{sort === "year_desc" ? "▼" : "▲"}</span>
                        )}
                      </button>
                    </th>
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap border-b border-border dark:border-neutral-800/80">
                      Stories
                    </th>
                    <th className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#0e0f14] px-4 py-3 pr-4 text-right whitespace-nowrap border-b border-border dark:border-neutral-800/80">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60 dark:divide-neutral-800/50">
                  {rows.map((row) => {
                    const isRowSelected = selectedRowIds.has(row.id);
                    const isDrawerOpen = selectedId === row.id;
                    const isHighlighted = isRowSelected || isDrawerOpen;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        className={cn(
                          "group transition-colors duration-150 cursor-pointer",
                          isHighlighted
                            ? "bg-[#F5EADB]/70 hover:bg-[#ECD5BC]/70 dark:bg-[#201C17] dark:hover:bg-[#2A241E]"
                            : "bg-transparent hover:bg-[#FAF5EE] dark:hover:bg-[#1C1A17]"
                        )}
                      >
                        {/* Checkbox with active row indicator */}
                        <td className="w-10 px-3 py-3 text-center transition-all group-hover:shadow-[inset_3px_0_0_0_#D99B26] dark:group-hover:shadow-[inset_3px_0_0_0_#E9B63B]">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectRow(row.id);
                            }}
                            aria-label={`Select ${row.address || row.id}`}
                            className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Address Sticky Left with Left Active Indicator */}
                        <td
                          className={cn(
                            "sticky left-0 z-10 px-4 py-3 font-medium whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)] transition-all duration-150",
                            isHighlighted
                              ? "bg-[#F5EADB]/80 group-hover:bg-[#ECD5BC]/80 dark:bg-[#201C17] dark:group-hover:bg-[#2A241E]"
                              : "bg-background dark:bg-[#0a0b0d] group-hover:bg-[#FAF5EE] dark:group-hover:bg-[#1C1A17]"
                          )}
                        >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-amber-800 dark:group-hover:text-amber-300 transition-colors">
                            {row.address || "—"}
                          </span>
                          {row.hasContact && (
                            <span
                              title="Verified direct contact info available (phone & email)"
                              className="inline-flex size-4 items-center justify-center rounded-full border border-[#B4E4D6]/40 bg-[#B4E4D6]/15 dark:bg-[#B4E4D6]/10 text-[#1b7e65] dark:text-[#B4E4D6] shrink-0"
                            >
                              <Phone className="size-2.5" />
                            </span>
                          )}

                        </div>
                        <p className="text-[11px] text-muted-foreground">{row.city || city}</p>
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-3 max-w-56 truncate whitespace-nowrap">
                        <span className="text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors">
                          {row.owner || "—"}
                        </span>
                      </td>

                      {/* Property Type */}
                      <td className="px-4 py-3 max-w-48 truncate text-xs text-muted-foreground whitespace-nowrap">
                        {row.propertyType || "—"}
                      </td>

                      {/* Sq ft */}
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                        {row.sqft ? num(row.sqft) : "—"}
                      </td>

                      {/* Year */}
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                        {row.yearBuilt || "—"}
                      </td>

                      {/* Stories */}
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                        {row.stories || "—"}
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3 text-right whitespace-nowrap pr-4">
                        <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            className="inline-flex h-7 items-center rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white group-hover:border-neutral-400 dark:group-hover:border-neutral-600 transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                          <Link
                            href={`/parcels/${encodeURIComponent(row.id)}`}
                            className="inline-flex h-7 items-center rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white group-hover:border-neutral-400 dark:group-hover:border-neutral-600 transition-colors"
                          >
                            Dossier →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Fixed Pagination Bar */}
          {!page.data?.territoryLocked && (
            <div className="shrink-0 flex items-center justify-between border-t border-border dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#0e0f14] px-5 py-3 text-xs text-muted-foreground dark:text-neutral-400 z-10">
            <div>
              {page.loading ? (
                <div className="flex items-center gap-2 text-foreground dark:text-neutral-200">
                  <span className="size-2 rounded-full bg-[#B4E4D6] animate-ping" />
                  <span className="font-medium text-xs">Querying {city} CAD records...</span>
                </div>
              ) : (
                <span>
                  Showing <strong className="text-foreground dark:text-white font-medium">{from}–{to}</strong> of <strong className="text-foreground dark:text-white font-medium">{num(total)}</strong> buildings{selectedRowIds.size > 0 && <span className="ml-2 text-amber-700 dark:text-amber-400 font-semibold">· {selectedRowIds.size} selected</span>}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground dark:text-neutral-500 mr-2">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={offset === 0 || page.loading}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                className="rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 cursor-pointer select-none"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + LIMIT >= total || page.loading}
                onClick={() => setOffset(offset + LIMIT)}
                className="rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 py-1 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 cursor-pointer select-none"
              >
                Next
              </button>
            </div>
          </div>
          )}
        </main>
      </div>

      {/* Building Directory Inspection Card (Right Sheet Drawer - Full Hot Sheet Dossier Parity) */}
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:w-[90vw] md:w-[80vw] lg:w-[65vw] xl:w-[60vw] 2xl:w-[55vw] min-w-[50vw] sm:max-w-none p-0 flex flex-col h-full overflow-hidden border-l border-border dark:border-neutral-800 shadow-2xl bg-background"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Building Intelligence Dossier</SheetTitle>
            <SheetDescription>Comprehensive building appraisal, municipal permits, and decision-maker dossier.</SheetDescription>
          </SheetHeader>
          {selectedId && (
            <ParcelDossierView
              parcelId={selectedId}
              onBack={() => setSelectedId(null)}
              onExpand={() => {
                setFullDetailId(selectedId);
                setSelectedId(null);
              }}
              backLabel="Close"
              isDrawer={true}
              rawBuilding={true}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
