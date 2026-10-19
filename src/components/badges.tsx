import { cn } from "cn";
import type { TdiWindow } from "@/lib/engine/tdi";
import type { Provenance, SwathTier } from "@/lib/types";

const PROV: Record<Provenance, { label: string; cls: string; title: string }> = {
  "source-record": {
    label: "Source record",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    title: "Copied from a named source. This is not a certification.",
  },
  "radar-modeled": {
    label: "Radar-indicated",
    cls: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    title: "NEXRAD MESH / HDA estimate. Not ground-measured until field-verified.",
  },
  "depoii-modeled": {
    label: "Depoii modeled",
    cls: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    title: "Inferred by Depoii. Confirm in the field before relying on it.",
  },
};

const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function ProvenanceBadge({ kind, className }: { kind: Provenance; className?: string }) {
  const p = PROV[kind];
  return (
    <span title={p.title} className={cn(pill, p.cls, className)}>
      {p.label}
    </span>
  );
}

export function TierBadge({ tier, hail }: { tier: SwathTier; hail?: number }) {
  const map = {
    core: "border-red-500/50 bg-red-500/15 text-red-300",
    envelope: "border-amber-500/50 bg-amber-500/15 text-amber-300",
    outside: "border-border bg-muted text-muted-foreground",
  } as const;
  const label = tier === "core" ? "Core swath" : tier === "envelope" ? "Outer envelope" : "Outside swath";
  return (
    <span className={cn(pill, map[tier])}>
      {label}
      {hail ? ` · ${hail}"` : ""}
    </span>
  );
}

export function TdiBadge({ tdi }: { tdi: TdiWindow }) {
  const cls =
    tdi.status === "closed"
      ? "border-border bg-muted text-muted-foreground"
      : tdi.status === "urgent"
        ? "border-red-500/50 bg-red-500/15 text-red-300"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  return (
    <span className={cn(pill, cls)} title={`24-month advisory window ends ${tdi.deadline}`}>
      {tdi.status === "closed" ? "Window elapsed" : `${tdi.daysRemaining}d left`}
    </span>
  );
}

export function ScorePill({ score, className }: { score: number; className?: string }) {
  const cls = score >= 80 ? "bg-red-500 text-white" : score >= 60 ? "bg-amber-500 text-black" : score >= 40 ? "bg-sky-600 text-white" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex h-7 min-w-10 items-center justify-center rounded-md px-1.5 font-mono text-sm font-semibold tabular-nums", cls, className)}>{score}</span>;
}
