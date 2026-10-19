"use client";

import Link from "next/link";
import { useState } from "react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Filter, Kpis, Pager, RiskBadge, ScopeFilter, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapAging, mapDarkMarket } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

const LIMIT = 50;

export default function RoofAgingPage() {
  const { jurisdiction } = useDepoiiState();
  const [record, setRecord] = useState<"aged" | "never">("aged");
  const [all, setAll] = useState(true);
  const [includePublic, setIncludePublic] = useState(false);
  const [tier, setTier] = useState("");
  const [minAge, setMinAge] = useState(15);
  const [minVal, setMinVal] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const q = useDebounced(search);
  const lo = useDebounced(minVal);

  const page = useEngine(
    "permits/roof-aging-alarm",
    { jurisdiction: all ? undefined : jurisdiction, risk_tier: tier, min_age: minAge, min_valuation: lo, search: q, limit: LIMIT, offset },
    mapAging,
    record === "aged",
  );
  const dark = useEngine(
    "parcels/dark-market/overdue",
    { min_age: minAge, min_sqft: 20000, limit: LIMIT, offset, jurisdiction, include_public: includePublic },
    mapDarkMarket,
    record === "never",
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
  };

  return (
    <EngineLayout
      title="Roof aging alarm"
      subtitle={record === "never" ? `Buildings ${minAge}+ years old with no roofing permit on record` : `${all ? "All locations" : jurisdiction} · roofs whose last permitted install is ${minAge}+ years old`}
      filters={
        <>
          <Filter label="Record">
            <select value={record} onChange={(e) => { setRecord(e.target.value as "aged" | "never"); setOffset(0); }} className={filterField}>
              <option value="aged">Last install is old</option>
              <option value="never">No roofing permit</option>
            </select>
          </Filter>
          {record === "aged" && <ScopeFilter jurisdiction={jurisdiction} all={all} onChange={reset(setAll)} />}
          {record === "never" && (
            <Filter label="Owners">
              <button type="button" onClick={() => reset(setIncludePublic)(!includePublic)} className={filterField}>{includePublic ? "Including public owners" : "Private owners only"}</button>
            </Filter>
          )}
          {record === "aged" && <Filter label="Risk tier">
            <select value={tier} onChange={(e) => reset(setTier)(e.target.value)} className={filterField}>
              <option value="">Any</option>
              <option value="CRITICAL">Critical · 20+ years</option>
              <option value="HIGH">High · 15–19 years</option>
              <option value="MODERATE">Moderate · 10–14 years</option>
            </select>
          </Filter>}
          <Filter label="Minimum roof age">
            <select value={minAge} onChange={(e) => reset(setMinAge)(Number(e.target.value))} className={filterField}>
              {[10, 15, 20, 25].map((v) => <option key={v} value={v}>{v}+ years</option>)}
            </select>
          </Filter>
          {record === "aged" && <Filter label="Min historical value">
            <input value={minVal} inputMode="numeric" onChange={(e) => reset(setMinVal)(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" className={filterField} />
          </Filter>}
          {record === "aged" && <Filter label="Search">
            <input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Address or contractor" className={filterField} />
          </Filter>}
          {record === "aged" && page.data?.jurisdictions.length ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">Aging data exists for {page.data.jurisdictions.join(", ")}.</p>
          ) : null}
        </>
      }
    >
      <Kpis
        items={record === "never" ? [
          { label: "No permit on record", value: dark.data ? num(dark.data.total) : "…" },
          { label: "Reroof value on page", value: dark.data ? usd(dark.data.parcels.reduce((s, p) => s + p.reroofValue, 0), true) : "…" },
          { label: "Minimum age", value: `${minAge} yrs` },
          { label: "On this page", value: dark.data ? num(dark.data.parcels.length) : "…" },
        ] : [
          { label: "Aging roofs", value: page.data ? num(page.data.total) : "…" },
          { label: "Replacement pipeline", value: page.data ? usd(page.data.pipeline, true) : "…" },
          { label: "Warranty expired", value: page.data ? num(page.data.critical) : "…" },
          { label: "Approaching term", value: page.data ? num(page.data.approaching) : "…" },
        ]}
      />
      {record === "never" ? (
        <EngineState loading={dark.loading} error={dark.error} empty={!dark.data?.parcels.length} onRetry={dark.retry}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Address</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="pr-4 text-right">Est. replacement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dark.data?.parcels.map((p) => (
                <TableRow key={p.parcelId}>
                  <TableCell className="pl-4">
                    <Link href={`/parcels/${encodeURIComponent(p.parcelId)}`} className="font-medium hover:underline">{p.address || p.parcelId}</Link>
                    <span className="block text-xs text-muted-foreground">{p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-52 truncate lg:table-cell">{p.owner || "Not on record"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{p.age ? `${p.age} yrs` : "—"}</TableCell>
                  <TableCell>No roofing permit</TableCell>
                  <TableCell className="pr-4 text-right font-mono tabular-nums">{p.reroofValue ? usd(p.reroofValue, true) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager offset={offset} limit={LIMIT} total={dark.data?.total ?? 0} onChange={setOffset} />
        </EngineState>
      ) : (
      <EngineState loading={page.loading} error={page.error} empty={!page.data?.roofs.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Address</TableHead>
              <TableHead className="hidden md:table-cell">Installed</TableHead>
              <TableHead className="text-right">Age</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="hidden lg:table-cell">Roof system</TableHead>
              <TableHead className="hidden xl:table-cell">Last contractor</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Priority</TableHead>
              <TableHead className="pr-4 text-right">Est. replacement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data?.roofs.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4">
                  <Link href={`/permits?q=${encodeURIComponent(r.permitNumber || r.address)}`} className="font-medium hover:underline">{r.address}</Link>
                  <span className="block text-xs text-muted-foreground">{r.jurisdiction} · permit {r.permitNumber}{r.laterPermits ? ` · ${r.laterPermits} later permits` : ""}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{r.installed ? shortDate(r.installed) : "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.age} yrs</TableCell>
                <TableCell><RiskBadge value={r.risk} /></TableCell>
                <TableCell className="hidden lg:table-cell">{r.roofSystem || "—"}</TableCell>
                <TableCell className="hidden max-w-56 xl:table-cell"><ContractorLink name={r.contractor} /></TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{r.priority || "—"}</TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">{r.replacementCost ? usd(r.replacementCost, true) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager offset={offset} limit={LIMIT} total={page.data?.total ?? 0} onChange={setOffset} />
      </EngineState>
      )}
    </EngineLayout>
  );
}
