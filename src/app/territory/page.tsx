"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  MapPin, 
  Building2, 
  DollarSign, 
  Lock, 
  ArrowRight, 
  Users, 
  CheckCircle2, 
  Sparkles,
  Layers
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DepoiiLoader } from "@/components/depoii-logo";
import { usd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Territory {
  id: string;
  market: string;
  name: string;
  description: string;
  zipCodes: string[];
  maxSubscribers: number;
  totalParcels: number;
  totalPipelineValue: number;
  totalSqft: number;
  activeSubscribers: number;
  availableSlots: number;
  isSubscribed: boolean;
}

export default function TerritoryPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/territories?market=dallas")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load territories");
        return res.json();
      })
      .then((data) => {
        setTerritories(data.territories || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const totalValue = territories.reduce((acc, t) => acc + (Number(t.totalPipelineValue) || 0), 0);
  const totalParcels = territories.reduce((acc, t) => acc + (Number(t.totalParcels) || 0), 0);

  return (
    <div data-tour="territory-container" className="flex h-[calc(100vh-3.5rem)] flex-col bg-background dark:bg-[#0b0c10] text-foreground dark:text-neutral-200 overflow-hidden font-sans select-none antialiased">
      {/* Top Header */}
      <header className="shrink-0 border-b border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f12] px-5 py-3.5 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300">
              <ShieldCheck className="size-4 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-foreground dark:text-white">
                  Dallas Market Territories & Claim Protection
                </h1>
                <span className="rounded-full border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-400">
                  Strict Max 2 Contractors / Zone
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                Non-competing territory exclusivity. Claimed commercial roofs are protected exclusively for 21 days.
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

      {/* Sub-bar KPI Strip */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#111216] px-5 py-2 text-xs z-20">
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Market Pipeline:</span>
            <span className="font-mono font-semibold text-foreground dark:text-white">{usd(totalValue)}</span>
          </div>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Commercial Roofs:</span>
            <span className="font-semibold text-foreground dark:text-white">{totalParcels.toLocaleString()} Parcels</span>
          </div>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Market Zones:</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-300">{territories.length} Dallas Clusters</span>
          </div>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground dark:text-neutral-500 uppercase tracking-wider text-[10px]">Protection:</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">Guaranteed Max 2 Contractors</span>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground dark:text-neutral-500 flex items-center gap-1.5">
          <Layers className="size-3.5 text-muted-foreground dark:text-neutral-400" />
          <span>Market: Dallas County, TX</span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {/* Loading & Error States */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <DepoiiLoader label="Loading Dallas territories..." />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            Failed to load territories: {error}
          </div>
        )}

        {/* Territory Cards Grid */}
        {!loading && !error && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-tight uppercase text-muted-foreground dark:text-neutral-400 flex items-center gap-1.5">
                <Layers className="size-3.5 text-muted-foreground dark:text-neutral-400" />
                Dallas Commercial Zones ({territories.length})
              </h2>
              <div className="text-[11px] text-muted-foreground dark:text-neutral-500">
                Sorted by commercial parcel density
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {territories.map((t) => {
                const isFull = t.availableSlots <= 0;
                return (
                  <div 
                    key={t.id} 
                    className={cn(
                      "flex flex-col justify-between rounded-xl border bg-card dark:bg-[#0e0f14]/95 p-5 shadow-sm transition-all duration-200",
                      t.isSubscribed 
                        ? "border-neutral-400 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-[#121319] shadow-sm ring-1 ring-neutral-300 dark:ring-neutral-700/50" 
                        : "border-border dark:border-neutral-800/80 hover:border-neutral-400 dark:hover:border-neutral-700/80"
                    )}
                  >
                    <div className="space-y-3">
                      {/* Header with Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground dark:text-white leading-snug">{t.name}</h3>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground dark:text-neutral-400 mt-0.5">
                            <MapPin className="size-3 text-muted-foreground dark:text-neutral-500" />
                            <span>{t.zipCodes?.length || 0} ZIP Clusters</span>
                          </div>
                        </div>

                        {t.isSubscribed ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900/90 px-2.5 py-0.5 text-[10px] font-medium text-neutral-900 dark:text-white">
                            <span className="size-1.5 rounded-full bg-neutral-900 dark:bg-white shrink-0" />
                            Subscribed
                          </span>
                        ) : isFull ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 px-2.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-500">
                            Waitlist Only
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-[#B4E4D6]">
                            <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-[#B4E4D6] shrink-0" />
                            {t.availableSlots} of {t.maxSubscribers} Open
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>

                      {/* Stats Box */}
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800/60 bg-neutral-50/80 dark:bg-[#121319]/80 p-3 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Est. Pipeline</span>
                          <div className="font-semibold text-foreground dark:text-neutral-100 font-mono text-xs mt-0.5">
                            {usd(Number(t.totalPipelineValue) || 0)}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Commercial Roofs</span>
                          <div className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono text-xs mt-0.5">
                            {(Number(t.totalParcels) || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* ZIP Pill List */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground dark:text-neutral-500">Included ZIPs:</div>
                        <div className="flex flex-wrap gap-1">
                          {t.zipCodes?.slice(0, 6).map((zip) => (
                            <span key={zip} className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-neutral-100 dark:bg-[#14151c] px-1.5 py-0.5 text-[10px] font-mono text-neutral-700 dark:text-neutral-300">
                              {zip}
                            </span>
                          ))}
                          {(t.zipCodes?.length || 0) > 6 && (
                            <span className="text-[10px] text-muted-foreground dark:text-neutral-500 self-center">
                              +{t.zipCodes.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="mt-4 pt-3 border-t border-border dark:border-neutral-800/60 space-y-2">
                      {isFull && !t.isSubscribed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/territories/${t.id}/waitlist`, { method: "POST" });
                              if (res.ok) alert(`You have joined the priority waitlist for ${t.name}!`);
                            } catch {
                              alert("Failed to join waitlist");
                            }
                          }}
                          className="w-full text-xs text-amber-800 dark:text-[#FFCA88] border-amber-500/40 dark:border-[#FFCA88]/30 hover:bg-amber-500/10 dark:hover:bg-[#FFCA88]/10 h-7"
                        >
                          Join Priority Waitlist
                        </Button>
                      )}
                      <Link
                        href={`/territory/${t.id}`}
                        className={cn(
                          buttonVariants({ 
                            variant: t.isSubscribed ? "brand" : "outline", 
                            size: "sm" 
                          }), 
                          "w-full justify-between h-8 text-xs font-medium",
                          !t.isSubscribed && "border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                        )}
                      >
                        <span>{t.isSubscribed ? "Open Territory Leads" : "View Zone Leads"}</span>
                        <ArrowRight className="size-3.5 ml-1" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature Explainer */}
        <div className="rounded-xl border border-border dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#0e0f14]/60 p-5 space-y-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground dark:text-white flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-muted-foreground dark:text-neutral-400" />
            How Claim-Locking Protects Your Territory
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-muted-foreground dark:text-neutral-400">
            <div className="space-y-1.5">
              <div className="font-medium text-foreground dark:text-white flex items-center gap-1.5 text-xs">
                <Users className="size-3.5 text-muted-foreground dark:text-neutral-400" /> 1. Max 2 Non-Compete Orgs
              </div>
              <p className="leading-relaxed text-[11px] text-muted-foreground dark:text-neutral-400">
                We never oversell a zone. Each zone is capped at 2 contractors with personalized ranking so both see different high-priority targets first.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-medium text-foreground dark:text-white flex items-center gap-1.5 text-xs">
                <Lock className="size-3.5 text-muted-foreground dark:text-neutral-400" /> 2. Exclusive 21-Day Lock
              </div>
              <p className="leading-relaxed text-[11px] text-muted-foreground dark:text-neutral-400">
                When you claim an aging commercial roof, the property and owner intelligence are locked exclusively to your team for 21 days.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="font-medium text-foreground dark:text-white flex items-center gap-1.5 text-xs">
                <ShieldCheck className="size-3.5 text-muted-foreground dark:text-neutral-400" /> 3. Rolling 7-Day Activity
              </div>
              <p className="leading-relaxed text-[11px] text-muted-foreground dark:text-neutral-400">
                No claim hoarding. Keep your exclusive lock active by simply logging calls, emails, or site inspections with one click every 7 days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
