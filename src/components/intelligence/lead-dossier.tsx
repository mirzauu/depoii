"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { RiskBadge } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { mapLeadDossier } from "@/lib/engine-api";
import { num, shortDate } from "@/lib/format";

function Quote({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <button
          type="button"
          className="text-xs text-sky-400 hover:underline"
          onClick={() => {
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

export function LeadDossier({ parcelId }: { parcelId: string }) {
  const stormId = useSearchParams().get("storm") || "";
  const lead = useEngine(`intelligence/leads/${encodeURIComponent(parcelId)}/dossier`, stormId ? { storm_id: stormId } : {}, mapLeadDossier);
  if (lead.loading) return <p className="border-b border-border px-4 py-6 text-sm text-muted-foreground">Loading the record…</p>;
  if (lead.error || !lead.data) return null;
  const d = lead.data;
  const download = () => {
    const blob = new Blob([d.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${d.parcelId || "lead"}-dossier.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="border-b border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Source record</p>
          <h2 className="text-lg font-semibold">{d.badge || "Lead score"} · {d.score} / 100</h2>
          <p className="text-xs text-muted-foreground">
            {d.storm}{d.stormDate ? ` · ${shortDate(d.stormDate)}` : ""} · {d.hail ? `${d.hail}″ hail` : "hail not stated"} · {d.joules ? `${num(Math.round(d.joules))} J` : ""} · {d.deal || "value not estimated"}
          </p>
          <p className="mt-2 text-sm">
            <span className="text-xs text-muted-foreground">Owner of record. </span>{d.owner || "Not on the roll"}
            <span className="mt-0.5 block text-xs text-muted-foreground">{d.ownerMail || "No mailing address on the appraisal roll."}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">The appraisal roll has no phone or email.</span>
          </p>
        </div>
        <button type="button" onClick={download} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Download briefing</button>
      </div>

      <div className="grid gap-px border-y border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
        {d.pillars.map((p) => (
          <div key={p.name} className="bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">{p.name}</p>
              <RiskBadge value={p.status} />
            </div>
            <p className="mt-1 font-mono text-sm tabular-nums">+{p.points} pts</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.metric}</p>
            <p className="mt-1 text-xs leading-relaxed">{p.justification}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Why it is strong</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {d.strong.map((reason) => <li key={reason} className="text-[#B4E4D6] font-medium">+ {reason}</li>)}
            {!d.strong.length && <li className="text-muted-foreground">None recorded.</li>}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Risks and objections</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {d.weak.map((reason) => <li key={reason} className="text-[#FFCA88] font-medium">− {reason}</li>)}
            {!d.weak.length && <li className="text-muted-foreground">None recorded.</li>}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Outreach</h3>
          <Quote label="Phone opening" text={d.opening} />
          <Quote label="Insurance urgency" text={d.urgency} />
          {d.offer && <p className="text-sm"><span className="text-xs text-muted-foreground">Offer. </span>{d.offer}</p>}
          {d.roofSystem && <p className="text-sm"><span className="text-xs text-muted-foreground">Recommended system. </span>{d.roofSystem}</p>}
        </div>
      </div>
    </section>
  );
}
