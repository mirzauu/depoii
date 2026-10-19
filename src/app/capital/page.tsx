"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ProvenanceBadge } from "@/components/badges";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoii } from "@/components/depoii-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate, usd } from "@/lib/format";

export default function CapitalPage() {
  const { opportunities, developments } = useDepoii();
  const [minAge, setMinAge] = useState(18);

  const aging = useMemo(
    () => opportunities.filter((o) => o.roofAge >= minAge).sort((a, b) => b.roofAge - a.roofAge || b.parcel.sqft - a.parcel.sqft),
    [opportunities, minAge],
  );
  const shown = aging.slice(0, 100);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Off-season · Year-round pipeline"
        title="Capital Replacement & Warranty Expiration"
        description="Year built for Fort Worth and Dallas buildings of at least 25,000 sq ft, from Tarrant Appraisal District and Dallas Central Appraisal District. New-construction permits are Fort Worth filings from 2026 and the City of Dallas public permit extract. A warranty is not on these records; age is year built only."
        actions={
          <select value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            {[15, 18, 20, 25].map((v) => (
              <option key={v} value={v}>Roofs {v}+ years</option>
            ))}
          </select>
        }
      />
      <div className="grid gap-4 px-4 lg:px-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">Older buildings on the appraisal roll <ProvenanceBadge kind="source-record" /></CardTitle>
            <CardDescription>
              {aging.length} buildings at least {minAge} years old. Showing {shown.length}. Benchmark is TAD area × $14/sq ft, not a bid.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {aging.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No roofs at or above this age threshold.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Property</TableHead>
                    <TableHead className="text-right">Roof age</TableHead>
                    <TableHead className="hidden md:table-cell">Archetype</TableHead>
                    <TableHead className="hidden sm:table-cell">Warranty status</TableHead>
                    <TableHead className="pr-6 text-right">Benchmark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((o) => (
                    <TableRow key={o.parcel.id}>
                      <TableCell className="pl-6">
                        <Link href={`/property/${o.parcel.id}`} className="font-medium hover:underline">{o.parcel.address}</Link>
                        <p className="text-xs text-muted-foreground">{o.parcel.city} · {o.parcel.owner}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{o.roofAge}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{o.archetype.label}</TableCell>
                      <TableCell className="hidden text-xs sm:table-cell">Year built {o.parcel.yearBuilt}</TableCell>
                      <TableCell className="pr-6 text-right font-mono tabular-nums">{usd(o.pipelineValue, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">New commercial development <ProvenanceBadge kind="source-record" /></CardTitle>
            <CardDescription>Commercial new-construction permits of at least 20,000 sq ft in the city selected in the header</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {developments.length === 0 && <li className="text-sm text-muted-foreground">No large new-construction permit is on file for this city in the current extract.</li>}
              {developments.map((p) => (
                <li key={p.id} className="border-l-2 border-sky-500/60 pl-3">
                  <p className="font-mono text-xs text-muted-foreground">{p.permitNo} · {shortDate(p.issued)}</p>
                  <p className="font-medium">{p.address}, {p.city}</p>
                  <p className="text-xs text-muted-foreground">{p.scope}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ContractorLink name={p.contractorName} /> · {p.valuation ? usd(p.valuation, true) + " job value" : "no job value recorded"}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
