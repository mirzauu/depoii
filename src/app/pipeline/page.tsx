"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Lock,
  ShieldCheck,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  Bookmark,
  BookmarkCheck,
  Building2,
  X,
  Zap,
  Briefcase,
  UserCheck,
  MapPin,
  Check,
} from "lucide-react";
import { DepoiiLoader } from "@/components/depoii-logo";
import { ScorePill } from "@/components/badges";
import { RealLogo } from "@/components/real-logo";
import { Badge } from "@/components/ui/badge";
import { useDepoiiState } from "@/components/depoii-provider";
import { useEngine } from "@/components/use-engine";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ParcelDossierView } from "@/components/parcel-dossier-view";
import { Button } from "@/components/ui/button";
import { SERVED_AREAS } from "@/lib/us-areas";
import { mapBrief, type MondayBrief } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const STAGES = ["New", "Contacted", "Inspected", "Bid", "Won", "Lost"] as const;

type SharedLead = { parcelId: string; stormId: string; stage: string; assignee: string; notes: string };
type Lead = MondayBrief["opportunities"][number];
type TabFilter = "all" | "unresolved" | "saved";

const SKELETON_ROWS = [
  { addrW: "w-44", ownerW: "w-40", webW: "w-24", contactW: "w-32", mailW: "w-44", sqftW: "w-16", valW: "w-20", scoreTone: "bg-[#DE7272]/20 dark:bg-[#DE7272]/25", badge: true },
  { addrW: "w-52", ownerW: "w-48", webW: "w-28", contactW: "w-28", mailW: "w-36", sqftW: "w-14", valW: "w-18", scoreTone: "bg-[#FFCA88]/20 dark:bg-[#FFCA88]/25", badge: false },
  { addrW: "w-36", ownerW: "w-36", webW: "w-20", contactW: "w-36", mailW: "w-40", sqftW: "w-18", valW: "w-24", scoreTone: "bg-[#DE7272]/20 dark:bg-[#DE7272]/25", badge: true },
  { addrW: "w-48", ownerW: "w-44", webW: "w-32", contactW: "w-30", mailW: "w-32", sqftW: "w-16", valW: "w-16", scoreTone: "bg-[#FFCA88]/20 dark:bg-[#FFCA88]/25", badge: false },
  { addrW: "w-40", ownerW: "w-36", webW: "w-24", contactW: "w-32", mailW: "w-44", sqftW: "w-14", valW: "w-20", scoreTone: "bg-[#FFF6A9]/20 dark:bg-[#FFF6A9]/25", badge: false },
  { addrW: "w-44", ownerW: "w-40", webW: "w-28", contactW: "w-28", mailW: "w-36", sqftW: "w-20", valW: "w-22", scoreTone: "bg-[#DE7272]/20 dark:bg-[#DE7272]/25", badge: true },
  { addrW: "w-56", ownerW: "w-44", webW: "w-24", contactW: "w-34", mailW: "w-40", sqftW: "w-16", valW: "w-18", scoreTone: "bg-[#FFCA88]/20 dark:bg-[#FFCA88]/25", badge: false },
  { addrW: "w-36", ownerW: "w-32", webW: "w-20", contactW: "w-30", mailW: "w-34", sqftW: "w-14", valW: "w-16", scoreTone: "bg-[#FFF6A9]/20 dark:bg-[#FFF6A9]/25", badge: false },
  { addrW: "w-48", ownerW: "w-48", webW: "w-36", contactW: "w-36", mailW: "w-48", sqftW: "w-22", valW: "w-24", scoreTone: "bg-[#DE7272]/20 dark:bg-[#DE7272]/25", badge: true },
  { addrW: "w-42", ownerW: "w-36", webW: "w-24", contactW: "w-28", mailW: "w-38", sqftW: "w-16", valW: "w-20", scoreTone: "bg-[#FFCA88]/20 dark:bg-[#FFCA88]/25", badge: false },
  { addrW: "w-40", ownerW: "w-42", webW: "w-30", contactW: "w-32", mailW: "w-36", sqftW: "w-18", valW: "w-18", scoreTone: "bg-[#DE7272]/20 dark:bg-[#DE7272]/25", badge: false },
  { addrW: "w-36", ownerW: "w-38", webW: "w-26", contactW: "w-30", mailW: "w-42", sqftW: "w-14", valW: "w-16", scoreTone: "bg-[#FFF6A9]/20 dark:bg-[#FFF6A9]/25", badge: false },
];

