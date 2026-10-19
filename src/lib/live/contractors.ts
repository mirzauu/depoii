import type { Contractor, Permit } from "@/lib/types";

const PALETTE = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#94a3b8", "#f97316", "#ef4444", "#22d3ee", "#c084fc"];

export function contractorsFrom(permits: Permit[]): Contractor[] {
  const seen = new Map<string, Contractor>();
  for (const p of permits) {
    if (!p.contractorId || seen.has(p.contractorId)) continue;
    seen.set(p.contractorId, {
      id: p.contractorId,
      name: p.contractorName,
      hq: p.contractorState === "UNKNOWN" ? "State not printed on the permit" : p.contractorState,
      homeState: p.contractorState,
      color: PALETTE[seen.size % PALETTE.length],
    });
  }
  return [...seen.values()];
}
