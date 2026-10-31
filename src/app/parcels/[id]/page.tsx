"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { LeadContactsCard } from "@/components/lead-contacts-card";
import { LeadDossier } from "@/components/lead-dossier";
import { RoofTimeline } from "@/components/roof-timeline";
import { VerificationCard } from "@/components/verification-card";
import { EngineLayout, EngineState } from "@/components/engine-layout";
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

  const [copiedAccount, setCopiedAccount] = useState(false);

  const cleanAccountId = p?.account?.replace(/^DCAD-PARCEL-/i, "") || p?.id || "";
  const cadUrl = p?.account?.startsWith("TAD")
    ? `https://www.tad.org/property/${encodeURIComponent(cleanAccountId)}`
    : `https://www.dallascad.org/SearchAcct.aspx?ACCOUNTNO=${encodeURIComponent(cleanAccountId)}`;

  return (
    <EngineLayout
      title="Property Intelligence"
      subtitle=""
      actions={
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            ← {backLabel}
          </Link>
        </div>
      }
    >
      <EngineState loading={parcel.loading} error={parcel.error} empty={!p} onRetry={parcel.retry}>
        {p && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
            {/* Confident Document Header (28px Title with Proper Scale Contrast) */}
            <div className="space-y-1.5 pb-2 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {p.address}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {[p.city, p.state, p.zip].filter(Boolean).join(", ")}
                    {p.county ? ` · ${p.county} County` : ""}
                    {p.source ? ` · ${p.source}` : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Notion Database Properties Grid: Precision Left-Edge Alignment */}
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-xs">
                {/* Column 1 */}
                <div className="space-y-3">
                  {/* Property: Decision Maker */}
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-muted-foreground flex items-center gap-1.5 font-medium pt-0.5">
                      <User className="size-3.5 text-muted-foreground/70" />
                      Contact
                    </span>
                    <div className="min-w-0 flex-1">
                      {p.contact?.decisionMakerName ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground">{p.contact.decisionMakerName}</span>
                            {p.contact.decisionMakerTitle && (
                              <span className="text-muted-foreground text-[11px]">({p.contact.decisionMakerTitle})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {p.contact.phoneNumber && (
                              <a
                                href={`tel:${p.contact.phoneNumber.replace(/[^\d+]/g, "")}`}
                                className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-border hover:underline"
                              >
                                <Phone className="size-2.5" />
                                {p.contact.phoneNumber}
                              </a>
                            )}
                            {p.contact.emailAddress && (
                              <a
                                href={`mailto:${p.contact.emailAddress}`}
                                className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 border border-border hover:underline"
                              >
                                <Mail className="size-2.5" />
                                {p.contact.emailAddress}
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-medium pt-0.5 block">{p.owner || "Owner on record"}</span>
                      )}
                    </div>
                  </div>

                  {/* Property: Building Spec */}
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-muted-foreground flex items-center gap-1.5 font-medium pt-0.5">
                      <Building2 className="size-3.5 text-muted-foreground/70" />
                      Structure
                    </span>
                    <div className="text-foreground font-medium pt-0.5">
                      <span>{p.sqft ? `${num(p.sqft)} sq ft` : "—"}</span>
                      {p.yearBuilt ? (
                        <span className="text-muted-foreground"> · Built {p.yearBuilt} (~{Math.max(1, 2026 - p.yearBuilt)} yrs)</span>
                      ) : null}
                      {p.valuation ? (
                        <span className="text-foreground"> · {usd(p.valuation, true)}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Property: CAD Account */}
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-muted-foreground flex items-center gap-1.5 font-medium pt-0.5">
                      <FileText className="size-3.5 text-muted-foreground/70" />
                      CAD Roll
                    </span>
                    <div className="text-foreground font-mono text-[11px] flex items-center gap-2 pt-0.5">
                      <span>{cleanAccountId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(cleanAccountId);
                          setCopiedAccount(true);
                          setTimeout(() => setCopiedAccount(false), 1200);
                        }}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Copy CAD account"
                      >
                        {copiedAccount ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      </button>
                      <a
                        href={cadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px]"
                        title="View official Appraisal District roll"
                      >
                        <span>Portal</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-3">
                  {/* Property: Archetype */}
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-muted-foreground flex items-center gap-1.5 font-medium pt-0.5">
                      <Shield className="size-3.5 text-muted-foreground/70" />
                      Archetype
                    </span>
                    <div className="text-foreground pt-0.5 font-medium">
                      <span>{p.propertyType || "Commercial Property"}</span>
                      {p.jurisdiction ? <span className="text-muted-foreground"> · {p.jurisdiction}</span> : ""}
                    </div>
                  </div>

                  {/* Property: Permit Status */}
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-muted-foreground flex items-center gap-1.5 font-medium pt-0.5">
                      <CheckCircle2 className="size-3.5 text-muted-foreground/70" />
                      Permit Status
                    </span>
                    <div className="pt-0.5">
                      {p.permits.length === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Zero prior roof permits (Dark Market Lead)
                        </span>
                      ) : (
                        <span className="text-foreground">{num(p.permits.length)} municipal permits on file</span>
                      )}
                    </div>
                  </div>

                  {/* Property: Location & Lot */}
                  <div className="flex items-start gap-3">
                    <span className="w-28 shrink-0 text-muted-foreground flex items-center gap-1.5 font-medium pt-0.5">
                      <MapPin className="size-3.5 text-muted-foreground/70" />
                      Coordinates
                    </span>
                    <div className="text-muted-foreground pt-0.5">
                      {p.lat != null && p.lng != null ? `${p.lat.toFixed(5)}°, ${p.lng.toFixed(5)}°` : "Dallas County, TX"}
                      {p.landSqft ? ` · ${num(p.landSqft)} sq ft lot` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Section 1: Visual Proof & 5-Stage Verification Audit (No Box-in-Box Wrapping) */}
            <div className="space-y-4">
              <div className="pb-2 border-b border-border/60">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Roof Imagery & Physical Verification</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  5-year chronological satellite history correlated with radar hail ground truth and municipal permit clearance.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 5-Year Chronological Aerial Roof Timeline */}
                <div className="lg:col-span-6 rounded-lg border border-border bg-card/40 p-4">
                  <RoofTimeline
                    lat={p.lat}
                    lng={p.lng}
                    address={p.address}
                    parcelId={p.id}
                  />
                </div>

                {/* 5-Stage Verification Audit Checklist */}
                <div className="lg:col-span-6 rounded-lg border border-border bg-card/40 p-4">
                  <VerificationCard
                    leadId={parcelId}
                    hideImage={true}
                    hideHeader={false}
                    className="p-0 border-none"
                  />
                </div>
              </div>
            </div>

            {/* Document Section 2: Predictive Opportunity Dossier & Playbook */}
            <LeadDossier parcelId={parcelId} className="border-none" />

            {/* Document Section 3: Verified Contacts & Corporate Officers */}
            <LeadContactsCard
              contact={p.contact}
              officers={p.officers}
              entity={p.entity}
              ownerName={p.owner}
              ownerAddress={p.ownerAddress}
            />

            {/* Document Section 4: Structural CAD Breakdown (if present) */}
            {p.improvementSections && (() => {
              try {
                const sections = typeof p.improvementSections === "string" ? JSON.parse(p.improvementSections) : p.improvementSections;
                if (Array.isArray(sections) && sections.length > 0) {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <h2 className="text-sm font-semibold tracking-tight text-foreground">
                          CAD Building Structure Breakdown ({sections.length} Sections)
                        </h2>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sections.map((sec: any, idx: number) => (
                          <div key={idx} className="rounded-lg border border-border bg-card/40 p-3.5 text-xs">
                            <p className="font-semibold text-foreground">{sec.description || `Section ${idx + 1}`}</p>
                            <p className="text-muted-foreground mt-0.5">
                              {sec.stories ? `${sec.stories} Stories` : ""} {sec.year_built ? `· Built ${sec.year_built}` : ""}
                            </p>
                            <p className="font-mono mt-1 font-medium text-foreground">
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

            {/* Document Section 5: Historical Municipal Permits Registry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Historical Municipal Permit Roll
                </h2>
                <span className="text-xs text-muted-foreground">
                  {p.permits.length} records on file
                </span>
              </div>

              {p.permits.length ? (
                <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">Permit #</TableHead>
                          <TableHead className="hidden md:table-cell">Scope of Work</TableHead>
                          <TableHead className="w-[160px]">Contractor</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="text-right w-[100px]">Valuation</TableHead>
                          <TableHead className="w-[170px]">Source Record</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.permits.map((x) => (
                          <TableRow key={x.id || x.permitNumber}>
                            <TableCell className="font-mono text-xs">
                              <span className="font-medium text-foreground">{x.permitNumber}</span>
                              <span className="block text-[11px] text-muted-foreground">{x.issued ? shortDate(x.issued) : "—"}{x.roofSystem ? ` · ${x.roofSystem}` : ""}</span>
                            </TableCell>
                            <TableCell className="hidden max-w-80 truncate md:table-cell text-xs" title={x.scope}>{x.scope || "—"}</TableCell>
                            <TableCell className="max-w-56 text-xs"><ContractorLink name={x.contractor} /></TableCell>
                            <TableCell className="text-xs">{x.status || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums font-medium">{x.valuation || "—"}</TableCell>
                            <TableCell className="text-xs">
                              {x.sourceUrl ? (
                                <a
                                  href={x.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs max-w-[160px] truncate"
                                  title={`Open official source record: ${x.sourceSystem || x.sourceUrl}`}
                                >
                                  <span className="truncate">{x.sourceSystem || "Official Source"}</span>
                                  <ExternalLink className="size-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">{x.sourceSystem || "Public Record"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-xs text-muted-foreground text-center bg-card/20">
                  No prior roofing permits have been pulled for this parcel in municipal records. This indicates an untouched roof system ready for assessment.
                </div>
              )}
            </div>

            {/* Document Section 6: Source Files & Record Provenance Footnote */}
            <div className="border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-6">
                <div>
                  <span className="font-medium text-foreground/80">Authority:</span> {p.source || "Dallas County Appraisal District (DCAD)"} · {p.yearBuiltSource || "DCAD Certified Commercial Roll"}
                </div>
                <div>
                  <span className="font-medium text-foreground/80">Pipeline:</span> {p.dataProvenance || "live_dcad_api (Direct Public Record)"}
                </div>
                <div>
                  <span className="font-medium text-foreground/80">Ingestion:</span> {p.provenanceDate || p.retrievedAt || "Recent"}
                </div>
              </div>
            </div>
          </div>
        )}
      </EngineState>
    </EngineLayout>
  );
}