function PipelineSkeletonRows() {
  return (
    <>
      {SKELETON_ROWS.map((row, i) => {
        const delay = `${i * 70}ms`;
        return (
          <tr
            key={i}
            className="border-b border-border/40 dark:border-neutral-800/40 transition-opacity"
            style={{
              opacity: Math.max(0.3, 1 - i * 0.05),
            }}
          >
            {/* Checkbox Skeleton */}
            <td className="w-10 px-3 py-3 text-center">
              <div
                style={{ animationDelay: delay }}
                className="size-3.5 mx-auto rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-200/70 dark:bg-neutral-800/80 animate-pulse"
              />
            </td>

            {/* 1. Address - Sticky Left Skeleton */}
            <td className="sticky left-10 z-10 px-3 py-0 text-[12px] font-medium whitespace-nowrap bg-[#171714] group-hover:bg-[rgb(35,35,30)] text-[#FAFAF8]">
              <div className="flex items-center gap-2">
                <div
                  style={{ animationDelay: delay }}
                  className={`h-4 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.addrW}`}
                />
                {row.badge && (
                  <div
                    style={{ animationDelay: delay }}
                    className="h-4 w-11 rounded border border-[#B4E4D6]/40 dark:border-[#B4E4D6]/30 bg-[#B4E4D6]/15 dark:bg-[#B4E4D6]/10 animate-pulse"
                  />
                )}
              </div>
            </td>

            {/* 2. Score Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
              <div
                style={{ animationDelay: delay }}
                className={`h-6 w-8 rounded-md ${row.scoreTone} animate-pulse`}
              />
            </td>

            {/* 3. Owner Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[260px] whitespace-nowrap">
              <div className="flex items-center gap-2">
                <div
                  style={{ animationDelay: delay }}
                  className="size-5 rounded-full bg-neutral-200 dark:bg-neutral-800/90 animate-pulse shrink-0"
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <div
                    style={{ animationDelay: delay }}
                    className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.ownerW}`}
                  />
                  <div
                    style={{ animationDelay: delay }}
                    className={`h-2.5 rounded bg-neutral-200/70 dark:bg-neutral-800/60 animate-pulse ${row.webW}`}
                  />
                </div>
              </div>
            </td>

            {/* 4. Contact / Decision maker Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[280px] whitespace-nowrap">
              <div className="flex flex-col gap-1.5">
                <div
                  style={{ animationDelay: delay }}
                  className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.contactW}`}
                />
                <div className="flex items-center gap-1.5">
                  <div
                    style={{ animationDelay: delay }}
                    className="h-4 w-18 rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300/80 dark:border-neutral-700/80 animate-pulse"
                  />
                  <div
                    style={{ animationDelay: delay }}
                    className="h-4 w-18 rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300/80 dark:border-neutral-700/80 animate-pulse"
                  />
                </div>
              </div>
            </td>

            {/* 5. Mailing address Skeleton */}
            <td className="px-3 py-2 h-14 align-middle text-[12px] max-w-64 truncate whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse ${row.mailW}`}
              />
            </td>

            {/* 6. City Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
              <div
                style={{ animationDelay: delay }}
                className="h-3.5 w-14 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse"
              />
            </td>

            {/* 7. Sq ft Skeleton */}
            <td className="px-3 py-2 h-14 align-middle text-[12px] text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse ${row.sqftW}`}
              />
            </td>

            {/* 8. Year built Skeleton */}
            <td className="px-3 py-2 h-14 align-middle text-[12px] text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-3.5 w-10 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse"
              />
            </td>

            {/* 9. Hail Skeleton */}
            <td className="px-3 py-2 h-14 align-middle text-[12px] text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-3.5 w-10 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse"
              />
            </td>

            {/* 10. Warning Tier Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
              <div
                style={{ animationDelay: delay }}
                className="h-4 w-14 rounded-full bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse"
              />
            </td>

            {/* 11. Permit Status Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
              <div
                style={{ animationDelay: delay }}
                className="h-5 w-20 rounded-full border border-neutral-300 dark:border-neutral-700/70 bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse"
              />
            </td>

            {/* 12. Est. Value Skeleton */}
            <td className="px-3 py-2 h-14 align-middle text-[12px] text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 ml-auto animate-pulse ${row.valW}`}
              />
            </td>

            {/* 13. Stage Skeleton */}
            <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
              <div
                style={{ animationDelay: delay }}
                onClick={(e) => e.stopPropagation()} className="h-7 w-28 rounded-md border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#14151b] animate-pulse"
              />
            </td>

            {/* 14. Actions Skeleton */}
            <td className="px-3 py-2 h-14 align-middle text-[12px] pr-4 text-right whitespace-nowrap">
              <div className="inline-flex items-center gap-1.5 ml-auto">
                <div
                  style={{ animationDelay: delay }}
                  className="size-6 rounded border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
                <div
                  style={{ animationDelay: delay }}
                  className="size-6 rounded border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
                <div
                  style={{ animationDelay: delay }}
                  className="h-7 w-20 rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
              </div>
            </td>
          </tr>
        );
      })}

      {/* Trailing streaming indicator row */}
      <tr>
        <td colSpan={15} className="py-6 text-center bg-transparent">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/70 text-xs text-neutral-500 dark:text-neutral-400 shadow-sm">
            <span className="size-2 rounded-full bg-[#B4E4D6] animate-ping" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Streaming commercial pipeline records...</span>
          </div>
        </td>
      </tr>
    </>
  );
}

