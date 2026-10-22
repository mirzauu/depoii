"use client";

import { useEffect, useState } from "react";
import { 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  Activity, 
  Users, 
  CheckCircle2, 
  Phone, 
  FileText, 
  Eye, 
  Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DepoiiLoader } from "@/components/depoii-logo";
import { usd, num } from "@/lib/format";

interface AnalyticsResponse {
  zones: {
    id: string;
    name: string;
    totalParcels: number;
    totalPipelineValue: number;
    activeSubscribers: number;
    activeClaims: number;
    utilizationPct: number;
  }[];
  funnel: {
    totalClaims: number;
    convertedClaims: number;
    pipelineByStage: {
      stage: string;
      count: number;
      value: number;
    }[];
  };
  activity: {
    last7Days: number;
    last30Days: number;
    phoneCalls: number;
    siteVisits: number;
    bidsSubmitted: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    activeSubscriptions: number;
  };
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load analytics");
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
  }, []);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Territory Commercial Analytics & Performance
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Market-level insights: zone utilization rates, claim-to-bid conversion funnel, contractor outreach velocity, and recurring revenue.
        </p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <DepoiiLoader label="Aggregating commercial roofing metrics..." />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Error: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Top Revenue Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                Monthly Run Rate (MRR)
              </div>
              <div className="text-2xl font-bold mt-1 text-primary">
                {usd(data.revenue.mrr)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {data.revenue.activeSubscriptions} active zone subscriptions
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                Annual Run Rate (ARR)
              </div>
              <div className="text-2xl font-bold mt-1 text-emerald-400">
                {usd(data.revenue.arr)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Based on current contractor subscriptions
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-sky-400" />
                Contractor Outreach (7d)
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground">
                {data.activity.last7Days}{" "}
                <span className="text-xs font-normal text-muted-foreground">activities</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {data.activity.last30Days} in the last 30 days
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Claims Converted to Won
              </div>
              <div className="text-2xl font-bold mt-1 text-foreground">
                {data.funnel.convertedClaims}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {data.funnel.totalClaims} claims
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Permanently won commercial contracts
              </div>
            </div>
          </div>

          {/* Zone Utilization Section */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Dallas Zone Capacity & Property Claim Lock Rates
            </h2>
            <div className="space-y-4">
              {data.zones.map((zone) => (
                <div key={zone.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground text-sm">{zone.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ({zone.activeSubscribers}/2 Contractors · {zone.totalParcels} Commercial Roofs)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-foreground">
                        {zone.activeClaims} Active Claims Locked
                      </span>
                      <span className="text-muted-foreground ml-1 font-mono">
                        ({zone.utilizationPct}%)
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, zone.utilizationPct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline Conversion Funnel & Contractor Velocity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Funnel */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Pipeline Stage Breakdown
              </h2>
              <div className="space-y-2 text-xs">
                {data.funnel.pipelineByStage.length === 0 ? (
                  <div className="text-muted-foreground italic">No pipeline leads currently recorded.</div>
                ) : (
                  data.funnel.pipelineByStage.map((stage) => (
                    <div
                      key={stage.stage}
                      className="flex items-center justify-between rounded-lg bg-muted/30 p-2.5 border border-border/40"
                    >
                      <div className="font-semibold text-foreground">{stage.stage}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{stage.count} leads</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {usd(stage.value)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Outreach Activity Breakdown */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" />
                Contractor Outreach Breakdown
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-muted/40 p-3">
                  <Phone className="h-4 w-4 text-primary mx-auto mb-1" />
                  <div className="text-xl font-bold text-foreground">
                    {data.activity.phoneCalls}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Phone Calls</div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3">
                  <Eye className="h-4 w-4 text-sky-400 mx-auto mb-1" />
                  <div className="text-xl font-bold text-foreground">
                    {data.activity.siteVisits}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Site Inspections</div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3">
                  <FileText className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                  <div className="text-xl font-bold text-foreground">
                    {data.activity.bidsSubmitted}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Bids Submitted</div>
                </div>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground leading-relaxed">
                Contractors maintain exclusive property claim locks by logging contact activity at least once every 7 days.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
