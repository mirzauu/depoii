"use client";

import Link from "next/link";
import { useState } from "react";
import { EngineLayout, EngineState, Filter, Kpis, Pager, RiskBadge, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapDarkMarket } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";

const LIMIT = 50;

export default function DarkMarketPage() {
  const [minAge, setMinAge] = useState(20);
  const [minSqft, setMinSqft] = useState("");
  const [offset, setOffset] = useState(0);
  const sqft = useDebounced(minSqft);

  const page = useEngine("parcels/dark-market/overdue", { min_age: minAge, min_sqft: sqft, limit: LIMIT, offset }, mapDarkMarket);
  const value = page.data?.parcels.reduce((s, p) => s + p.reroofValue, 0) ?? 0;

  return (
    <EngineLayout
      title="Dark market"
      subtitle="Released leads only. A missing permit search is not shown as an unpitched building."
      filters={
        <>
          <Filter label="Minimum building age">
            <select value={minAge} onChange={(e) => { setMinAge(Number(e.target.value)); setOffset(0); }} className={filterField}>
              {[15, 20, 25, 30, 40].map((v) => <option key={v} value={v}>{v}+ years</option>)}
            </select>
          </Filter>
          <Filter label="Minimum building sq ft">
            <input value={minSqft} inputMode="numeric" onChange={(e) => { setMinSqft(e.target.value.replace(/\D/g, "")); setOffset(0); }} placeholder="e.g. 20000" className={filterField} />
          </Filter>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Covers appraisal parcels the engine holds. Parcel coverage is limited to the seeded counties.</p>
        </>
      }
    >
      <Kpis
        items={[
          { label: "Overdue parcels", value: page.data ? num(page.data.total) : "…" },
          { label: "Reroof value on page", value: page.data ? usd(value, true) : "…" },
          { label: "Minimum age", value: `${minAge} yrs` },
          { label: "Never permitted", value: page.data ? num(page.data.parcels.filter((p) => !p.permitCount).length) : "…" },
        ]}
      />
      <EngineState loading={page.loading} error={page.error} empty={!page.data?.parcels.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Address</TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="hidden md:table-cell text-right">Sq ft</TableHead>
              <TableHead className="text-right">Age</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead className="pr-4 text-right">Est. reroof</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data?.parcels.map((p) => (
              <TableRow key={p.parcelId}>
                <TableCell className="pl-4">
                  <Link href={`/parcels/${encodeURIComponent(p.parcelId)}`} className="font-medium hover:underline">{p.address || p.parcelId}</Link>
                  <span className="block text-xs text-muted-foreground" title={p.angle}>{p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")} · {p.propertyType || "commercial"}</span>
                </TableCell>
                <TableCell className="hidden max-w-64 lg:table-cell">
                  <span className="block truncate">{p.owner || "Not on record"}</span>
                  <span className="block truncate text-xs text-muted-foreground" title={p.ownerMail}>{p.ownerMail || "No mailing address on the roll"}</span>
                </TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums md:table-cell">{p.sqft ? num(p.sqft) : "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{p.age ? `${p.age} yrs` : p.yearBuilt || "—"}</TableCell>
                <TableCell><RiskBadge value={p.urgency} /></TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">{p.reroofValue ? usd(p.reroofValue, true) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager offset={offset} limit={LIMIT} total={page.data?.total ?? 0} onChange={setOffset} />
      </EngineState>
    </EngineLayout>
  );
}
