"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, X, Phone, HardHat, Info } from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Filter, Pager, ScopeFilter, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapLeaderboard } from "@/lib/engine-api";
import { num, pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const LIMIT = 50;

/** Common commercial roof systems seen on Dallas roof filings. */
const ROOF_SYSTEMS = ["TPO", "Metal", "Modified Bitumen", "EPDM", "Built-up", "Shingle", "PVC"];

export default function ContractorsBrowsePage() {
  const { jurisdiction } = useDepoiiState();
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const [minPermits, setMinPermits] = useState("");
  const [minVal, setMinVal] = useState("");
  const [roof, setRoof] = useState("");
  const [hasContact, setHasContact] = useState(false);
  const [sort, setSort] = useState("volume_desc");
  const [offset, setOffset] = useState(0);

  const q = useDebounced(search);
  const minP = useDebounced(minPermits);
  const minV = useDebounced(minVal);

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

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
  };

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

  const activeCount = [
    Boolean(search),
    Boolean(minPermits),
    Boolean(minVal),
    Boolean(roof),
    hasContact,
    all,
    sort !== "volume_desc",
  ].filter(Boolean).length;

  const rows = page.data?.contractors ?? [];
  const total = page.data?.total ?? 0;
  const place = all ? "All locations" : jurisdiction;

  return (
    <EngineLayout
      title="Contractors"
      subtitle={`${place} · roofing contractor directory from named contractors on commercial roof permits. Broader than the win-share leaderboard.`}
      onResetFilters={clearAllFilters}
      activeFiltersCount={activeCount}
      filters={
        <>
          <ScopeFilter jurisdiction={jurisdiction} all={all} onChange={reset(setAll)} />

          <Filter label="Search Contractor">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
              <input
                value={search}
                onChange={(e) => reset(setSearch)(e.target.value)}
                placeholder="Company name…"
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

          <Filter label="Roof system">
            <select value={roof} onChange={(e) => reset(setRoof)(e.target.value)} className={filterField}>
              <option value="">Any Roof System</option>
              {ROOF_SYSTEMS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Filter>

          <Filter label="Min permits">
            <select value={minPermits} onChange={(e) => reset(setMinPermits)(e.target.value)} className={filterField}>
              <option value="">Any Volume</option>
              <option value="2">2+ permits</option>
              <option value="5">5+ permits</option>
              <option value="10">10+ permits</option>
              <option value="25">25+ permits</option>
            </select>
          </Filter>

          <Filter label="Min volume">
            <select value={minVal} onChange={(e) => reset(setMinVal)(e.target.value)} className={filterField}>
              <option value="">Any Valuation</option>
              <option value="100000">$100k+</option>
              <option value="500000">$500k+</option>
              <option value="1000000">$1M+</option>
              <option value="5000000">$5M+</option>
            </select>
          </Filter>

          <Filter label="Contact Details">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#111217] p-1">
              <button
                type="button"
                onClick={() => reset(setHasContact)(false)}
                className={cn(
                  "rounded py-1 text-center text-xs font-medium transition-colors",
                  !hasContact
                    ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => reset(setHasContact)(true)}
                className={cn(
                  "rounded py-1 text-center text-xs font-medium transition-colors flex items-center justify-center gap-1",
                  hasContact
                    ? "border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6] font-semibold shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                )}
              >
                <Phone className="size-3" />
                Phone/Web
              </button>
            </div>
          </Filter>

          <Filter label="Sort">
            <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} className={filterField}>
              <option value="volume_desc">Volume (High to Low)</option>
              <option value="permits_desc">Permits (High to Low)</option>
              <option value="name_asc">Name (A–Z)</option>
            </select>
          </Filter>
        </>
      }
    >
      {/* Calibration Banner */}
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-[#FFCA88]">
            <Info className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-amber-900 dark:text-[#FFCA88]">
                Contractor Data Updates Underway
              </p>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-[#FFCA88]">
                100% Verified by Nov 5
              </span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-[#FFCA88]/80 leading-relaxed">
              We are currently validating and cross-referencing all contractor permit volumes and contact records across North Texas. Complete, 100% verified intelligence will be ready by <strong>November 5th</strong>.
            </p>
          </div>
        </div>
      </div>

      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        Full regional roofing directory for {place} (named contractors on roof filings). Placeholders like “On Municipal Record” are excluded. For ranked market share, use{" "}
        <Link href="/competitors" className="underline hover:text-foreground">Leaderboard</Link>.
      </p>
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3">
        <div className="bg-background px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contractors</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{page.data ? num(total) : "…"}</p>
        </div>
        <div className="bg-background px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Permitted volume</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{page.data ? usd(page.data.valuation, true) : "…"}</p>
        </div>
        <div className="bg-background px-4 py-3 sm:col-span-1 col-span-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Showing</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{rows.length ? `${num(offset + 1)}–${num(offset + rows.length)}` : "—"}</p>
        </div>
      </div>
      <EngineState loading={page.loading && !page.data} error={page.error} empty={!rows.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Contractor</TableHead>
              <TableHead className="hidden md:table-cell">Roof system</TableHead>
              <TableHead className="text-right">Permits</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Share</TableHead>
              <TableHead className="pr-4 text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4">
                  <ContractorLink name={c.name} />
                  {(c.phone || c.hq) && (
                    <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                      {[c.phone, c.hq].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-40 truncate text-xs text-muted-foreground md:table-cell">
                  {c.roofSystem || "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{num(c.permits)}</TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                  {c.share > 0 ? pct(c.share, 1) : "—"}
                </TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">
                  {c.valuationLabel || (c.valuation ? usd(c.valuation, true) : "—")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
      </EngineState>
    </EngineLayout>
  );
}
