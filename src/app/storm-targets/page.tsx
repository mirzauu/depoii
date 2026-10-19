"use client";

import Link from "next/link";
import { useState } from "react";
import { EngineLayout, EngineState, Filter, Kpis, RiskBadge, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapExposure, mapSwaths } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

export default function StormTargetsPage() {
  const [stormId, setStormId] = useState("");
  const [minHail, setMinHail] = useState(1);
  const [minSqft, setMinSqft] = useState("");
  const sqft = useDebounced(minSqft);

  const swaths = useEngine("storms/active-swaths", {}, mapSwaths);
  const page = useEngine("intelligence/unresolved-exposure", { storm_id: stormId, min_hail_inches: minHail, min_sqft: sqft }, mapExposure);
  const storms = [...new Map((swaths.data ?? []).filter((s) => s.properties.id).map((s) => [s.properties.id, s.properties])).values()];

  return (
    <EngineLayout
      title="Storm targets"
      subtitle="Released leads only. This list stays empty until a building clears the roof, SPC, and permit-search checks."
      filters={
        <>
          <Filter label="Storm">
            <select value={stormId} onChange={(e) => setStormId(e.target.value)} className={filterField}>
              <option value="">All active storms</option>
              {storms.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}{s.date ? ` · ${s.date}` : ""}</option>)}
            </select>
          </Filter>
          <Filter label="Minimum hail">
            <select value={minHail} onChange={(e) => setMinHail(Number(e.target.value))} className={filterField}>
              {[0.75, 1, 1.5, 2, 2.5].map((v) => <option key={v} value={v}>{v}&Prime;+</option>)}
            </select>
          </Filter>
          <Filter label="Minimum building sq ft">
            <input value={minSqft} inputMode="numeric" onChange={(e) => setMinSqft(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 20000" className={filterField} />
          </Filter>
        </>
      }
    >
      <Kpis
        items={[
          { label: "Unresolved targets", value: page.data ? num(page.data.total) : "…" },
          { label: "Unresolved value (mid)", value: page.data ? usd(page.data.valuation, true) : "…" },
          { label: "Active storm swaths", value: swaths.data ? num(storms.length) : "…" },
          { label: "Largest hail", value: page.data?.targets.length ? `${Math.max(...page.data.targets.map((t) => t.hail))}″` : "—" },
        ]}
      />
      <EngineState loading={page.loading} error={page.error} empty={!page.data?.targets.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Address</TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="hidden md:table-cell">Storm</TableHead>
              <TableHead className="text-right">Hail</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Months open</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="pr-4 text-right">Replacement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data?.targets.map((t, i) => (
              <TableRow key={`${t.parcelId || t.address}-${t.storm}-${i}`}>
                <TableCell className="pl-4">
                  {t.parcelId ? (
                    <Link href={`/parcels/${encodeURIComponent(t.parcelId)}`} className="font-medium hover:underline">{t.address}</Link>
                  ) : <span className="font-medium">{t.address}</span>}
                  <span className="block text-xs text-muted-foreground">{[t.city, t.state].filter(Boolean).join(", ")}{t.sqft ? ` · ${num(t.sqft)} sq ft` : ""}</span>
                </TableCell>
                <TableCell className="hidden max-w-48 truncate lg:table-cell">{t.owner || "Not on record"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {t.storm || "—"}
                  {t.stormDate && <span className="block text-xs text-muted-foreground">{shortDate(t.stormDate)}</span>}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{t.hail ? `${t.hail}″` : "—"}</TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{t.monthsUnrepaired || "—"}</TableCell>
                <TableCell><RiskBadge value={t.tier} /></TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">
                  {t.replacementHigh ? `${usd(t.replacementLow, true)}–${usd(t.replacementHigh, true)}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </EngineState>
    </EngineLayout>
  );
}
