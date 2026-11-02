"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileText,
  Hourglass,
  House,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Moon,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RealLogo } from "@/components/real-logo";
import { PageHeader } from "@/components/app-shell";
import { ScorePill, TierBadge } from "@/components/badges";
import { DepoiiMap, type MapPoint } from "@/components/depoii-map";
import { DepoiiMark } from "@/components/depoii-logo";
import { RiskBadge } from "@/components/engine-layout";
import { Sidebar, SidebarPreview } from "@/components/sidebar";
import type { TourHighlight, TourScene } from "@/components/landing-tour";
import {
  MOCK_AGING_ROOFS,
  MOCK_BUILDINGS,
  MOCK_COMPETITORS,
  MOCK_CONTRACTORS,
  MOCK_HAIL,
  MOCK_OUTCOMES,
  MOCK_OUTSIDE_LEAD,
  MOCK_PERMITS,
  MOCK_STORM,
  MOCK_TEAM,
  PIPELINE_STAGES,
  agingStats,
  leadById,
  leadsForCity,
  type MockAgingRoof,
  type MockCity,
  type MockLead,
  type PipelineStage,
} from "@/components/landing-mock-data";
import { cn } from "cn";
import { longDate, num, shortDate, usd } from "@/lib/format";
import { allStateNames, searchUsCounties, SERVED_AREAS } from "@/lib/us-areas";

function hlClass(active: TourHighlight | null | undefined, id: TourHighlight) {
  if (active !== id) return "";
  return "relative z-10 bg-[#c8f000]/10 outline outline-2 outline-[#c8f000] outline-offset-2 shadow-[0_0_24px_-4px_rgba(200,240,0,0.45)] transition-[outline,box-shadow,background-color] duration-500";
}

type PipelineRow = { leadId: string; stage: PipelineStage; notes: string };

