"use client";

import { useEffect, useState } from "react";
import { Search, X, Check, HardHat } from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Filter, Kpis, Pager, ScopeFilter, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermitDetailDrawer } from "@/components/permit-detail-drawer";
import { ParcelDetailDrawer } from "@/components/parcel-detail-drawer";
import { mapJobsites, mapMultiphase, mapPermitSearch, mapStats, type EnginePermit } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const LIMIT = 50;

function daysSince(iso: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export default function PermitsPage() {
  const { jurisdiction } = useDepoiiState();
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

  const q = useDebounced(search);
  const c = useDebounced(contractor);
  const lo = useDebounced(minVal);
  const hi = useDebounced(maxVal);

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

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
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

  const activeCount = [
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
  ].filter(Boolean).length;

  return (
    <EngineLayout
      title="All permits"
      subtitle="Search and audit 30-year municipal building and reroof histories sourced directly from city inspection portals."
      onResetFilters={clearAllFilters}
      activeFiltersCount={activeCount}
      filters={
        <>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Permit View
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#13141a] p-1 text-center">
              <button
                type="button"
                onClick={() => { setView("all"); setOffset(0); }}
                className={cn(
                  "rounded py-1.5 text-[11px] font-medium transition-colors",
                  view === "all"
                    ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => { setView("jobsites"); setOffset(0); }}
                className={cn(
                  "rounded py-1.5 text-[11px] font-medium transition-colors",
                  view === "jobsites"
                    ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                )}
              >
                Jobsites
              </button>
              <button
                type="button"
                onClick={() => { setView("phases"); setOffset(0); }}
                className={cn(
                  "rounded py-1.5 text-[11px] font-medium transition-colors",
                  view === "phases"
                    ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                )}
              >
                Phases
              </button>
            </div>
          </div>

          <ScopeFilter jurisdiction={jurisdiction} all={all} onChange={reset(setAll)} />

          {view !== "phases" && (
            <>
              <Filter label="Search">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                  <input
                    value={search}
                    onChange={(e) => reset(setSearch)(e.target.value)}
                    placeholder="Permit, address, scope…"
                    className={cn(filterField, "pl-8 pr-7")}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => reset(setSearch)("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </Filter>

              <Filter label="Contractor">
                <div className="relative">
                  <HardHat className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                  <input
                    value={contractor}
                    onChange={(e) => reset(setContractor)(e.target.value)}
                    placeholder="Contractor name…"
                    className={cn(filterField, "pl-8 pr-7")}
                  />
                  {contractor && (
                    <button
                      type="button"
                      onClick={() => reset(setContractor)("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </Filter>

              {view === "all" && (
                <>
                  <Filter label="Category">
                    <select value={category} onChange={(e) => reset(setCategory)(e.target.value)} className={filterField}>
                      <option value="">Any Category</option>
                      {(stats.data?.byCategory ?? []).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                    </select>
                  </Filter>

                  <Filter label="Roof system">
                    <select value={roof} onChange={(e) => reset(setRoof)(e.target.value)} className={filterField}>
                      <option value="">Any Roof System</option>
                      {(stats.data?.byRoofSystem ?? []).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                    </select>
                  </Filter>

                  <Filter label="Status">
                    <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={filterField}>
                      <option value="">Any Status</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="expired">Expired</option>
                    </select>
                  </Filter>

                  <Filter label="Intelligence">
                    <select value={mode} onChange={(e) => reset(setMode)(e.target.value)} className={filterField}>
                      <option value="all">All permits</option>
                      <option value="pre_permit">Pre-Permit / Bidding Open</option>
                      <option value="storm_matched">Storm matched</option>
                      <option value="unresolved_hail">Unresolved hail</option>
                      <option value="commercial_only">Commercial only</option>
                    </select>
                  </Filter>

                  <div className="grid grid-cols-2 gap-2">
                    <Filter label="Min value">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">$</span>
                        <input
                          value={minVal}
                          inputMode="numeric"
                          onChange={(e) => reset(setMinVal)(e.target.value.replace(/[^\d.]/g, ""))}
                          placeholder="Min"
                          className={cn(filterField, "pl-5 font-mono")}
                        />
                      </div>
                    </Filter>
                    <Filter label="Max value">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">$</span>
                        <input
                          value={maxVal}
                          inputMode="numeric"
                          onChange={(e) => reset(setMaxVal)(e.target.value.replace(/[^\d.]/g, ""))}
                          placeholder="Max"
                          className={cn(filterField, "pl-5 font-mono")}
                        />
                      </div>
                    </Filter>
                  </div>

                  <label
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer transition-colors",
                      hail
                        ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/15 text-neutral-900 dark:text-white"
                        : "border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#14151c] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={hail}
                      onChange={(e) => reset(setHail)(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "size-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                        hail ? "border-[#B4E4D6] bg-[#B4E4D6] text-neutral-950" : "border-neutral-400 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
                      )}
                    >
                      {hail && <Check className="size-2.5 stroke-[3]" />}
                    </div>
                    <span className="text-[11px] font-medium">Post-Storm Window (180d)</span>
                  </label>

                  <Filter label="Sort">
                    <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} className={filterField}>
                      <option value="date_desc">Newest first</option>
                      <option value="date_asc">Oldest first</option>
                      <option value="valuation_desc">Highest value</option>
                      <option value="valuation_asc">Lowest value</option>
                    </select>
                  </Filter>
                </>
              )}
            </>
          )}
        </>
      }
    >
      {view === "jobsites" ? (
        <>
          <Kpis items={[
            { label: "Open jobs", value: jobs.data ? num(jobs.data.total) : "…" },
            { label: "Active pipeline", value: jobs.data ? usd(jobs.data.valuation, true) : "…" },
            { label: "Contractors on site", value: jobs.data ? num(jobs.data.contractors) : "…" },
            { label: "Top roof system", value: jobs.data?.roofSystems[0]?.name ?? "—" },
          ]} />
          <EngineState loading={jobs.loading} error={jobs.error} empty={!jobs.data?.jobsites.length} onRetry={jobs.retry}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Permit</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="hidden lg:table-cell">Contractor</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Days open</TableHead>
                  <TableHead className="pr-4 text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data?.jobsites.map((j) => (
                  <TableRow
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
                    className="cursor-pointer hover:bg-neutral-500/10 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <TableCell className="pl-4"><span className="font-medium">{j.permitNumber}</span><span className="block text-xs text-muted-foreground">{j.issued ? shortDate(j.issued) : "Issue date blank"}</span></TableCell>
                    <TableCell className="max-w-72"><span className="block truncate">{j.address || "Address not published"}</span><span className="block text-xs text-muted-foreground">{j.jurisdiction}</span></TableCell>
                    <TableCell className="hidden max-w-56 lg:table-cell" onClick={(e) => e.stopPropagation()}><ContractorLink name={j.contractor} /></TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{daysSince(j.issued) ?? "—"}</TableCell>
                    <TableCell className="pr-4 text-right font-mono tabular-nums">{j.valuation ? usd(j.valuation, true) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager offset={offset} limit={LIMIT} total={jobs.data?.total ?? 0} onChange={setOffset} />
          </EngineState>
        </>
      ) : view === "phases" ? (
        <>
          <Kpis items={[
            { label: "Campuses", value: phases.data ? num(phases.data.total) : "…" },
            { label: "Combined value", value: phases.data ? usd(phases.data.campuses.reduce((s, c) => s + c.valuation, 0), true) : "…" },
            { label: "Phases", value: phases.data ? num(phases.data.campuses.reduce((s, c) => s + c.phases, 0)) : "…" },
            { label: "Scope", value: all ? "All locations" : jurisdiction },
          ]} />
          <EngineState loading={phases.loading} error={phases.error} empty={!phases.data?.campuses.length} onRetry={phases.retry}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Campus</TableHead>
                  <TableHead className="text-right">Phases</TableHead>
                  <TableHead className="hidden md:table-cell">Contractors</TableHead>
                  <TableHead className="pr-4 text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phases.data?.campuses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4"><span className="font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.jurisdiction}</span></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{c.phases}</TableCell>
                    <TableCell className="hidden max-w-72 md:table-cell">{c.contractors.length ? <span className="flex flex-col gap-1">{c.contractors.map((name) => <ContractorLink key={name} name={name} />)}</span> : "—"}</TableCell>
                    <TableCell className="pr-4 text-right font-mono tabular-nums">{c.valuation ? usd(c.valuation, true) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </EngineState>
        </>
      ) : (
      <>
      <Kpis
        items={[
          { label: "Matching permits", value: page.data ? num(page.data.total) : "…" },
          { label: "Matching value", value: page.data ? usd(page.data.totalValuation, true) : "…" },
          { label: "Warehouse permits", value: stats.data ? num(stats.data.totalPermits) : "…" },
          { label: "Warehouse value", value: stats.data ? usd(stats.data.totalValuation, true) : "…" },
        ]}
      />
      <EngineState loading={page.loading} error={page.error} empty={!page.data?.permits.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Permit</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="hidden lg:table-cell">Contractor</TableHead>
              <TableHead className="hidden md:table-cell">Roof system</TableHead>
              <TableHead className="hidden xl:table-cell">Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data?.permits.map((p) => (
              <TableRow
                key={p.id}
                onClick={() => setSelectedPermit(p)}
                className="cursor-pointer hover:bg-neutral-500/10 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <TableCell className="pl-4">
                  <span className="font-medium group-hover:text-primary transition-colors">{p.permitNumber}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.isPrePermit && p.appliedDate
                      ? `Applied ${shortDate(p.appliedDate)}`
                      : p.issued
                      ? shortDate(p.issued)
                      : "Issue date blank"}
                    {p.hailWindow ? " · storm window" : ""}
                  </span>
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="block truncate">{p.address || "Address not published"}</span>
                  <span className="block text-xs text-muted-foreground">{p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")}</span>
                </TableCell>
                <TableCell className="hidden max-w-56 lg:table-cell" onClick={(e) => e.stopPropagation()}>
                  {p.isPrePermit && (!p.contractor || p.contractor.toLowerCase().includes("file") || p.contractor.toLowerCase().includes("licensed")) ? (
                    <span className="text-xs text-muted-foreground italic">
                      Contractor not selected
                    </span>
                  ) : (
                    <ContractorLink name={p.contractor} />
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">{p.roofSystem || "—"}</TableCell>
                <TableCell className="hidden xl:table-cell">{p.category}</TableCell>
                <TableCell>
                  {p.isPrePermit ? (
                    <span className="inline-flex items-center rounded border border-[#B4E4D6]/40 bg-[#B4E4D6]/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-[#B4E4D6]">
                      {p.bidWindowStatus || p.status || "In Review"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{p.status || "—"}</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">{p.valuation ? usd(p.valuation, true) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager offset={offset} limit={LIMIT} total={page.data?.total ?? 0} onChange={setOffset} />
      </EngineState>
      </>
      )}

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
    </EngineLayout>
  );
}
