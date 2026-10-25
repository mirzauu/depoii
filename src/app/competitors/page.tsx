"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Shield,
  AlertTriangle,
  Zap,
  MapPin,
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  Copy,
  Check,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Layers,
  X,
  Crosshair,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ProvenanceBadge } from "@/components/badges";
import { useDepoii } from "@/components/depoii-provider";
import { DepoiiMap, type MapPoint } from "@/components/depoii-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competitorStats } from "@/lib/engine/competitors";
import { contractorsFrom } from "@/lib/live/contractors";
import { ContractorLink } from "@/components/contractor-link";
import { DepoiiLoader } from "@/components/depoii-logo";
import { useEngine } from "@/components/use-engine";
import { useMe } from "@/hooks/use-me";
import { looksLikePersonName, mapLeaderboard } from "@/lib/engine-api";
import { pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LocalizedRival, EncroachmentAlert, CounterStrikeTarget } from "@/lib/competitor-intelligence";
import type { TurfProfile } from "@/lib/turf-profiler";

const RANGES = {
  "12m": { label: "Last 12 months", from: "2025-10-01" },
  storm: { label: "90 days after selected storm", from: "" },
  all: { label: "Since Jan 2023", from: "2023-01-01" },
} as const;

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

interface RecentPermit {
  id: string;
  number: string;
  issued: string;
  address: string;
  city: string;
  valuation: number;
  category: string;
  contractor: string;
  lat: number;
  lng: number;
}

