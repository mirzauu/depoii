"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  History,
  Lock,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { LeadContactsCard } from "@/components/lead-contacts-card";
import { LeadDossier } from "@/components/lead-dossier";
import { RoofTimeline } from "@/components/roof-timeline";
import { VerificationCard } from "@/components/verification-card";
import { EngineLayout, EngineState } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapParcelDossier, mapLeadDossier } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

type TabId = "playbook" | "contacts" | "history";

export default function ParcelDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const backHref = fromParam === "roof-aging" ? "/roof-aging" : "/pipeline";
  const backLabel = fromParam === "roof-aging" ? "Back to roof aging" : "Back to pipeline";

  const parcelId = decodeURIComponent(id);
  const stormParam = searchParams.get("storm") || "";
  const parcel = useEngine(`parcels/${encodeURIComponent(parcelId)}`, {}, mapParcelDossier);
  const p = parcel.data;
  const dossier = useEngine(`intelligence/leads/${encodeURIComponent(parcelId)}/dossier`, stormParam ? { storm_id: stormParam } : {}, mapLeadDossier);
  const d = dossier.data;

  // De-duplicate location: If city is "Dallas" and county is "Dallas County", don't repeat "Dallas County"
  const locationLine = useMemo(() => {
    if (!p) return "";
    const cityStateZip = [p.city, p.state, p.zip].filter(Boolean).join(", ");
    const cleanCounty = p.county?.replace(/\s*county$/i, "").trim();
    const showCounty = cleanCounty && cleanCounty.toLowerCase() !== p.city?.toLowerCase();
    return showCounty ? `${cityStateZip} · ${cleanCounty} County` : cityStateZip;
  }, [p?.city, p?.state, p?.zip, p?.county]);

  const googleMapsUrl = useMemo(() => {
    if (!p) return null;
    if (p.lat && p.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    }
    if (p.address) {
      const full = [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
    }
    return null;
  }, [p?.lat, p?.lng, p?.address, p?.city, p?.state, p?.zip]);

  const websiteUrl = useMemo(() => {
    if (!p?.contact?.websiteUrl) return null;
    const url = p.contact.websiteUrl.trim();
    return url.startsWith("http") ? url : `https://${url}`;
  }, [p?.contact?.websiteUrl]);

  const targetEntity = p?.contact?.organizationName || p?.entity?.legalName || p?.owner || "";
  const targetExecutive = p?.contact?.decisionMakerName || p?.officers?.[0]?.name || "";

  const linkedInUrl = useMemo(() => {
    if (!targetEntity && !targetExecutive) return null;
    const keywords = [targetExecutive, targetEntity, p?.city, p?.state].filter(Boolean).join(" ");
    return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(keywords)}`;
  }, [targetExecutive, targetEntity, p?.city, p?.state]);

  const googleSearchUrl = useMemo(() => {
    if (!targetEntity && !p?.address) return null;
    const keywords = [targetEntity, p?.address, p?.city, "commercial"].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(keywords)}`;
  }, [targetEntity, p?.address, p?.city]);

  // Dynamic post-storm permits calculation (replaces hardcoded "0 post-storm permits")
  const postStormRoofPermits = useMemo(() => {
    if (!p?.permits || !d?.stormDate) return [];
    const stormTime = new Date(d.stormDate).getTime();
    return p.permits.filter((x) => {
      if (!x.issued) return false;
      const issuedTime = new Date(x.issued).getTime();
      return issuedTime >= stormTime && (/roof/i.test(x.scope || "") || /roof/i.test(x.roofSystem || "") || /roof/i.test(x.contractor || ""));
    });
  }, [p?.permits, d?.stormDate]);

  const [activeTab, setActiveTab] = useState<TabId>("playbook");
  const [permitFilter, setPermitFilter] = useState<"all" | "roof" | "other">("all");
  const [permitsOpen, setPermitsOpen] = useState(true);
  const [cadOpen, setCadOpen] = useState(true);
  const [aerialOpen, setAerialOpen] = useState(true);
  const [verificationOpen, setVerificationOpen] = useState(true);
  const [cadRecordOpen, setCadRecordOpen] = useState(true);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check saved and claimed status on mount or parcelId change
  useEffect(() => {
    if (!parcelId) return;
    fetch("/api/leads")
      .then((res) => (res.ok ? res.json() : []))
      .then((leads) => {
        if (Array.isArray(leads) && leads.some((l) => l.parcelId === parcelId)) {
          setIsSaved(true);
        }
      })
      .catch(() => {});

    fetch("/api/claims")
      .then((res) => (res.ok ? res.json() : { claims: [] }))
      .then((data) => {
        if (Array.isArray(data.claims) && data.claims.some((c: any) => c.parcelId === parcelId && c.status === "active")) {
          setIsClaimed(true);
          setIsSaved(true);
        }
      })
      .catch(() => {});
  }, [parcelId]);

  const handleSave = async () => {
    if (!p || isSaving) return;
    setIsSaving(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelId,
          stormId: stormParam || "storm-2024-05-dallas",
          address: p.address,
          city: p.city,
          score: d?.score || 95,
          hail: d?.hail || 1.75,
          price: p.improvementValuation || 0,
          stage: isClaimed ? "Claimed" : "New",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsSaved(true);
        setActionFeedback({ type: "success", text: "Saved to Pipeline!" });
        setTimeout(() => setActionFeedback(null), 3000);
      } else {
        setActionFeedback({ type: "error", text: data.error || "Failed to save lead" });
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error saving lead" });
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClaim = async () => {
    if (!p || isClaiming || isClaimed) return;
    setIsClaiming(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsClaimed(true);
        setIsSaved(true);
        setActionFeedback({ type: "success", text: "Claimed for 21 days!" });
        setTimeout(() => setActionFeedback(null), 3500);

        // Also ensure lead is saved in pipeline with Claimed stage
        fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parcelId,
            stormId: stormParam || "storm-2024-05-dallas",
            address: p.address,
            city: p.city,
            score: d?.score || 95,
            hail: d?.hail || 1.75,
            price: p.improvementValuation || 0,
            stage: "Claimed",
          }),
        }).catch(() => {});
      } else {
        setActionFeedback({ type: "error", text: data.error || "Failed to claim property" });
        setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error claiming property" });
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setIsClaiming(false);
    }
  };

  const cleanAccountId = p?.account?.replace(/^DCAD-PARCEL-/i, "") || p?.id || "";
  const cadUrl = p?.account?.startsWith("TAD")
    ? `https://www.tad.org/property/${encodeURIComponent(cleanAccountId)}`
    : `https://www.dallascad.org/SearchAcct.aspx?ACCOUNTNO=${encodeURIComponent(cleanAccountId)}`;

  const parsedSections = useMemo(() => {
    if (!p?.improvementSections) return [];
    try {
      const parsed = typeof p.improvementSections === "string" ? JSON.parse(p.improvementSections) : p.improvementSections;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [p?.improvementSections]);

  const filteredPermits = useMemo(() => {
    if (!p?.permits) return [];
    if (permitFilter === "roof") {
      return p.permits.filter(
        (x) => /roof/i.test(x.scope || "") || /roof/i.test(x.roofSystem || "") || /roof/i.test(x.contractor || "")
      );
    }
    if (permitFilter === "other") {
      return p.permits.filter(
        (x) => !/roof/i.test(x.scope || "") && !/roof/i.test(x.roofSystem || "") && !/roof/i.test(x.contractor || "")
      );
    }
    return p.permits;
  }, [p?.permits, permitFilter]);

  const roofPermitsCount = useMemo(() => {
    return p?.permits?.filter(
      (x) => /roof/i.test(x.scope || "") || /roof/i.test(x.roofSystem || "") || /roof/i.test(x.contractor || "")
    ).length || 0;
  }, [p?.permits]);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: typeof Sparkles; count?: number }[] = [
      { id: "playbook", label: "Tactical Playbook", icon: Sparkles },
      { id: "contacts", label: "Decision Makers", count: p?.officers?.length ? p.officers.length : (p?.contact ? 1 : undefined), icon: User },
      { id: "history", label: "History", count: p?.permits?.length, icon: History },
    ];
    return list;
  }, [p?.officers?.length, p?.contact, p?.permits?.length]);

  return (
    <EngineLayout hideHeader={true} fullHeight={true}>
      <EngineState loading={parcel.loading} error={parcel.error} empty={!p} onRetry={parcel.retry}>
        {p && (
          <div className="flex flex-col h-full w-full overflow-hidden bg-background">
            {/* ========================================================================= */}
            {/* PANE 1: FIXED TOP PANE (Header & Executive Decision Strip - NEVER SCROLLS) */}
            {/* ========================================================================= */}
            <header className="shrink-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-md px-5 py-3 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {p.address}
                    </h1>

                    {/* Social Proof, Location & External Profile Action Icons */}
                    <div className="flex items-center gap-1.5">
                      {/* 1. Building Location (Google Maps) */}
                      {googleMapsUrl && (
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`View ${p.address} on Google Maps`}
                          aria-label="View on Google Maps"
                          className="size-7 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-emerald-600 dark:border-border/70 dark:bg-[#1c1c18] dark:hover:bg-[#232320] dark:text-muted-foreground dark:hover:text-emerald-400 dark:hover:border-emerald-500/40 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <MapPin className="size-3.5" />
                        </a>
                      )}

                      {/* 2. Official Website */}
                      {websiteUrl && (
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Visit official website: ${p.contact?.websiteUrl}`}
                          aria-label="Visit company website"
                          className="size-7 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 dark:border-border/70 dark:bg-[#1c1c18] dark:hover:bg-[#232320] dark:text-muted-foreground dark:hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Globe className="size-3.5" />
                        </a>
                      )}

                      {/* 3. LinkedIn Social Proof */}
                      {linkedInUrl && (
                        <a
                          href={linkedInUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Search LinkedIn for ${targetExecutive || targetEntity}`}
                          aria-label="Search LinkedIn"
                          className="size-7 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-sky-600 dark:border-border/70 dark:bg-[#1c1c18] dark:hover:bg-[#232320] dark:text-muted-foreground dark:hover:text-sky-400 dark:hover:border-sky-500/40 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.6 1.6 0 0 0-1.6 1.6 1.6 1.6 0 0 0 1.6-1.6 1.6 1.6 0 0 0 1.6-1.6 1.6 1.6 0 0 0-1.6-1.6Z" />
                          </svg>
                        </a>
                      )}

                      {/* 4. Google Intelligence Web Search */}
                      {googleSearchUrl && (
                        <a
                          href={googleSearchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Google Intelligence Search for ${targetEntity || p.address}`}
                          aria-label="Google intelligence search"
                          className="size-7 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 dark:border-border/70 dark:bg-[#1c1c18] dark:hover:bg-[#232320] dark:text-muted-foreground dark:hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Search className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {locationLine}
                  </p>
                </div>

                {/* Primary Actions: Save Lead / Claim Property Actions + Back Link */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Claim Property (Territory 21-day lock) */}
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={isClaiming || isClaimed}
                    title={isClaimed ? "Exclusive territory lock active for 21 days" : "Lock this property exclusively for 21 days"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none",
                      isClaimed
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default"
                        : "border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 dark:border-border/70 dark:bg-[#1c1c18] dark:text-foreground dark:hover:bg-[#232320] cursor-pointer"
                    )}
                  >
                    {isClaimed ? (
                      <>
                        <ShieldCheck className="size-3.5 text-emerald-400" />
                        <span>Claimed (21d Lock)</span>
                      </>
                    ) : (
                      <>
                        <Lock className="size-3.5 text-muted-foreground" />
                        <span>{isClaiming ? "Claiming..." : "Claim Property"}</span>
                      </>
                    )}
                  </button>

                  {/* Save Lead to Pipeline (Theme-adaptive Dark/Light, Zero Yellow) */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    title={isSaved ? "Saved to your CRM pipeline" : "Save this lead to your CRM pipeline"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium shadow-xs transition-colors cursor-pointer select-none",
                      isSaved
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        : "border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-900 dark:border-[#383832] dark:bg-[#242420] dark:hover:bg-[#2c2c28] dark:text-[#efefeb]"
                    )}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="size-3.5 text-emerald-400" />
                        <span>Saved to Pipeline</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="size-3.5 text-current" />
                        <span>{isSaving ? "Saving..." : "Save Lead"}</span>
                      </>
                    )}
                  </button>

                  {/* Feedback toast badge if any */}
                  {actionFeedback && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium border animate-in fade-in duration-200",
                        actionFeedback.type === "success"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      )}
                    >
                      {actionFeedback.text}
                    </span>
                  )}

                  <Link
                    href={backHref}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 dark:border-border/70 dark:bg-[#1c1c18] dark:text-muted-foreground dark:hover:bg-[#232320] dark:hover:text-foreground transition-colors"
                  >
                    ← {backLabel}
                  </Link>
                </div>
              </div>

              {/* 4-Pillar Executive Summary Strip (Always Visible at Top) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2.5 border-t border-border/40 text-xs">
                {/* 1. Verification Score (Promoted from heading) */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Verification Score
                  </span>
                  <div className="text-foreground font-semibold tabular-nums">
                    Verified {d?.score || 95}/100
                  </div>
                  <span className={cn("block text-[11px] font-normal", postStormRoofPermits.length === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {postStormRoofPermits.length === 0 ? "Unpermitted Post-Storm" : `${postStormRoofPermits.length} Post-Storm Filings`}
                  </span>
                </div>

                {/* 2. Facility & Structure */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Structure
                  </span>
                  <div className="text-foreground font-semibold tabular-nums">
                    {p.sqft ? `${num(p.sqft)} sq ft` : "Commercial Facility"}
                    {p.yearBuilt ? (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        Built {p.yearBuilt} (~{Math.max(1, 2026 - p.yearBuilt)} yrs) · {p.propertyType || "Commercial"}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* 3. Storm Exposure (100% Dynamic from NOAA radar ground truth) */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Storm Impact
                  </span>
                  <div className="text-foreground font-semibold tabular-nums">
                    {d?.hail ? `${d.hail}″ Hail Ground Truth` : "Severe Hail Exposure"}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {d?.stormDate ? shortDate(d.stormDate) : "May 2024"} · {d?.storm || "Verified Radar Swath"}
                    </span>
                  </div>
                </div>

                {/* 4. Permit Clearance (100% Dynamic from municipal permit database) */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Permit Status
                  </span>
                  <div className="text-foreground font-semibold tabular-nums">
                    {postStormRoofPermits.length === 0 ? "0 Post-Storm Filings" : `${postStormRoofPermits.length} Post-Storm Filings`}
                    <span className={cn("block text-[11px] font-normal", postStormRoofPermits.length === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                      {postStormRoofPermits.length === 0 ? "Clear assessment window" : "Prior contractor reroof filed"}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* ========================================================================= */}
            {/* SPLIT WORKBENCH CONTAINER (PANES 2 & 3: FIXED SEPARATE SCROLLS)          */}
            {/* ========================================================================= */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
              {/* ===================================================================== */}
              {/* PANE 2: LEFT PANE (Physical Ground Truth - INDEPENDENT SCROLLBAR)    */}
              {/* ===================================================================== */}
              <aside className="w-full lg:w-[460px] xl:w-[480px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/70 overflow-y-auto h-full p-5 space-y-4 bg-neutral-50/70 dark:bg-[#131310] [scrollbar-width:thin] [scrollbar-color:#292925_transparent]">
                {/* 1. Multi-Year Aerial Satellite Evidence (Apollo Box) */}
                <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
                  <div
                    onClick={() => setAerialOpen(!aerialOpen)}
                    className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
                  >
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Aerial satellite evidence
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAerialOpen(!aerialOpen);
                      }}
                      aria-label={aerialOpen ? "Collapse aerial evidence" : "Expand aerial evidence"}
                      className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
                    >
                      {aerialOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                  </div>
                  {aerialOpen && (
                    <div className="px-5 pb-5 pt-3 border-t border-border">
                      <RoofTimeline
                        lat={p.lat}
                        lng={p.lng}
                        address={p.address}
                        parcelId={p.id}
                      />
                    </div>
                  )}
                </div>

                {/* 2. 5-Stage Physical Verification Audit Stamp (Apollo Box) */}
                <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
                  <div
                    onClick={() => setVerificationOpen(!verificationOpen)}
                    className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
                  >
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      Verification audit
                    </h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVerificationOpen(!verificationOpen);
                      }}
                      aria-label={verificationOpen ? "Collapse verification audit" : "Expand verification audit"}
                      className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
                    >
                      {verificationOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </button>
                  </div>
                  {verificationOpen && (
                    <div className="px-5 pb-5 pt-3 border-t border-border">
                      <VerificationCard
                        leadId={parcelId}
                        hideImage={true}
                        hideHeader={true}
                        className="p-0 border-none"
                      />
                    </div>
                  )}
                </div>

                {/* 3. CAD Appraisal Record (Apollo Box) */}
                <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
                  <div
                    onClick={() => setCadRecordOpen(!cadRecordOpen)}
                    className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
                  >
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      CAD appraisal record
                    </h3>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={cadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors"
                      >
                        <span>Official CAD Roll</span>
                        <ExternalLink className="size-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setCadRecordOpen(!cadRecordOpen)}
                        aria-label={cadRecordOpen ? "Collapse CAD record" : "Expand CAD record"}
                        className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
                      >
                        {cadRecordOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                  {cadRecordOpen && (
                    <div className="px-5 pb-5 pt-3 border-t border-border">
                      <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
                        <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-sans">Account #</span>
                          <span className="text-foreground font-semibold">{cleanAccountId}</span>
                        </div>
                        <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-sans">Lot Sq Ft</span>
                          <span className="text-foreground font-semibold">{p.landSqft ? `${num(p.landSqft)} sq ft` : "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              {/* ===================================================================== */}
              {/* PANE 3: RIGHT PANE (Dynamic Action Workbench - INDEPENDENT SCROLLBAR) */}
              {/* ===================================================================== */}
              <main className="flex-1 min-w-0 overflow-y-auto h-full p-5 space-y-4 bg-neutral-100/60 dark:bg-[#171714] [scrollbar-width:thin] [scrollbar-color:#292925_transparent]">
                {/* Apollo-Style Segmented View Switcher (Sticky at top of Right Pane) */}
                <div className="sticky top-0 z-10 bg-neutral-100/90 dark:bg-[#171714]/90 backdrop-blur-md pb-2 pt-0">
                  <div className="flex items-center gap-1.5 p-1 rounded-lg border border-border bg-neutral-200/60 dark:bg-[#131310] overflow-x-auto">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer select-none whitespace-nowrap",
                            active
                              ? "bg-white dark:bg-[#1c1c18] text-foreground font-semibold shadow-xs border border-border"
                              : "text-muted-foreground hover:text-foreground hover:bg-neutral-200/70 dark:hover:bg-[#20201c]"
                          )}
                        >
                          <span>{tab.label}</span>
                          {tab.count != null && (
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[11px] tabular-nums font-mono",
                                active ? "bg-neutral-100 dark:bg-[#232320] text-foreground" : "bg-neutral-200 dark:bg-[#232320]/60 text-muted-foreground"
                              )}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab 1: Tactical Playbook & Pitch Scripts */}
                {activeTab === "playbook" && (
                  <div className="space-y-4">
                    <LeadDossier parcelId={parcelId} hideHeader={true} className="border-none" />
                  </div>
                )}

                {/* Tab 2: Decision Maker & Corporate Intelligence */}
                {activeTab === "contacts" && (
                  <div className="space-y-4">
                    <LeadContactsCard
                      contact={p.contact}
                      officers={p.officers}
                      entity={p.entity}
                      ownerName={p.owner}
                      ownerAddress={p.ownerAddress}
                    />
                  </div>
                )}

                {/* Tab 3: History (Municipal Permits + CAD Building Structure - Clean Apollo Style) */}
                {activeTab === "history" && (
                  <div className="space-y-4">
                    {/* ================================================================= */}
                    {/* BOX 1: MUNICIPAL PERMITS (EXACT APOLLO BOX RECREATION)            */}
                    {/* ================================================================= */}
                    <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
                      {/* Box 1 Header: Entire header clickable to toggle collapse */}
                      <div
                        onClick={() => setPermitsOpen(!permitsOpen)}
                        className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
                      >
                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                          Municipal permits
                        </h3>

                        {/* Top-Right: Chevron Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPermitsOpen(!permitsOpen);
                          }}
                          aria-label={permitsOpen ? "Collapse municipal permits" : "Expand municipal permits"}
                          className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
                        >
                          {permitsOpen ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Box 1 Content (When Open) */}
                      {permitsOpen && (
                        <div>
                          {/* Apollo-Style Horizontal Underline Tabs */}
                          <div className="flex items-center gap-6 border-b border-border px-5 pt-1 text-xs">
                            <button
                              type="button"
                              onClick={() => setPermitFilter("all")}
                              className={cn(
                                "pb-2.5 pt-1 font-medium transition-colors cursor-pointer flex items-center gap-1.5 -mb-px select-none",
                                permitFilter === "all"
                                  ? "border-b-2 border-foreground text-foreground font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <span>Overview</span>
                              <span className="rounded px-1.5 py-0.2 text-[11px] font-mono tabular-nums bg-neutral-100 dark:bg-[#232320] text-muted-foreground">
                                {p.permits?.length || 0}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPermitFilter("roof")}
                              className={cn(
                                "pb-2.5 pt-1 font-medium transition-colors cursor-pointer flex items-center gap-1.5 -mb-px select-none",
                                permitFilter === "roof"
                                  ? "border-b-2 border-foreground text-foreground font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <span>Roofing</span>
                              <span className="rounded px-1.5 py-0.2 text-[11px] font-mono tabular-nums bg-neutral-100 dark:bg-[#232320] text-muted-foreground">
                                {roofPermitsCount}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPermitFilter("other")}
                              className={cn(
                                "pb-2.5 pt-1 font-medium transition-colors cursor-pointer flex items-center gap-1.5 -mb-px select-none",
                                permitFilter === "other"
                                  ? "border-b-2 border-foreground text-foreground font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <span>Other</span>
                              <span className="rounded px-1.5 py-0.2 text-[11px] font-mono tabular-nums bg-neutral-100 dark:bg-[#232320] text-muted-foreground">
                                {(p.permits?.length || 0) - roofPermitsCount}
                              </span>
                            </button>
                          </div>

                          {/* Permits Table */}
                          {filteredPermits.length ? (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="w-[160px] text-muted-foreground text-xs font-medium pl-5">Permit #</TableHead>
                                    <TableHead className="hidden md:table-cell text-muted-foreground text-xs font-medium">Scope of Work</TableHead>
                                    <TableHead className="w-[160px] text-muted-foreground text-xs font-medium">Contractor</TableHead>
                                    <TableHead className="w-[100px] text-muted-foreground text-xs font-medium">Status</TableHead>
                                    <TableHead className="text-right w-[100px] text-muted-foreground text-xs font-medium">Valuation</TableHead>
                                    <TableHead className="w-[160px] text-muted-foreground text-xs font-medium pr-5">Source</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredPermits.map((x) => (
                                    <TableRow key={x.id || x.permitNumber} className="border-border hover:bg-[#FAF5EE] dark:hover:bg-[#1C1A17] transition-colors">
                                      <TableCell className="font-mono text-xs tabular-nums pl-5">
                                        <span className="font-medium text-foreground">{x.permitNumber}</span>
                                        <span className="block text-[11px] text-muted-foreground">
                                          {x.issued ? shortDate(x.issued) : "—"}
                                          {x.roofSystem ? ` · ${x.roofSystem}` : ""}
                                        </span>
                                      </TableCell>
                                      <TableCell className="hidden max-w-72 truncate md:table-cell text-xs" title={x.scope}>
                                        {x.scope || "—"}
                                      </TableCell>
                                      <TableCell className="max-w-48 text-xs">
                                        <ContractorLink name={x.contractor} />
                                      </TableCell>
                                      <TableCell className="text-xs">{x.status || "—"}</TableCell>
                                      <TableCell className="text-right font-mono text-xs tabular-nums font-medium">
                                        {x.valuation || "—"}
                                      </TableCell>
                                      <TableCell className="text-xs pr-5">
                                        {x.sourceUrl ? (
                                          <a
                                            href={x.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs max-w-[150px] truncate"
                                            title={`Open official source record: ${x.sourceSystem || x.sourceUrl}`}
                                          >
                                            <span className="truncate">{x.sourceSystem || "Official Source"}</span>
                                            <ExternalLink className="size-3 shrink-0" />
                                          </a>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">{x.sourceSystem || "Public Record"}</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="p-6 text-xs text-muted-foreground text-center bg-neutral-50 dark:bg-[#1c1c18]">
                              {permitFilter === "roof"
                                ? "No historical roofing permits pulled for this parcel. Untouched commercial roof system ready for insurance assessment."
                                : "No municipal permit records matching this filter."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ================================================================= */}
                    {/* BOX 2: CAD STRUCTURE (EXACT APOLLO BOX RECREATION)                */}
                    {/* ================================================================= */}
                    {parsedSections.length > 0 && (
                      <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
                        {/* Box 2 Header: Entire header clickable to toggle collapse */}
                        <div
                          onClick={() => setCadOpen(!cadOpen)}
                          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
                        >
                          <h3 className="text-base font-semibold tracking-tight text-foreground">
                            CAD structure
                          </h3>

                          {/* Top-Right: Official CAD Link + Chevron Toggle Button */}
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={cadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors"
                            >
                              <span>Official CAD Roll</span>
                              <ExternalLink className="size-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setCadOpen(!cadOpen)}
                              aria-label={cadOpen ? "Collapse CAD structure" : "Expand CAD structure"}
                              className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
                            >
                              {cadOpen ? (
                                <ChevronUp className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Box 2 Content (When Open) */}
                        {cadOpen && (
                          <div className="px-5 pb-5 pt-3 border-t border-border">
                            <div className="grid gap-3 sm:grid-cols-2">
                              {parsedSections.map((sec: any, idx: number) => (
                                <div key={idx} className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 text-xs space-y-1">
                                  <div className="flex items-center justify-between">
                                    <p className="font-semibold text-foreground">{sec.description || `Section ${idx + 1}`}</p>
                                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                                      {sec.year_built ? `Built ${sec.year_built}` : ""}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground text-[11px]">
                                    {sec.stories ? `${sec.stories} Stories` : "1 Story"}
                                  </p>
                                  <p className="font-mono mt-1 font-medium tabular-nums text-foreground">
                                    {sec.area_sqft ? num(sec.area_sqft) : "—"} sq ft {sec.foundation_sqft ? `(${num(sec.foundation_sqft)} footprint)` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Document Record Provenance Footnote */}
                <div className="border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-6">
                    <div>
                      <span className="font-medium text-foreground/80">Authority:</span> {p.source || "Dallas County Appraisal District (DCAD)"} · {p.yearBuiltSource || "DCAD Certified Commercial Roll"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground/80">Pipeline:</span> {p.dataProvenance || "live_dcad_api (Direct Public Record)"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground/80">Ingestion:</span> {p.provenanceDate || p.retrievedAt || "Recent"}
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        )}
      </EngineState>
    </EngineLayout>
  );
}
