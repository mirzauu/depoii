"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useEngine } from "@/components/use-engine";
import { mapLeadDossier } from "@/lib/engine-api";
import { cn } from "@/lib/utils";

function ScriptBlock({
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
    <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {badge && (
            <span className="text-[11px] text-muted-foreground font-normal">
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
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
              <Check className="size-3" /> Copied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Copy className="size-2.5" /> Copy
            </span>
          )}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-foreground/90 font-normal">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

export function LeadDossier({
  parcelId,
  className,
}: {
  parcelId: string;
  className?: string;
  hideHeader?: boolean;
}) {
  const stormId = useSearchParams().get("storm") || "";
  const lead = useEngine(`intelligence/leads/${encodeURIComponent(parcelId)}/dossier`, stormId ? { storm_id: stormId } : {}, mapLeadDossier);

  const [scorecardOpen, setScorecardOpen] = useState(true);
  const [scriptsOpen, setScriptsOpen] = useState(true);
  const [assessmentOpen, setAssessmentOpen] = useState(true);

  if (lead.loading) return <p className="px-5 py-6 text-xs text-muted-foreground">Loading opportunity intelligence…</p>;
  if (lead.error || !lead.data) return null;
  const d = lead.data;

  return (
    <div className={cn("space-y-4", className)}>
      {/* ================================================================= */}
      {/* BOX 1: OPPORTUNITY SCORECARD                                      */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
        <div
          onClick={() => setScorecardOpen(!scorecardOpen)}
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
        >
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Opportunity scorecard
            </h3>
            <span className="rounded px-2 py-0.5 text-xs font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 tabular-nums">
              {d.score} / 100
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setScorecardOpen(!scorecardOpen);
            }}
            aria-label={scorecardOpen ? "Collapse opportunity scorecard" : "Expand opportunity scorecard"}
            className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
          >
            {scorecardOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>

        {scorecardOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-border">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {d.pillars.slice(0, 4).map((p) => (
                <div key={p.name} className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-foreground">{p.name}</span>
                    <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {p.points > 0 ? `+${p.points} pts` : "Evaluated"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium pt-0.5">{p.metric}</p>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-0.5">{p.justification}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* BOX 2: TACTICAL PITCH SCRIPTS                                     */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
        <div
          onClick={() => setScriptsOpen(!scriptsOpen)}
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
        >
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Tactical pitch scripts
          </h3>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setScriptsOpen(!scriptsOpen);
            }}
            aria-label={scriptsOpen ? "Collapse pitch scripts" : "Expand pitch scripts"}
            className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
          >
            {scriptsOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>

        {scriptsOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-border space-y-3">
            <ScriptBlock label="Cold Call Opener" text={d.opening} badge="Property records angle" />
            <ScriptBlock label="Insurance Window Urgency" text={d.urgency} badge="Claim deadline angle" />
            {d.offer && (
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 space-y-1">
                <span className="text-xs font-semibold text-foreground block">Recommended Inspection Hook</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.offer}</p>
              </div>
            )}
            {d.roofSystem && (
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 space-y-1">
                <span className="text-xs font-semibold text-foreground block">Recommended Roof System</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.roofSystem}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* BOX 3: DEAL ASSESSMENT (STRENGTHS & RISKS)                         */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
        <div
          onClick={() => setAssessmentOpen(!assessmentOpen)}
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
        >
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Deal assessment
          </h3>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAssessmentOpen(!assessmentOpen);
            }}
            aria-label={assessmentOpen ? "Collapse deal assessment" : "Expand deal assessment"}
            className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
          >
            {assessmentOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>

        {assessmentOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-border">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Deal Strengths */}
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Deal strengths</h4>
                <ul className="space-y-1.5 text-xs">
                  {d.strong.map((reason) => (
                    <li key={reason} className="text-foreground/90 font-medium flex items-start gap-2 leading-relaxed">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">+</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                  {!d.strong.length && <li className="text-muted-foreground text-xs">None recorded.</li>}
                </ul>
              </div>

              {/* Risks & Objections */}
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Risks & objections</h4>
                <ul className="space-y-1.5 text-xs">
                  {d.weak.map((reason) => (
                    <li key={reason} className="text-foreground/90 font-medium flex items-start gap-2 leading-relaxed">
                      <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">−</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                  {!d.weak.length && <li className="text-muted-foreground text-xs">None recorded.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