export default function CompetitorsPage() {
  const { storm, storms, permits, jurisdiction } = useDepoii();
  const [activeTab, setActiveTab] = useState<"defense" | "leaderboard">("defense");

  const me = useMe();
  const isSuperAdmin = me?.platformRole === "superadmin";

  // Localized Competitor Intelligence state
  const [turf, setTurf] = useState<TurfProfile | null>(null);
  const [rivals, setRivals] = useState<LocalizedRival[]>([]);
  const [encroachments, setEncroachments] = useState<EncroachmentAlert[]>([]);
  const [turfVolume, setTurfVolume] = useState<number>(0);
  const [customerShare, setCustomerShare] = useState<number>(0);
  const [turfLoading, setTurfLoading] = useState(true);

  // Counter-Strike drawer state
  const [selectedEncroachment, setSelectedEncroachment] = useState<EncroachmentAlert | null>(null);
  const [counterStrikeTargets, setCounterStrikeTargets] = useState<CounterStrikeTarget[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // City-wide leaderboard data
  const [recent, setRecent] = useState<RecentPermit[]>([]);
  const board = useEngine("contractors/leaderboard", { jurisdiction, limit: 100 }, mapLeaderboard);
  const leaders = board.data?.contractors ?? null;

  // 1. Load Localized Competitor Defense data
  useEffect(() => {
    let cancelled = false;
    setTurfLoading(true);
    fetch("/api/organization/competitors")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) {
          setTurfLoading(false);
          return;
        }
        setTurf(data.turf || null);
        setRivals(data.rivals || []);
        setEncroachments(data.encroachments || []);
        setTurfVolume(data.totalMarketVolumeInTurf || 0);
        setCustomerShare(data.customerSharePct || 0);
        setTurfLoading(false);
      })
      .catch(() => {
        if (!cancelled) setTurfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Load Counter-Strike Targets when an alert is opened
  const openCounterStrike = (alert: EncroachmentAlert) => {
    setSelectedEncroachment(alert);
    setCsLoading(true);
    setCounterStrikeTargets([]);
    fetch(`/api/organization/counter-strike?permit=${encodeURIComponent(alert.permitNumber)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && Array.isArray(data.targets)) {
          setCounterStrikeTargets(data.targets);
        }
        setCsLoading(false);
      })
      .catch(() => setCsLoading(false));
  };

  // 3. City-wide permit history
  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(jurisdiction);
    setRecent([]);
    fetch(`/api/permits?jurisdiction=${q}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((jobs) => {
        if (cancelled) return;
        const rows = Array.isArray(jobs?.permits) ? (jobs.permits as RecentPermit[]) : [];
        setRecent(rows.filter((p) => p.contractor && !looksLikePersonName(p.contractor)));
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jurisdiction]);

  const [today, setToday] = useState("2026-10-18");
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  const [rangeKey, setRangeKey] = useState<keyof typeof RANGES>("all");
  const contractors = useMemo(() => contractorsFrom(permits), [permits]);

  const range = useMemo(() => {
    if (rangeKey === "storm") {
      const end = new Date(new Date(storm.date).getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
      return { from: storm.date, to: end < today ? end : today };
    }
    return { from: RANGES[rangeKey].from, to: today };
  }, [rangeKey, storm, today]);

  const stats = useMemo(
    () => competitorStats(permits, contractors, storms, range),
    [permits, contractors, storms, range],
  );
  const active = stats.filter((s) => s.permits > 0);
  const totalPermits = active.reduce((s, c) => s + c.permits, 0);
  const totalValue = active.reduce((s, c) => s + c.filingValue, 0);

  const velocity = useMemo(() => {
    const months = stats[0]?.monthly.map((m) => m.month) ?? [];
    const top = stats.slice(0, 8);
    return months.map((m, i) => ({
      month: m,
      ...Object.fromEntries(top.map((s) => [s.contractor.id, s.monthly[i].permits])),
    }));
  }, [stats]);

  const points: MapPoint[] = permits
    .filter((p) => p.contractorId && p.kind !== "new-commercial" && p.issued >= range.from && p.issued <= range.to)
    .map((p) => ({
      id: p.id,
      lng: p.lng,
      lat: p.lat,
      state: "custom",
      color: contractors.find((c) => c.id === p.contractorId)?.color,
      title: `${p.contractorName} · ${p.permitNo} · ${usd(p.valuation)}`,
    }));

  const copyScript = (target: CounterStrikeTarget, alert: EncroachmentAlert) => {
    const text = `Hi, our project manager and roofing crews are finishing a job near ${alert.jobAddress.split(",")[0]} this week. While our boom lift is mobilized in the neighborhood, we can conduct a complimentary commercial roof scan for ${target.address}.`;
    navigator.clipboard.writeText(text);
    setCopiedId(target.parcelId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Page Header */}
      <PageHeader
        eyebrow="Decision 5 · Market Intelligence & Defense"
        title="Competitor War Room"
        description="Monitor rival contractor activity, track encroachment inside your core postal sectors, and launch immediate counter-strike campaigns."
        actions={
          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="inline-flex rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#121319] p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("defense")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors",
                  activeTab === "defense"
                    ? "bg-white dark:bg-[#0b0c10] text-neutral-900 dark:text-white shadow-sm font-semibold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <Shield className="size-3.5 text-emerald-600 dark:text-[#B4E4D6]" />
                <span>Turf Defense & Rivals</span>
                {encroachments.length > 0 && (
                  <span className="size-1.5 rounded-full bg-[#DE7272]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("leaderboard")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors",
                  activeTab === "leaderboard"
                    ? "bg-white dark:bg-[#0b0c10] text-neutral-900 dark:text-white shadow-sm font-semibold"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                <TrendingUp className="size-3.5 text-neutral-500" />
                <span>Metro Leaderboard</span>
              </button>
            </div>

            {activeTab === "leaderboard" && (
              <select
                value={rangeKey}
                onChange={(e) => setRangeKey(e.target.value as keyof typeof RANGES)}
                className="h-8 rounded-md border border-border dark:border-neutral-800 bg-background dark:bg-[#0f1015] px-2 text-xs text-neutral-800 dark:text-neutral-200 outline-none"
              >
                {Object.entries(RANGES).map(([k, r]) => (
                  <option key={k} value={k}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {/* ─── TAB 1: TURF DEFENSE & RIVALS ──────────────────────────── */}
      {activeTab === "defense" && (
        <div className="space-y-5 px-4 lg:px-8">
          {/* Unlinked Organization Notice */}
          {!turf && !turfLoading && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#121319] p-4 text-xs text-neutral-700 dark:text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88]">
                  <Shield className="size-4" />
                </div>
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    Super Admin Verification Required
                  </span>
                  <p className="mt-0.5 text-muted-foreground dark:text-neutral-400">
                    Municipal contractor verification is managed exclusively by Depoii Super Admins. Once linked, Depoii automatically tracks your core stronghold ZIPs, competitor encroachments within 2,500 ft of your past jobs, and neighborhood counter-strike targets.
                  </p>
                </div>
              </div>
              {isSuperAdmin ? (
                <Link
                  href="/admin/organizations"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#B4E4D6]/50 bg-[#B4E4D6]/15 hover:bg-[#B4E4D6]/25 text-emerald-900 dark:text-[#B4E4D6] px-3 py-1.5 text-xs font-semibold transition-colors shadow-sm"
                >
                  <span>Link in Admin Console</span>
                  <ChevronRight className="size-3" />
                </Link>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded border border-border">
                  Contact Super Admin to Link
                </span>
              )}
            </div>
          )}

          {/* Linked Contractor Turf Strip */}
          {turf && (
            <div className="rounded-lg border border-border dark:border-neutral-800 bg-card dark:bg-[#0e0f14] p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 dark:border-neutral-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-[#B4E4D6]" />
                  <span className="text-xs text-muted-foreground dark:text-neutral-400 font-medium">Defending Base:</span>
                  <strong className="text-xs font-semibold text-foreground dark:text-white">
                    {turf.contractorName}
                  </strong>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground dark:text-neutral-400">Stronghold Sectors:</span>
                  {turf.primaryZips.map((zip) => (
                    <span
                      key={zip}
                      className="inline-flex items-center gap-1 rounded border border-[#B4E4D6]/50 bg-[#B4E4D6]/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-[#B4E4D6]"
                    >
                      {zip}
                    </span>
                  ))}
                  {turf.expansionZips.length > 0 && (
                    <span className="text-[11px] text-muted-foreground dark:text-neutral-500 ml-1">
                      (Expansion: {turf.expansionZips.join(", ")})
                    </span>
                  )}
                </div>
              </div>

              {/* Minimal Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1 text-left">
                <div className="rounded-md border border-border/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#121319]/60 px-3 py-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
                    Your Core Volume
                  </span>
                  <p className="text-sm font-bold text-foreground dark:text-white mt-0.5">
                    {turf.totalHistoricalVolumeFormatted}
                  </p>
                  <span className="text-[10px] text-muted-foreground dark:text-neutral-400">
                    {turf.totalHistoricalJobs} verified municipal permits
                  </span>
                </div>

                <div className="rounded-md border border-border/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#121319]/60 px-3 py-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
                    Your Average Ticket
                  </span>
                  <p className="text-sm font-bold text-foreground dark:text-white mt-0.5">
                    {turf.avgTicketSizeFormatted}
                  </p>
                  <span className="text-[10px] text-muted-foreground dark:text-neutral-400">
                    {turf.primaryRoofSystem}
                  </span>
                </div>

                <div className="rounded-md border border-border/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#121319]/60 px-3 py-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
                    Sector Market Share
                  </span>
                  <p className="text-sm font-bold text-emerald-700 dark:text-[#B4E4D6] mt-0.5">
                    {customerShare > 0 ? `${customerShare}%` : "<1%"}
                  </p>
                  <span className="text-[10px] text-muted-foreground dark:text-neutral-400">
                    of {usd(turfVolume, true)} in your ZIPs
                  </span>
                </div>

                <div className="rounded-md border border-border/70 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#121319]/60 px-3 py-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-neutral-400">
                    Commercial Low-Slope Mix
                  </span>
                  <p className="text-sm font-bold text-amber-700 dark:text-[#FFCA88] mt-0.5">
                    {turf.commercialPercentage}%
                  </p>
                  <span className="text-[10px] text-muted-foreground dark:text-neutral-400">
                    Opportunity to scale into TPO
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Live Encroachment Radar */}
          <div className="rounded-lg border border-border dark:border-neutral-800 bg-card dark:bg-[#0e0f14] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/70 dark:border-neutral-800/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md border border-[#DE7272]/50 bg-[#DE7272]/15 text-[#DE7272]">
                  <AlertTriangle className="size-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground dark:text-white">
                    Live Encroachment Radar
                  </h3>
                  <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                    Competitor filings detected within your core ZIPs or within 2,500 ft of your past jobs
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-border dark:border-neutral-800 bg-neutral-100 dark:bg-[#14151e] px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground dark:text-neutral-400">
                {encroachments.length} Active Threat{encroachments.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="divide-y divide-border/60 dark:divide-neutral-800/60">
              {encroachments.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground dark:text-neutral-400">
                  <Shield className="mx-auto size-8 text-neutral-400 dark:text-neutral-600 mb-2" />
                  <p className="font-medium text-foreground dark:text-neutral-300">
                    No competitor encroachments detected in your core ZIPs in the last 90 days.
                  </p>
                  <p className="mt-0.5 text-muted-foreground dark:text-neutral-500">
                    Your territory shield is active across {turf?.primaryZips.join(", ") || "Dallas"}.
                  </p>
                </div>
              ) : (
                encroachments.map((a) => {
                  const isCrit = a.threatTier === "CRITICAL";
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-neutral-50 dark:hover:bg-[#121319]/70 transition-colors",
                        isCrit && "bg-rose-500/[0.02]"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                              isCrit
                                ? "border-[#DE7272]/50 bg-[#DE7272]/15 text-red-800 dark:text-[#DE7272]"
                                : "border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88]"
                            )}
                          >
                            {isCrit ? "CRITICAL ENCROACHMENT" : "SECTOR TRESPASSING"}
                          </span>

                          <span className="text-xs font-semibold text-foreground dark:text-neutral-100">
                            {a.competitorName}
                          </span>

                          <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200">
                            {a.valuationFormatted}
                          </span>

                          <span className="text-[11px] text-muted-foreground dark:text-neutral-500">
                            · Permit #{a.permitNumber}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground dark:text-neutral-400 flex items-center gap-1.5">
                          <MapPin className="size-3 text-neutral-400 shrink-0" />
                          <span>{a.jobAddress}</span>
                          <span className="text-muted-foreground/60 dark:text-neutral-500">
                            ({a.zipCode})
                          </span>
                        </p>

                        <p className="text-[11px] font-medium text-amber-700 dark:text-[#FFCA88]">
                          {a.threatReason}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openCounterStrike(a)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#FFCA88]/50 bg-[#FFCA88]/15 hover:bg-[#FFCA88]/25 text-amber-900 dark:text-[#FFCA88] px-3 text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                        >
                          <Zap className="size-3" />
                          <span>Launch Counter-Strike</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: Localized True Rivals in Your Core ZIPs */}
          <div className="rounded-lg border border-border dark:border-neutral-800 bg-card dark:bg-[#0e0f14] shadow-sm overflow-hidden">
            <div className="border-b border-border/70 dark:border-neutral-800/80 px-4 py-3">
              <h3 className="text-xs font-semibold text-foreground dark:text-white">
                Rivals Competing in Your Core Sector ({turf?.primaryZips.join(", ") || "Dallas"})
              </h3>
              <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                Contractors with active permit volume inside your specific postal routes, ranked by market impact
              </p>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 dark:border-neutral-800">
                  <TableHead className="pl-4 text-xs font-semibold">Competitor</TableHead>
                  <TableHead className="text-xs font-semibold">Threat Classification</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Sector Jobs</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Filing Volume</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Sector Share</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Avg Ticket</TableHead>
                  <TableHead className="pr-4 text-xs font-semibold text-right">Recent Turf Jobs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs divide-y divide-border/40 dark:divide-neutral-800/60">
                {rivals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No competitor permit data indexed for your core ZIPs yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rivals.map((r) => {
                    const isPoacher = r.threatTier === "COMMERCIAL_POACHER";
                    const isRival = r.threatTier === "DIRECT_RIVAL";
                    return (
                      <TableRow key={r.contractorName} className="hover:bg-neutral-50 dark:hover:bg-[#121319]">
                        <TableCell className="pl-4 font-medium text-foreground dark:text-neutral-100">
                          <ContractorLink name={r.contractorName} />
                        </TableCell>

                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                              isPoacher
                                ? "border-[#DE7272]/50 bg-[#DE7272]/15 text-red-800 dark:text-[#DE7272]"
                                : isRival
                                  ? "border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88]"
                                  : "border-border bg-muted/60 text-muted-foreground"
                            )}
                          >
                            {isPoacher ? "COMMERCIAL POACHER" : isRival ? "DIRECT PEER RIVAL" : "SECTOR RIVAL"}
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {r.coreZipJobs}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold tabular-nums text-foreground dark:text-neutral-200">
                          {r.coreZipVolumeFormatted}
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                          {r.marketSharePct}%
                        </TableCell>

                        <TableCell className="text-right font-mono tabular-nums">
                          {r.avgTicketFormatted}
                        </TableCell>

                        <TableCell className="pr-4 text-right">
                          {r.recentFilingsInTurf.length > 0 ? (
                            <span className="text-[11px] text-muted-foreground dark:text-neutral-400">
                              {r.recentFilingsInTurf[0].address.split(",")[0]}
                              {r.recentFilingsInTurf.length > 1 && ` (+${r.recentFilingsInTurf.length - 1} more)`}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: METRO LEADERBOARD (Original Citywide Analytics) ── */}
      {activeTab === "leaderboard" && (
        <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-8">
          <Card className="border-border dark:border-neutral-800 bg-card dark:bg-[#0e0f14]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center justify-between gap-2">
                <span>Estimated Permit Share</span>
                <ProvenanceBadge kind="depoii-modeled" />
              </CardTitle>
              <CardDescription className="text-xs">
                {leaders?.length
                  ? `${leaders.length} engine-ranked contractors · ${usd(
                      leaders.reduce((s, c) => s + c.valuation, 0),
                      true
                    )} permitted value`
                  : `${totalPermits} roofing permits · ${usd(totalValue, true)} city filing value`}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {(leaders ?? active).length === 0 ? (
                <p className="grid h-full place-items-center text-xs text-muted-foreground">
                  No roofing permits in this window.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      (leaders ?? []).length
                        ? leaders!.map((s) => ({
                            name: s.name,
                            volume: +(s.share * 100).toFixed(1),
                            value: +(s.share * 100).toFixed(1),
                          }))
                        : active.map((s) => ({
                            name: s.contractor.name,
                            volume: +(s.shareByVolume * 100).toFixed(1),
                            value: +(s.shareByValue * 100).toFixed(1),
                          }))
                    }
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" unit="%" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="volume" name="Share %" fill="#B4E4D6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border dark:border-neutral-800 bg-card dark:bg-[#0e0f14]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">Permit Velocity</CardTitle>
              <CardDescription className="text-xs">
                Monthly filings by contractor across {jurisdiction}.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocity}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} minTickGap={24} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} width={24} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {stats
                    .slice(0, 8)
                    .map((s) => s.contractor)
                    .map((c) => (
                      <Line
                        key={c.id}
                        type="monotone"
                        dataKey={c.id}
                        name={c.name}
                        stroke={c.color}
                        dot={false}
                        strokeWidth={1.75}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Leaderboard Table */}
          <Card className="lg:col-span-2 border-border dark:border-neutral-800 bg-card dark:bg-[#0e0f14]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">Dallas Metro Leaderboard</CardTitle>
              <CardDescription className="text-xs">
                {leaders == null
                  ? "Asking data engine..."
                  : `${leaders.length} contractors in ${jurisdiction}, ranked by permitted valuation.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/70 dark:border-neutral-800">
                    <TableHead className="pl-6 text-xs font-semibold">Contractor</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Permits</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Share</TableHead>
                    <TableHead className="hidden text-right sm:table-cell text-xs font-semibold">
                      City Filing Value
                    </TableHead>
                    <TableHead className="pr-6 text-xs font-semibold">Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs divide-y divide-border/40 dark:divide-neutral-800/60">
                  {(leaders ?? []).map((s) => (
                    <TableRow key={s.id} className="hover:bg-neutral-50 dark:hover:bg-[#121319]">
                      <TableCell className="pl-6">
                        <ContractorLink name={s.name} />
                        <span className="block pl-7 text-[11px] text-muted-foreground">
                          {s.roofSystem || "Roof system not stated"}
                          {s.license ? ` · license ${s.license}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{s.permits}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {s.share > 0 ? pct(s.share, 1) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                        {usd(s.valuation, true)}
                      </TableCell>
                      <TableCell className="pr-6 text-xs">
                        <Link
                          href={`/contractors/${encodeURIComponent(s.name)}`}
                          className="text-primary hover:underline font-medium"
                        >
                          Profile →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {leaders == null && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <DepoiiLoader label="Asking the data engine…" className="py-8" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── COUNTER-STRIKE SLIDE-OVER DRAWER ─────────────────────── */}
      {selectedEncroachment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]">
          <div className="w-full max-w-xl bg-background dark:bg-[#0e0f14] border-l border-border dark:border-neutral-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-border/80 dark:border-neutral-800/80 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-md border border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-900 dark:text-[#FFCA88]">
                  <Crosshair className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground dark:text-white">
                    Neighborhood Counter-Strike
                  </h3>
                  <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                    Target adjacent commercial roofs while rival equipment is in the area
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEncroachment(null)}
                className="rounded-md p-1.5 text-neutral-400 hover:text-foreground dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Target Rival Context Card */}
            <div className="shrink-0 bg-neutral-50/70 dark:bg-[#121319]/80 border-b border-border/60 dark:border-neutral-800/80 p-4 text-xs space-y-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground dark:text-neutral-400">
                Encroaching Jobsite Anchor
              </span>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {selectedEncroachment.competitorName}
                </span>
                <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  {selectedEncroachment.valuationFormatted}
                </span>
              </div>
              <p className="text-muted-foreground dark:text-neutral-400">
                {selectedEncroachment.jobAddress} ({selectedEncroachment.zipCode}) · Permit #{selectedEncroachment.permitNumber}
              </p>
            </div>

            {/* Target List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground dark:text-neutral-200 uppercase tracking-wider">
                  Adjacent Commercial Targets (Aged 15+ Years)
                </span>
                <span className="text-[10px] text-muted-foreground dark:text-neutral-400">
                  {counterStrikeTargets.length} candidates
                </span>
              </div>

              {csLoading ? (
                <div className="py-16 text-center">
                  <DepoiiLoader label="Scanning adjacent commercial parcels..." />
                </div>
              ) : counterStrikeTargets.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground dark:text-neutral-400">
                  No unpermitted commercial buildings 15+ years old identified in this immediate block.
                </div>
              ) : (
                counterStrikeTargets.map((t) => {
                  const isCopied = copiedId === t.parcelId;
                  return (
                    <div
                      key={t.parcelId}
                      className="rounded-lg border border-border/70 dark:border-neutral-800/80 bg-card dark:bg-[#121319] p-3.5 space-y-2.5 text-xs shadow-sm hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-foreground dark:text-white text-xs">
                            {t.address}
                          </h4>
                          <span className="text-[11px] text-muted-foreground dark:text-neutral-400">
                            {t.ownerName} · {t.propertyType}
                          </span>
                        </div>

                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border border-[#DE7272]/50 bg-[#DE7272]/15 text-red-800 dark:text-[#DE7272]">
                          Roof Age: {t.roofAgeYears}y
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] border-t border-border/50 dark:border-neutral-800/60 pt-2 font-mono">
                        <span className="text-muted-foreground dark:text-neutral-400">Est. Replacement:</span>
                        <strong className="text-foreground dark:text-neutral-200">
                          {t.estimatedReplacementFormatted}
                        </strong>
                      </div>

                      {/* Decision Maker & Contact Info */}
                      {(t.phone || t.email || t.decisionMaker) && (
                        <div className="rounded bg-neutral-100/70 dark:bg-[#161722] p-2 space-y-1 text-[11px]">
                          {t.decisionMaker && (
                            <span className="font-semibold block text-neutral-900 dark:text-neutral-200">
                              Contact: {t.decisionMaker}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-muted-foreground dark:text-neutral-400">
                            {t.phone && (
                              <a
                                href={`tel:${t.phone}`}
                                className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors"
                              >
                                <Phone className="size-3 text-[#B4E4D6]" />
                                <span>{t.phone}</span>
                              </a>
                            )}
                            {t.email && (
                              <a
                                href={`mailto:${t.email}`}
                                className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors"
                              >
                                <Mail className="size-3 text-[#FFCA88]" />
                                <span>{t.email}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => copyScript(t, selectedEncroachment)}
                          className="inline-flex h-7 items-center gap-1.5 rounded border border-border dark:border-neutral-700 bg-background dark:bg-neutral-900 px-2 text-[11px] font-medium text-foreground dark:text-neutral-300 hover:bg-muted dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="size-3 text-[#B4E4D6]" />
                              <span className="text-emerald-700 dark:text-[#B4E4D6]">Pitch Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3 text-neutral-400" />
                              <span>Copy Proximity Pitch</span>
                            </>
                          )}
                        </button>

                        <Link
                          href={`/property/${encodeURIComponent(t.parcelId)}`}
                          className="inline-flex h-7 items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-foreground dark:hover:text-white transition-colors"
                        >
                          <span>Full Dossier</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
