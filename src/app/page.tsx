"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ScorePill, TierBadge } from "@/components/badges";
import { DepoiiLoader } from "@/components/depoii-logo";
import { useDepoiiState } from "@/components/depoii-provider";
import { useEngine } from "@/components/use-engine";
import { CityVerificationModal } from "@/components/city-verification-modal";
import { mapBrief, type MondayBrief } from "@/lib/engine-api";
import { num } from "@/lib/format";
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
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No released leads in {city}.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {b.opportunities.map((o) => {
                  const href = o.parcelId ? `/parcels/${encodeURIComponent(o.parcelId)}${o.stormId ? `?storm=${encodeURIComponent(o.stormId)}` : ""}` : "/pipeline";
                  const added = o.parcelId ? saved.has(o.parcelId) : false;
                  return (
                    <li key={o.parcelId || o.address} className="flex flex-wrap items-center gap-3 px-3 py-3">
                      <ScorePill score={o.score} />
                      <span className="min-w-0 flex-1">
                        <Link href={href} className="block truncate font-medium hover:underline">{o.address}, {o.city}</Link>
                        <span className="block truncate text-xs text-muted-foreground">{o.owner || "Owner not on record"} · {num(o.roofSqft)} sq ft roof · nearest SPC report {o.hail} in · {o.permitStatus || "permit search not logged"}</span>
                      </span>
                      <span className="hidden sm:block"><TierBadge tier={tierOf(o.tier)} hail={o.hail} /></span>
                      <span className="flex gap-2">
                        <Link href={href} className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs hover:bg-muted">Open dossier</Link>
                        <button type="button" disabled={!o.parcelId || added} onClick={() => add(o)} className="inline-flex h-8 items-center rounded-md bg-red-600 px-2.5 text-xs font-medium text-white disabled:opacity-50">
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
