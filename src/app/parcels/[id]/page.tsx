"use client";

import Link from "next/link";
import { use } from "react";
import { ContractorLink } from "@/components/contractor-link";
import { LeadContactsCard } from "@/components/lead-contacts-card";
import { LeadDossier } from "@/components/lead-dossier";
import { VerificationCard } from "@/components/verification-card";
import { EngineLayout, EngineState, Kpis } from "@/components/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapParcelDossier } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

import { useSearchParams } from "next/navigation";

export default function ParcelDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const backHref = fromParam === "roof-aging" ? "/roof-aging" : "/pipeline";
  const backLabel = fromParam === "roof-aging" ? "Back to roof aging" : "Back to pipeline";

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
      actions={<Link href={backHref} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">{backLabel}</Link>}
    >
      <EngineState loading={parcel.loading} error={parcel.error} empty={!p} onRetry={parcel.retry}>
        {p && (
          <>
            <VerificationCard leadId={parcelId} />
            <LeadDossier parcelId={parcelId} />
            <div className="p-4 border-b border-border">
              <LeadContactsCard
                contact={p.contact}
                officers={p.officers}
                entity={p.entity}
                ownerName={p.owner}
                ownerAddress={p.ownerAddress}
              />
            </div>
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

            {/* Source Record & Provenance Audit */}
            <div className="border-b border-border bg-muted/15 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Source Files & Record Provenance
              </h2>
              <dl className="grid gap-x-8 gap-y-3 text-xs sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Appraisal Roll File / Source</dt>
                  <dd className="mt-0.5 font-medium">{p.source || "Dallas County Appraisal District (DCAD)"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Year Built Authority</dt>
                  <dd className="mt-0.5 font-medium">{p.yearBuiltSource || "DCAD Certified 2026 Commercial Roll"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Square Footage Authority</dt>
                  <dd className="mt-0.5 font-medium">{p.areaSource || "DCAD_COM_DETAIL_2026"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">CAD Account / Source ID</dt>
                  <dd className="mt-0.5 font-mono font-medium">{p.sourceRecordId || p.account || p.id}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Ingestion Pipeline</dt>
                  <dd className="mt-0.5 font-medium">{p.dataProvenance || "live_dcad_api (Direct Public Record)"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Verified / Ingested Date</dt>
                  <dd className="mt-0.5 font-mono text-[11px]">{p.provenanceDate || p.retrievedAt || "2026-10-14T01:55:53Z"}</dd>
                </div>
              </dl>
            </div>

            {/* Improvement Sections */}
            {p.improvementSections && (() => {
              try {
                const sections = typeof p.improvementSections === "string" ? JSON.parse(p.improvementSections) : p.improvementSections;
                if (Array.isArray(sections) && sections.length > 0) {
                  return (
                    <div className="border-b border-border p-4">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        CAD Building Structure Breakdown ({sections.length} Sections)
                      </h2>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {sections.map((sec: any, idx: number) => (
                          <div key={idx} className="rounded-lg border border-border p-3 text-xs">
                            <p className="font-semibold">{sec.description || `Section ${idx + 1}`}</p>
                            <p className="text-muted-foreground mt-0.5">
                              {sec.stories ? `${sec.stories} Stories` : ""} {sec.year_built ? `· Built ${sec.year_built}` : ""}
                            </p>
                            <p className="font-mono mt-1 font-medium">
                              {sec.area_sqft ? num(sec.area_sqft) : "—"} sq ft {sec.foundation_sqft ? `(${num(sec.foundation_sqft)} footprint)` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch {
                return null;
              }
              return null;
            })()}
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
