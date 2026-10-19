"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Minus, RefreshCw, X } from "lucide-react";
import { cn } from "cn";
import { mapEvidenceCard } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { useEngine } from "./use-engine";

const LABELS: Record<string, string> = {
  VERIFIED: "Verified",
  UNVERIFIED: "Not verified yet",
  LOW_STORM_PROXIMITY: "Too far from the storm",
  DISQUALIFIED_INSTITUTIONAL: "Church or government owner",
  DISQUALIFIED_MFR: "Apartments or condos",
  ROOF_PERMIT_DETECTED: "Roof permit already filed",
  NON_ROOF_PERMIT_DETECTED: "Active site (Non-roof permit)",
  NO_POST_STORM_ROOF_PERMIT_FOUND: "No post-storm roof filing found in the city feed we checked",
  PERMIT_DETECTED: "Roof permit already filed",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : active
          ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
          : none
          ? "border-border text-muted-foreground"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      {ok || active ? <Check className="size-3" /> : none ? <Minus className="size-3" /> : <X className="size-3" />}
      {verificationLabel(status)}
      {ok && score ? ` · ${score}/100` : active && score ? ` · ${score}/100` : ""}
    </span>
  );
}

function Check_({ pass, title, children, href }: { pass: boolean | null; title: string; children: React.ReactNode; href?: string }) {
  return (
    <li className="flex gap-3 py-2">
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", pass == null ? "bg-muted text-muted-foreground" : pass ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
        {pass == null ? <Minus className="size-3" /> : pass ? <Check className="size-3" /> : <X className="size-3" />}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {title}
          {href && (
            <a href={href} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground hover:text-foreground">
              Source <ExternalLink className="size-3" />
            </a>
          )}
        </p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function AerialImage({ leadId, stamp }: { leadId: string; stamp: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={stamp}
      src={`/api/aerial/${encodeURIComponent(leadId)}?v=${stamp}`}
      alt="Satellite view of the roof"
      onError={() => setFailed(true)}
      className="mt-3 aspect-[4/3] w-full max-w-md rounded-md border border-border object-cover"
    />
  );
}

export function VerificationCard({ leadId }: { leadId: string }) {
  const card = useEngine(`verifications/evidence-card/${encodeURIComponent(leadId)}`, {}, mapEvidenceCard);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);
  const v = card.data;

  async function recheck() {
    setBusy(true);
    setFault(null);
    try {
      const res = await fetch(`/api/engine/verifications/verify/${encodeURIComponent(leadId)}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error((body && typeof body.error === "string" && body.error) || "The live check did not finish.");
      setStamp(Date.now());
      card.retry();
    } catch (error) {
      setFault(error instanceof Error ? error.message : "The live check did not finish.");
    } finally {
      setBusy(false);
    }
  }

  if (card.loading && !v) return <div className="border-b border-border p-4 text-sm text-muted-foreground">Checking verification…</div>;

  // No scored row yet — still show the panel so the user can run a live verify (real ESRI aerial).
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
    <section className="border-b border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Verification</h2>
        <VerificationBadge status={view.status} score={view.score} />
        {view.verifiedAt && <span className="text-xs text-muted-foreground">Checked {view.verifiedAt}</span>}
        <button type="button" onClick={recheck} disabled={busy} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {busy ? "Checking…" : unchecked ? "Verify" : "Verify again"}
        </button>
      </div>
      {fault && <p className="mt-2 text-sm text-red-400">{fault}</p>}
      {card.error && !v && !fault && (
        <p className="mt-2 text-sm text-muted-foreground">No live check on file yet. Run Verify to pull appraisal, hail, permits, and a satellite roof image for this parcel.</p>
      )}
      {unchecked && v ? (
        <p className="mt-2 text-sm text-muted-foreground">This building hasn&apos;t been run through the live checks yet.</p>
      ) : unchecked ? null : (
        <>
          {view.reason && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{view.reason}</p>}
          <ul className="mt-2 divide-y divide-border">
            <Check_ pass={view.cad ? view.cad.found : null} title="Appraisal record" href={view.cad?.url}>
              {view.cad?.found
                ? [`Account ${view.cad.account}`, view.cad.owner, view.cad.sqft ? `${num(view.cad.sqft)} sq ft` : "", view.cad.yearBuilt ? `built ${view.cad.yearBuilt}` : "", view.cad.value ? usd(view.cad.value, true) : ""].filter(Boolean).join(" · ")
                : "No matching county record"}
            </Check_>
            <Check_ pass={view.hail ? view.hail.inZone : null} title="Hail strike">
              {view.hail ? `${view.hail.miles.toFixed(2)} mi from ${view.hail.inches.toFixed(2)}″ hail${view.hail.location ? ` (${view.hail.location})` : ""}` : "Not checked"}
            </Check_>
            <Check_ pass={view.permits ? (view.permits.status === "NO_POST_STORM_ROOF_PERMIT_FOUND" || view.permits.status === "NON_ROOF_PERMIT_DETECTED") : null} title="City permits since the storm" href={view.permits?.url}>
              {view.permits
                ? view.permits.status === "NON_ROOF_PERMIT_DETECTED"
                  ? `Active commercial capex (${view.permits.postStorm} filed) · no roof permit`
                  : view.permits.status === "ROOF_PERMIT_DETECTED"
                  ? `Roof permit filed (${view.permits.postStorm})`
                  : `No post-storm roof permit found`
                : "Not checked"}
            </Check_>
            <Check_ pass={view.aerialDate ? true : null} title="Aerial imagery">
              {view.aerialDate || "No image on file"}
            </Check_>
          </ul>
          {view.hasAerial && <AerialImage leadId={leadId} stamp={stamp} />}
        </>
      )}
    </section>
  );
}
