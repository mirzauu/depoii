"use client";

import Link from "next/link";
import { use } from "react";
import { ContractorLink } from "@/components/contractor-link";
import { LeadDossier } from "@/components/lead-dossier";
import { VerificationCard } from "@/components/verification-card";
import { EngineLayout, EngineState, Kpis } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapParcelDossier } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

export default function ParcelDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const parcelId = decodeURIComponent(id);
  const parcel = useEngine(`parcels/${encodeURIComponent(parcelId)}`, {}, mapParcelDossier);
  const p = parcel.data;
  const facts: [string, React.ReactNode][] = p
    ? [
        ["Owner", p.owner || "Not on record"],
        ["Owner mailing address", p.ownerAddress || "—"],
        ["Property type", p.propertyType || "—"],
        ["Account", p.account || p.id],
        ["Jurisdiction", p.jurisdiction || "—"],
        ["County", p.county || "—"],
        ["Land sq ft", p.landSqft ? num(p.landSqft) : "—"],
        ["Improvement value", p.improvementValuation ? usd(p.improvementValuation) : "—"],
        ["Coordinates", p.lat != null && p.lng != null ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "Not geocoded"],
        ["Source", p.source || "—"],
      ]
    : [];

  return (
    <EngineLayout
      title={p?.address || "Parcel dossier"}
      subtitle={p ? [p.city, p.state, p.zip].filter(Boolean).join(", ") : decodeURIComponent(id)}
      actions={<Link href="/pipeline" className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Back to pipeline</Link>}
    >
      <EngineState loading={parcel.loading} error={parcel.error} empty={!p} onRetry={parcel.retry}>
        {p && (
          <>
            <VerificationCard leadId={parcelId} />
            <LeadDossier parcelId={parcelId} />
            <Kpis
              items={[
                { label: "Building sq ft", value: p.sqft ? num(p.sqft) : "—" },
                { label: "Year built", value: p.yearBuilt || "—" },
                { label: "Appraised value", value: p.valuation ? usd(p.valuation, true) : "—" },
                { label: "Permit rows shown", value: num(p.permits.length) },
              ]}
            />
            <dl className="grid gap-x-8 gap-y-3 border-b border-border p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            <h2 className="px-4 pt-4 text-sm font-semibold">Permit history</h2>
            {p.permits.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Permit</TableHead>
                    <TableHead className="hidden md:table-cell">Scope</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.permits.map((x) => (
                    <TableRow key={x.id || x.permitNumber}>
                      <TableCell className="pl-4">
                        <span className="font-medium">{x.permitNumber}</span>
                        <span className="block text-xs text-muted-foreground">{x.issued ? shortDate(x.issued) : "—"}{x.roofSystem ? ` · ${x.roofSystem}` : ""}</span>
                      </TableCell>
                      <TableCell className="hidden max-w-80 truncate md:table-cell" title={x.scope}>{x.scope || "—"}</TableCell>
                      <TableCell className="max-w-56"><ContractorLink name={x.contractor} /></TableCell>
                      <TableCell>{x.status || "—"}</TableCell>
                      <TableCell className="pr-4 text-right font-mono tabular-nums">{x.valuation || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No roofing permit has been filed for this parcel. That makes it a dark-market lead.</p>
            )}
          </>
        )}
      </EngineState>
    </EngineLayout>
  );
}
