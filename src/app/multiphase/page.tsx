"use client";

import { useState } from "react";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoiiState } from "@/components/depoii-provider";
import { EngineLayout, EngineState, Kpis, ScopeFilter } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapMultiphase } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";

export default function MultiphasePage() {
  const { jurisdiction } = useDepoiiState();
  const [all, setAll] = useState(true);
  const page = useEngine("permits/multiphase-projects", { jurisdiction: all ? undefined : jurisdiction }, mapMultiphase);
  const value = page.data?.campuses.reduce((s, c) => s + c.valuation, 0) ?? 0;

  return (
    <EngineLayout
      title="Multi-phase projects"
      subtitle="Campuses where several roofing permits were filed in phases. Later phases are still open to bid."
      filters={<ScopeFilter jurisdiction={jurisdiction} all={all} onChange={setAll} />}
    >
      <Kpis
        items={[
          { label: "Campuses", value: page.data ? num(page.data.total) : "…" },
          { label: "Combined value", value: page.data ? usd(value, true) : "…" },
          { label: "Phases", value: page.data ? num(page.data.campuses.reduce((s, c) => s + c.phases, 0)) : "…" },
          { label: "Scope", value: all ? "All locations" : jurisdiction },
        ]}
      />
      <EngineState loading={page.loading} error={page.error} empty={!page.data?.campuses.length} onRetry={page.retry}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Campus</TableHead>
              <TableHead className="text-right">Phases</TableHead>
              <TableHead className="hidden md:table-cell">Contractors</TableHead>
              <TableHead className="pr-4 text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.data?.campuses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.address !== c.name ? `${c.address} · ` : ""}{c.jurisdiction}</span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{c.phases}</TableCell>
                <TableCell className="hidden max-w-72 md:table-cell">
                  {c.contractors.length ? <span className="flex flex-col gap-1">{c.contractors.map((name) => <ContractorLink key={name} name={name} />)}</span> : "—"}
                </TableCell>
                <TableCell className="pr-4 text-right font-mono tabular-nums">{c.valuation ? usd(c.valuation, true) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </EngineState>
    </EngineLayout>
  );
}