export function LandingMock({ scene }: { scene: TourScene }) {
  const [darkMock, setDarkMock] = useState(true);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [path, setPath] = useState<string>(scene.path);
  const [city, setCity] = useState<MockCity>(scene.city);
  const [selectedId, setSelectedId] = useState<string | null>(
    scene.openRecord ? "dcad-16850" : null,
  );
  const [pipeline, setPipeline] = useState<PipelineRow[]>([
    { leadId: "dcad-16850", stage: "Contacted", notes: "Left voicemail for owner" },
    { leadId: "dcad-4100", stage: "New", notes: "" },
    { leadId: "dcad-12221", stage: "Inspected", notes: "Crew on site Mon" },
    { leadId: "dcad-2501", stage: "Bid", notes: "Proposal sent" },
    { leadId: "tad-1200", stage: "Contacted", notes: "Spoke with asset manager" },
    { leadId: "tad-4801", stage: "New", notes: "" },
  ]);
  const [mapSelected, setMapSelected] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState(MOCK_OUTCOMES);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tour drives the mock when the scene changes
  useEffect(() => {
    setPath(scene.path);
    setCity(scene.city);
    setCityOpen(false);
    setCityQuery("");
    if (scene.openRecord) {
      setSelectedId("dcad-16850");
    } else if (scene.highlight === "leads" || scene.highlight === "city") {
      setSelectedId(null);
    }
    if (scene.path === "/map") setMapSelected("dcad-16850");
  }, [scene.path, scene.city, scene.openRecord, scene.highlight]);

  const cityNeedle = cityQuery.trim().toLowerCase();
  const servedVisible = useMemo(
    () =>
      SERVED_AREAS.filter(
        (a) => !cityNeedle || `${a.city} ${a.state} ${a.label}`.toLowerCase().includes(cityNeedle),
      ),
    [cityNeedle],
  );
  const upcomingGroups = useMemo(() => {
    if (!cityNeedle) return [];
    const hits = searchUsCounties(cityQuery, 120);
    const live = new Set(SERVED_AREAS.map((a) => a.label.toLowerCase()));
    const upcoming = hits.filter((h) => !live.has(`${h.county}, ${h.state}`.toLowerCase()));
    const map = new Map<string, { name: string; items: typeof upcoming }>();
    for (const hit of upcoming) {
      const g = map.get(hit.state) ?? { name: hit.stateName, items: [] };
      g.items.push(hit);
      map.set(hit.state, g);
    }
    return [...map.entries()]
      .map(([code, g]) => ({ code, name: g.name, items: g.items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cityNeedle, cityQuery]);

  const go = (href: string) => {
    setPath(href);
    if (href !== "/" && href !== "/pipeline") setSelectedId(null);
  };

  const openLead = (id: string) => {
    setSelectedId(id);
    setPath("/");
  };

  const addToPipeline = (leadId: string) => {
    setPipeline((prev) => {
      if (prev.some((r) => r.leadId === leadId)) return prev;
      return [...prev, { leadId, stage: "New", notes: "" }];
    });
  };

  const setStage = (leadId: string, stage: PipelineStage) => {
    setPipeline((prev) => prev.map((r) => (r.leadId === leadId ? { ...r, stage } : r)));
  };

  const inPipeline = (id: string) => pipeline.some((r) => r.leadId === id);
  const highlight = scene.highlight;
  const leads = leadsForCity(city);
  // MapLibre breaks under CSS scale — map route renders at 1:1 like the real app.
  const isMap = path === "/map";

  const chrome = (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="hidden h-full lg:contents">
          <Sidebar defaultCollapsed={true} />
        </div>
        <div className={`flex min-w-0 flex-1 flex-col ${isMap ? "text-sm" : "text-[13px]"}`}>
        <header className="border-b border-border bg-background">
          <div className="flex items-center gap-2 px-3 py-2 lg:gap-3 lg:px-4 lg:py-2.5">
            <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
              <DepoiiMark className="size-5" />
              <span className="text-[13px] font-bold tracking-tight">Depoii</span>
            </div>
            <div className={`relative w-full max-w-xs rounded-md ${hlClass(highlight, "city")}`}>
              <button
                type="button"
                aria-expanded={cityOpen}
                aria-haspopup="listbox"
                onClick={() => {
                  setCityOpen((v) => !v);
                  setCityQuery("");
                }}
                className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-sky-400" />
                  <span className="truncate">
                    {city}, TX
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-60" />
              </button>
              {cityOpen && (
                <div className="absolute top-full left-0 z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] max-lg:left-0 max-lg:right-0 max-lg:w-auto rounded-md border border-border bg-background p-2 shadow-lg">
                  <label className="flex items-center gap-2 rounded-md border border-border px-2">
                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                    <input
                      autoFocus
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      placeholder="Search city, county, or state"
                      className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                  <div role="listbox" className="mt-2 max-h-72 overflow-y-auto">
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
                            onClick={() => {
                              setCity(a.city as MockCity);
                              setCityOpen(false);
                              setSelectedId(null);
                              setMapSelected(null);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                              a.city === city && "bg-muted",
                            )}
                          >
                            <span>{a.label}</span>
                            <span className="text-[10px] font-medium text-emerald-500">Live</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div>
                      {!cityNeedle &&
                        allStateNames().map((s) => (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => setCityQuery(s.name)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <span>{s.name}</span>
                            <span className="text-[10px] tracking-wide uppercase">Soon</span>
                          </button>
                        ))}
                      {cityNeedle && upcomingGroups.length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          No counties match “{cityQuery.trim()}”.
                        </p>
                      )}
                      {cityNeedle &&
                        upcomingGroups.map((group) => (
                          <div key={group.code}>
                            <p className="sticky top-0 bg-background px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                              {group.name}
                            </p>
                            {group.items.map((c) => (
                              <div
                                key={c.label}
                                aria-disabled="true"
                                title="Coming soon — not selectable"
                                className="flex cursor-not-allowed items-center justify-between gap-2 px-2 py-1.5 text-sm text-muted-foreground/70"
                              >
                                <span className="truncate">
                                  {c.county} County, {c.state}
                                </span>
                                <span className="text-[10px] tracking-wide uppercase">Soon</span>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDarkMock((v) => !v)}
              aria-label={darkMock ? "Switch mock to light mode" : "Switch mock to dark mode"}
              className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
            >
              {darkMock ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className={`min-h-0 flex-1 ${isMap ? "overflow-hidden" : "overflow-auto"}`}
        >
          {path === "/" && (
            <MockHome
              city={city}
              leads={leads}
              selectedId={selectedId}
              highlight={highlight}
              scrollParentRef={scrollRef}
              inPipeline={inPipeline}
              onOpen={openLead}
              onCloseRecord={() => setSelectedId(null)}
              onAdd={addToPipeline}
              onOpenMap={() => go("/map")}
              onOpenPipeline={() => go("/pipeline")}
              onNavigate={go}
            />
          )}
          {path === "/pipeline" && (
            <MockPipeline
              city={city}
              pipeline={pipeline}
              highlight={highlight}
              onOpen={openLead}
              onStage={setStage}
              onAdd={addToPipeline}
            />
          )}
          {path === "/map" && (
            <MockMap
              city={city}
              selectedId={mapSelected}
              highlight={highlight}
              onSelect={setMapSelected}
              onOpenLead={openLead}
            />
          )}
          {path === "/outcomes" && (
            <MockOutcomes
              outcomes={outcomes}
              highlight={highlight}
              onClear={() => setOutcomes([])}
              onRestore={() => setOutcomes(MOCK_OUTCOMES)}
              onOpenLead={openLead}
            />
          )}
          {path === "/roof-aging" && <MockRoofAging city={city} highlight={highlight} />}
          {path === "/permits" && <MockPermits city={city} />}
          {path === "/buildings" && <MockBuildings city={city} onOpen={openLead} />}
          {path === "/contractors" && <MockContractors />}
          {path === "/competitors" && <MockCompetitors />}
          {path === "/team" && <MockTeam />}
          {path !== "/" &&
            path !== "/pipeline" &&
            path !== "/map" &&
            path !== "/outcomes" &&
            path !== "/roof-aging" &&
            path !== "/permits" &&
            path !== "/buildings" &&
            path !== "/contractors" &&
            path !== "/competitors" &&
            path !== "/team" && (
              <MockStub path={path} onHome={() => go("/")} />
            )}
        </div>
      </div>
      </div>
      <MockBottomNav path={path} onGo={go} />
    </div>
  );

  return (
    <SidebarPreview.Provider value={{ path, go }}>
      <div
        className={cn(
          darkMock ? "dark" : "",
          "h-full w-full overflow-hidden bg-background text-foreground max-lg:text-[12px]",
          // Desktop floating window chrome; phone shell owns the bezel on small screens
          "max-lg:rounded-none max-lg:border-0 max-lg:shadow-none max-lg:ring-0",
          "lg:rounded-2xl lg:border lg:border-border lg:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.45),0_16px_40px_-12px_rgba(0,0,0,0.25)] lg:ring-1 lg:ring-black/10",
        )}
      >
        {isMap ? (
          <div className="flex h-full w-full">{chrome}</div>
        ) : (
          <div className="flex h-full w-full origin-top-left lg:h-[135%] lg:w-[135%] lg:scale-[0.74]">
            {chrome}
          </div>
        )}
      </div>
    </SidebarPreview.Provider>
  );
}

const MOCK_TABS: { href: TourScene["path"]; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: House },
  { href: "/pipeline", label: "Pipeline", icon: Briefcase },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/roof-aging", label: "Aging", icon: Ruler },
  { href: "/outcomes", label: "Field", icon: ClipboardList },
];

function MockBottomNav({
  path,
  onGo,
}: {
  path: string;
  onGo: (href: string) => void;
}) {
  return (
    <nav
      className="flex shrink-0 items-stretch justify-around border-t border-border bg-card/90 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Product preview"
    >
      {MOCK_TABS.map((tab) => {
        const active = tab.href === "/" ? path === "/" : path === tab.href || path.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <button
            key={tab.href}
            type="button"
            onClick={() => onGo(tab.href)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors",
              active ? "text-[#c8f000]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function scrollChildIntoMock(parent: HTMLElement, child: HTMLElement) {
  const parentRect = parent.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  const next = parent.scrollTop + (childRect.top - parentRect.top) - 10;
  parent.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
}

function DecisionCard({
  n,
  icon: Icon,
  question,
  answer,
  detail,
  onAction,
  cta,
  tourId,
}: {
  n: number;
  icon: React.ElementType;
  question: string;
  answer: React.ReactNode;
  detail: React.ReactNode;
  onAction: () => void;
  cta: string;
  tourId?: string;
}) {
  return (
    <div
      data-tour={tourId}
      className="group relative flex flex-col justify-between rounded-xl border border-border bg-card/75 p-4 sm:p-5 shadow-sm transition-all duration-150 hover:border-foreground/30 hover:bg-card hover:shadow-md"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-4 text-[#DE7272]" />
          <span>Decision {n}</span>
        </div>
        <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground">{question}</h3>
        <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{answer}</div>
        <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">{detail}</div>
      </div>

      <div className="pt-4">
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#DE7272] transition-all hover:text-[#DE7272]/80 group-hover:gap-2 text-left"
        >
          <span>{cta}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function MockHome({
  city,
  leads,
  selectedId,
  highlight,
  scrollParentRef,
  inPipeline,
  onOpen,
  onCloseRecord,
  onAdd,
  onOpenMap,
  onOpenPipeline,
  onNavigate,
}: {
  city: MockCity;
  leads: MockLead[];
  selectedId: string | null;
  highlight: TourHighlight;
  scrollParentRef: React.RefObject<HTMLDivElement | null>;
  inPipeline: (id: string) => boolean;
  onOpen: (id: string) => void;
  onCloseRecord: () => void;
  onAdd: (id: string) => void;
  onOpenMap: () => void;
  onOpenPipeline: () => void;
  onNavigate: (href: string) => void;
}) {
  const selected = leadById(selectedId);
  const recordRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLLIElement>(null);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);

  const topLead = leads[0];

  const {
    topZips,
    agingCount,
    avgAge,
    totalPipelineValue,
    totalRoofSqft,
  } = useMemo(() => {
    const currentYear = 2026;
    let pipeVal = 0;
    let roofSq = 0;
    let aged = 0;
    let totalYears = 0;
    let yearCount = 0;
    const zipMap = new Map<string, number>();

    for (const o of leads) {
      pipeVal += o.value || 0;
      roofSq += o.roofSqft || 0;
      if (o.yearBuilt && o.yearBuilt > 1900 && o.yearBuilt <= currentYear) {
        const age = currentYear - o.yearBuilt;
        totalYears += age;
        yearCount++;
        if (age >= 20) aged++;
      }
      if (o.zipCode) {
        const zip5 = o.zipCode.slice(0, 5);
        zipMap.set(zip5, (zipMap.get(zip5) || 0) + 1);
      }
    }

    const sortedZips = Array.from(zipMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([zip, count]) => ({ zip, count }));

    const avg = yearCount > 0 ? Math.round(totalYears / yearCount) : 23;

    return {
      topZips: sortedZips,
      agingCount: aged || leads.length,
      avgAge: avg,
      totalPipelineValue: pipeVal,
      totalRoofSqft: roofSq,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!selectedZip) return leads;
    return leads.filter((o) => (o.zipCode || "").slice(0, 5) === selectedZip);
  }, [leads, selectedZip]);

  const DEFAULT_ZIPS_BY_CITY: Record<string, [string, string]> = {
    Dallas: ["75248", "75244"],
    "Fort Worth": ["76102", "76132"],
  };
  const fallbackZips = DEFAULT_ZIPS_BY_CITY[city] || ["75248", "75244"];
  const topZip1 = topZips[0]?.zip || fallbackZips[0];
  const topZip2 = topZips[1]?.zip || fallbackZips[1];

  // Tour: scroll the highlighted target to the top of the mock viewport
  useEffect(() => {
    const parent = scrollParentRef.current;
    if (!parent) return;

    if (highlight === "record" && selected) {
      const t = window.setTimeout(() => {
        if (recordRef.current) scrollChildIntoMock(parent, recordRef.current);
      }, 80);
      return () => window.clearTimeout(t);
    }

    if (highlight === "leads") {
      const t = window.setTimeout(() => {
        if (leadRef.current) scrollChildIntoMock(parent, leadRef.current);
      }, 80);
      return () => window.clearTimeout(t);
    }

    parent.scrollTo({ top: 0, behavior: "smooth" });
  }, [highlight, selected?.id, scrollParentRef]);

  return (
    <div className="pb-10">
      {/* Overview Page Title Bar */}
      <div data-tour="hero-dispatch" className="flex flex-col gap-3 px-4 pt-5 pb-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Overview
            </h1>
            <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {city} Metro Swath
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-rose-600 dark:text-[#DE7272] mt-0.5">
            High-level commercial roof inventory, pipeline valuation, and active jobsite distribution across your licensed territory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenMap}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card dark:bg-[#111216] px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <MapPin className="size-4 text-muted-foreground" />
            Open hail map
          </button>
          <button
            type="button"
            onClick={() => onNavigate("/territory")}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#B4E4D6] hover:bg-[#B4E4D6]/20 transition-colors shadow-sm"
          >
            <ShieldCheck className="size-4 text-[#B4E4D6]" />
            Territory Claims
          </button>
        </div>
      </div>

      {/* Free Trial Active Banner */}
      <div data-tour="trial-banner" className="mx-4 mb-4 rounded-xl border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 p-3.5 sm:p-4 lg:mx-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#B4E4D6] text-neutral-950 font-semibold text-xs gap-1 border-0">
                <Sparkles className="h-3 w-3" />
                Free Trial Active
              </Badge>
              <span className="font-semibold text-foreground text-sm">
                {city} Metro Territory
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              14 days remaining · Full verified roof intelligence & 3 exclusive claim-locks unlocked.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("/territory")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#B4E4D6] hover:underline shrink-0"
          >
            Manage Territory Claims
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 6 Core Tactical Decision Cards */}
      <div className="mb-6 px-4 lg:px-6">
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <DecisionCard
            n={1}
            icon={MapPinned}
            question="Where do we deploy crews?"
            answer={`ZIP ${topZip1}${topZip2 ? ` & ${topZip2}` : ""} (${city} Corridor)`}
            detail={`Severe storm impact footprint · 1.75"–2.00" hail swath. ${agingCount || leads.length} priority roofs in direct deployment vector.`}
            onAction={onOpenMap}
            cta="Open hail swath map"
            tourId="card-zip"
          />
          <DecisionCard
            n={2}
            icon={Search}
            question="Who should we inspect?"
            answer={`${num(leads.length)} unresolved · ${totalPipelineValue > 0 ? usd(totalPipelineValue, true) : "$17.7M"}`}
            detail={`${agingCount} commercial roofs exceeding 20+ years of age identified with zero competitor re-roof permits logged to date.`}
            onAction={onOpenPipeline}
            cta="Review pipeline"
            tourId="card-condition"
          />
          <DecisionCard
            n={3}
            icon={UserRound}
            question="Who do we contact?"
            answer={topLead ? (topLead.organizationName || topLead.owner) : "Verified Decision Maker"}
            detail={
              topLead
                ? `Owner of record for ${topLead.address}. ${topLead.decisionMaker ? `${topLead.decisionMaker} (${topLead.decisionTitle || "Executive"})` : "Deed entity and decision-maker contact roll."}`
                : "Direct property deed owner & verified entity contact."
            }
            onAction={() => topLead && onOpen(topLead.id)}
            cta="Open dossier"
          />
          <DecisionCard
            n={4}
            icon={FileText}
            question="What is our technical pitch?"
            answer="Structural Condition Audit"
            detail={
              topLead
                ? `Brief for ${topLead.address}: ${topLead.hailInches}" hail exposure, ${2026 - topLead.yearBuilt} yr aging, membrane commercial flat / BUR.`
                : "Select a property to generate engineering brief."
            }
            onAction={() => topLead && onOpen(topLead.id)}
            cta="Generate brief"
          />
          <DecisionCard
            n={5}
            icon={BarChart3}
            question="Where are competitors winning?"
            answer="Apex Roofing · 34% share"
            detail={`Apex Roofing leads market share with 34% of commercial re-roof permits across ${city}. Storm-chaser surge: Elite Roofing, Texas Direct.`}
            onAction={() => onNavigate("/competitors")}
            cta="Enter war room"
            tourId="card-permits"
          />
          <DecisionCard
            n={6}
            icon={Hourglass}
            question="What is the statutory urgency?"
            answer={<span className="text-[#B4E4D6]">412 days remaining</span>}
            detail="TDI 24-month advisory window for storm event ends May 14, 2026. Prioritize outreach before filing deadline expires."
            onAction={onOpenPipeline}
            cta="Prioritize outreach"
          />
        </div>
      </div>

      <div className="space-y-6 px-4 lg:px-6">
        {/* Tactical Pipeline & Roofing Stats */}
        <div data-tour="overview-stats" className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Target Pipeline Value"
            value={totalPipelineValue > 0 ? usd(totalPipelineValue, true) : "$17.7M"}
          />
          <Stat
            label="Commercial Roof Area"
            value={totalRoofSqft > 0 ? `${num(totalRoofSqft)} sq ft` : "104,194 sq ft"}
          />
          <Stat
            label={selectedZip ? `Active Leads (ZIP ${selectedZip})` : "Active Unpermitted Leads"}
            value={num(filteredLeads.length)}
          />
        </div>

        <section data-tour="released-records">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Released records
                {selectedZip && (
                  <Badge variant="outline" className="text-xs gap-1 font-normal text-[#DE7272] border-[#DE7272]/30 bg-[#DE7272]/10">
                    Filtered: ZIP {selectedZip}
                    <button type="button" onClick={() => setSelectedZip(null)} className="hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
              </h2>
              {topZips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <span className="text-[11px] font-medium">Filter by target ZIP:</span>
                  {topZips.slice(0, 4).map((z) => (
                    <button
                      key={z.zip}
                      type="button"
                      onClick={() => setSelectedZip(selectedZip === z.zip ? null : z.zip)}
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors border",
                        selectedZip === z.zip
                          ? "bg-[#DE7272] text-white border-[#DE7272]"
                          : "bg-muted/50 text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {z.zip} ({z.count})
                    </button>
                  ))}
                  {selectedZip && (
                    <button
                      type="button"
                      onClick={() => setSelectedZip(null)}
                      className="text-[11px] font-semibold text-[#DE7272] hover:underline ml-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenPipeline}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline shrink-0"
            >
              Open pipeline
            </button>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No released leads in {city} for the selected filter.
              </p>
              {selectedZip && (
                <button
                  type="button"
                  onClick={() => setSelectedZip(null)}
                  className="text-xs font-semibold text-[#DE7272] hover:underline"
                >
                  Clear ZIP filter
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {filteredLeads.map((lead, index) => {
                const ringFirst = highlight === "leads" && index === 0;
                const added = inPipeline(lead.id);
                return (
                  <li
                    key={lead.id}
                    ref={index === 0 ? leadRef : undefined}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-3 py-3 transition-colors",
                      selectedId === lead.id ? "bg-muted/60" : "",
                      ringFirst ? hlClass(highlight, "leads") : ""
                    )}
                  >
                    <ScorePill score={lead.score} />
                    {lead.logoUrl ? (
                      <RealLogo url={lead.logoUrl} alt={lead.organizationName || lead.owner} size={24} />
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground border border-border/40">
                        {(lead.organizationName || lead.owner || "C").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpen(lead.id)}
                          className="block truncate text-left font-medium hover:underline"
                        >
                          {lead.address}, {lead.city}
                        </button>
                        {lead.websiteUrl && (
                          <a
                            href={lead.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-0.5 shrink-0"
                            title={lead.websiteUrl}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Website</span>
                            <ExternalLink className="size-2.5 opacity-60" />
                          </a>
                        )}
                      </div>
                      <span className="block truncate text-xs text-muted-foreground">
                        {lead.organizationName || lead.owner || "Owner not on record"} · {num(lead.roofSqft)} sq ft · nearest SPC {lead.hailInches}&quot; · {lead.permitStatus}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <TierBadge tier={lead.tier} hail={lead.hailInches} />
                    </span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpen(lead.id)}
                        className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs hover:bg-muted transition-colors"
                      >
                        Open dossier
                      </button>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => onAdd(lead.id)}
                        className={cn(
                          "inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                          added
                            ? "border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 text-[#B4E4D6]"
                            : "bg-white text-neutral-950 hover:bg-neutral-100"
                        )}
                      >
                        {added ? "In pipeline" : "Add to pipeline"}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {selected && (
          <div ref={recordRef} className={`scroll-mt-2 ${hlClass(highlight, "record")}`}>
            <MockDossier lead={selected} onClose={onCloseRecord} onAdd={onAdd} inPipeline={inPipeline(selected.id)} />
          </div>
        )}

        <p className="text-sm text-muted-foreground pt-1">
          <button
            type="button"
            onClick={() => onNavigate("/competitors")}
            className="font-medium text-foreground hover:underline"
          >
            Apex Roofing
          </button>{" "}
          pulled 34% of permits here.
        </p>
      </div>
    </div>
  );
}

function MockDossier({
  lead,
  onClose,
  onAdd,
  inPipeline,
}: {
  lead: MockLead;
  onClose: () => void;
  onAdd: (id: string) => void;
  inPipeline: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Record · {lead.city === "Dallas" ? "Dallas Central Appraisal District" : "Tarrant Appraisal District"} · {lead.account}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-base font-semibold sm:text-lg">{lead.address}</h3>
            {lead.websiteUrl && (
              <a
                href={lead.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span>Website</span>
                <ExternalLink className="size-3 opacity-60" />
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.city}, TX · {lead.stories} stor{lead.stories === 1 ? "y" : "ies"} · {lead.propertyType}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-border lg:border-r lg:border-b-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lead.aerial}
            alt={`Aerial view of ${lead.address}`}
            className="aspect-[4/3] w-full object-cover"
          />
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Satellite aerial · {lead.aerialDate} · not a damage claim
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ScorePill score={lead.score} />
            <TierBadge tier={lead.tier} hail={lead.hailInches} />
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" /> Verified checks
            </span>
          </div>

          {lead.decisionMaker && (
            <div className="rounded-md border border-border bg-muted/30 p-2.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <UserRound className="size-3.5 text-[#DE7272]" />
                Decision Maker: {lead.decisionMaker}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lead.decisionTitle || "Owner"} · {lead.organizationName || lead.owner}
              </p>
            </div>
          )}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Owner of record" value={lead.owner} />
            <Item label="Mailing address" value={lead.ownerMail} />
            <Item label="Year built" value={String(lead.yearBuilt)} />
            <Item label="Market value" value={usd(lead.value)} />
            <Item label="Roof size" value={`${num(lead.roofSqft)} sq ft`} />
            <Item label="Permit status" value={lead.permitStatus} />
          </dl>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Nearest hail report</p>
            <p className="mt-0.5 font-medium">
              {lead.hailInches}&quot; SPC · {lead.hailMiles} mi · {lead.hailDate}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={inPipeline}
              onClick={() => onAdd(lead.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors disabled:opacity-50",
                inPipeline
                  ? "border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 text-[#B4E4D6]"
                  : "bg-white text-neutral-950 hover:bg-neutral-100"
              )}
            >
              {inPipeline ? "In pipeline" : "Add to pipeline"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPipeline({
  city,
  pipeline,
  highlight,
  onOpen,
  onStage,
  onAdd,
}: {
  city: MockCity;
  pipeline: PipelineRow[];
  highlight: TourHighlight;
  onOpen: (id: string) => void;
  onStage: (id: string, stage: PipelineStage) => void;
  onAdd: (id: string) => void;
}) {
  const rows = pipeline
    .map((row) => ({ row, lead: leadById(row.leadId) }))
    .filter((x): x is { row: PipelineRow; lead: MockLead } => x.lead != null && x.lead.city === city);

  const available = leadsForCity(city).filter((l) => !pipeline.some((p) => p.leadId === l.id));

  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">Opportunity pipeline</h2>
        <p className="text-xs text-muted-foreground">
          {city} · {rows.length} building{rows.length === 1 ? "" : "s"} in chase
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Nothing in the {city} pipeline yet.</p>
          {available[0] && (
            <button
              type="button"
              onClick={() => onAdd(available[0].id)}
              className="mt-3 inline-flex h-8 items-center rounded-md bg-red-600 px-3 text-xs font-medium text-white"
            >
              Add {available[0].address}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Address</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium text-right">Sq ft</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, lead }, index) => (
                <tr
                  key={lead.id}
                  className={`border-b border-border ${
                    highlight === "pipeline" && index === 0 ? hlClass(highlight, "pipeline") : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <ScorePill score={lead.score} />
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    <button type="button" className="hover:underline" onClick={() => onOpen(lead.id)}>
                      {lead.address}
                    </button>
                  </td>
                  <td className="max-w-36 truncate px-4 py-3">{lead.owner}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{num(lead.roofSqft)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={row.stage}
                      onChange={(e) => onStage(lead.id, e.target.value as PipelineStage)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(lead.id)}
                      className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs hover:bg-muted"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {available.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs text-muted-foreground">Add from released list</p>
          <div className="flex flex-wrap gap-2">
            {available.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => onAdd(lead.id)}
                className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs hover:bg-muted"
              >
                + {lead.address}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MockMap({
  city,
  selectedId,
  highlight,
  onSelect,
  onOpenLead,
}: {
  city: MockCity;
  selectedId: string | null;
  highlight: TourHighlight;
  onSelect: (id: string | null) => void;
  onOpenLead: (id: string) => void;
}) {
  const [showOutside, setShowOutside] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const leads = leadsForCity(city);
  const exposed = leads.filter((l) => l.tier !== "outside");
  const unresolved = exposed; // demo leads are unresolved (no post-storm roof permit)
  const selected = leadById(selectedId) ?? null;
  const focus = useMemo(
    () => (city === "Fort Worth" ? { lat: 32.74, lng: -97.35 } : { lat: 32.92, lng: -96.82 }),
    [city],
  );

  const points: MapPoint[] = useMemo(() => {
    const buildings: MapPoint[] = [
      ...exposed.map((lead) => ({
        id: lead.id,
        lng: lead.lng,
        lat: lead.lat,
        state: "unresolved" as const,
        title: `${lead.address} · score ${lead.score}`,
      })),
      ...(showOutside && city === "Dallas"
        ? [
            {
              id: MOCK_OUTSIDE_LEAD.id,
              lng: MOCK_OUTSIDE_LEAD.lng,
              lat: MOCK_OUTSIDE_LEAD.lat,
              state: "outside" as const,
              title: `${MOCK_OUTSIDE_LEAD.address} · outside swath`,
            },
          ]
        : []),
    ];
    const reports: MapPoint[] =
      city === "Dallas"
        ? MOCK_STORM.reports.map((r) => ({
            id: r.id,
            lng: r.lng,
            lat: r.lat,
            state: "custom" as const,
            color: "#38bdf8",
            title: `${r.inches}" ${r.qualifier === "M" ? "measured" : "estimated"} hail · ${r.city} · ${r.source}`,
          }))
        : [
            {
              id: "fw-spc-1",
              lng: -97.332,
              lat: 32.76,
              state: "custom" as const,
              color: "#38bdf8",
              title: `1.5" estimated hail · Fort Worth · SPC`,
            },
            {
              id: "fw-spc-2",
              lng: -97.4,
              lat: 32.69,
              state: "custom" as const,
              color: "#38bdf8",
              title: `1.25" estimated hail · Fort Worth · SPC`,
            },
          ];
    return [...buildings, ...reports];
  }, [exposed, showOutside, city]);

  const pipelineValue = unresolved.reduce((s, l) => s + Math.round(l.roofSqft * 8.5), 0);

  return (
    <div className={`flex h-full min-h-0 flex-col lg:min-h-[420px] lg:flex-row ${hlClass(highlight, "map")}`}>
      <div className="relative min-h-[280px] flex-1">
        <DepoiiMap
          storm={
            city === "Dallas"
              ? MOCK_STORM
              : {
                  ...MOCK_STORM,
                  id: "mock-fw-2024-03-14",
                  name: "Fort Worth cell · Mar 14, 2024",
                  shortName: "FW Mar 14",
                  center: [-97.35, 32.74],
                  warnings: [],
                  reports: [],
                }
          }
          focus={focus}
          points={points}
          selectedId={selectedId}
          onSelect={onSelect}
          className="absolute inset-0"
          // Extra top padding so the settled zoom sits below the storm overlay
          viewPadding={{ top: 140, bottom: 36, left: 36, right: 36 }}
        />
        <div className="pointer-events-none absolute top-3 right-14 left-3 z-10 max-w-sm">
          <div className="pointer-events-auto space-y-3 rounded-lg border border-border bg-background/90 p-3 shadow-xl backdrop-blur">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium tracking-widest text-red-400 uppercase">Storm</p>
                <p className="text-sm leading-tight font-semibold">
                  {city === "Dallas" ? MOCK_STORM.name : "Fort Worth cell · Mar 14, 2024"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              >
                {panelOpen ? "Hide" : "Show"}
              </button>
            </div>
            {panelOpen && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {city === "Dallas"
                    ? `${MOCK_STORM.reportCount} hail reports. Largest warning hail tag: ${MOCK_STORM.maxHailTag}".`
                    : `${exposed.length} exposed Fort Worth roofs · 2 nearby SPC hail points.`}
                </p>
                <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                  Demo storm · same map engine as the signed-in Hail Map
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MapStat label="Exposed" value={exposed.length} />
                  <MapStat label="Unresolved" value={unresolved.length} accent />
                  <MapStat label="Pipeline" value={usd(pipelineValue, true)} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <MapLegend cls="border-amber-500 bg-amber-500/50" label="NWS warning" />
                  <MapLegend cls="border-red-500 bg-red-600/60" label={'Warning with 2"+ hail'} />
                  <MapLegend cls="rounded-full bg-sky-400" label="Hail report" />
                  <MapLegend cls="rounded-full bg-red-500" label="No roof permit since" />
                  <MapLegend cls="rounded-full bg-slate-500" label="Permit filed" />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showOutside}
                    onChange={(e) => setShowOutside(e.target.checked)}
                    className="accent-red-500"
                  />
                  Show unexposed pilot parcels
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      <aside className="w-full border-t border-border bg-card/30 lg:w-[280px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        {selected ? (
          <div className="space-y-3 p-4">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← All exposed properties
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.aerial}
              alt={`Aerial of ${selected.address}`}
              className="aspect-[4/3] w-full rounded-md border border-border object-cover"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{selected.address}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.city}, TX · {num(selected.roofSqft)} sq ft
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <TierBadge tier={selected.tier} hail={selected.hailInches || undefined} />
                </div>
              </div>
              <ScorePill score={selected.score} className="h-9 min-w-12 text-lg" />
            </div>
            <div className="space-y-2 border-t border-border/60 pt-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Hail</p>
                <p className="font-medium">
                  {selected.tier === "outside"
                    ? "Outside the NWS warning polygons"
                    : `${selected.hailInches}" · ${selected.tier === "core" ? "core warning" : "warning polygon"}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Owner</p>
                <p className="font-medium">{selected.owner}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Permit</p>
                <p className="font-medium">{selected.permitStatus}</p>
              </div>
            </div>
            {selected.tier !== "outside" && (
              <button
                type="button"
                onClick={() => onOpenLead(selected.id)}
                className="inline-flex h-8 w-full items-center justify-center rounded-md border border-border text-xs hover:bg-muted"
              >
                Open dossier
              </button>
            )}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm font-semibold">Buildings hit</p>
            <p className="mb-3 text-xs text-muted-foreground">
              {city} buildings inside the {longDate(MOCK_STORM.date)} warning areas, highest score
              first. Click one to zoom to it.
            </p>
            {exposed.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No {city} buildings sit inside this storm.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {exposed.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(lead.id)}
                      className="flex w-full items-center gap-3 rounded-md border border-border/60 p-2.5 text-left hover:bg-muted"
                    >
                      <ScorePill score={lead.score} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{lead.address}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {lead.city} · Unresolved · {usd(Math.round(lead.roofSqft * 8.5), true)}
                        </span>
                      </span>
                      <TierBadge tier={lead.tier} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function MapStat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <p className={cn("font-mono text-base font-semibold tabular-nums", accent && "text-red-400")}>{value}</p>
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function MapLegend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm border border-transparent", cls)} />
      {label}
    </span>
  );
}

function MockOutcomes({
  outcomes,
  highlight,
  onClear,
  onRestore,
  onOpenLead,
}: {
  outcomes: typeof MOCK_OUTCOMES;
  highlight: TourHighlight;
  onClear: () => void;
  onRestore: () => void;
  onOpenLead: (id: string) => void;
}) {
  const hit = outcomes.filter((o) => o.result === "Verified damage").length;
  const hitRate = outcomes.length ? hit / outcomes.length : 0;
  const awarded = outcomes.reduce((s, o) => s + o.awarded, 0);

  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Organization"
        title="Field outcomes"
        description="What the crew found on the roof — used to calibrate, never invented."
        actions={
          outcomes.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Clear outcomes
            </button>
          ) : (
            <button
              type="button"
              onClick={onRestore}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Restore demo log
            </button>
          )
        }
      />

      {outcomes.length === 0 ? (
        <div className="mx-4 rounded-lg border border-dashed border-border p-8 text-center lg:mx-6">
          <p className="font-medium">No field outcomes logged yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a property and record what the crew found. Depoii does not invent inspection results.
          </p>
        </div>
      ) : (
        <div className={`mx-4 space-y-4 lg:mx-6 ${hlClass(highlight, "outcomes")}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Inspections logged" value={String(outcomes.length)} />
            <Stat label="Verified-damage hit rate" value={`${Math.round(hitRate * 100)}%`} />
            <Stat label="Contract value awarded" value={usd(awarded, true)} />
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Inspection log · Dallas & Fort Worth
            </div>
            <ul className="divide-y divide-border">
              {outcomes.map((o) => {
                const lead = leadById(o.leadId);
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <ScorePill score={o.predicted} />
                    <span className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => lead && onOpenLead(lead.id)}
                        className="block text-left font-medium hover:underline"
                      >
                        {lead?.address ?? o.leadId}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        {o.result} · {o.scope}
                      </span>
                    </span>
                    <span className="text-right text-xs">
                      <span className="block font-medium">{o.awarded ? usd(o.awarded, true) : "—"}</span>
                      <span className="text-muted-foreground">
                        {o.loggedBy} · {o.loggedAt}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MockRoofAging({ city, highlight }: { city: MockCity; highlight: TourHighlight }) {
  const [record, setRecord] = useState<"aged" | "never">("aged");
  const [tier, setTier] = useState("");
  const [minAge, setMinAge] = useState(15);

  const cityRoofs = useMemo(
    () => MOCK_AGING_ROOFS.filter((r) => r.city === city),
    [city],
  );

  const filtered = useMemo(() => {
    return cityRoofs.filter((r) => {
      if (record === "never" && !r.neverPermitted) return false;
      if (record === "aged" && r.neverPermitted) return false;
      if (r.age < minAge) return false;
      if (tier && r.risk !== tier) return false;
      return true;
    });
  }, [cityRoofs, record, tier, minAge]);

  const stats = agingStats(
    record === "never"
      ? cityRoofs.filter((r) => r.neverPermitted)
      : cityRoofs.filter((r) => !r.neverPermitted),
  );

  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Leads"
        title="Roof aging alarm"
        description={
          record === "never"
            ? `${city} · buildings ${minAge}+ years old with no roofing permit on record`
            : `${city} · roofs whose last permitted install is ${minAge}+ years old`
        }
      />

      <div className={`space-y-4 px-4 lg:px-6 ${hlClass(highlight, "aging")}`}>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Record
            <select
              value={record}
              onChange={(e) => setRecord(e.target.value as "aged" | "never")}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="aged">Last install is old</option>
              <option value="never">No roofing permit</option>
            </select>
          </label>
          {record === "aged" && (
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              Risk tier
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value="">Any</option>
                <option value="CRITICAL">Critical · 20+ years</option>
                <option value="HIGH">High · 15–19 years</option>
                <option value="MODERATE">Moderate · 10–14 years</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            Minimum roof age
            <select
              value={minAge}
              onChange={(e) => setMinAge(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              {[10, 15, 20, 25].map((v) => (
                <option key={v} value={v}>
                  {v}+ years
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label={record === "never" ? "No permit on record" : "Aging roofs"}
            value={num(stats.total)}
          />
          <Stat label="Replacement pipeline" value={usd(stats.pipeline, true)} />
          <Stat label="Warranty expired" value={num(stats.critical)} />
          <Stat label="Approaching term" value={num(stats.approaching)} />
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <AgeChip tone="critical" label="Critical · 20+ yrs" />
          <AgeChip tone="high" label="High · 15–19 yrs" />
          <AgeChip tone="moderate" label="Moderate · 10–14 yrs" />
          <AgeChip tone="never" label="No roofing permit" />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No roofs match these filters in the demo.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Installed</th>
                  <th className="px-3 py-2 text-right font-medium">Age</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">Roof system</th>
                  <th className="hidden px-3 py-2 font-medium xl:table-cell">Last contractor</th>
                  <th className="px-3 py-2 text-right font-medium">Est. replacement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, index) => (
                  <AgingRow key={r.id} roof={r} emphasize={highlight === "aging" && index === 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AgingRow({ roof, emphasize }: { roof: MockAgingRoof; emphasize: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        emphasize && "bg-[#c8f000]/10 outline outline-2 outline-[#c8f000] outline-offset-[-2px]",
      )}
    >
      <td className="px-3 py-2.5">
        <span className="font-medium">{roof.address}</span>
        <span className="block text-xs text-muted-foreground">
          {roof.city}
          {roof.neverPermitted
            ? " · no roofing permit on record"
            : ` · permit ${roof.permitNumber}${roof.laterPermits ? ` · ${roof.laterPermits} later` : ""}`}
        </span>
      </td>
      <td className="hidden px-3 py-2.5 md:table-cell">
        {roof.installed ? shortDate(roof.installed) : "—"}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{roof.age} yrs</td>
      <td className="px-3 py-2.5">
        <RiskBadge value={roof.risk} />
      </td>
      <td className="hidden px-3 py-2.5 lg:table-cell">{roof.roofSystem}</td>
      <td className="hidden max-w-40 truncate px-3 py-2.5 xl:table-cell">{roof.contractor}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{usd(roof.replacementCost, true)}</td>
    </tr>
  );
}

function AgeChip({
  tone,
  label,
}: {
  tone: "critical" | "high" | "moderate" | "never";
  label: string;
}) {
  const cls =
    tone === "critical"
      ? "border-red-500/50 bg-red-500/15 text-red-300"
      : tone === "high"
        ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
        : tone === "moderate"
          ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-medium", cls)}>
      {label}
    </span>
  );
}

function MockPermits({ city }: { city: MockCity }) {
  const rows = MOCK_PERMITS.filter((p) => p.city === city);
  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Prospect and enrich"
        title="Permits"
        description={`${city} municipal filings tied to commercial roofs in the demo workspace.`}
      />
      <div className="mx-4 overflow-x-auto rounded-lg border border-border lg:mx-6">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Permit</th>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Type</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Contractor</th>
              <th className="px-3 py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5">
                  <span className="font-medium">{p.permitNo}</span>
                  <span className="block text-xs text-muted-foreground">{shortDate(p.filed)}</span>
                </td>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">{p.address}</td>
                <td className="hidden px-3 py-2.5 md:table-cell">{p.type}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">{p.status}</span>
                </td>
                <td className="hidden max-w-40 truncate px-3 py-2.5 lg:table-cell">{p.contractor}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{usd(p.valuation, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockBuildings({ city, onOpen }: { city: MockCity; onOpen: (id: string) => void }) {
  const rows = MOCK_BUILDINGS.filter((b) => b.city === city);
  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Prospect and enrich"
        title="Buildings"
        description={`${num(rows.length)} ${city} commercial parcels in the demo appraisal set.`}
      />
      <div className="mx-4 space-y-2 lg:mx-6">
        {rows.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onOpen(b.id)}
            className="flex w-full items-start justify-between gap-3 rounded-lg border border-border px-3 py-3 text-left hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="font-medium">{b.address}</p>
              <p className="text-xs text-muted-foreground">
                {b.propertyType} · built {b.yearBuilt} · {b.stories} stor
                {b.stories === 1 ? "y" : "ies"}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{b.owner}</p>
            </div>
            <div className="shrink-0 text-right text-xs">
              <p className="font-mono tabular-nums font-medium">{num(b.roofSqft)} sq ft</p>
              <p className="text-muted-foreground">{usd(b.value, true)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MockContractors() {
  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Prospect and enrich"
        title="Contractors"
        description="DFW commercial roofing firms that show up on permits in the demo."
      />
      <div className="mx-4 grid gap-3 sm:grid-cols-2 lg:mx-6">
        {MOCK_CONTRACTORS.map((c) => (
          <div key={c.id} className="rounded-lg border border-border p-3">
            <p className="font-semibold">{c.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.specialty}</p>
            <dl className="mt-3 grid gap-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">License</dt>
                <dd className="font-mono">{c.license}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{c.phone}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">HQ</dt>
                <dd>{c.hq}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Jobs in demo</dt>
                <dd className="font-medium">{c.jobs}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockCompetitors() {
  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="More"
        title="Leaderboard"
        description="Who is winning commercial roof work in the demo territory."
      />
      <div className="mx-4 overflow-x-auto rounded-lg border border-border lg:mx-6">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Contractor</th>
              <th className="px-3 py-2 text-right font-medium">Wins</th>
              <th className="px-3 py-2 text-right font-medium">Bids</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Avg award</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Territory</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_COMPETITORS.map((c, i) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium">{c.name}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{c.wins}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{c.bids}</td>
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums md:table-cell">
                  {usd(c.avgAward, true)}
                </td>
                <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">{c.territory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockTeam() {
  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Organization"
        title="Team"
        description="Sample workspace members — invite-only until your pilot starts."
      />
      <div className="mx-4 overflow-hidden rounded-lg border border-border lg:mx-6">
        <ul className="divide-y divide-border">
          {MOCK_TEAM.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {m.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{m.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.role} · {m.email}
                </span>
              </span>
              <span className="text-right text-xs">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5",
                    m.status === "Active"
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {m.status}
                </span>
                <span className="mt-1 block text-muted-foreground">{m.lastActive}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MockStub({ path, onHome }: { path: string; onHome: () => void }) {
  const labels: Record<string, string> = {
    "/settings": "Settings",
    "/admin": "Super Admin",
  };
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-lg font-semibold">{labels[path] ?? path}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Account screens stay invite-only in the demo. Use the other tabs for sample leads, map, and
        field data.
      </p>
      <button
        type="button"
        onClick={onHome}
        className="mt-2 inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-muted"
      >
        Back to Overview
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium leading-snug">{value}</dd>
    </div>
  );
}
