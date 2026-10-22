"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Building2, 
  Lock, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Search, 
  Filter,
  DollarSign
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DepoiiLoader } from "@/components/depoii-logo";
import { usd, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TerritoryLead } from "@/lib/territories";

interface LeadsResponse {
  territoryId: string;
  isSubscribed: boolean;
  tier: string;
  leads: TerritoryLead[];
  total: number;
}

export default function TerritoryLeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const territoryId = resolvedParams.id;

  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [claimingParcelId, setClaimingParcelId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadLeads = () => {
    fetch(`/api/territories/${territoryId}/leads?search=${encodeURIComponent(search)}`)
      .then(async (res) => {
        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(resData.error || "Failed to load territory leads");
        }
        return resData;
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
    const timer = setTimeout(() => {
      loadLeads();
    }, 250);
    return () => clearTimeout(timer);
  }, [territoryId, search]);

  const handleClaim = async (parcelId: string) => {
    setClaimingParcelId(parcelId);
    setFeedback(null);

    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Claim failed");
      }

      setFeedback({
        type: "success",
        message: "Property successfully claimed and locked exclusively for 21 days!",
      });

      // Update lead status in local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          leads: prev.leads.map((l) =>
            l.parcelId === parcelId
              ? { ...l, claimStatus: "claimed_by_you" as const }
              : l
          ),
        };
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error claiming property",
      });
    } finally {
      setClaimingParcelId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background dark:bg-[#0b0c10] text-foreground dark:text-neutral-200 overflow-hidden font-sans select-none antialiased">
      {/* Top Header */}
      <header className="shrink-0 border-b border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f12] px-5 py-3.5 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/territory"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "size-8 p-0 border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white")}
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-foreground dark:text-white capitalize">
                  {territoryId.replace(/-/g, " ")} Leads
                </h1>
                {data?.isSubscribed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900/90 px-2.5 py-0.5 text-[10px] font-medium text-neutral-900 dark:text-white">
                    <CheckCircle2 className="size-3" /> Subscribed
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-500">
                    Preview Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                Personalized commercial roofing opportunities ranked by hail exposure, square footage, and replacement value.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/claims"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs font-medium border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-300")}
            >
              <Lock className="size-3.5 text-muted-foreground dark:text-neutral-400" />
              <span>View My Active Claims</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Sub-bar Filter & Stats */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#111216] px-5 py-2 text-xs z-20">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground dark:text-neutral-500" />
          <Input
            placeholder="Search address, city, or ZIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#14151c] text-foreground dark:text-neutral-200 placeholder:text-muted-foreground dark:placeholder:text-neutral-500 focus:border-neutral-400 dark:focus:border-neutral-700"
          />
        </div>

        <div className="text-[11px] text-muted-foreground dark:text-neutral-400 flex items-center gap-3">
          <span>
            Showing <span className="font-semibold text-foreground dark:text-white font-mono">{data?.leads.length || 0}</span> of{" "}
            <span className="font-semibold text-foreground dark:text-white font-mono">{data?.total || 0}</span> target roofs
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <span className="text-muted-foreground dark:text-neutral-500">Exclusive 21-Day Lock upon claim</span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg p-3 text-xs font-medium",
              feedback.type === "success"
                ? "border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6]"
                : "border border-[#DE7272]/50 bg-[#DE7272]/20 text-rose-800 dark:text-[#DE7272]"
            )}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Subscription upsell if not subscribed */}
        {data && !data.isSubscribed && (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-[#121319] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground dark:text-white">
                <Lock className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                Previewing Shared Intelligence
              </div>
              <p className="text-xs text-muted-foreground dark:text-neutral-400 leading-relaxed max-w-2xl">
                Owner contact intelligence and exclusive 21-day claim locking are reserved for territory subscribers. Join the waitlist to claim properties and unlock decision-maker contacts.
              </p>
            </div>
            <Button
              size="sm"
              variant="brand"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/territories/${territoryId}/waitlist`, { method: "POST" });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error || "Failed to join waitlist");
                  setFeedback({ type: "success", message: "You have been added to the priority waitlist for this territory zone!" });
                } catch (err) {
                  setFeedback({ type: "error", message: err instanceof Error ? err.message : "Error joining waitlist" });
                }
              }}
              className="whitespace-nowrap h-7 text-xs font-medium shrink-0"
            >
              Join Priority Waitlist
            </Button>
          </div>
        )}

        {/* Loading & Error States */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <DepoiiLoader label="Loading territory opportunities..." />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            Error loading leads: {error}
          </div>
        )}

        {/* Leads List */}
        {!loading && !error && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.leads.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-muted-foreground dark:text-neutral-500">
                No matching commercial properties found in this territory.
              </div>
            ) : (
              data.leads.map((lead) => {
                const isClaimedByYou = lead.claimStatus === "claimed_by_you";
                const isClaimedByOther = lead.claimStatus === "claimed_by_other";

                return (
                  <div
                    key={lead.parcelId}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border bg-card dark:bg-[#0e0f14]/95 p-5 shadow-sm transition-all duration-200",
                      isClaimedByYou
                        ? "border-[#B4E4D6]/50 bg-emerald-50/40 dark:bg-[#0c1310] ring-1 ring-[#B4E4D6]/30"
                        : isClaimedByOther
                        ? "border-border/60 dark:border-neutral-800/60 opacity-60"
                        : "border-border dark:border-neutral-800/80 hover:border-neutral-400 dark:hover:border-neutral-700/80"
                    )}
                  >
                    <div className="space-y-3">
                      {/* Top Row: Address & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-foreground dark:text-white leading-snug">
                            {lead.address || "Commercial Property"}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground dark:text-neutral-400 mt-0.5">
                            <MapPin className="size-3 text-muted-foreground dark:text-neutral-500" />
                            <span>
                              {lead.city}, {lead.state} {lead.zipCode}
                            </span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        {isClaimedByYou ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-[#B4E4D6] shrink-0">
                            <CheckCircle2 className="size-3" /> Locked
                          </span>
                        ) : isClaimedByOther ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-500 shrink-0">
                            <Lock className="size-3" /> Claimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#14151c] px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
                            Available
                          </span>
                        )}
                      </div>

                      {/* Owner / Decision Maker info */}
                      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/60 bg-neutral-50/80 dark:bg-[#121319]/80 p-2.5 text-xs space-y-0.5">
                        <div className="text-muted-foreground dark:text-neutral-500 flex items-center justify-between text-[10px] uppercase font-medium tracking-wider">
                          <span>Owner Entity</span>
                          {lead.leadTier && (
                            <span className="font-mono text-neutral-700 dark:text-neutral-300">
                              Tier {lead.leadTier}
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-foreground dark:text-neutral-200 truncate text-xs">
                          {lead.ownerName || (
                            <span className="text-muted-foreground dark:text-neutral-500 italic flex items-center gap-1">
                              <Lock className="size-3" /> Requires Territory Subscription
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Key Building Specs */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Roof Area</span>
                          <div className="font-medium text-foreground dark:text-neutral-200 font-mono mt-0.5">
                            {lead.buildingSqft ? `${num(lead.buildingSqft)} sq ft` : "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Est. Replacement</span>
                          <div className="font-semibold text-foreground dark:text-neutral-100 font-mono mt-0.5">
                            {lead.estimatedReplacementMid ? usd(lead.estimatedReplacementMid) : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Storm Exposure & Hail Data */}
                      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/60 bg-neutral-50/60 dark:bg-[#121319]/50 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground dark:text-neutral-400">Hail Exposure:</span>
                          <span className="font-mono font-semibold text-foreground dark:text-white">
                            {lead.maxHailInches ? `${lead.maxHailInches}" Hail` : "Storm Tracked"}
                          </span>
                        </div>
                        {lead.whyStrongSummary && (
                          <p className="text-[10px] text-muted-foreground dark:text-neutral-400 line-clamp-2 italic pt-1 border-t border-border dark:border-neutral-800/60">
                            &ldquo;{lead.whyStrongSummary}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3.5 pt-3 border-t border-border dark:border-neutral-800/60 flex items-center gap-2">
                      {isClaimedByYou ? (
                        <Link
                          href="/claims"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full border-[#B4E4D6]/50 bg-[#B4E4D6]/20 hover:bg-[#B4E4D6]/30 text-emerald-800 dark:text-[#B4E4D6] gap-1.5 h-8 text-xs font-medium")}
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Locked to You · View Claim</span>
                        </Link>
                      ) : isClaimedByOther ? (
                        <Button disabled size="sm" variant="outline" className="w-full text-xs text-neutral-500 border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/40 h-8">
                          <Lock className="size-3 mr-1" /> Claimed by Competitor
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="brand"
                          onClick={() => handleClaim(lead.parcelId)}
                          disabled={claimingParcelId === lead.parcelId}
                          className="w-full gap-1.5 text-xs font-medium h-8"
                        >
                          <Lock className="size-3" />
                          <span>{claimingParcelId === lead.parcelId ? "Locking Claim..." : "Claim Property (21d Lock)"}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
