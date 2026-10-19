"use client";

import { useEffect, useState } from "react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Filter, Kpis, Pager, ScopeFilter, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapJobsites, mapMultiphase, mapPermitSearch, mapStats } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

const LIMIT = 50;

function daysSince(iso: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export default function PermitsPage() {
  const { jurisdiction } = useDepoiiState();
  const [view, setView] = useState<"all" | "jobsites" | "phases">("all");
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

  return (
    <EngineLayout
      title="All permits"
      subtitle={view === "jobsites" ? `${all ? "All locations" : jurisdiction} · open permits issued in the last 90 to 180 days` : view === "phases" ? "Campuses permitted in stages, with a later phase still open" : `${all ? "All locations" : jurisdiction} · commercial roofing permits from the data engine warehouse`}
      filters={
        <>
          <Filter label="View">
            <select value={view} onChange={(e) => { setView(e.target.value as "all" | "jobsites" | "phases"); setOffset(0); }} className={filterField}>
              <option value="all">All permits</option>
              <option value="jobsites">Active jobsites</option>
              <option value="phases">Multi-phase projects</option>
            </select>
          </Filter>
          <ScopeFilter jurisdiction={jurisdiction} all={all} onChange={reset(setAll)} />
          {view !== "phases" && <>
          <Filter label="Search">
            <input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Permit, address, scope" className={filterField} />
          </Filter>
          <Filter label="Contractor">
            <input value={contractor} onChange={(e) => reset(setContractor)(e.target.value)} placeholder="Name" className={filterField} />
          </Filter>
          {view === "all" && <>
          <Filter label="Category">
            <select value={category} onChange={(e) => reset(setCategory)(e.target.value)} className={filterField}>
              <option value="">Any</option>
              {(stats.data?.byCategory ?? []).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </Filter>
          <Filter label="Roof system">
            <select value={roof} onChange={(e) => reset(setRoof)(e.target.value)} className={filterField}>
              <option value="">Any</option>
              {(stats.data?.byRoofSystem ?? []).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </Filter>
          <Filter label="Status">
            <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={filterField}>
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
            </select>
          </Filter>
          <Filter label="Intelligence">
            <select value={mode} onChange={(e) => reset(setMode)(e.target.value)} className={filterField}>
              <option value="all">All permits</option>
              <option value="storm_matched">Storm matched</option>
              <option value="unresolved_hail">Unresolved hail</option>
              <option value="commercial_only">Commercial only</option>
            </select>
          </Filter>
          <div className="grid grid-cols-2 gap-2">
            <Filter label="Min value">
              <input value={minVal} inputMode="numeric" onChange={(e) => reset(setMinVal)(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" className={filterField} />
            </Filter>
            <Filter label="Max value">
              <input value={maxVal} inputMode="numeric" onChange={(e) => reset(setMaxVal)(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" className={filterField} />
            </Filter>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hail} onChange={(e) => reset(setHail)(e.target.checked)} className="accent-red-500" />
            Filed within 180 days of a storm
          </label>
          </>}
          {view === "all" && <Filter label="Sort">
            <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} className={filterField}>
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="valuation_desc">Highest value</option>
              <option value="valuation_asc">Lowest value</option>
            </select>
          </Filter>}
          </>}
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
                  <TableRow key={j.id}>
                    <TableCell className="pl-4"><span className="font-medium">{j.permitNumber}</span><span className="block text-xs text-muted-foreground">{j.issued ? shortDate(j.issued) : "Issue date blank"}</span></TableCell>
                    <TableCell className="max-w-72"><span className="block truncate">{j.address || "Address not published"}</span><span className="block text-xs text-muted-foreground">{j.jurisdiction}</span></TableCell>
                    <TableCell className="hidden max-w-56 lg:table-cell"><ContractorLink name={j.contractor} /></TableCell>
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
              <TableRow key={p.id}>
                <TableCell className="pl-4">
                  <span className="font-medium">{p.permitNumber}</span>
                  <span className="block text-xs text-muted-foreground">{p.issued ? shortDate(p.issued) : "Issue date blank"}{p.hailWindow ? " · storm window" : ""}</span>
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="block truncate">{p.address || "Address not published"}</span>
                  <span className="block text-xs text-muted-foreground">{p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")}</span>
                </TableCell>
                <TableCell className="hidden max-w-56 lg:table-cell"><ContractorLink name={p.contractor} /></TableCell>
                <TableCell className="hidden md:table-cell">{p.roofSystem || "—"}</TableCell>
                <TableCell className="hidden xl:table-cell">{p.category}</TableCell>
                <TableCell>{p.status || "—"}</TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">{p.valuation ? usd(p.valuation, true) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager offset={offset} limit={LIMIT} total={page.data?.total ?? 0} onChange={setOffset} />
      </EngineState>
      </>
      )}
    </EngineLayout>
  );
}
