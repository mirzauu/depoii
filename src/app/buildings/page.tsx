"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Filter, Pager, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { engineGet, mapBrowseParcelDetail, mapParcelBrowse, type BrowseParcel } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const LIMIT = 50;

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
  const { jurisdiction } = useDepoiiState();
  const [propertyClass, setPropertyClass] = useState<"all" | "commercial" | "industrial">("all");
  const [search, setSearch] = useState("");
  const [minSqft, setMinSqft] = useState("5000");
  const [sort, setSort] = useState("sqft_desc");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BrowseParcel | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const q = useDebounced(search);
  const sqft = useDebounced(minSqft);

  const page = useEngine(
    "parcels/browse",
    {
      jurisdiction,
      property_class: propertyClass,
      search: q || undefined,
      min_sqft: sqft ? Number(sqft) || 0 : 0,
      sort_by: sort,
      limit: LIMIT,
      offset,
    },
    mapParcelBrowse,
  );

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
  };

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
  const total = page.data?.total ?? 0;
  const city = jurisdiction.split(",")[0] || "Dallas";
  const sections = parseSections(detail?.improvementSections);

  const clearAllFilters = () => {
    setPropertyClass("all");
    setSearch("");
    setMinSqft("5000");
    setSort("sqft_desc");
    setOffset(0);
  };

  const activeCount = [
    propertyClass !== "all",
    Boolean(search),
    minSqft !== "5000" && minSqft !== "",
    sort !== "sqft_desc",
  ].filter(Boolean).length;

  return (
    <>
      <EngineLayout
        title="Building Browse"
        subtitle={`${city} county appraisal inventory — commercial and industrial improvements. Not Opportunity Pipeline leads.`}
        onResetFilters={clearAllFilters}
        activeFiltersCount={activeCount}
        filters={
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                Property Class
              </label>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#13141a] p-1 text-center">
                <button
                  type="button"
                  onClick={() => reset(setPropertyClass)("all")}
                  className={cn(
                    "rounded py-1.5 text-[11px] font-medium transition-colors",
                    propertyClass === "all"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => reset(setPropertyClass)("commercial")}
                  className={cn(
                    "rounded py-1.5 text-[11px] font-medium transition-colors",
                    propertyClass === "commercial"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  Commercial
                </button>
                <button
                  type="button"
                  onClick={() => reset(setPropertyClass)("industrial")}
                  className={cn(
                    "rounded py-1.5 text-[11px] font-medium transition-colors",
                    propertyClass === "industrial"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  Industrial
                </button>
              </div>
            </div>

            <Filter label="Search Address / Owner">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  value={search}
                  onChange={(e) => reset(setSearch)(e.target.value)}
                  placeholder="Address or owner…"
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

            <Filter label="Min Building Sq Ft">
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    value={minSqft}
                    onChange={(e) => reset(setMinSqft)(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    placeholder="e.g. 5000"
                    className={cn(filterField, "font-mono pr-12")}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-[11px]">sq ft</span>
                </div>
                <div className="flex gap-1">
                  {["0", "10000", "25000", "50000"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => reset(setMinSqft)(val)}
                      className={cn(
                        "flex-1 rounded border py-0.5 text-[10px] font-mono transition-colors",
                        minSqft === val
                          ? "border-neutral-400 dark:border-white/20 bg-neutral-200 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold"
                          : "border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#111217] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                      )}
                    >
                      {val === "0" ? "Any" : `${Number(val) / 1000}k+`}
                    </button>
                  ))}
                </div>
              </div>
            </Filter>

            <Filter label="Sort">
              <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} className={filterField}>
                <option value="sqft_desc">Largest roof area</option>
                <option value="year_asc">Oldest year built</option>
                <option value="address_asc">Address A–Z</option>
              </select>
            </Filter>
          </>
        }
      >
        <p className="border-b border-[#FFCA88]/40 bg-[#FFCA88]/15 px-4 py-2 text-xs text-amber-900 dark:text-[#FFCA88]">
          County appraisal inventory for {city}. These are CAD building records, not verified roof leads. Use Opportunity Pipeline for the released call list.
        </p>
        <EngineState loading={page.loading && !page.data} error={page.error} empty={!rows.length} onRetry={page.retry}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead className="hidden md:table-cell">Owner</TableHead>
                <TableHead className="hidden lg:table-cell">Type</TableHead>
                <TableHead className="text-right">Sq ft</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Year</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Stories</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedId(row.id)}
                >
                  <TableCell>
                    <p className="font-medium">{row.address || "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.city}{row.released ? " · In pipeline book" : ""}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate md:table-cell">{row.owner || "—"}</TableCell>
                  <TableCell className="hidden max-w-48 truncate text-xs text-muted-foreground lg:table-cell">{row.propertyType || "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.sqft ? num(row.sqft) : "—"}</TableCell>
                  <TableCell className="hidden text-right font-mono sm:table-cell">{row.yearBuilt || "—"}</TableCell>
                  <TableCell className="hidden text-right font-mono xl:table-cell">{row.stories || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager offset={offset} limit={LIMIT} total={total} onChange={setOffset} />
        </EngineState>
      </EngineLayout>

      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{detail?.address || (detailLoading ? "Loading…" : "Building directory")}</SheetTitle>
            <SheetDescription>
              City building directory card from county CAD and linked permits. Not a damage claim or verified roof lead.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            {detailLoading && <p className="py-6 text-sm text-muted-foreground">Loading directory card…</p>}
            {detailError && <p className="py-6 text-sm text-red-300">{detailError}</p>}
            {detail && !detailLoading && (
              <>
                <Section title="Parcel">
                  <dl>
                    <DetailRow label="Address" value={[detail.address, detail.city, detail.state, detail.zip].filter(Boolean).join(", ")} />
                    <DetailRow label="County" value={detail.county} />
                    <DetailRow label="Type" value={detail.propertyType} />
                    <DetailRow label="Building sq ft" value={detail.sqft ? num(detail.sqft) : null} />
                    <DetailRow label="Land sq ft" value={detail.landSqft ? num(detail.landSqft) : null} />
                    <DetailRow label="Year built" value={detail.yearBuilt || null} />
                    <DetailRow label="Stories" value={detail.stories || null} />
                    <DetailRow label="CAD value" value={detail.valuation ? usd(detail.valuation) : null} />
                    <DetailRow label="Improvements" value={detail.improvementValuation ? usd(detail.improvementValuation) : null} />
                    <DetailRow label="Account" value={detail.accountNumber || detail.id} />
                    <DetailRow label="Parcel ID" value={detail.id} />
                    <DetailRow label="CAD source" value={detail.source} />
                    <DetailRow
                      label="Last reroof"
                      value={detail.lastReroofDate ? `${detail.lastReroofDate}${detail.lastReroofPermitNo ? ` · #${detail.lastReroofPermitNo}` : ""}` : null}
                    />
                    <DetailRow
                      label="Coords"
                      value={detail.lat != null && detail.lng != null ? `${detail.lat.toFixed(5)}, ${detail.lng.toFixed(5)}` : null}
                    />
                  </dl>
                </Section>

                {sections.length > 0 && (
                  <Section title="Improvement sections">
                    <ul className="space-y-2 text-sm">
                      {sections.map((section, i) => (
                        <li key={i} className="rounded-md border border-border/60 px-3 py-2">
                          <p className="font-medium">{section.description || "Section"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[section.area_sqft ? `${num(section.area_sqft)} sq ft` : null, section.year_built ? `built ${section.year_built}` : null, section.stories != null ? `${section.stories} stories` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="Contacts">
                  {detail.contacts?.length ? (
                    <ul className="space-y-2 text-sm">
                      {detail.contacts.map((c, i) => (
                        <li key={`${c.role}-${c.name}-${i}`} className="rounded-md border border-border/60 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.role}</p>
                          <p className="font-medium">{c.name}</p>
                          {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                          {(c.phone || c.license) && (
                            <p className="text-xs text-muted-foreground">
                              {[c.phone, c.license ? `License ${c.license}` : null].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {c.note && <p className="mt-1 text-[11px] text-muted-foreground">{c.note}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No owner or contractor contact on file for this parcel.</p>
                  )}
                </Section>

                <Section title={`Permits${detail.permitCount ? ` (${detail.permitCount})` : ""}`}>
                  {detail.permits?.length ? (
                    <ul className="space-y-3 text-sm">
                      {detail.permits.map((p) => (
                        <li key={p.id || p.permitNumber} className="rounded-md border border-border/60 px-3 py-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-medium">{p.permitNumber || "Permit"}</p>
                            <p className="text-xs text-muted-foreground">{[p.issueDate, p.status].filter(Boolean).join(" · ")}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[p.category, p.isPureReroof ? "reroof" : null, p.valuationFormatted || (p.valuation ? usd(p.valuation) : null), p.roofSystem]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {p.contractorName && (
                            <p className="mt-1 text-xs">
                              Contractor: {p.contractorName}
                              {p.contractorPhone ? ` · ${p.contractorPhone}` : ""}
                            </p>
                          )}
                          {p.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-4">{p.description}</p>}
                          {p.match === "address" && (
                            <p className="mt-1 text-[11px] text-amber-200/90">Matched by address (no parcel ID on the permit row).</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No permits linked to this parcel ID in the warehouse. That does not prove no permit was filed — many Dallas filings have no parcel join yet.
                    </p>
                  )}
                </Section>

                <Section title="Source links">
                  {detail.sources?.length ? (
                    <ul className="space-y-2 text-sm">
                      {detail.sources.map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                            {s.label}
                          </a>
                          {s.system && <span className="text-xs text-muted-foreground"> · {s.system}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No external source links available.</p>
                  )}
                </Section>

                {detail.released && (
                  <p className="mt-5 text-sm">
                    <Link href={`/parcels/${encodeURIComponent(detail.id)}`} className="underline hover:text-foreground">
                      Open lead dossier
                    </Link>
                    <span className="text-muted-foreground"> — this parcel is also on the released pipeline book.</span>
                  </p>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
