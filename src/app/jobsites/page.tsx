"use client";

import { useState } from "react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Filter, Kpis, Pager, ScopeFilter, filterField, useDebounced } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermitDetailDrawer } from "@/components/permit-detail-drawer";
import { ParcelDetailDrawer } from "@/components/parcel-detail-drawer";
import { mapJobsites, type EnginePermit } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

const LIMIT = 50;

function daysSince(iso: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(`${iso}T12:00:00Z`).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export default function JobsitesPage() {
  const { jurisdiction } = useDepoiiState();
  const [selectedPermit, setSelectedPermit] = useState<EnginePermit | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const [contractor, setContractor] = useState("");
  const [roof, setRoof] = useState("");
  const [minVal, setMinVal] = useState("");
  const [offset, setOffset] = useState(0);
  const q = useDebounced(search);
  const c = useDebounced(contractor);
  const lo = useDebounced(minVal);

  const page = useEngine(
    "permits/active-jobsites",
    { jurisdiction: all ? undefined : jurisdiction, search: q, contractor: c, roof_system: roof, min_valuation: lo, limit: LIMIT, offset },
    mapJobsites,
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
  };

  return (
    <EngineLayout
      title="Active jobsites"
      subtitle={`${all ? "All locations" : jurisdiction} · commercial roofs with an open permit, issued in the last 90 to 180 days`}
      filters={
        <>
          <ScopeFilter jurisdiction={jurisdiction} all={all} onChange={reset(setAll)} />
          <Filter label="Search">
            <input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Permit, address, scope" className={filterField} />
          </Filter>
          <Filter label="Contractor">
            <input value={contractor} onChange={(e) => reset(setContractor)(e.target.value)} placeholder="Name" className={filterField} />
          </Filter>
          <Filter label="Roof system">
            <select value={roof} onChange={(e) => reset(setRoof)(e.target.value)} className={filterField}>
              <option value="">Any</option>
              {(page.data?.roofSystems ?? []).map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </Filter>
          <Filter label="Min value">
            <input value={minVal} inputMode="numeric" onChange={(e) => reset(setMinVal)(e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" className={filterField} />
          </Filter>
        </>
      }
    >
      <Kpis
        items={[
          { label: "Active jobs", value: page.data ? num(page.data.total) : "…" },
          { label: "Active pipeline", value: page.data ? usd(page.data.valuation, true) : "…" },
          { label: "Contractors on site", value: page.data ? num(page.data.contractors) : "…" },
          { label: "Top roof system", value: page.data?.roofSystems[0]?.name ?? "—" },
        ]}
      />
      <EngineState loading={page.loading} error={page.error} empty={!page.data?.jobsites.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Permit</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="hidden lg:table-cell">Contractor</TableHead>
              <TableHead className="hidden md:table-cell">Roof system</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Days open</TableHead>
              <TableHead className="pr-4 text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data?.jobsites.map((j) => {
              const days = daysSince(j.issued);
              return (
                <TableRow
                  key={j.id}
                  onClick={() => setSelectedPermit({
                    id: j.id,
                    permitNumber: j.permitNumber,
                    jurisdiction: j.jurisdiction,
                    address: j.address,
                    city: "",
                    state: "",
                    zip: "",
                    issued: j.issued,
                    status: j.status || "Active",
                    valuation: j.valuation,
                    category: j.category || "Commercial Re-Roof",
                    roofSystem: j.roofSystem,
                    contractor: j.contractor,
                    description: j.scope || "Active commercial roofing jobsite in progress.",
                    sqft: 0,
                    hailWindow: false,
                    storm: "",
                    parcelId: "",
                    lat: j.lat,
                    lng: j.lng,
                  })}
                  className="cursor-pointer hover:bg-neutral-500/10 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <TableCell className="pl-4">
                    <span className="font-medium group-hover:text-primary transition-colors">{j.permitNumber}</span>
                    <span className="block text-xs text-muted-foreground">{j.issued ? shortDate(j.issued) : "Issue date blank"} · {j.status || "status blank"}</span>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <span className="block truncate">{j.address || "Address not published"}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={j.scope}>{j.jurisdiction} · {j.category}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-56 lg:table-cell" onClick={(e) => e.stopPropagation()}><ContractorLink name={j.contractor} /></TableCell>
                  <TableCell className="hidden md:table-cell">{j.roofSystem || "—"}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{days ?? "—"}</TableCell>
                  <TableCell className="pr-4 text-right font-mono tabular-nums">{j.valuation ? usd(j.valuation, true) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pager offset={offset} limit={LIMIT} total={page.data?.total ?? 0} onChange={setOffset} />
      </EngineState>

      {/* Permit Detail Half Window / Drawer */}
      <PermitDetailDrawer
        permit={selectedPermit}
        onClose={() => setSelectedPermit(null)}
        onViewParcel={(parcelId) => {
          setSelectedPermit(null);
          setSelectedParcelId(parcelId);
        }}
      />

      {/* Connected Parcel Detail Drawer */}
      <ParcelDetailDrawer
        parcelId={selectedParcelId}
        onClose={() => setSelectedParcelId(null)}
      />
    </EngineLayout>
  );
}
