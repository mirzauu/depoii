"use client";

import { useState } from "react";
import { Check, ExternalLink, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mapEvidenceCard } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { useEngine } from "@/components/use-engine";

const LABELS: Record<string, string> = {
  VERIFIED: "Verified",
  UNVERIFIED: "Not verified yet",
  LOW_STORM_PROXIMITY: "Too far from storm",
  DISQUALIFIED_INSTITUTIONAL: "Institutional owner",
  DISQUALIFIED_MFR: "Residential/condo",
  ROOF_PERMIT_DETECTED: "Roof permit filed",
  NON_ROOF_PERMIT_DETECTED: "Active site (Non-roof permit)",
  NO_POST_STORM_ROOF_PERMIT_FOUND: "Clear window",
  PERMIT_DETECTED: "Roof permit filed",
};

export function verificationLabel(status: string) {
  return LABELS[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function VerificationBadge({ status, score }: { status: string; score?: number }) {
  const ok = status === "VERIFIED" || status === "NO_POST_STORM_ROOF_PERMIT_FOUND";
  const active = status === "NON_ROOF_PERMIT_DETECTED";
  const none = !status || status === "UNVERIFIED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-mono font-medium tabular-nums",
        ok
          ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : active
          ? "border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : none
          ? "border border-border bg-neutral-100 dark:bg-[#232320] text-muted-foreground"
          : "border border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      {ok || active ? <Check className="size-3" /> : none ? <Minus className="size-3" /> : <X className="size-3" />}
      <span>{verificationLabel(status)}</span>
      {ok && score ? <span>· {score}/100</span> : active && score ? <span>· {score}/100</span> : ""}
    </span>
  );
}

function Check_({ pass, title, children, href }: { pass: boolean | null; title: string; children: React.ReactNode; href?: string }) {
  return (
    <li className="flex gap-2.5 py-2.5 text-xs">
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full", pass == null ? "bg-neutral-100 dark:bg-[#232320] text-muted-foreground" : pass ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
        {pass == null ? <Minus className="size-2.5" /> : pass ? <Check className="size-2.5" /> : <X className="size-2.5" />}
      </span>
      <div className="min-w-0 text-xs">
        <p className="font-semibold text-foreground">
          {title}
          {href && (
            <a href={href} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[11px] font-normal text-muted-foreground hover:text-foreground">
              Source <ExternalLink className="size-2.5" />
            </a>
          )}
        </p>
        <div className="text-muted-foreground text-[11px] mt-0.5">{children}</div>
      </div>
    </li>
  );
}

export function VerificationCard({
  leadId,
  className,
  hideHeader = false,
}: {
  leadId: string;
  hideImage?: boolean;
  hideHeader?: boolean;
  className?: string;
}) {
  const card = useEngine(`intelligence/leads/${encodeURIComponent(leadId)}/evidence`, {}, mapEvidenceCard);
  const v = card.data;

  if (card.loading && !v) return <div className="p-3 text-xs text-muted-foreground">Checking verification…</div>;

  const view = v ?? {
    status: "UNVERIFIED",
    score: 0,
    verifiedAt: "",
    reason: "",
    cad: null,
    hail: null,
    permits: null,
    aerialDate: "",
    hasAerial: false,
  };
  const unchecked = view.status === "UNVERIFIED" && !view.cad && !view.hail && !view.permits;

  return (
    <div className={className}>
      {!hideHeader && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h4 className="text-xs font-semibold text-foreground">5-Stage Verification Audit</h4>
          <VerificationBadge status={view.status} score={view.score} />
        </div>
      )}
      {unchecked && v ? (
        <p className="text-xs text-muted-foreground">This building hasn&apos;t been run through the live checks yet.</p>
      ) : unchecked ? null : (
        <>
          {view.reason && <p className="text-xs text-amber-400 mb-2">{view.reason}</p>}
          <ul className="divide-y divide-border">
            <Check_ pass={view.cad ? view.cad.found : null} title="Appraisal record" href={view.cad?.url}>
              {view.cad?.found
                ? [`Account ${view.cad.account}`, view.cad.owner, view.cad.sqft ? `${num(view.cad.sqft)} sq ft` : "", view.cad.yearBuilt ? `built ${view.cad.yearBuilt}` : "", view.cad.value ? usd(view.cad.value, true) : ""].filter(Boolean).join(" · ")
                : "No matching county record"}
            </Check_>
            <Check_ pass={view.hail ? view.hail.inZone : null} title="Hail strike" href={view.hail?.url}>
              {view.hail ? (
                <div className="mt-0.5 space-y-0.5">
                  <div className="text-foreground">
                    <span className="font-semibold text-foreground">{view.hail.inches.toFixed(2)}″ hail</span>
                    {view.hail.sizeLabel ? (
                      <span className="ml-1 text-xs text-muted-foreground">({view.hail.sizeLabel})</span>
                    ) : null}
                    {" · "}
                    <span className="font-medium">{view.hail.miles.toFixed(2)} mi</span> from strike point
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {view.hail.formattedDate && (
                      <span>Strike date: {view.hail.formattedDate}</span>
                    )}
                    {view.hail.stormName && (
                      <>
                        <span>·</span>
                        <span>Storm: {view.hail.stormName}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                "Not checked"
              )}
            </Check_>
            <Check_ pass={view.permits ? (view.permits.status === "NO_POST_STORM_ROOF_PERMIT_FOUND" || view.permits.status === "NON_ROOF_PERMIT_DETECTED") : null} title="City permits since storm" href={view.permits?.url}>
              {view.permits
                ? view.permits.status === "NON_ROOF_PERMIT_DETECTED"
                  ? `Active commercial capex (${view.permits.postStorm} filed) · no roof permit`
                  : view.permits.status === "ROOF_PERMIT_DETECTED"
                  ? `Roof permit filed (${view.permits.postStorm})`
                  : `No post-storm roof permit found`
                : "Not checked"}
            </Check_>
            <Check_ pass={view.aerialDate ? true : null} title="Aerial imagery">
              {view.aerialDate ? `Satellite pass: ${view.aerialDate}` : "Satellite pass confirmed"}
            </Check_>
          </ul>
        </>
      )}
    </div>
  );
}
