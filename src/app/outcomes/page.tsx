"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { ScorePill } from "@/components/badges";
import { useDepoii } from "@/components/depoii-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calibrate, isPositive } from "@/lib/engine/outcomes";
import { DEFAULT_WEIGHTS, FACTOR_LABELS } from "@/lib/engine/score";
import { pct, usd } from "@/lib/format";
import type { ScoreWeights } from "@/lib/types";

const FACTORS = Object.keys(FACTOR_LABELS) as (keyof ScoreWeights)[];

export default function OutcomesPage() {
  const { outcomes, setOutcomes, weights, setWeights, parcels } = useDepoii();
  const cal = useMemo(() => calibrate(outcomes, weights), [outcomes, weights]);
  const won = outcomes.reduce((s, o) => s + o.contractValue, 0);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Closed-loop moat"
        title="Field Outcomes & Model Calibration"
        description="Every logged inspection is compared with what Depoii predicted. Weights move toward the factors that best separated verified damage from clean roofs."
        actions={
          outcomes.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setOutcomes([])}>
              Clear outcomes
            </Button>
          )
        }
      />
      {outcomes.length === 0 ? (
        <div className="mx-4 rounded-lg border border-dashed border-border p-10 text-center lg:mx-8">
          <p className="font-medium">No field outcomes logged yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Open a property from the <Link href="/pipeline" className="underline">pipeline</Link> and record what the crew actually found. Depoii does not invent inspection results.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-8">
          <Card>
            <CardHeader><CardDescription>Inspections logged</CardDescription><CardTitle className="text-3xl">{cal.sample}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader><CardDescription>Verified-damage hit rate</CardDescription><CardTitle className="text-3xl">{pct(cal.hitRate)}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader><CardDescription>Contract value awarded</CardDescription><CardTitle className="text-3xl">{usd(won, true)}</CardTitle></CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hit rate by score band</CardTitle>
              <CardDescription>Higher-scored properties should verify more often</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cal.bands.map((b) => (
                <div key={b.band} className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Score {b.band}</span><span className="text-muted-foreground">{b.inspections ? `${pct(b.hitRate)} of ${b.inspections}` : "—"}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-red-500" style={{ width: `${b.hitRate * 100}%` }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Weight calibration preview</CardTitle>
              <CardDescription>Lift = how much higher the factor scored on verified-damage roofs than on clean roofs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factor</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Lift</TableHead>
                    <TableHead className="text-right">Suggested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FACTORS.map((f) => (
                    <TableRow key={f}>
                      <TableCell>{FACTOR_LABELS[f]}</TableCell>
                      <TableCell className="text-right font-mono">{weights[f].toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-mono ${cal.lift[f] > 0 ? "text-emerald-300" : cal.lift[f] < 0 ? "text-red-300" : ""}`}>{(cal.lift[f] * 100).toFixed(0)}</TableCell>
                      <TableCell className="text-right font-mono">{cal.suggested[f].toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setWeights(cal.suggested)}>Apply suggested weights</Button>
                <Button variant="outline" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Reset to defaults</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader><CardTitle>Inspection log</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Property</TableHead>
                    <TableHead>Predicted</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="hidden sm:table-cell">Scope</TableHead>
                    <TableHead className="pr-6 text-right">Awarded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outcomes.map((o) => {
                    const p = parcels.find((x) => x.id === o.parcelId);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="pl-6">
                          <Link href={`/property/${o.parcelId}`} className="font-medium hover:underline">{p?.address ?? o.parcelId}</Link>
                          <p className="max-w-xs truncate text-xs text-muted-foreground">{o.notes}</p>
                        </TableCell>
                        <TableCell><ScorePill score={o.predictedScore} /></TableCell>
                        <TableCell className={isPositive(o) ? "text-emerald-300" : "text-muted-foreground"}>{isPositive(o) ? "Damage verified" : "No damage"}</TableCell>
                        <TableCell className="hidden capitalize sm:table-cell">{o.scope === "none" ? "—" : o.scope}</TableCell>
                        <TableCell className="pr-6 text-right font-mono">{o.contractValue ? usd(o.contractValue) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
