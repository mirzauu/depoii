"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { 
  ClipboardCheck, 
  Lock, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  Sparkles,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { ScorePill } from "@/components/badges";
import { useDepoii } from "@/components/depoii-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InspectionOutcomeModal, type InspectionTarget } from "@/components/inspection-outcome-modal";
import { calibrate, isPositive } from "@/lib/engine/outcomes";
import { DEFAULT_WEIGHTS, FACTOR_LABELS } from "@/lib/engine/score";
import { num, pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClaimWithProperty } from "@/lib/claims";
import type { FieldOutcome, ScoreWeights } from "@/lib/types";

const FACTORS = Object.keys(FACTOR_LABELS) as (keyof ScoreWeights)[];

export default function OutcomesPage() {
  const { outcomes, addOutcome, setOutcomes, weights, setWeights, parcels } = useDepoii();
  const [claims, setClaims] = useState<ClaimWithProperty[]>([]);
  const [modalTarget, setModalTarget] = useState<InspectionTarget | null>(null);

  // Fetch claimed deals from /api/claims to bridge with Field Outcomes
  const loadClaims = () => {
    fetch("/api/claims")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.claims && Array.isArray(data.claims)) {
          setClaims(data.claims);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const cal = useMemo(() => calibrate(outcomes, weights), [outcomes, weights]);
  const won = outcomes.reduce((s, o) => s + o.contractValue, 0);

  // Identify which claimed properties are still pending a field inspection
  const outcomeParcelIds = useMemo(() => new Set(outcomes.map((o) => o.parcelId)), [outcomes]);
  const pendingClaims = useMemo(
    () => claims.filter((c) => !outcomeParcelIds.has(c.parcelId)),
    [claims, outcomeParcelIds]
  );

  return (
    <div className="space-y-5 px-4 py-5 lg:px-8 max-w-7xl mx-auto pb-12">
      {/* Header matching Depoii standard UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ClipboardCheck className="size-5 text-neutral-300" />
              Field Outcomes & Model Calibration
            </h1>
            <span className="rounded-full border border-neutral-700/50 bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
              Closed-Loop Moat
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            Every physical inspection is compared with what Depoii predicted. Algorithm weights automatically calibrate toward the factors that best separate verified damage from clean roofs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/claims"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs font-semibold border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-200")}
          >
            <Lock className="size-3.5 text-neutral-400" />
            <span>My Property Claims ({claims.length})</span>
          </Link>
          {outcomes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Clear all field outcomes?")) setOutcomes([]);
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear outcomes
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats Row matching Depoii UI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card/60 p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Inspections Logged
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {cal.sample} <span className="text-xs font-normal text-muted-foreground">Verified</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Verified-Damage Hit Rate
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-[#B4E4D6]">
            {cal.sample > 0 ? pct(cal.hitRate) : "—"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contract Value Awarded
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-white font-mono">
            {usd(won, true)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/60 p-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Claims Awaiting Inspection
          </div>
          <div className={`mt-1 text-xl font-bold tracking-tight ${pendingClaims.length > 0 ? "text-[#FFCA88]" : "text-neutral-400"}`}>
            {pendingClaims.length} <span className="text-xs font-normal text-muted-foreground">Pending</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Active Claims Awaiting Field Inspection (The Bridge) */}
      {pendingClaims.length > 0 && (
        <Card className="rounded-lg border-neutral-800 bg-[#0d0e14]">
          <CardHeader className="pb-3 border-b border-neutral-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="size-4 text-[#FFCA88]" />
                  Active Claims Awaiting Field Inspection ({pendingClaims.length})
                </CardTitle>
                <CardDescription className="text-xs text-neutral-400 mt-0.5">
                  Properties locked to your company. Once your field crew inspects the roof, click &quot;Log Inspection Finding&quot; to calibrate the AI model.
                </CardDescription>
              </div>
              <Link
                href="/claims"
                className="text-xs text-neutral-300 hover:text-white hover:underline flex items-center gap-1 font-medium shrink-0"
              >
                <span>Manage Claims</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="border-b border-neutral-800/80 hover:bg-transparent">
                    <TableHead className="pl-5 text-neutral-300 font-semibold">Property</TableHead>
                    <TableHead className="text-neutral-300 font-semibold">Owner</TableHead>
                    <TableHead className="text-right text-neutral-300 font-semibold">Footprint</TableHead>
                    <TableHead className="text-right text-neutral-300 font-semibold">Hail Exposure</TableHead>
                    <TableHead className="text-neutral-300 font-semibold">Exclusivity Status</TableHead>
                    <TableHead className="pr-5 text-right text-neutral-300 font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-neutral-800/60">
                  {pendingClaims.map((claim) => (
                    <TableRow key={claim.id} className="hover:bg-[#161722]/80 transition-colors">
                      <TableCell className="pl-5 py-3 font-medium">
                        <Link 
                          href={`/parcels/${claim.parcelId}`}
                          className="text-white hover:text-neutral-200 hover:underline flex items-center gap-1 leading-snug"
                        >
                          <span>{claim.address || "Commercial Property"}</span>
                          <ExternalLink className="size-3 opacity-60" />
                        </Link>
                        <span className="block text-[11px] text-neutral-400 mt-0.5">
                          {[claim.city, claim.state, claim.zipCode].filter(Boolean).join(", ")}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-neutral-300 max-w-48 truncate">
                        {claim.ownerName || "Commercial Owner"}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono text-neutral-300">
                        {claim.buildingSqft ? `${num(claim.buildingSqft)} sq ft` : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-right font-mono font-semibold text-[#FFCA88]">
                        {claim.exposureScore ? `${claim.exposureScore} Score` : "Storm Tracked"}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#B4E4D6]/30 bg-[#B4E4D6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#B4E4D6]">
                          <Lock className="size-2.5" />
                          Locked ({claim.daysRemaining}d left)
                        </span>
                      </TableCell>
                      <TableCell className="pr-5 py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => setModalTarget({
                            claimId: claim.id,
                            parcelId: claim.parcelId,
                            address: claim.address,
                            city: claim.city,
                            state: claim.state,
                            zipCode: claim.zipCode,
                            ownerName: claim.ownerName || undefined,
                            buildingSqft: claim.buildingSqft,
                            predictedScore: claim.exposureScore || 85,
                          })}
                          variant="brand"
                          className="h-7 text-xs gap-1.5"
                        >
                          <ClipboardCheck className="size-3.5" />
                          <span>Log Inspection Finding</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Verified Outcomes & AI Model Calibration */}
      {outcomes.length === 0 ? (
        pendingClaims.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-3">
            <ClipboardCheck className="size-8 text-muted-foreground mx-auto" />
            <p className="font-semibold text-base text-foreground">No field outcomes logged yet</p>
            <p className="mx-auto max-w-md text-xs text-muted-foreground leading-relaxed">
              Claim a property from the <Link href="/pipeline" className="text-sky-400 underline">pipeline</Link> or <Link href="/territory" className="text-sky-400 underline">territories</Link>, then log what the crew actually found on the roof to calibrate the scoring model.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Link href="/territory" className={cn(buttonVariants({ size: "sm" }), "h-8 text-xs")}>
                Explore Territories
              </Link>
              <Link href="/claims" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}>
                View My Claims
              </Link>
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Hit rate by score band */}
          <Card className="rounded-lg border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground">Hit rate by score band</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Higher-scored properties should verify damage more frequently
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cal.bands.map((b) => (
                <div key={b.band} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>Score {b.band}</span>
                    <span className="text-muted-foreground">
                      {b.inspections ? `${pct(b.hitRate)} of ${b.inspections}` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-[#B4E4D6] rounded-full" style={{ width: `${b.hitRate * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Weight calibration preview */}
          <Card className="rounded-lg border-border bg-card/60 lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Weight calibration preview</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Lift = how much higher the factor scored on verified-damage roofs than on clean roofs
                  </CardDescription>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B4E4D6] bg-[#B4E4D6]/10 border border-[#B4E4D6]/20 px-2 py-0.5 rounded-full">
                  AI Calibrated
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="border-b border-border/80">
                      <TableHead className="text-muted-foreground font-semibold">Factor</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Current</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Lift</TableHead>
                      <TableHead className="text-right text-muted-foreground font-semibold">Suggested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FACTORS.map((f) => (
                      <TableRow key={f} className="border-b border-border/50">
                        <TableCell className="font-medium text-foreground">{FACTOR_LABELS[f]}</TableCell>
                        <TableCell className="text-right font-mono">{weights[f].toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-mono ${cal.lift[f] > 0 ? "text-[#B4E4D6] font-semibold" : cal.lift[f] < 0 ? "text-[#DE7272]" : "text-muted-foreground"}`}>
                          {(cal.lift[f] * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-white">{cal.suggested[f].toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="brand"
                  onClick={() => setWeights(cal.suggested)}
                  className="h-8 text-xs font-semibold"
                >
                  <Sparkles className="size-3.5 mr-1" />
                  Apply suggested weights
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setWeights(DEFAULT_WEIGHTS)}
                  className="h-8 text-xs"
                >
                  <RotateCcw className="size-3 mr-1" />
                  Reset to defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: Verified Inspection Log Table */}
          <Card className="rounded-lg border-border bg-card/60 lg:col-span-3">
            <CardHeader className="pb-3 border-b border-border/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Verified Inspection Log</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Historical record of completed ground truth inspections
                  </CardDescription>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {outcomes.length} records
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="border-b border-border/80">
                      <TableHead className="pl-5 text-muted-foreground font-semibold">Property</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Predicted Score</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Ground Outcome</TableHead>
                      <TableHead className="hidden sm:table-cell text-muted-foreground font-semibold">Approved Scope</TableHead>
                      <TableHead className="pr-5 text-right text-muted-foreground font-semibold">Awarded Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/60">
                    {outcomes.map((o) => {
                      const p = parcels.find((x) => x.id === o.parcelId);
                      return (
                        <TableRow key={o.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="pl-5 py-3">
                            <Link 
                              href={`/parcels/${o.parcelId}`} 
                              className="font-medium text-foreground hover:text-sky-400 hover:underline block truncate max-w-xs"
                            >
                              {p?.address ?? o.parcelId}
                            </Link>
                            {o.notes && (
                              <p className="max-w-xs truncate text-[11px] text-muted-foreground mt-0.5" title={o.notes}>
                                {o.notes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <ScorePill score={o.predictedScore} />
                          </TableCell>
                          <TableCell className="py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                              isPositive(o)
                                ? "bg-[#B4E4D6]/10 text-[#B4E4D6] border-[#B4E4D6]/20"
                                : "bg-neutral-900/60 text-neutral-400 border-neutral-800"
                            )}>
                              <span className={cn("size-1.5 rounded-full shrink-0", isPositive(o) ? "bg-[#B4E4D6]" : "bg-neutral-600")} />
                              {isPositive(o) ? "Damage verified" : "No damage / clean"}
                            </span>
                          </TableCell>
                          <TableCell className="hidden capitalize sm:table-cell py-3 text-neutral-300">
                            {o.scope === "none" ? "—" : o.scope}
                          </TableCell>
                          <TableCell className="pr-5 py-3 text-right font-mono tabular-nums font-medium text-neutral-100">
                            {o.contractValue ? usd(o.contractValue) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Field Inspection Outcome Modal */}
      <InspectionOutcomeModal
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSuccess={(newOutcome) => {
          addOutcome(newOutcome);
          loadClaims();
        }}
      />
    </div>
  );
}
