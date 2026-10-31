"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { useEngine } from "@/components/use-engine";
import { mapLeadDossier } from "@/lib/engine-api";
import { num, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function NotionCallout({
  label,
  text,
  badge,
}: {
  label: string;
  text: string;
  badge?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div className="group relative rounded-r-md border-l-2 border-foreground/40 bg-muted/20 py-2.5 pl-4 pr-3 transition-colors hover:bg-muted/35">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">{label}</span>
          {badge && (
            <span className="text-[10px] text-muted-foreground/80 font-normal">
              · {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          onClick={() => {
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            });
          }}
          title="Copy script"
        >
          {copied ? (
            <span className="text-emerald-500 font-semibold inline-flex items-center gap-1">
              <Check className="size-3" /> Copied
            </span>
          ) : (
            <span className="opacity-60 group-hover:opacity-100 inline-flex items-center gap-1">
              <Copy className="size-2.5" /> Copy
            </span>
          )}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-foreground/90 italic">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

export function LeadDossier({
  parcelId,
  className,
  hideHeader = false,
}: {
  parcelId: string;
  className?: string;
  hideHeader?: boolean;
}) {
  const stormId = useSearchParams().get("storm") || "";
  const lead = useEngine(`intelligence/leads/${encodeURIComponent(parcelId)}/dossier`, stormId ? { storm_id: stormId } : {}, mapLeadDossier);
  if (lead.loading) return <p className="px-5 py-6 text-xs text-muted-foreground">Loading opportunity intelligence…</p>;
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
    <section className={cn("space-y-5", className)}>
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold tracking-tight text-foreground">Tactical Outreach Playbook</span>
            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-semibold text-foreground border border-border">
              <Sparkles className="size-3 text-amber-500" />
              <span>Score {d.score} / 100</span>
              <span className="text-muted-foreground font-normal">· {d.badge?.toUpperCase() || "CORE"}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Download className="size-3" />
            <span>Export Dossier (.md)</span>
          </button>
        </div>
      )}

      {/* 4-Pillar Typographic Scorecard (Zero Badge Bloat) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d.pillars.slice(0, 4).map((p) => (
          <div key={p.name} className="rounded-md border border-border bg-card/40 p-3.5 text-xs space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold text-foreground text-xs">{p.name}</span>
              <span className="font-mono text-xs font-medium text-foreground/90 tabular-nums">+{p.points} pts</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium pt-0.5">{p.metric}</p>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-0.5">{p.justification}</p>
          </div>
        ))}
      </div>

      {/* Strategic Playbook: Strengths/Risks & Pitch Scripts */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Pitch Scripts Column */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tactical Pitch Scripts</h3>
          <NotionCallout label="Cold Call Opener" text={d.opening} badge="Property records angle" />
          <NotionCallout label="Insurance Window Urgency" text={d.urgency} badge="Claim deadline angle" />
          {d.offer && (
            <div className="rounded-r-md border-l-2 border-foreground/40 bg-muted/20 py-2.5 pl-4 pr-3 text-xs">
              <span className="font-semibold text-foreground block mb-0.5">Recommended Inspection Hook</span>
              <span className="text-muted-foreground text-xs leading-relaxed">{d.offer}</span>
            </div>
          )}
          {d.roofSystem && (
            <div className="rounded-r-md border-l-2 border-foreground/40 bg-muted/20 py-2.5 pl-4 pr-3 text-xs">
              <span className="font-semibold text-foreground block mb-0.5">Recommended Roof System</span>
              <span className="text-muted-foreground text-xs leading-relaxed">{d.roofSystem}</span>
            </div>
          )}
        </div>

        {/* Strengths & Risks Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-md border border-border bg-card/40 p-3.5 space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deal Strengths</h3>
              <ul className="space-y-1.5 text-xs">
                {d.strong.map((reason) => (
                  <li key={reason} className="text-foreground/90 font-medium flex items-start gap-1.5 leading-relaxed">
                    <span className="font-bold text-emerald-500 shrink-0">+</span>
                    <span>{reason}</span>
                  </li>
                ))}
                {!d.strong.length && <li className="text-muted-foreground text-xs">None recorded.</li>}
              </ul>
            </div>

            <div className="pt-2 border-t border-border/60">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risks & Objections</h3>
              <ul className="space-y-1.5 text-xs">
                {d.weak.map((reason) => (
                  <li key={reason} className="text-foreground/90 font-medium flex items-start gap-1.5 leading-relaxed">
                    <span className="font-bold text-amber-500 shrink-0">−</span>
                    <span>{reason}</span>
                  </li>
                ))}
                {!d.weak.length && <li className="text-muted-foreground text-xs">None recorded.</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
