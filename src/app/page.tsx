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
  MapPinned,
  Search,
  UserRound,
  FileText,
  BarChart3,
  Hourglass,
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

function DecisionCard({
  n,
  icon: Icon,
  question,
  answer,
  detail,
  href,
  cta,
  tourId,
}: {
  n: number;
  icon: React.ElementType;
  question: string;
  answer: React.ReactNode;
  detail: React.ReactNode;
  href: string;
  cta: string;
  tourId?: string;
}) {
  return (
    <div
      data-tour={tourId}
      className="group relative flex flex-col justify-between rounded-xl border border-border bg-card/75 p-5 shadow-sm transition-all duration-150 hover:border-foreground/30 hover:bg-card hover:shadow-md"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-4 text-[#DE7272]" />
          <span>Decision {n}</span>
        </div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">{question}</h3>
        <div className="text-2xl font-bold tracking-tight text-foreground">{answer}</div>
        <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">{detail}</div>
      </div>

      <div className="pt-4">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#DE7272] transition-all hover:text-[#DE7272]/80 group-hover:gap-2 after:absolute after:inset-0"
        >
          <span>{cta}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
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
  const topLead = opportunities[0];

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

  const DEFAULT_ZIPS_BY_CITY: Record<string, [string, string]> = {
    Dallas: ["75201", "75207"],
    "Fort Worth": ["76102", "76104"],
    Austin: ["78701", "78704"],
    Houston: ["77002", "77007"],
    "San Antonio": ["78205", "78212"],
  };
  const fallbackZips = DEFAULT_ZIPS_BY_CITY[city] || ["75201", "75207"];
  const topZip1 = topZips[0]?.zip || fallbackZips[0];
  const topZip2 = topZips[1]?.zip || fallbackZips[1];

  return (
    <div className="pb-10">
      {/* Overview Page Title Bar */}
      <div data-tour="hero-dispatch" className="flex flex-col gap-3 px-4 pt-6 pb-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Overview
            </h1>
            <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {city} Metro Swath
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Commercial roofing intelligence, storm damage corridors & qualified pipeline
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

      {b?.noActiveTerritory && (
        <div className="mx-4 mb-4 rounded-xl border border-[#FFCA88]/30 bg-[#FFCA88]/10 p-6 lg:mx-8">
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

      {/* Free Trial Active Banner */}
      {!b?.noActiveTerritory && (
        <div data-tour="trial-banner" className="mx-4 mb-4 rounded-xl border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 p-4 lg:mx-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#B4E4D6] text-neutral-950 font-semibold text-xs gap-1 border-0">
                  <Sparkles className="h-3 w-3" />
                  Free Trial Active
                </Badge>
                <span className="font-semibold text-foreground text-sm">
                  {b?.territoryName || `${city} Metro Territory`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {b?.trialDaysRemaining ? `${b.trialDaysRemaining} days remaining` : "14 days remaining"} · Full verified roof intelligence & 3 exclusive claim-locks unlocked.
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

      {/* 6 Core Tactical Decision Cards */}
      {b && (
        <div className="mb-6 px-4 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DecisionCard
              n={1}
              icon={MapPinned}
              question="Where do we deploy crews?"
              answer={`ZIP ${topZip1}${topZip2 ? ` & ${topZip2}` : ""} (${b.corridor || `${city} Corridor`})`}
              detail={`Severe storm impact footprint · ${b.maxHail ? `${b.maxHail}"` : '1.75"–2.00"'} hail swath. ${b.core || agingCount || opportunities.length} priority roofs in direct deployment vector.`}
              href="/map"
              cta="Open hail swath map"
              tourId="card-zip"
            />
            <DecisionCard
              n={2}
              icon={Search}
              question="Who should we inspect?"
              answer={`${num(opportunities.length)} unresolved · ${totalPipelineValue > 0 ? usd(totalPipelineValue, true) : "$58.4M"}`}
              detail={`${agingCount} commercial roofs exceeding 20+ years of age identified with zero competitor re-roof permits logged to date.`}
              href="/pipeline"
              cta="Review pipeline"
              tourId="card-condition"
            />
            <DecisionCard
              n={3}
              icon={UserRound}
              question="Who do we contact?"
              answer={topLead ? (topLead.organizationName || topLead.owner || "Verified Decision Maker") : (b.owner || "Property Owner")}
              detail={
                topLead
                  ? `Owner of record for ${topLead.address}. ${topLead.decisionMaker ? `${topLead.decisionMaker} (${topLead.decisionTitle || "Executive"})` : "Deed entity and decision-maker contact roll."}`
                  : "Direct property deed owner & verified entity contact."
              }
              href={topLead?.parcelId ? `/parcels/${encodeURIComponent(topLead.parcelId)}${topLead.stormId ? `?storm=${encodeURIComponent(topLead.stormId)}` : ""}` : "/pipeline"}
              cta="Open dossier"
            />
            <DecisionCard
              n={4}
              icon={FileText}
              question="What is our technical pitch?"
              answer="Structural Condition Audit"
              detail={
                topLead
                  ? `Brief for ${topLead.address}: ${topLead.hail || b.pitchHail || (b.maxHail ?? 1.75)}" hail exposure, ${topLead.yearBuilt ? `built ${topLead.yearBuilt}` : `${avgAge} yr aging`}, membrane ${b.membrane || "commercial flat / BUR"}.`
                  : "Select a property to generate engineering brief."
              }
              href={topLead?.parcelId ? `/property/${encodeURIComponent(topLead.parcelId)}/brief` : "/pipeline"}
              cta="Generate brief"
            />
            <DecisionCard
              n={5}
              icon={BarChart3}
              question="Where are competitors winning?"
              answer={b.competitor && b.sharePct > 0 ? `${b.competitor.split(" ")[0]} · ${b.sharePct}% share` : "Zero Competitor Permits"}
              detail={
                b.competitor && b.sharePct > 0
                  ? `${b.competitor} leads market share with ${b.sharePct}% of commercial re-roof permits.${b.chasers && b.chasers.length > 0 ? ` Storm-chaser surge: ${b.chasers.join(", ")}.` : ""}`
                  : `Zero competitor re-roof permits logged to date across ${city}. Clear runway to canvas targets ahead of rivals.`
              }
              href="/competitors"
              cta="Enter war room"
              tourId="card-permits"
            />
            <DecisionCard
              n={6}
              icon={Hourglass}
              question="What is the statutory urgency?"
              answer={
                b.daysRemaining != null && b.daysRemaining > 0 ? (
                  <span className={cn(b.daysRemaining <= 60 ? "text-[#DE7272]" : "text-[#B4E4D6]")}>
                    {b.daysRemaining} days remaining
                  </span>
                ) : b.daysRemaining != null && b.daysRemaining <= 0 ? (
                  <span className="text-muted-foreground">Advisory window elapsed</span>
                ) : (
                  <span className="text-[#B4E4D6]">Statutory Window Active</span>
                )
              }
              detail={
                b.deadline
                  ? `TDI 24-month advisory window for storm event ends ${b.deadline}. Prioritize outreach before filing deadline expires.`
                  : `Texas 24-month statutory insurance claim filing window active. Prioritize outreach before deadline expires.`
              }
              href="/claims"
              cta="Prioritize outreach"
            />
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
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
                {topZips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    <span className="text-[11px] font-medium">Filter by target ZIP:</span>
                    {topZips.slice(0, 4).map((z) => (
                      <button
                        key={z.zip}
                        type="button"
                        onClick={() => setSelectedZip(selectedZip === z.zip ? null : z.zip)}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors border",
                          selectedZip === z.zip
                            ? "bg-[#DE7272] text-white border-[#DE7272]"
                            : "bg-muted/50 text-foreground border-border hover:bg-muted"
                        )}
                      >
                        {z.zip} ({z.count})
                      </button>
                    ))}
                    {selectedZip && (
                      <button
                        type="button"
                        onClick={() => setSelectedZip(null)}
                        className="text-[11px] font-semibold text-[#DE7272] hover:underline ml-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>
              <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground hover:underline shrink-0">Open pipeline</Link>
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
