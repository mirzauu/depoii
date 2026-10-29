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

import { Filter as FilterIcon } from "lucide-react";

export function ScopeFilter({ jurisdiction, all, onChange }: { jurisdiction: string; all: boolean; onChange: (all: boolean) => void }) {
  const city = jurisdiction.split(",")[0];
  return (
    <Filter label="Location">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#111217] p-1">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "rounded py-1 text-center text-xs font-medium transition-colors truncate px-1",
            !all
              ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
          )}
          title={jurisdiction}
        >
          {city}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "rounded py-1 text-center text-xs font-medium transition-colors",
            all
              ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white font-semibold shadow-sm"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
          )}
        >
          All Locations
        </button>
      </div>
    </Filter>
  );
}

export const filterField =
  "h-8 w-full rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#14151c] px-2.5 text-xs text-neutral-900 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none transition-colors focus:border-neutral-400 dark:focus:border-neutral-700 hover:border-neutral-400/80 dark:hover:border-neutral-700/80";

export function FilterRail({
  children,
  title = "Filters",
  onReset,
  activeCount,
}: {
  children: React.ReactNode;
  title?: string;
  onReset?: () => void;
  activeCount?: number;
}) {
  return (
    <aside className="w-full shrink-0 border-b border-border dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#0d0e12] p-3.5 text-xs lg:w-64 lg:border-r lg:border-b-0 lg:sticky lg:top-0 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto z-10 flex flex-col">
      <div className="sticky top-0 bg-neutral-50 dark:bg-[#0d0e12] z-20 flex items-center justify-between pb-2.5 mb-3 border-b border-border dark:border-neutral-800/80 shrink-0 -mt-3.5 pt-3.5">
        <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200 text-xs">
          <FilterIcon className="size-3.5 text-neutral-500 dark:text-neutral-400" />
          <span>{title}</span>
          {activeCount && activeCount > 0 ? (
            <span className="rounded-full bg-neutral-200 dark:bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-neutral-800 dark:text-white">
              {activeCount}
            </span>
          ) : null}
        </div>
        {onReset && activeCount && activeCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            Reset
          </button>
        ) : null}
      </div>
      <div className="space-y-3.5 flex-1">{children}</div>
    </aside>
  );
}

export function Filter({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}

export function EngineLayout({
  title,
  subtitle,
  actions,
  filters,
  children,
  onResetFilters,
  activeFiltersCount,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  onResetFilters?: () => void;
  activeFiltersCount?: number;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row bg-background dark:bg-[#0b0c10] text-foreground dark:text-neutral-200 antialiased font-sans">
      {filters && (
        <FilterRail onReset={onResetFilters} activeCount={activeFiltersCount}>
          {filters}
        </FilterRail>
      )}
      <section className="min-w-0 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f12] px-5 py-3.5 z-10 shrink-0">
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground dark:text-white">{title}</h1>
            {subtitle && <p className="text-xs font-medium text-rose-600 dark:text-[#DE7272] mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
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
    const isTerritoryError = error.toLowerCase().includes("territor");
    return (
      <div className="p-10 text-center text-sm space-y-2">
        <p className="font-semibold text-foreground">{isTerritoryError ? "Territory Subscription Required" : "The data engine returned an error"}</p>
        <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">{error}</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          {isTerritoryError && (
            <a href="/territory" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              Browse Territories
            </a>
          )}
          {onRetry && <button type="button" onClick={onRetry} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Try again</button>}
        </div>
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

const RISK: Record<string, { cls: string; dot: string }> = {
  CRITICAL: { cls: "border-[#DE7272]/30 bg-[#DE7272]/10 text-[#DE7272]", dot: "bg-[#DE7272]" },
  URGENT: { cls: "border-[#DE7272]/30 bg-[#DE7272]/10 text-[#DE7272]", dot: "bg-[#DE7272]" },
  HIGH: { cls: "border-[#FFCA88]/30 bg-[#FFCA88]/10 text-[#FFCA88]", dot: "bg-[#FFCA88]" },
  ELEVATED: { cls: "border-[#FFCA88]/30 bg-[#FFCA88]/10 text-[#FFCA88]", dot: "bg-[#FFCA88]" },
  MODERATE: { cls: "border-[#FFF6A9]/30 bg-[#FFF6A9]/10 text-[#FFF6A9]", dot: "bg-[#FFF6A9]" },
  LOW: { cls: "border-[#B4E4D6]/30 bg-[#B4E4D6]/10 text-[#B4E4D6]", dot: "bg-[#B4E4D6]" },
};

export function RiskBadge({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const key = Object.keys(RISK).find((k) => value.toUpperCase().includes(k));
  const cfg = key ? RISK[key] : { cls: "border-border bg-neutral-900/60 text-muted-foreground", dot: "bg-neutral-600" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", cfg.cls)}>
      <span className={cn("size-1.5 rounded-full shrink-0", cfg.dot)} />
      {value}
    </span>
  );
}