export default function PipelinePage() {
  const { jurisdiction, setJurisdiction } = useDepoiiState();
  const [serverPage, setServerPage] = useState(0);
  const brief = useEngine("brief", { jurisdiction, limit: 500, offset: serverPage * 500 }, mapBrief);
  const leads = brief.data?.opportunities ?? [];

  const [previewSkeleton, setPreviewSkeleton] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has("preview_skeleton")) {
        setPreviewSkeleton(true);
      }
    }
  }, []);

  // Layout controls (referencing attached image layout & styling)
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [hideFilters, setHideFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Interactive phone & email access
  const [unlockedPhones, setUnlockedPhones] = useState<Set<string>>(new Set());
  const [unlockedEmails, setUnlockedEmails] = useState<Set<string>>(new Set());

  // Original filters state
  const [shared, setShared] = useState<SharedLead[]>([]);
  const [claims, setClaims] = useState<Map<string, { daysRemaining: number }>>(new Map());
  const [stage, setStage] = useState("");
  const [assignee, setAssignee] = useState("");
  const [minSqft, setMinSqft] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [owner, setOwner] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "sqft" | "value" | "hail">("sqft");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  const [fullDetailId, setFullDetailId] = useState<string | null>(null);
  const [fullDetailStormId, setFullDetailStormId] = useState<string | null>(null);

  // Accordion open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jurisdiction: true,
    sqft: true,
    score: true,
    owner: true,
    stage: true,
    assignee: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [outcomeFor, setOutcomeFor] = useState<Lead | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");

  const loadShared = () => {
    fetch("/api/leads")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: SharedLead[]) => setShared(Array.isArray(rows) ? rows : []))
      .catch(() => setShared([]));
  };

  const loadClaims = () => {
    fetch("/api/claims")
      .then((res) => (res.ok ? res.json() : { claims: [] }))
      .then((data) => {
        const map = new Map<string, { daysRemaining: number }>();
        for (const c of data.claims || []) {
          map.set(c.parcelId, { daysRemaining: c.daysRemaining });
        }
        setClaims(map);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadShared();
    loadClaims();
  }, []);

  const recordOf = (o: Lead) => shared.find((row) => row.parcelId === o.parcelId);

  // Search & Filter
  const q = searchQuery.trim().toLowerCase();
  const ownerQuery = owner.trim().toLowerCase();
  const assigneeQuery = assignee.trim().toLowerCase();

  const rows = useMemo(() => {
    const list = leads.filter((o) => {
      const record = shared.find((row) => row.parcelId === o.parcelId);
      if (activeTab === "unresolved" && !o.unresolved) return false;
      if (activeTab === "saved" && !record) return false;
      if (stage && (record?.stage || "New") !== stage) return false;
      if (assigneeQuery && !(record?.assignee || "").toLowerCase().includes(assigneeQuery)) return false;
      if (minSqft && o.sqft < minSqft) return false;
      if (minScore && o.score < minScore) return false;
      if (ownerQuery && !`${o.owner} ${o.organizationName || ""} ${o.ownerMail || ""}`.toLowerCase().includes(ownerQuery)) {
        return false;
      }
      if (q) {
        const hay = `${o.address} ${o.city} ${o.owner} ${o.organizationName || ""} ${o.decisionMaker || ""} ${o.parcelId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "score") return (b.score - a.score) || (b.sqft - a.sqft);
      if (sortBy === "value") return (b.value - a.value) || (b.sqft - a.sqft);
      if (sortBy === "hail") return (b.hail - a.hail) || (b.sqft - a.sqft);
      return (b.sqft - a.sqft) || (b.score - a.score);
    });
  }, [leads, activeTab, shared, stage, assigneeQuery, minSqft, minScore, ownerQuery, q, sortBy]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageIndex = Math.min(page, pageCount - 1);
  const visible = rows.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);
  const from = rows.length === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const to = Math.min(rows.length, (pageIndex + 1) * PAGE_SIZE);
  const isLoading = (brief.loading && rows.length === 0) || previewSkeleton;

  // Bulk selection
  const allSelected = visible.length > 0 && visible.every((o) => selectedIds.has(o.parcelId));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((o) => o.parcelId)));
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unlockPhone = (id: string) => {
    setUnlockedPhones((prev) => new Set(prev).add(id));
  };

  const unlockEmail = (id: string) => {
    setUnlockedEmails((prev) => new Set(prev).add(id));
  };

  const saveLead = async (o: Lead, next: Partial<SharedLead> & { stage?: string }) => {
    const current = recordOf(o);
    const stageName = next.stage || current?.stage || "New";
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parcelId: o.parcelId,
        stormId: o.stormId,
        address: o.address,
        city: o.city,
        score: o.score,
        hail: o.hail,
        price: o.value,
        stage: stageName,
        assignee: next.assignee ?? current?.assignee ?? "",
        notes: next.notes ?? current?.notes ?? "",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { promptOutcome?: boolean; error?: string };
    if (!res.ok) {
      alert(body.error || "Failed to update lead");
      return;
    }
    if (body.promptOutcome) setOutcomeFor(o);
    loadShared();
    loadClaims();
  };

  const [claimPending, setClaimPending] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);

  const claimSelected = async () => {
    const target = selectedIds.size > 0 ? rows.filter((o) => selectedIds.has(o.parcelId)) : (rows[0] ? [rows[0]] : []);
    if (target.length === 0) return;
    setClaimPending(true);
    let claimedCount = 0;
    let lastError = "";

    for (const item of target) {
      try {
        const res = await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parcelId: item.parcelId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          claimedCount++;
          saveLead(item, { stage: "Claimed" });
        } else {
          lastError = data.error || "Claim limit reached or already claimed";
        }
      } catch {
        lastError = "Network error claiming property";
      }
    }
    setClaimPending(false);
    loadClaims();
    if (claimedCount > 0) {
      setClaimSuccessMsg(`Claimed ${claimedCount} property${claimedCount > 1 ? "ies" : ""}! Locked to your company for 21 days.`);
    } else if (lastError) {
      alert(lastError);
    }
  };

  const claimOne = async (o: Lead) => {
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelId: o.parcelId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setClaimSuccessMsg(`Successfully claimed ${o.address || "property"}! Locked for 21 days.`);
        saveLead(o, { stage: "Claimed" });
        loadClaims();
      } else {
        alert(data.error || "Failed to claim property");
      }
    } catch {
      alert("Error claiming property");
    }
  };

  const clearAllFilters = () => {
    setMinSqft(0);
    setMinScore(0);
    setStage("");
    setAssignee("");
    setOwner("");
    setSearchQuery("");
    setPage(0);
  };

  const activeFiltersCount = [
    minSqft > 0,
    minScore > 0,
    Boolean(stage),
    Boolean(assignee),
    Boolean(owner),
    Boolean(searchQuery),
  ].filter(Boolean).length;


  const totalCount = brief.data?.totalOpportunities || leads.length;
  const unresolvedCount = leads.filter((l) => l.unresolved).length;
  const savedCount = shared.length;

  if (fullDetailId) {
    return (
      <div className="flex h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] flex-col bg-background dark:bg-[#0b0c0e] text-foreground dark:text-neutral-100 antialiased font-sans overflow-hidden">
        <ParcelDossierView
          parcelId={fullDetailId}
          stormId={fullDetailStormId || undefined}
          onBack={() => {
            setFullDetailId(null);
            setFullDetailStormId(null);
          }}
          backLabel="Back to Hot Sheet"
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-53px)] max-h-[calc(100dvh-53px)] flex-col bg-[#171714] text-[#FAFAF8] antialiased font-sans overflow-hidden">
      {/* Top Header Row - Fixed */}
      <div data-tour="pipeline-header" className="shrink-0 border-b border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-3.5 z-20 text-[#FAFAF8]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Hot Sheet</h1>
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/50">
                {jurisdiction}
              </span>
            </div>
            <p className="text-xs font-medium text-rose-600 dark:text-[#DE7272]">
              Manage your claimed off-market commercial targets, track property owner outreach, and organize takeoff stages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="brand"
              disabled={claimPending}
              onClick={claimSelected}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <Lock className="size-3.5" />
              <span>{claimPending ? "Claiming..." : `Add to My Claims ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Claim Success Banner */}
      {claimSuccessMsg && (
        <div className="shrink-0 flex items-center justify-between border-b border-[#B4E4D6]/30 bg-[#B4E4D6]/10 px-5 py-2 text-xs text-neutral-800 dark:text-neutral-200 z-20">
          <div className="flex items-center gap-2">
            <Check className="size-3.5 text-emerald-600 dark:text-[#B4E4D6]" />
            <span>{claimSuccessMsg}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/claims"
              className="inline-flex items-center gap-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              View in My Claims
              <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-400" />
            </Link>
            <button onClick={() => setClaimSuccessMsg(null)} className="text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:hover:text-white">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Action & Filter Sub-Bar - Fixed */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-2.5 text-xs z-20 text-[#FAFAF8]">
        {/* Left Side: Toggle Sidebar & Search */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setHideFilters((prev) => !prev)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 px-2.5 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <Filter className="size-3 text-muted-foreground dark:text-neutral-400" />
            <span>{hideFilters ? "Show Filters" : "Hide Filters"}</span>
          </button>

          {/* Search Input */}
          <div className="relative min-w-[260px] sm:min-w-[340px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search address, owner, or parcel"
              className="h-8 w-full rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#16171d] pl-8 pr-3 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none transition-colors focus:border-neutral-400 dark:focus:border-neutral-700 focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Sorting & Reset */}
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="h-8 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 px-2.5 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Reset filters ({activeFiltersCount})
            </button>
          )}

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 pl-2.5 pr-7 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white outline-none cursor-pointer"
            >
              <option value="score">⇅ Relevance (Score)</option>
              <option value="sqft">⇅ Sq ft</option>
              <option value="value">⇅ Est. Value</option>
              <option value="hail">⇅ Hail</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div data-tour="pipeline-content" className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Filter Sidebar - Fixed */}
        {!hideFilters && (
          <aside className="w-80 shrink-0 border-r border-[rgba(250,250,248,0.08)] bg-[#171714] text-[#B9B9B2] flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Segmented Count Tabs (Original Titles: All, Unresolved, Saved) */}
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[rgba(250,250,248,0.08)] bg-[#1F1F1B] p-0.5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("all");
                    setPage(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    activeTab === "all"
                      ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white border-neutral-300 dark:border-white/20 font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">All</span>
                  <span className="text-xs font-semibold">{num(totalCount)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("unresolved");
                    setPage(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    activeTab === "unresolved"
                      ? "border-[#DE7272]/40 bg-[#DE7272]/15 text-[#DE7272] dark:text-[#DE7272] font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Unresolved</span>
                  <span className="text-xs font-semibold">{num(unresolvedCount)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("saved");
                    setPage(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    activeTab === "saved"
                      ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6] font-semibold shadow-sm"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Saved</span>
                  <span className="text-xs font-semibold">{savedCount}</span>
                </button>
              </div>

              {/* Accordion Filter Items with Exact Original Headings */}
              <div className="space-y-2.5">
                {/* 1. Jurisdiction */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("jurisdiction")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Jurisdiction</span>
                    </div>
                    {openSections.jurisdiction ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.jurisdiction && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex gap-1.5">
                        {SERVED_AREAS.map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            onClick={() => {
                              setJurisdiction(a.label);
                              setPage(0);
                            }}
                            className={cn(
                              "flex-1 rounded border px-2 py-1.5 text-center text-xs font-medium transition-colors",
                              jurisdiction === a.label
                                ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold shadow-sm"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {a.city}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <select
                          value={jurisdiction}
                          onChange={(e) => {
                            setJurisdiction(e.target.value);
                            setPage(0);
                          }}
                          className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-foreground dark:text-neutral-200 outline-none focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
                        >
                          {SERVED_AREAS.map((a) => (
                            <option key={a.label} value={a.label}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground dark:text-neutral-500" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Square feet */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("sqft")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Square feet</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {minSqft > 0 && <span className="rounded bg-neutral-200 dark:bg-white/10 text-neutral-800 dark:text-white px-1 text-[10px]">1 x</span>}
                      {openSections.sqft ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.sqft && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {[0, 25_000, 50_000, 100_000, 200_000].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setMinSqft(size);
                              setPage(0);
                            }}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] transition-colors border",
                              minSqft === size
                                ? "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {size === 0 ? "Any" : `${num(size)}+`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Score */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("score")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="size-3.5 text-amber-600 dark:text-[#FFCA88]" />
                      <span>Score</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {minScore > 0 && <span className="rounded bg-amber-500/15 text-amber-700 dark:text-[#FFCA88] px-1 text-[10px]">1 x</span>}
                      {openSections.score ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.score && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {[
                          { s: 0, label: "Any", cls: "bg-neutral-900 text-white dark:bg-white/10 dark:text-white border-neutral-900 dark:border-white/20 font-semibold" },
                          { s: 40, label: "40+", cls: "border-yellow-500/40 dark:border-[#FFF6A9]/30 bg-yellow-500/15 dark:bg-[#FFF6A9]/15 text-yellow-800 dark:text-[#FFF6A9] font-semibold" },
                          { s: 60, label: "60+", cls: "border-amber-500/40 dark:border-[#FFCA88]/30 bg-amber-500/15 dark:bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88] font-semibold" },
                          { s: 80, label: "80+", cls: "border-rose-500/40 dark:border-[#DE7272]/30 bg-rose-500/15 dark:bg-[#DE7272]/15 text-rose-800 dark:text-[#DE7272] font-semibold" },
                        ].map(({ s, label, cls }) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setMinScore(s);
                              setPage(0);
                            }}
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] transition-colors border",
                              minScore === s
                                ? cls
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Owner */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("owner")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Owner</span>
                    </div>
                    {openSections.owner ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.owner && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={owner}
                        onChange={(e) => {
                          setOwner(e.target.value);
                          setPage(0);
                        }}
                        placeholder="Name"
                        className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
                      />
                    </div>
                  )}
                </div>

                {/* 5. Stage */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("stage")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                      <span>Stage</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {stage && <span className="rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 px-1 text-[10px]">1 x</span>}
                      {openSections.stage ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                    </div>
                  </button>

                  {openSections.stage && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStage("");
                            setPage(0);
                          }}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] border",
                            !stage ? "bg-neutral-900 text-white dark:bg-neutral-800 dark:text-white border-neutral-900 dark:border-neutral-700 font-semibold" : "text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          Any
                        </button>
                        {STAGES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setStage(s);
                              setPage(0);
                            }}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] border",
                              stage === s ? "bg-neutral-900 text-white dark:bg-neutral-800 dark:text-white border-neutral-900 dark:border-neutral-700 font-semibold" : "text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Assignee */}
                <div className="rounded-lg border border-[rgba(250,250,248,0.04)] bg-[#1C1C18]/60 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("assignee")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <span>Assignee</span>
                    {openSections.assignee ? <ChevronDown className="size-3 text-muted-foreground dark:text-neutral-500" /> : <ChevronRight className="size-3 text-muted-foreground dark:text-neutral-500" />}
                  </button>

                  {openSections.assignee && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={assignee}
                        onChange={(e) => {
                          setAssignee(e.target.value);
                          setPage(0);
                        }}
                        placeholder="Rep"
                        className="w-full rounded border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 py-1 text-xs text-foreground dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-[rgba(250,250,248,0.08)] p-3 bg-[#171714]">
              <button
                type="button"
                onClick={clearAllFilters}
                className="w-full rounded-md border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-3 py-2 text-xs font-medium text-[#FAFAF8] hover:bg-[#23231E] transition-colors cursor-pointer select-none"
              >
                Clear All Filters
              </button>
            </div>
          </aside>
        )}

        {/* Right Table Container with EXACT Original Column Titles */}
        <main className="min-w-0 flex-1 flex flex-col justify-between overflow-x-auto bg-[#171714] text-[#FAFAF8]">
          {/* Territory Alert */}
          {brief.data?.noActiveTerritory && (
            <div className="m-3 rounded-lg border border-amber-500/40 dark:border-[#FFCA88]/30 bg-amber-500/10 dark:bg-[#FFCA88]/10 p-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-amber-600 dark:text-[#FFCA88]" />
                <span className="text-amber-800 dark:text-[#FFCA88]">
                  {brief.data.territoryMessage || `No active territory subscription in ${jurisdiction}. Pipeline leads require a territory subscription.`}
                </span>
              </div>
              <Link href="/territory" className="font-semibold text-neutral-900 dark:text-white hover:underline">
                Subscribe to a Zone →
              </Link>
            </div>
          )}

          {/* Table Container - Only rows scroll */}
          <div className="min-w-0 flex-1 overflow-auto relative">
            {(brief.loading || previewSkeleton) && (
              <div className="sticky top-0 z-40 h-0.5 w-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div className="h-full w-1/3 bg-neutral-900 dark:bg-white animate-[shimmer-slide_1.2s_infinite_ease-in-out]" />
              </div>
            )}

            {rows.length === 0 && !isLoading ? (
              <div className="p-16 text-center text-xs text-muted-foreground dark:text-neutral-400 space-y-2">
                <p>No buildings in {jurisdiction} match these filters.</p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1 text-foreground dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <table className="w-full min-w-max text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-[#171714]">
                  {/* EXACT ORIGINAL COLUMN HEADERS - Sticky Top */}
                  <tr className="apollo-th h-[39px] border-b border-[rgba(250,250,248,0.08)] bg-[#171714] text-[11px] font-medium uppercase tracking-wider text-[#B9B9B2]">
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider w-12 px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        disabled={isLoading}
                        className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sky-500 focus:ring-0 cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="sticky left-12 top-0 z-30 bg-[#171714] px-4 py-2.5 font-medium text-[#B9B9B2] whitespace-nowrap border-b border-[rgba(250,250,248,0.08)] uppercase text-[11px] tracking-wider min-w-[280px]">Address</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[90px] text-center">
                      <button
                        type="button"
                        onClick={() => { setSortBy(sortBy === "score" ? "sqft" : "score"); setPage(0); }}
                        className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors"
                        title="Click to sort by score"
                      >
                        <span>Score</span>
                        {sortBy === "score" && <span className="text-[10px] text-amber-500">▼</span>}
                      </button>
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[260px]">Owner</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[280px]">Contact / Decision maker</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[240px]">Mailing address</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[130px]">City</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => { setSortBy(sortBy === "sqft" ? "score" : "sqft"); setPage(0); }}
                        className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors"
                        title="Click to sort by square feet"
                      >
                        <span>Sq ft</span>
                        {sortBy === "sqft" && <span className="text-[10px] text-amber-500">▼</span>}
                      </button>
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap min-w-[110px]">Year built</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap min-w-[100px]">Hail</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[120px]">Warning</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[130px]">Permit</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 text-right whitespace-nowrap min-w-[140px]">
                      <button
                        type="button"
                        onClick={() => { setSortBy(sortBy === "value" ? "sqft" : "value"); setPage(0); }}
                        className="inline-flex items-center gap-1 hover:text-foreground dark:hover:text-white transition-colors"
                        title="Click to sort by estimated value"
                      >
                        <span>Est. Value</span>
                        {sortBy === "value" && <span className="text-[10px] text-amber-500">▼</span>}
                      </button>
                    </th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 font-semibold text-neutral-800 dark:text-neutral-300 whitespace-nowrap min-w-[120px]">Stage</th>
                    <th className="sticky top-0 z-20 bg-[#171714] border-b border-[rgba(250,250,248,0.08)] text-[#B9B9B2] uppercase text-[11px] font-medium tracking-wider px-4 py-2.5 pr-4 text-right whitespace-nowrap min-w-[160px]" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60 dark:divide-neutral-800/50">
                  {isLoading ? (
                    <PipelineSkeletonRows />
                  ) : (
                    visible.map((o) => {
                    const isSelected = selectedIds.has(o.parcelId);
                    const record = recordOf(o);
                    const isSaved = Boolean(record);
                    const hasClaim = claims.has(o.parcelId);
                    const isPhoneUnlocked = unlockedPhones.has(o.parcelId);
                    const isEmailUnlocked = unlockedEmails.has(o.parcelId);
                    const href = o.parcelId
                      ? `/parcels/${encodeURIComponent(o.parcelId)}${o.stormId ? `?storm=${encodeURIComponent(o.stormId)}` : ""}`
                      : "/pipeline";

                    return (
                      <tr
                        key={o.parcelId || o.address}
                        onClick={() => {
                          if (o.parcelId) {
                            setSelectedId(o.parcelId);
                            setSelectedStormId(o.stormId || null);
                          }
                        }}
                        className={cn(
                          "apollo-row h-14 group transition-colors duration-150 cursor-pointer border-b border-[rgba(250,250,248,0.06)]",
                          isSelected
                            ? "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                            : "bg-[#171714] hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                        )}
                      >
                        {/* Checkbox with active row indicator */}
                        <td
                          className="w-12 px-4 py-0 text-center sticky left-0 z-10 bg-[#171714] group-hover:bg-[rgb(35,35,30)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(o.parcelId)}
                            className="size-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground dark:text-white focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* 1. Address - Sticky Left */}
                        <td className={cn(
                          "sticky left-12 z-10 px-4 py-2 h-14 align-middle text-[12px] font-medium whitespace-nowrap min-w-[280px] transition-colors duration-150",
                          isSelected
                            ? "bg-[rgba(255,255,255,0.06)] group-hover:bg-[rgba(255,255,255,0.10)] text-[#FAFAF8]"
                            : "bg-[#171714] group-hover:bg-[rgb(35,35,30)] text-[#FAFAF8]"
                        )}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (o.parcelId) {
                                  setSelectedId(o.parcelId);
                                  setSelectedStormId(o.stormId || null);
                                }
                              }}
                              className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-amber-800 dark:group-hover:text-amber-300 hover:underline transition-colors text-left cursor-pointer"
                            >
                              {o.address}
                            </button>
                            {hasClaim && (
                              <span className="inline-flex items-center gap-1 rounded border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-800 dark:text-[#B4E4D6] shrink-0">
                                <Lock className="size-2.5 text-emerald-700 dark:text-[#B4E4D6]" />
                                <span>{claims.get(o.parcelId)?.daysRemaining}d</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Score */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
                          <ScorePill score={o.score} />
                        </td>

                        {/* 3. Owner */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[260px] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {o.logoUrl ? (
                              <RealLogo url={o.logoUrl} alt={o.organizationName || o.owner} size={20} />
                            ) : null}
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-medium text-neutral-900 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors">
                                {o.organizationName || o.owner || "—"}
                              </span>
                              {o.websiteUrl ? (
                                <a
                                  href={o.websiteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-mono"
                                  title={o.websiteUrl}
                                >
                                  <span>{o.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                                  <ExternalLink className="size-2.5 opacity-60" />
                                </a>
                              ) : o.organizationName && o.owner && o.organizationName !== o.owner ? (
                                <span className="text-[10px] text-muted-foreground dark:text-neutral-500 truncate">{o.owner}</span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* 4. Contact / Decision maker */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[280px] whitespace-nowrap">
                          <div className="flex flex-col text-xs leading-tight gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-neutral-900 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors truncate">
                                {o.decisionMaker || "Property Contact"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Phone Access / Display */}
                              {isPhoneUnlocked ? (
                                <a
                                  href={`tel:${o.phone || ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium hover:underline inline-flex items-center gap-1"
                                  title="Click to call"
                                >
                                  <Phone className="size-2.5" />
                                  <span>{o.phone || "Available on request"}</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); unlockPhone(o.parcelId); }}
                                  className="inline-flex size-6 items-center justify-center rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                  title="Access phone number"
                                >
                                  <Phone className="size-3" />
                                </button>
                              )}

                              {/* Email Access / Display */}
                              {isEmailUnlocked ? (
                                <a
                                  href={`mailto:${o.email || ""}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-mono text-[11px] text-sky-700 dark:text-sky-400 font-medium hover:underline inline-flex items-center gap-1"
                                  title="Click to email"
                                >
                                  <Mail className="size-2.5" />
                                  <span>{o.email || "Available on request"}</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); unlockEmail(o.parcelId); }}
                                  className="inline-flex size-6 items-center justify-center rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                  title="Access email address"
                                >
                                  <Mail className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 5. Mailing address */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[240px] truncate whitespace-nowrap text-muted-foreground dark:text-neutral-400" title={o.ownerMail || "No mailing address"}>
                          {o.ownerMail || "—"}
                        </td>

                        {/* 6. City */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[130px] whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                          {o.city}
                        </td>

                        {/* 7. Sq ft */}
                        <td className="px-3 py-2 h-14 align-middle text-[12px] text-right font-mono tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                          {o.sqft ? num(o.sqft) : "—"}
                        </td>

                        {/* 8. Year built */}
                        <td className="px-3 py-2 h-14 align-middle text-[12px] text-right font-mono tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                          {o.yearBuilt || "—"}
                        </td>

                        {/* 9. Hail */}
                        <td className="px-3 py-2 h-14 align-middle text-[12px] text-right font-mono tabular-nums whitespace-nowrap text-neutral-900 dark:text-neutral-200 font-medium">
                          {o.hail ? `${o.hail}"` : "—"}
                        </td>

                        {/* 10. Warning */}
                        <td className="px-3 py-2 h-14 align-middle text-[12px] whitespace-nowrap capitalize text-neutral-700 dark:text-neutral-300">
                          {o.tier || "—"}
                        </td>

                        {/* 11. Permit */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
                          {o.permitStatus === "NON_ROOF_PERMIT_DETECTED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 dark:border-[#FFF6A9]/30 bg-yellow-500/15 dark:bg-[#FFF6A9]/10 px-2 py-0.5 text-[11px] font-medium text-yellow-800 dark:text-[#FFF6A9]" title={o.recentActivity || "Active site with non-roof tenant improvements"}>
                              <span className="size-1.5 rounded-full bg-yellow-600 dark:bg-[#FFF6A9] shrink-0" />
                              Active site
                            </span>
                          ) : o.unresolved ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 dark:border-[#DE7272]/30 bg-rose-500/15 dark:bg-[#DE7272]/10 px-2 py-0.5 text-[11px] font-medium text-rose-800 dark:text-[#DE7272]">
                              <span className="size-1.5 rounded-full bg-rose-600 dark:bg-[#DE7272] shrink-0" />
                              Unresolved
                            </span>
                          ) : (
                            <span className="text-muted-foreground dark:text-neutral-400">Roof permit filed</span>
                          )}
                        </td>

                        {/* 12. Est. Value */}
                        <td className="px-3 py-2 h-14 align-middle text-[12px] text-right font-mono tabular-nums whitespace-nowrap text-neutral-900 dark:text-neutral-100 font-medium">
                          {o.valueLow && o.valueHigh ? `${usd(o.valueLow, true)}–${usd(o.valueHigh, true)}` : usd(o.value, true)}{o.priceFlagged ? " *" : ""}
                        </td>

                        {/* 13. Stage */}
                        <td className="px-4 py-2 h-14 align-middle text-[12px] min-w-[90px] whitespace-nowrap text-center">
                          <select
                            value={record?.stage || "New"}
                            onChange={(e) => saveLead(o, { stage: e.target.value })}
                            className="h-7 w-28 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#14151b] px-2 text-xs text-foreground dark:text-neutral-200 outline-none focus:border-neutral-400 dark:focus:border-neutral-700 cursor-pointer"
                          >
                            {STAGES.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </td>

                        {/* 14. Actions */}
                        <td className="px-3 py-2 h-14 align-middle text-[12px] pr-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {claims.has(o.parcelId) ? (
                              <span className="inline-flex items-center gap-1 rounded border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-[#B4E4D6]" title={`Claimed (${claims.get(o.parcelId)?.daysRemaining}d left)`}>
                                <Lock className="size-2.5 text-emerald-700 dark:text-[#B4E4D6]" /> Claimed
                              </span>
                            ) : (
                              <button
                                type="button"
                                title="Add to My Claims (21d Lock)"
                                onClick={(e) => { e.stopPropagation(); claimOne(o); }}
                                className="p-1 hover:text-foreground dark:hover:text-white text-muted-foreground dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                              >
                                <Lock className="size-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              title={isSaved ? "Saved" : "Save lead"}
                              onClick={(e) => { e.stopPropagation(); saveLead(o, { stage: record?.stage || "New" }); }}
                              className="p-1 hover:text-neutral-700 dark:hover:text-neutral-200 text-neutral-400 dark:text-neutral-500 transition-colors"
                            >
                              {isSaved ? <BookmarkCheck className="size-3.5 text-neutral-800 dark:text-neutral-200" /> : <Bookmark className="size-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (o.parcelId) {
                                  setSelectedId(o.parcelId);
                                  setSelectedStormId(o.stormId || null);
                                }
                              }}
                              className="inline-flex h-7 items-center rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white group-hover:border-neutral-400 dark:group-hover:border-neutral-600 transition-colors cursor-pointer"
                            >
                              Open dossier
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Pagination Bar - Fixed */}
          <div className="shrink-0 flex items-center justify-between border-t border-[rgba(250,250,248,0.08)] bg-[#171714] px-5 py-3 text-xs text-[#B9B9B2] z-10">
            <div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-[#FAFAF8]">
                  <span className="size-2 rounded-full bg-[#B4E4D6] animate-ping" />
                  <span className="font-medium text-xs">Streaming {jurisdiction} commercial pipeline opportunities...</span>
                </div>
              ) : (
                <>
                  <span>
                    Showing <strong className="text-[#FAFAF8] font-medium">{from}–{to}</strong> of <strong className="text-[#FAFAF8] font-medium">{rows.length}</strong>
                  </span>
                  {brief.data && brief.data.totalOpportunities > rows.length && (
                    <span className="text-[#B9B9B2] ml-2">
                      · {num(brief.data.totalOpportunities)} in this storm
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#B9B9B2] mr-2">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={isLoading || pageIndex === 0}
                onClick={() => setPage(pageIndex - 1)}
                className="rounded border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-2.5 py-1 text-[#FAFAF8] hover:bg-[#23231E] disabled:opacity-30 cursor-pointer select-none transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={isLoading || pageIndex >= pageCount - 1}
                onClick={() => setPage(pageIndex + 1)}
                className="rounded border border-[rgba(250,250,248,0.12)] bg-[#1C1C18] px-2.5 py-1 text-[#FAFAF8] hover:bg-[#23231E] disabled:opacity-30 cursor-pointer select-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Hot Sheet Inspection Card (Right Sheet Drawer - Full Dossier Parity) */}
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) { setSelectedId(null); setSelectedStormId(null); } }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:w-[90vw] md:w-[80vw] lg:w-[65vw] xl:w-[60vw] 2xl:w-[55vw] min-w-[50vw] sm:max-w-none p-0 flex flex-col h-full overflow-hidden border-l border-border dark:border-neutral-800 shadow-2xl bg-background"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Opportunity Intelligence Dossier</SheetTitle>
            <SheetDescription>Comprehensive hail ground truth, municipal permits, and decision-maker dossier.</SheetDescription>
          </SheetHeader>
          {selectedId && (
            <ParcelDossierView
              parcelId={selectedId}
              stormId={selectedStormId || undefined}
              onBack={() => {
                setSelectedId(null);
                setSelectedStormId(null);
              }}
              onExpand={() => {
                setFullDetailId(selectedId);
                setFullDetailStormId(selectedStormId);
                setSelectedId(null);
                setSelectedStormId(null);
              }}
              backLabel="Close"
              isDrawer={true}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Outcome Form Modal */}
      {outcomeFor && (
        <form
          className="m-4 space-y-2 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#121319] p-3 text-xs"
          onSubmit={(event) => {
            event.preventDefault();
            fetch("/api/outcomes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: crypto.randomUUID(),
                parcelId: outcomeFor.parcelId,
                stormId: outcomeFor.stormId || "unknown",
                loggedAt: new Date().toISOString(),
                predictedScore: outcomeFor.score,
                factors: {},
                moistureVerified: false,
                scope: "none",
                contractValue: 0,
                notes: outcomeNote,
              }),
            }).then(() => {
              setOutcomeFor(null);
              setOutcomeNote("");
            });
          }}
        >
          <p className="text-sm font-medium text-foreground dark:text-white">Inspection outcome for {outcomeFor.address}</p>
          <textarea
            value={outcomeNote}
            onChange={(e) => setOutcomeNote(e.target.value)}
            placeholder="What did the roof show?"
            className="h-20 w-full rounded-md border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0d0e12] p-2 text-xs text-foreground dark:text-white"
          />
          <button type="submit" className="rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors">
            Save outcome
          </button>
        </form>
      )}
    </div>
  );
}
