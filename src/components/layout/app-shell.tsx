"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, CloudLightning, Search } from "lucide-react";
import { cn } from "cn";
import { allStateNames, searchUsCounties, SERVED_AREAS } from "@/lib/us-areas";
import type { StormSummary } from "@/lib/types";
import { useDepoiiState } from "./depoii-provider";
import { ContractorIndex } from "@/components/contractor-link";
import { DepoiiLoader, DepoiiMark } from "./depoii-logo";
import { AccountMenu, ENGINE_PATHS, FLAT_NAV, Sidebar, isActive } from "./sidebar";
import { useMe } from "@/hooks/use-me";
import { ThemeToggle } from "./theme-toggle";

const selectClass = "h-8 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CitySelect({ className }: { className?: string }) {
  const { jurisdiction, setJurisdiction } = useDepoiiState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();

  const servedVisible = useMemo(
    () =>
      SERVED_AREAS.filter(
        (a) => !needle || `${a.city} ${a.state} ${a.label}`.toLowerCase().includes(needle),
      ),
    [needle],
  );

  const countyHits = useMemo(() => (needle ? searchUsCounties(query, 150) : []), [needle, query]);

  // Drop Dallas / Tarrant style hits that duplicate the live cities
  const upcoming = useMemo(() => {
    const live = new Set(SERVED_AREAS.map((a) => a.label.toLowerCase()));
    return countyHits.filter((h) => {
      const asCity = `${h.county}, ${h.state}`.toLowerCase();
      return !live.has(asCity) && !live.has(h.label.toLowerCase());
    });
  }, [countyHits]);

  const upcomingGroups = useMemo(() => {
    const map = new Map<string, { name: string; items: typeof upcoming }>();
    for (const hit of upcoming) {
      const g = map.get(hit.state) ?? { name: hit.stateName, items: [] };
      g.items.push(hit);
      map.set(hit.state, g);
    }
    return [...map.entries()]
      .map(([code, g]) => ({ code, name: g.name, items: g.items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [upcoming]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Building2 className="size-4 shrink-0 text-sky-400" />
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((next) => !next);
          setQuery("");
        }}
        className={cn(selectClass, "flex items-center justify-between gap-2 text-left")}
      >
        <span className="truncate" suppressHydrationWarning>
          {jurisdiction ? jurisdiction.split(",")[0] : "Choose a city"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-64 max-w-[90vw] rounded-md border border-border bg-background p-2 shadow-lg">
          <label className="flex items-center gap-2 rounded-md border border-border px-2">
            <Search className="size-3.5 shrink-0" />
            <span className="sr-only">Search cities and counties</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city, county, or state"
              className="h-8 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div role="listbox" aria-label="Areas" className="mt-2 max-h-80 overflow-y-auto">
            {servedVisible.length > 0 && (
              <div className="pb-1">
                <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-emerald-500/90 uppercase">
                  Available now
                </p>
                {servedVisible.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    role="option"
                    aria-selected={a.label === jurisdiction}
                    onClick={() => {
                      setJurisdiction(a.label);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted",
                      a.label === jurisdiction && "bg-muted",
                    )}
                  >
                    <span className="truncate">{a.label}</span>
                    <span className="shrink-0 text-[10px] font-medium text-emerald-500">Live</span>
                  </button>
                ))}
              </div>
            )}

            <div className="pb-1">
              {!needle &&
                allStateNames().map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setQuery(s.name)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] tracking-wide uppercase">Soon</span>
                  </button>
                ))}
              {needle && upcomingGroups.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">No counties match “{query.trim()}”.</p>
              )}
              {needle &&
                upcomingGroups.map((group) => (
                  <div key={group.code} className="pb-0.5">
                    <p className="sticky top-0 bg-background px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                      {group.name}
                    </p>
                    {group.items.map((c) => (
                      <div
                        key={c.label}
                        role="option"
                        aria-disabled="true"
                        aria-selected={false}
                        title="Coming soon — not selectable"
                        className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground/70"
                      >
                        <span className="truncate">
                          {c.county} County, {c.state}
                        </span>
                        <span className="shrink-0 text-[10px] tracking-wide uppercase">Soon</span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StormSelect({
  className,
  storms: stormsProp,
  stormId: stormIdProp,
  loading: loadingProp,
  onSelect,
  emptyLabel = "No storm loaded",
}: {
  className?: string;
  /** When set, use these instead of live Depoii payload storms (Hail Map engine catalog). */
  storms?: StormSummary[];
  stormId?: string;
  loading?: boolean;
  onSelect?: (id: string) => void;
  emptyLabel?: string;
}) {
  const live = useDepoiiState();
  const overridden = stormsProp !== undefined;
  const storms = overridden ? stormsProp : live.storms;
  const stormId = overridden ? (stormIdProp ?? "") : (live.storm?.id ?? "");
  const loading = overridden ? Boolean(loadingProp) : live.loading;
  const onChange = overridden
    ? (id: string) => onSelect?.(id)
    : (id: string) => live.setStormId(id);
  return (
    <label className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <CloudLightning className="size-4 shrink-0 text-amber-400" />
      <span className="sr-only">Storm event</span>
      <select
        value={stormId}
        disabled={!storms.length}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {!storms.length && (
          <option value="">{loading ? "Loading NWS reports…" : emptyLabel}</option>
        )}
        {storms.map((s) => (
          <option key={s.id} value={s.id}>
            {s.shortName} · {s.maxHail}&quot; largest report
          </option>
        ))}
      </select>
    </label>
  );
}

export function DataGate({ children }: { children: React.ReactNode }) {
  const { ready, loading, progress, error, refresh, coverage, fetchedAt, jurisdiction } = useDepoiiState();
  const path = usePathname();
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    setClock(fetchedAt ? new Date(fetchedAt).toLocaleString() : "");
  }, [fetchedAt]);
  const place = jurisdiction || "the selected city";
  if (path === "/" || ENGINE_PATHS.some((p) => path.startsWith(p))) return <>{children}</>;
  if (!ready && error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-lg font-semibold">The public records feed did not load</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <button onClick={refresh} className="mt-4 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white">
          Try again
        </button>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <DepoiiLoader className="mb-5" />
        <p className="text-lg font-semibold">Pulling live public records</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Hail reports, appraisal parcels, and commercial permits for {place}. The first load takes a few seconds.
        </p>
      </div>
    );
  }
  return (
    <>
      {loading && (
        <div className="h-0.5 w-full overflow-hidden bg-amber-500/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Refreshing public records">
          <div className="h-full bg-amber-400 transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <p className="border-b border-border px-4 py-2 text-[11px] leading-relaxed text-muted-foreground lg:px-8">
        {coverage} {clock && <>Fetched {clock}.</>}
        <button onClick={refresh} className="ml-2 underline">Refresh</button>
      </p>
      {children}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const me = useMe();
  // Defer role-gated links until after mount so SSR and hydration trees match.
  const [navReady, setNavReady] = useState(false);
  useEffect(() => setNavReady(true), []);
  const mobileNav =
    navReady && me?.platformRole === "superadmin"
      ? [...FLAT_NAV, { href: "/admin", label: "Super Admin", match: ["/admin"] }]
      : FLAT_NAV;
  if (path === "/login" || path === "/welcome") return <main className="min-h-screen">{children}</main>;
  return (
    <div className="flex min-h-screen print:block">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur print:hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
            <Link href="/" className="flex items-center gap-2 lg:hidden" suppressHydrationWarning>
              <DepoiiMark className="size-7 text-foreground" />
              <span className="font-bold">Depoii</span>
            </Link>
            <CitySelect className="ml-auto w-full max-w-xs" />
            <ThemeToggle />
            <div className="lg:hidden">
              <AccountMenu />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {mobileNav.map((link) => {
              const fromParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn("shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground", isActive(path, link, fromParam) && "border-foreground/30 bg-muted text-foreground")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1">
          <ContractorIndex>
            <DataGate>{children}</DataGate>
          </ContractorIndex>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between lg:px-8">
      <div className="space-y-1">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-widest text-red-400">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
