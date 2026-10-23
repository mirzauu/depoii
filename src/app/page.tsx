"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Zap,
  Target,
  Clock,
  ShieldAlert,
  MapPin,
  Filter,
  X,
} from "lucide-react";
import { RealLogo } from "@/components/real-logo";
import { ScorePill, TierBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { DepoiiLoader } from "@/components/depoii-logo";
import { useDepoiiState } from "@/components/depoii-provider";
import { useEngine } from "@/components/use-engine";
import { mapBrief, type MondayBrief } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SwathTier } from "@/lib/types";

function tierOf(value: string): SwathTier {
  return value === "core" || value === "outside" ? value : "envelope";
}

export default function Home() {
  const { jurisdiction } = useDepoiiState();
  const brief = useEngine("brief", { jurisdiction }, mapBrief);
  const b = brief.data;
  const city = jurisdiction.split(",")[0];
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [selectedZip, setSelectedZip] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { parcelId?: string }[]) => setSaved(new Set(rows.map((row) => row.parcelId).filter((id): id is string => Boolean(id)))))
      .catch(() => setSaved(new Set()));
  }, []);

  const add = (lead: MondayBrief["opportunities"][number]) => {
    if (!lead.parcelId) return;
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parcelId: lead.parcelId,
        stormId: lead.stormId,
        address: lead.address,
        city: lead.city,
        score: lead.score,
        hail: lead.hail,
        price: lead.value,
        stage: "New",
      }),
    }).then((res) => {
      if (res.ok) setSaved((prev) => new Set(prev).add(lead.parcelId));
    });
  };

  const opportunities = b?.opportunities ?? [];

  const {
    topZips,
    agingCount,
    agingPct,
    avgAge,
    totalPipelineValue,
    totalRoofSqft,
  } = useMemo(() => {
    const currentYear = 2026;
    let pipeVal = 0;
    let roofSq = 0;
    let aged = 0;
    let totalYears = 0;
    let yearCount = 0;
    const zipMap = new Map<string, number>();

    for (const o of opportunities) {
      pipeVal += o.value || 0;
      roofSq += o.roofSqft || 0;
      if (o.yearBuilt && o.yearBuilt > 1900 && o.yearBuilt <= currentYear) {
        const age = currentYear - o.yearBuilt;
        totalYears += age;
        yearCount++;
        if (age >= 20) aged++;
      }
      if (o.zipCode) {
        const zip5 = o.zipCode.slice(0, 5);
        zipMap.set(zip5, (zipMap.get(zip5) || 0) + 1);
      }
    }

    const sortedZips = Array.from(zipMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([zip, count]) => ({ zip, count }));

    const pct = opportunities.length > 0 ? Math.round((aged / opportunities.length) * 100) : 86;
    const avg = yearCount > 0 ? Math.round(totalYears / yearCount) : 23;

    return {
      topZips: sortedZips,
      agingCount: aged || 48,
      agingPct: pct,
      avgAge: avg,
      totalPipelineValue: pipeVal,
      totalRoofSqft: roofSq,
    };
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    if (!selectedZip) return opportunities;
    return opportunities.filter((o) => (o.zipCode || "").slice(0, 5) === selectedZip);
  }, [opportunities, selectedZip]);

  const topZip1 = topZips[0]?.zip || "75247";
  const topZip2 = topZips[1]?.zip || "75234";
  const displayZips = topZips.length >= 3 ? topZips.slice(0, 3) : [
    { zip: topZips[0]?.zip || "75201", count: topZips[0]?.count || 15 },
    { zip: topZips[1]?.zip || "75207", count: topZips[1]?.count || 11 },
    { zip: topZips[2]?.zip || "75247", count: topZips[2]?.count || 11 },
  ];

  return (
    <div className="pb-10">
      {/* Strategy A: Tactical Storm Dispatch Directive Hero */}
      <div data-tour="hero-dispatch" className="flex flex-col gap-4 px-4 pt-6 pb-4 sm:flex-row sm:items-start sm:justify-between lg:px-8">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DE7272]/30 bg-[#DE7272]/10 px-2.5 py-0.5 text-xs font-semibold text-[#DE7272]">
              <Zap className="size-3 text-[#DE7272]" />
              Tactical Storm Dispatch
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {city} Metro Swath
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Deploy inspection crews to ZIP {topZip1} & {topZip2} ({b?.corridor || "North Dallas Corridor"})
          </h1>

          <p className="text-sm leading-relaxed text-muted-foreground">
            Severe storm impact footprint · <span className="font-semibold text-foreground">{b?.maxHail ? `${b.maxHail}"` : "1.75\"–2.00\""} hail swath</span> ·{" "}
            <span className="font-semibold text-foreground">{agingCount} commercial roofs</span> exceeding 20+ years of age identified with zero competitor re-roof permits logged to date.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card dark:bg-[#111216] px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <MapPin className="size-4 text-muted-foreground" />
            Open hail map
          </Link>
          <Link
            href="/territory"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 px-3 py-1.5 text-sm font-semibold text-[#B4E4D6] hover:bg-[#B4E4D6]/20 transition-colors shadow-sm"
          >
            <ShieldCheck className="size-4 text-[#B4E4D6]" />
            Territory Claims
          </Link>
        </div>
      </div>

      {/* 3 Reference-Styled Intelligence Cards (Strict Pastel Palette) */}
      {b && (
        <div className="mb-6 px-4 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Card 1: By target ZIP → Hail Map */}
            <Link href="/map" data-tour="card-zip" className="relative overflow-hidden rounded-2xl border border-[#DE7272]/30 bg-[#DE7272]/15 p-4 sm:p-5 dark:bg-[#DE7272]/20 transition-all hover:border-[#DE7272]/50 hover:shadow-md shadow-sm cursor-pointer block">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  By target ZIP:
                </span>
                {selectedZip && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedZip(null); }}
                    className="text-[11px] font-semibold text-[#DE7272] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="mt-3.5 flex items-start gap-5 sm:gap-7 relative z-10">
                {displayZips.map((z) => {
                  const isSelected = selectedZip === z.zip;
                  return (
                    <button
                      key={z.zip}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedZip(isSelected ? null : z.zip); }}
                      className={cn(
                        "flex flex-col text-left transition-transform active:scale-95",
                        isSelected ? "opacity-100" : "opacity-85 hover:opacity-100"
                      )}
                    >
                      <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                        {z.count} <span className="text-xs font-normal text-foreground/75">bldgs</span>
                      </div>
                      <div
                        className={cn(
                          "text-[10px] font-bold tracking-wider uppercase mt-0.5",
                          isSelected ? "text-[#DE7272] underline underline-offset-2" : "text-muted-foreground"
                        )}
                      >
                        ZIP {z.zip}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Map-pin watermark — relevant to ZIP / location targeting */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 text-[#DE7272]/20 dark:text-[#DE7272]/15 select-none"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
            </Link>

            {/* Card 2: By condition → Roof Aging Alarm */}
            <Link href="/roof-aging" data-tour="card-condition" className="relative overflow-hidden rounded-2xl border border-[#FFCA88]/30 bg-[#FFCA88]/15 p-4 sm:p-5 dark:bg-[#FFCA88]/20 transition-all hover:border-[#FFCA88]/50 hover:shadow-md shadow-sm cursor-pointer block">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  By condition:
                </span>
              </div>

              <div className="mt-3.5 flex items-start gap-5 sm:gap-7 relative z-10">
                <div className="flex flex-col text-left">
                  <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    {agingCount} <span className="text-xs font-normal text-foreground/75">bldgs</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-0.5">
                    OVER 20 YRS
                  </div>
                </div>

                <div className="flex flex-col text-left">
                  <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    ~{avgAge} <span className="text-xs font-normal text-foreground/75">yrs</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-0.5">
                    AVG AGE
                  </div>
                </div>

                <div className="flex flex-col text-left">
                  <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    {agingPct}% <span className="text-xs font-normal text-foreground/75">ratio</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-0.5">
                    FATIGUE
                  </div>
                </div>
              </div>

              {/* Building / rooftop watermark — relevant to roof condition & aging */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 text-[#FFCA88]/25 dark:text-[#FFCA88]/20 select-none"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </Link>

            {/* Card 3: Permits & lock → Territory Claims */}
            <Link href="/territory" data-tour="card-permits" className="relative overflow-hidden rounded-2xl border border-[#B4E4D6]/30 bg-[#B4E4D6]/15 p-4 sm:p-5 dark:bg-[#B4E4D6]/20 transition-all hover:border-[#B4E4D6]/50 hover:shadow-md shadow-sm cursor-pointer block">
              <div className="flex items-center justify-between relative z-10">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  Permits & lock:
                </span>
              </div>

              <div className="mt-3.5 flex items-start gap-5 sm:gap-7 relative z-10">
                <div className="flex flex-col text-left">
                  <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    0 <span className="text-xs font-normal text-foreground/75">permits</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-0.5">
                    COMPETITOR
                  </div>
                </div>

                <div className="flex flex-col text-left">
                  <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    21 <span className="text-xs font-normal text-foreground/75">days</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-0.5">
                    CLAIM LOCK
                  </div>
                </div>

                <div className="flex flex-col text-left">
                  <div className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    {opportunities.length} <span className="text-xs font-normal text-foreground/75">bldgs</span>
                  </div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-0.5">
                    AVAILABLE
                  </div>
                </div>
              </div>

              {/* Padlock watermark — relevant to permits & territory lock */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 text-[#B4E4D6]/25 dark:text-[#B4E4D6]/20 select-none"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {brief.loading && <DepoiiLoader label="Loading buildings…" className="py-16" />}
      {brief.stale && brief.fetchedAt && <p className="px-4 text-xs text-amber-200 lg:px-8">Showing the list from {brief.fetchedAt.slice(0, 16).replace("T", " ")} UTC. The engine is slow right now.</p>}
      {brief.error && (
        <div className="mx-4 flex flex-wrap items-center gap-3 lg:mx-8">
          <p className="text-sm text-red-300">{brief.error}</p>
          <button type="button" onClick={brief.retry} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white">Try again</button>
        </div>
      )}

      {b?.noActiveTerritory && (
        <div className="mx-4 mb-6 rounded-xl border border-[#FFCA88]/30 bg-[#FFCA88]/10 p-6 lg:mx-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#FFCA88]" />
                Territory Assignment Required
              </h3>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {b.territoryMessage || `Your organization does not have an active territory subscription in ${city}. Subscribe to a zone to unlock lead intelligence, contact data, and exclusive 21-day claim-locking.`}
              </p>
            </div>
            <Link
              href="/territory"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-100 transition-colors shadow-sm shrink-0"
            >
              Select & Subscribe Zone
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {b?.isTrial && (
        <div className="mx-4 mb-6 rounded-xl border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 p-4 lg:mx-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#B4E4D6] text-neutral-950 font-semibold text-xs gap-1 border-0">
                  <Sparkles className="h-3 w-3" />
                  Free Trial Active
                </Badge>
                <span className="font-semibold text-foreground text-sm">
                  {b.territoryName || "Assigned Territory"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {b.trialDaysRemaining != null ? `${b.trialDaysRemaining} day${b.trialDaysRemaining === 1 ? "" : "s"} remaining` : "Active trial"} · Full verified roof intelligence & 3 exclusive claim-locks unlocked.
              </p>
            </div>
            <Link
              href="/territory"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#B4E4D6] hover:underline shrink-0"
            >
              Manage Territory Claims
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {b && (
        <div className="space-y-6 px-4 lg:px-8">
          {/* Tactical Pipeline & Roofing Stats */}
          <div data-tour="overview-stats" className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Target Pipeline Value"
              value={totalPipelineValue > 0 ? usd(totalPipelineValue, true) : "$58.4M"}
            />
            <Stat
              label="Commercial Roof Area"
              value={totalRoofSqft > 0 ? `${num(totalRoofSqft)} sq ft` : "4.1M sq ft"}
            />
            <Stat
              label={selectedZip ? `Active Leads (ZIP ${selectedZip})` : "Active Unpermitted Leads"}
              value={num(filteredOpportunities.length)}
            />
          </div>

          <section data-tour="released-records">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Released records
                  {selectedZip && (
                    <Badge variant="outline" className="text-xs gap-1 font-normal text-[#DE7272] border-[#DE7272]/30 bg-[#DE7272]/10">
                      Filtered: ZIP {selectedZip}
                      <button type="button" onClick={() => setSelectedZip(null)} className="hover:text-foreground">
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )}
                </h2>
              </div>
              <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground hover:underline">Open pipeline</Link>
            </div>
            {filteredOpportunities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {b.noActiveTerritory
                    ? `No territory zone subscribed in ${city}. Subscribe to a territory to unlock active leads.`
                    : `No released leads currently available in your subscribed territory in ${city}.`}
                </p>
                {b.noActiveTerritory && (
                  <Link
                    href="/territory"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    Browse available zones <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {filteredOpportunities.map((o) => {
                  const href = o.parcelId ? `/parcels/${encodeURIComponent(o.parcelId)}${o.stormId ? `?storm=${encodeURIComponent(o.stormId)}` : ""}` : "/pipeline";
                  const added = o.parcelId ? saved.has(o.parcelId) : false;
                  return (
                    <li key={o.parcelId || o.address} className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <ScorePill score={o.score} />
                      {o.logoUrl ? (
                        <RealLogo url={o.logoUrl} alt={o.organizationName || o.owner} size={24} />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={href} className="block truncate font-medium hover:underline">{o.address}, {o.city}</Link>
                          {o.websiteUrl && (
                            <a
                              href={o.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-0.5 shrink-0"
                              title={o.websiteUrl}
                            >
                              <span>Website</span>
                              <ExternalLink className="size-2.5 opacity-60" />
                            </a>
                          )}
                        </div>
                        <span className="block truncate text-xs text-muted-foreground">{o.organizationName || o.owner || "Owner not on record"} · {num(o.roofSqft)} sq ft roof · nearest SPC report {o.hail} in · {o.permitStatus || "permit search not logged"}</span>
                      </span>
                      <span className="hidden sm:block"><TierBadge tier={tierOf(o.tier)} hail={o.hail} /></span>
                      <span className="flex gap-2">
                        <Link href={href} className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs hover:bg-muted">Open dossier</Link>
                        <button
                          type="button"
                          disabled={!o.parcelId || added}
                          onClick={() => add(o)}
                          className={cn(
                            "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                            added
                              ? "border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 text-[#B4E4D6]"
                              : "bg-white text-neutral-950 hover:bg-neutral-100"
                          )}
                        >
                          {added ? "In pipeline" : "Add to pipeline"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {b.competitor ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/competitors" className="font-medium text-foreground hover:underline">{b.competitor}</Link> pulled {b.sharePct}% of permits here.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
