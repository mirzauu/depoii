"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { DepoiiLoader } from "./depoii-logo";

export function useDebounced<T>(value: T, ms = 350) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export function ScopeFilter({ jurisdiction, all, onChange }: { jurisdiction: string; all: boolean; onChange: (all: boolean) => void }) {
  return (
    <Filter label="Location">
      <select value={all ? "all" : "city"} onChange={(e) => onChange(e.target.value === "all")} className={filterField}>
        <option value="city">{jurisdiction}</option>
        <option value="all">All locations</option>
      </select>
    </Filter>
  );
}

export const filterField = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FilterRail({ children }: { children: React.ReactNode }) {
  return <aside className="w-full shrink-0 space-y-4 border-b border-border p-4 lg:w-60 lg:border-r lg:border-b-0">{children}</aside>;
}

export function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export function EngineLayout({
  title,
  subtitle,
  actions,
  filters,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {filters && <FilterRail>{filters}</FilterRail>}
      <section className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    </div>
  );
}

export function Kpis({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="bg-background px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{k.value}</p>
        </div>
      ))}
    </div>
  );
}

export function EngineState({ loading, error, empty, onRetry, children }: { loading: boolean; error: string | null; empty: boolean; onRetry?: () => void; children: React.ReactNode }) {
  if (error) {
    return (
      <div className="p-10 text-center text-sm">
        <p className="font-medium text-red-300">The data engine returned an error</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Try again</button>}
      </div>
    );
  }
  if (loading) return <DepoiiLoader label="Asking the data engine…" className="p-10" />;
  if (empty) return <p className="p-10 text-center text-sm text-muted-foreground">No records match these filters.</p>;
  return <>{children}</>;
}

export function Pager({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + limit);
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
      <span>{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Previous</button>
        <button type="button" className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>Next</button>
      </div>
    </div>
  );
}

const RISK: Record<string, string> = {
  CRITICAL: "border-red-500/50 bg-red-500/15 text-red-300",
  HIGH: "border-orange-500/50 bg-orange-500/15 text-orange-300",
  MODERATE: "border-amber-500/50 bg-amber-500/15 text-amber-200",
};

export function RiskBadge({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const key = Object.keys(RISK).find((k) => value.toUpperCase().includes(k));
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap", key ? RISK[key] : "border-border text-muted-foreground")}>{value}</span>;
}
