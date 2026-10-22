"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Lock, 
  Clock, 
  Phone, 
  Mail, 
  Eye, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  MapPin, 
  Trash2, 
  ExternalLink,
  PlusCircle,
  Activity,
  Calendar,
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DepoiiLoader } from "@/components/depoii-logo";
import { InspectionOutcomeModal, type InspectionTarget } from "@/components/inspection-outcome-modal";
import { usd, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClaimWithProperty } from "@/lib/claims";

interface ClaimsResponse {
  claims: ClaimWithProperty[];
  usage: {
    used: number;
    limit: number;
    month: string;
  };
}

const ACTIVITY_BUTTONS = [
  { type: "phone_call", label: "Called", icon: Phone },
  { type: "email_sent", label: "Emailed", icon: Mail },
  { type: "site_visit", label: "Site Visit", icon: Eye },
  { type: "bid_submitted", label: "Bid Sent", icon: FileText },
];

export default function ClaimsDashboardPage() {
  const [data, setData] = useState<ClaimsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [notePromptId, setNotePromptId] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [inspectionTarget, setInspectionTarget] = useState<InspectionTarget | null>(null);
  const [outcomeSuccessMsg, setOutcomeSuccessMsg] = useState<string | null>(null);

  const loadClaims = () => {
    fetch("/api/claims")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load claims");
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const handleLogActivity = async (claimId: string, activityType: string, notes: string = "") => {
    setActiveActionId(claimId);
    try {
      const res = await fetch(`/api/claims/${claimId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType, notes }),
      });
      if (!res.ok) throw new Error("Failed to record activity");
      // Reload claims to reflect refreshed deadlines
      loadClaims();
      setNotePromptId(null);
      setCustomNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error logging activity");
    } finally {
      setActiveActionId(null);
    }
  };

  const handleRelease = async (claimId: string) => {
    if (!confirm("Are you sure you want to release this property back to the territory pool?")) {
      return;
    }

    setActiveActionId(claimId);
    try {
      const res = await fetch(`/api/claims/${claimId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "contractor_voluntary" }),
      });
      if (!res.ok) throw new Error("Failed to release claim");
      loadClaims();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error releasing claim");
    } finally {
      setActiveActionId(null);
    }
  };

  const claims = data?.claims || [];
  const urgentCount = claims.filter((c) => c.activityDaysRemaining <= 2).length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background dark:bg-[#0b0c10] text-foreground dark:text-neutral-200 overflow-hidden font-sans select-none antialiased">
      {/* Top Header */}
      <header className="shrink-0 border-b border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f12] px-5 py-3.5 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300">
              <Lock className="size-4 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-foreground dark:text-white">
                  My Exclusive Property Claims
                </h1>
                <span className="rounded-full border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-400">
                  Exclusive 21-Day Lock
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                Guaranteed exclusivity for your organization. Maintain activity every 7 days to preserve active locks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/outcomes"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs font-medium border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-300")}
            >
              <ClipboardCheck className="size-3.5 text-emerald-600 dark:text-[#B4E4D6]" />
              <span>Field Outcomes</span>
            </Link>
            <Link
              href="/territory"
              className={cn(buttonVariants({ variant: "brand", size: "sm" }), "h-8 gap-1.5 text-xs font-medium")}
            >
              <PlusCircle className="size-3.5" />
              <span>Claim New Roofs</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Sub-bar KPI Strip */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#111216] px-5 py-2 text-xs z-20">
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Active Claims:</span>
            <span className="font-semibold text-foreground dark:text-white">{claims.length} Properties</span>
          </div>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Monthly Quota:</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{data?.usage.used ?? 0} / {data?.usage.limit || "Unlimited"}</span>
          </div>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Requires Contact:</span>
            <span className={cn("font-semibold flex items-center gap-1", urgentCount > 0 ? "text-amber-700 dark:text-[#FFCA88]" : "text-neutral-700 dark:text-neutral-300")}>
              {urgentCount > 0 && <span className="size-1.5 rounded-full bg-amber-500 dark:bg-[#FFCA88] animate-pulse" />}
              {urgentCount} (≤ 48h)
            </span>
          </div>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Locked Pipeline:</span>
            <span className="font-mono font-semibold text-foreground dark:text-white">
              {usd(claims.reduce((acc, c) => acc + (c.estimatedReplacementMid || 0), 0))}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground dark:text-neutral-500 flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-muted-foreground dark:text-neutral-400" />
          <span>Single-contractor exclusivity guaranteed by Depoii</span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Outcome Recorded Notification Alert */}
        {outcomeSuccessMsg && (
          <div className="flex items-center justify-between rounded-lg border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 p-3 text-xs text-emerald-900 dark:text-[#B4E4D6]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-700 dark:text-[#B4E4D6] shrink-0" />
              <span>{outcomeSuccessMsg}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/outcomes"
                className="font-medium underline flex items-center gap-1 text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white"
              >
                <span>View Field Outcomes & Calibration</span>
                <ArrowRight className="size-3" />
              </Link>
              <button
                onClick={() => setOutcomeSuccessMsg(null)}
                className="ml-2 text-xs opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading & Error */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <DepoiiLoader label="Loading active property claims..." />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            Failed to load claims: {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && claims.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#0e0f14]/40 p-12 text-center space-y-3 max-w-lg mx-auto my-12">
            <div className="size-12 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 flex items-center justify-center mx-auto text-neutral-600 dark:text-neutral-400">
              <Lock className="size-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground dark:text-white">No properties claimed yet</h3>
            <p className="text-xs text-muted-foreground dark:text-neutral-400 leading-relaxed">
              Explore your assigned Dallas territory to lock high-opportunity commercial roofs exclusively to your organization before competitors claim them.
            </p>
            <Link href="/territory" className={cn(buttonVariants({ variant: "brand", size: "sm" }), "h-8 text-xs mt-2")}>
              Explore Territories
            </Link>
          </div>
        )}

        {/* Claims List Grid */}
        {!loading && !error && claims.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {claims.map((claim) => {
              const isUrgent = claim.activityDaysRemaining <= 2;
              const isWorkingThis = activeActionId === claim.id;

              return (
                <div
                  key={claim.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border bg-card dark:bg-[#0e0f14]/95 p-5 shadow-sm transition-all duration-200",
                    isUrgent 
                      ? "border-amber-500/40 dark:border-[#FFCA88]/40 bg-amber-50/50 dark:bg-[#14120e] shadow-amber-500/5 dark:shadow-[#FFCA88]/5" 
                      : "border-border dark:border-neutral-800/80 hover:border-neutral-400 dark:hover:border-neutral-700/80"
                  )}
                >
                  <div className="space-y-3.5">
                    {/* Top: Address and Timers */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link 
                          href={`/parcels/${claim.parcelId}`}
                          className="font-semibold text-sm text-foreground dark:text-white hover:underline transition-colors flex items-center gap-1.5 leading-snug"
                        >
                          <span>{claim.address || "Commercial Property"}</span>
                          <ExternalLink className="size-3 opacity-60" />
                        </Link>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground dark:text-neutral-400 mt-0.5">
                          <MapPin className="size-3 text-muted-foreground dark:text-neutral-500" />
                          <span>
                            {claim.city}, {claim.state} {claim.zipCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#14151c] px-2 py-0.5 text-[10px] font-mono text-neutral-700 dark:text-neutral-300">
                          <Clock className="size-3 text-muted-foreground dark:text-neutral-500" />
                          {claim.daysRemaining}d TTL
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium font-mono",
                            isUrgent 
                              ? "bg-amber-500/15 dark:bg-[#FFCA88]/10 text-amber-800 dark:text-[#FFCA88] border-amber-500/40 dark:border-[#FFCA88]/30" 
                              : "border-neutral-300 dark:border-neutral-800/80 bg-neutral-100 dark:bg-[#121318] text-neutral-600 dark:text-neutral-400"
                          )}
                        >
                          {isUrgent ? <AlertTriangle className="size-3 text-amber-700 dark:text-[#FFCA88]" /> : <Activity className="size-3 text-muted-foreground dark:text-neutral-500" />}
                          {claim.activityDaysRemaining}d to contact
                        </span>
                      </div>
                    </div>

                    {/* Owner & Property Specs */}
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800/60 bg-neutral-50/80 dark:bg-[#121319]/80 p-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Owner</span>
                        <div className="font-medium text-foreground dark:text-neutral-200 truncate mt-0.5 text-xs">
                          {claim.ownerName || "Commercial Owner"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Roof Area</span>
                        <div className="font-medium text-foreground dark:text-neutral-200 font-mono mt-0.5 text-xs">
                          {claim.buildingSqft ? `${num(claim.buildingSqft)} sq ft` : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Est. Value</span>
                        <div className="font-semibold text-foreground dark:text-neutral-100 font-mono mt-0.5 text-xs">
                          {claim.estimatedReplacementMid ? usd(claim.estimatedReplacementMid) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Activity Rule Notice */}
                    {isUrgent && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-500/15 dark:bg-[#FFCA88]/10 border border-amber-500/40 dark:border-[#FFCA88]/30 p-2.5 text-xs text-amber-800 dark:text-[#FFCA88]">
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-700 dark:text-[#FFCA88]" />
                        <span>Log outreach today to maintain your exclusive 21-day lock!</span>
                      </div>
                    )}

                    {/* One-Click Activity Actions */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground dark:text-neutral-400">
                        <span>One-Click Activity (Resets 7-day clock):</span>
                        <span className="text-[10px] font-mono text-muted-foreground dark:text-neutral-500">{claim.activityCount} logged</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ACTIVITY_BUTTONS.map((btn) => {
                          const Icon = btn.icon;
                          return (
                            <Button
                              key={btn.type}
                              variant="outline"
                              size="sm"
                              disabled={isWorkingThis}
                              onClick={() => handleLogActivity(claim.id, btn.type)}
                              className="h-7 px-1.5 text-xs gap-1 border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#14151b] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                            >
                              <Icon className="size-3 text-muted-foreground dark:text-neutral-400" />
                              <span>{btn.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Direct Bridge: Record Inspection Outcome Button */}
                    <div className="pt-2.5 border-t border-border dark:border-neutral-800/60 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="brand"
                        onClick={() => setInspectionTarget({
                          claimId: claim.id,
                          parcelId: claim.parcelId,
                          address: claim.address,
                          city: claim.city,
                          state: claim.state,
                          zipCode: claim.zipCode,
                          ownerName: claim.ownerName || undefined,
                          buildingSqft: claim.buildingSqft,
                          predictedScore: 85,
                        })}
                        className="h-7 px-2.5 text-xs gap-1.5"
                      >
                        <ClipboardCheck className="size-3.5" />
                        <span>Log Inspection Outcome</span>
                      </Button>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => setNotePromptId(claim.id)}
                          className="text-xs text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
                        >
                          <FileText className="size-3" /> Note
                        </button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isWorkingThis}
                          onClick={() => handleRelease(claim.id)}
                          className="h-7 px-2 text-xs text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 gap-1 transition-colors"
                        >
                          <Trash2 className="size-3" />
                          <span>Release</span>
                        </Button>
                      </div>
                    </div>

                    {/* Note input toggle */}
                    {notePromptId === claim.id && (
                      <div className="space-y-2 pt-2 border-t border-border dark:border-neutral-800/60">
                        <textarea
                          value={customNote}
                          onChange={(e) => setCustomNote(e.target.value)}
                          placeholder="Add inspection notes, gate codes, or conversation details..."
                          className="w-full text-xs rounded-md border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-[#121319] p-2 text-foreground dark:text-neutral-200 placeholder:text-muted-foreground dark:placeholder:text-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-700 outline-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNotePromptId(null);
                              setCustomNote("");
                            }}
                            className="h-7 text-xs text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:hover:text-white"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={!customNote.trim() || isWorkingThis}
                            onClick={() => handleLogActivity(claim.id, "note_added", customNote)}
                            className="h-7 text-xs bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-white"
                          >
                            Save Note & Reset Timer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Field Inspection Outcome Modal */}
      <InspectionOutcomeModal
        target={inspectionTarget}
        onClose={() => setInspectionTarget(null)}
        onSuccess={(outcome) => {
          setOutcomeSuccessMsg(`Field inspection outcome recorded for ${inspectionTarget?.address || "property"}! Model calibrated.`);
          loadClaims();
        }}
      />
    </div>
  );
}
