"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { RealLogo } from "@/components/real-logo";
import { PageHeader } from "@/components/app-shell";
import { ScorePill, TierBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { DepoiiLoader } from "@/components/depoii-logo";
import { useDepoiiState } from "@/components/depoii-provider";
import { useEngine } from "@/components/use-engine";
import { CityVerificationModal } from "@/components/city-verification-modal";
import { mapBrief, type MondayBrief } from "@/lib/engine-api";
import { num } from "@/lib/format";
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

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow={city}
        title={b?.totalOpportunities ? `${num(b.totalOpportunities)} released ${city} lead${b.totalOpportunities === 1 ? "" : "s"}` : "Released leads"}
        description={
          b ? (
            <>
              {num(b.totalOpportunities)} {city} {b.totalOpportunities === 1 ? "building has" : "buildings have"} a county roof size, a Texas SPC point report, and a logged permit search. A point report is not a measurement on the roof. The permit line is the search result.
            </>
          ) : (
            `Loading released leads for ${city}.`
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <CityVerificationModal />
            {b && <Link href="/map" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Open hail map</Link>}
          </div>
        }
      />

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
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Released leads" value={num(b.totalOpportunities)} />
            <Stat label="Replacement price" value="Not priced" />
            <Stat label="SPC point reports" value={num(b.totalOpportunities)} />
          </div>

          <section>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Released records</h2>
              </div>
              <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground hover:underline">Open pipeline</Link>
            </div>
            {b.opportunities.length === 0 ? (
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
                {b.opportunities.map((o) => {
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
                              className="text-[10px] text-sky-500 hover:underline inline-flex items-center gap-0.5 shrink-0"
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
