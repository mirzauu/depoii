import { cn } from "cn";
import type { TdiWindow } from "@/lib/engine/tdi";
import type { Provenance, SwathTier } from "@/lib/types";

const PROV: Record<Provenance, { label: string; cls: string; title: string }> = {
  "source-record": {
    label: "Source record",
    cls: "border-neutral-700/60 bg-neutral-900/80 text-neutral-300",
    title: "Copied from a named source. This is not a certification.",
  },
  "radar-modeled": {
    label: "Radar-indicated",
    cls: "border-neutral-700/60 bg-neutral-900/80 text-neutral-300",
    title: "NEXRAD MESH / HDA estimate. Not ground-measured until field-verified.",
  },
  "depoii-modeled": {
    label: "Depoii modeled",
    cls: "border-neutral-700/60 bg-neutral-900/80 text-neutral-300",
    title: "Inferred by Depoii. Confirm in the field before relying on it.",
  },
};

const pill = "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function ProvenanceBadge({ kind, className }: { kind: Provenance; className?: string }) {
  const p = PROV[kind];
  return (
    <span title={p.title} className={cn(pill, p.cls, className)}>
      <span className="size-1.5 rounded-full bg-neutral-400" />
      {p.label}
    </span>
  );
}

export function TierBadge({ tier, hail }: { tier: SwathTier; hail?: number }) {
  const map = {
    core: { cls: "border-[#DE7272]/30 bg-[#DE7272]/10 text-[#DE7272]", dot: "bg-[#DE7272]" },
    envelope: { cls: "border-[#FFCA88]/30 bg-[#FFCA88]/10 text-[#FFCA88]", dot: "bg-[#FFCA88]" },
    outside: { cls: "border-neutral-800 bg-neutral-900/60 text-neutral-400", dot: "bg-neutral-600" },
  } as const;
  const cfg = map[tier];
  const label = tier === "core" ? "Core swath" : tier === "envelope" ? "Outer envelope" : "Outside swath";
  return (
    <span className={cn(pill, cfg.cls)}>
      <span className={cn("size-1.5 rounded-full", cfg.dot)} />
      {label}
      {hail ? ` · ${hail}"` : ""}
    </span>
  );
}

export function TdiBadge({ tdi }: { tdi: TdiWindow }) {
  const isUrgent = tdi.status === "urgent";
  const isClosed = tdi.status === "closed";
  return (
    <span
      className={cn(
        pill,
        isClosed
          ? "border-neutral-800 bg-neutral-900/60 text-neutral-400"
          : isUrgent
            ? "border-[#DE7272]/30 bg-[#DE7272]/10 text-[#DE7272]"
            : "border-neutral-700/60 bg-neutral-900/80 text-neutral-300"
      )}
      title={`24-month advisory window ends ${tdi.deadline}`}
    >
      <span className={cn("size-1.5 rounded-full", isClosed ? "bg-neutral-600" : isUrgent ? "bg-[#DE7272]" : "bg-[#B4E4D6]")} />
      {isClosed ? "Window elapsed" : `${tdi.daysRemaining}d left`}
    </span>
  );
}

export function ScorePill({ score, className }: { score: number; className?: string }) {
  const cls = score >= 80 ? "bg-red-500 text-white" : score >= 60 ? "bg-amber-500 text-black" : score >= 40 ? "bg-sky-600 text-white" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex h-7 min-w-10 items-center justify-center rounded-md px-1.5 font-mono text-sm font-semibold tabular-nums", cls, className)}>{score}</span>;
}
