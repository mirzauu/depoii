"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  ShieldCheck,
  ExternalLink,
  Lock,
} from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { RoofTimeline } from "@/components/roof-timeline";
import { useEngine } from "@/components/use-engine";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mapParcelDossier } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ParcelDetailDrawerProps {
  parcelId: string | null;
  onClose: () => void;
  titlePrefix?: string;
}

function parseSections(raw?: string): { description?: string; area_sqft?: number; year_built?: number; stories?: number }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as { description?: string; area_sqft?: number; year_built?: number; stories?: number }[]) : [];
  } catch {
    return [];
  }
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "" || value === 0) return null;
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function ParcelDetailDrawer({
  parcelId,
  onClose,
  titlePrefix = "Roof Aging Lead Dossier",
}: ParcelDetailDrawerProps) {
  const parcel = useEngine(
    parcelId ? `parcels/${encodeURIComponent(parcelId)}` : "",
    {},
    mapParcelDossier
  );
  const p = parcel.data;

  const currentYear = 2026;
  const hasPermits = Boolean(p?.permits && p.permits.length > 0);
  const latestPermit = hasPermits ? p!.permits[0] : null;
  const permitYear = latestPermit?.issued ? parseInt(latestPermit.issued.slice(0, 4), 10) : null;
  const cadYear = p?.yearBuilt && p.yearBuilt > 0 ? p.yearBuilt : null;
  const isPermitDerived = Boolean(permitYear && permitYear > 0);
  const displayAge = isPermitDerived
    ? currentYear - (permitYear as number)
    : cadYear
      ? currentYear - cadYear
      : null;

  const sections = parseSections(p?.improvementSections);

  // Assemble clean unified contacts list
  const contactsList: Array<{
    role: string;
    name: string;
    organization?: string;
    phone?: string;
    email?: string;
    emailStatus?: string;
    website?: string;
    facility?: string;
    address?: string;
    note?: string;
  }> = [];

  if (p?.contact) {
    contactsList.push({
      role: p.contact.decisionMakerTitle || "Executive Contact",
      name: p.contact.decisionMakerName || p.contact.organizationName || p.owner || "Executive Contact",
      organization:
        p.contact.organizationName && p.contact.organizationName !== p.contact.decisionMakerName
          ? p.contact.organizationName
          : undefined,
      phone: p.contact.phoneNumber,
      email: p.contact.emailAddress,
      emailStatus: p.contact.emailStatus || (p.contact.emailAddress ? "VERIFIED" : "UNVERIFIED"),
      website: p.contact.websiteUrl,
      facility: p.contact.tenantOrFacilityName,
      address: p.ownerAddress,
      note: p.contact.sourceSystem ? `Verified via ${p.contact.sourceSystem}` : undefined,
    });
  }

  if (p?.officers?.length) {
    for (const off of p.officers) {
      if (!off.name) continue;
      // Skip if identical to primary decision maker
      if (contactsList.some((c) => c.name.toLowerCase() === off.name.toLowerCase())) continue;
      contactsList.push({
        role: off.title || off.role || "Corporate Officer",
        name: off.name,
        organization: p.owner,
        emailStatus: "UNVERIFIED",
        address: off.address,
        note: "Texas Secretary of State public corporate filing",
      });
    }
  }

  return (
    <Sheet open={Boolean(parcelId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {p?.address || (parcel.loading ? "Loading building record…" : parcelId || "Property Detail")}
          </SheetTitle>
          <SheetDescription>
            {titlePrefix} · Commercial roof aging intelligence and property dossier from county appraisal rolls and municipal permit records.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8">
          {parcel.loading && (
            <p className="py-6 text-sm text-muted-foreground">Loading lead dossier…</p>
          )}

          {parcel.error && (
            <div className="my-4 rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-amber-500/10 p-4 text-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400">
                  <Lock className="size-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {parcel.error.toLowerCase().includes("territor")
                      ? "Subscribed Territory Required"
                      : "Unable to load parcel details"}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {parcel.error}
                  </p>
                </div>
              </div>
              {parcel.error.toLowerCase().includes("territor") ? (
                <div>
                  <Link
                    href="/territories"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-neutral-900 shadow hover:opacity-90 transition"
                  >
                    <span>Manage Territory Subscriptions</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={parcel.retry}
                  className="rounded border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {p && !parcel.loading && (
            <>
              {/* Roof & Age Intelligence */}
              <Section title="Roof & Aging Intelligence">
                <dl>
                  <DetailRow
                    label="Estimated age"
                    value={
                      displayAge ? (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span>{displayAge} Years</span>
                          {displayAge >= 20 ? (
                            <span className="inline-flex h-4 items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-1.5 text-[9.5px] font-semibold text-rose-700 dark:text-rose-300">
                              Critical (&gt;20 yrs)
                            </span>
                          ) : displayAge >= 15 ? (
                            <span className="inline-flex h-4 items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300">
                              Aging (15–20 yrs)
                            </span>
                          ) : (
                            <span className="inline-flex h-4 items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1.5 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                              Moderate (&lt;15 yrs)
                            </span>
                          )}
                        </span>
                      ) : null
                    }
                  />
                  <DetailRow
                    label="Baseline origin"
                    value={
                      isPermitDerived ? (
                        <span className="text-foreground">
                          Permit-derived install ({latestPermit?.issued ? latestPermit.issued.slice(0, 4) : "file"} reroof)
                        </span>
                      ) : cadYear ? (
                        <span className="text-foreground">
                          CAD construction baseline ({cadYear} certified build, unpermitted)
                        </span>
                      ) : null
                    }
                  />
                  <DetailRow
                    label="Permit status"
                    value={
                      hasPermits
                        ? `${p.permits.length} municipal permit(s) on file`
                        : "Dark Market (0 permits on file since construction)"
                    }
                  />
                  <DetailRow
                    label="Est. replacement"
                    value={
                      p.sqft
                        ? `${usd(p.sqft * 12)} – ${usd(p.sqft * 18)} ($12–$18/sq ft)`
                        : null
                    }
                  />
                  <DetailRow
                    label="Probable system"
                    value={latestPermit?.roofSystem || "Commercial Flat (Single-Ply TPO / Built-Up)"}
                  />
                  <DetailRow
                    label="Last reroof"
                    value={
                      latestPermit?.issued
                        ? `${latestPermit.issued}${latestPermit.permitNumber ? ` · #${latestPermit.permitNumber}` : ""}`
                        : null
                    }
                  />
                  <DetailRow
                    label="Last contractor"
                    value={
                      latestPermit?.contractor ? (
                        <ContractorLink name={latestPermit.contractor} />
                      ) : null
                    }
                  />
                </dl>
              </Section>

              {/* 5-Year Roof Imagery Timeline */}
              <RoofTimeline lat={p.lat} lng={p.lng} address={p.address} parcelId={p.id} />

              {/* Parcel & Building Specs */}
              <Section title="Parcel">
                <dl>
                  <DetailRow
                    label="Address"
                    value={[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")}
                  />
                  <DetailRow label="County" value={p.county} />
                  <DetailRow label="Jurisdiction" value={p.jurisdiction} />
                  <DetailRow label="Property type" value={p.propertyType} />
                  <DetailRow label="Building sq ft" value={p.sqft ? num(p.sqft) : null} />
                  <DetailRow label="Land sq ft" value={p.landSqft ? num(p.landSqft) : null} />
                  <DetailRow label="Year built" value={p.yearBuilt || null} />
                  <DetailRow label="Stories" value={p.stories || null} />
                  <DetailRow label="CAD value" value={p.valuation ? usd(p.valuation) : null} />
                  <DetailRow label="Improvements" value={p.improvementValuation ? usd(p.improvementValuation) : null} />
                  <DetailRow label="Account" value={p.account || p.id} />
                  <DetailRow label="Parcel ID" value={p.id} />
                  <DetailRow label="CAD source" value={p.source} />
                  <DetailRow
                    label="Coords"
                    value={p.lat != null && p.lng != null ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : null}
                  />
                </dl>
              </Section>

              {/* Improvement Sections */}
              {sections.length > 0 && (
                <Section title="Improvement sections">
                  <ul className="space-y-2 text-sm">
                    {sections.map((section, i) => (
                      <li key={i} className="rounded-md border border-border/60 px-3 py-2">
                        <p className="font-medium">{section.description || "Section"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            section.area_sqft ? `${num(section.area_sqft)} sq ft` : null,
                            section.year_built ? `built ${section.year_built}` : null,
                            section.stories != null ? `${section.stories} stories` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Contacts & Decision Makers */}
              <Section title="Contacts & Decision Makers">
                {contactsList.length ? (
                  <ul className="space-y-3 text-sm">
                    {contactsList.map((c, i) => (
                      <li
                        key={`${c.role}-${c.name}-${i}`}
                        className="rounded-lg border border-border/70 bg-card/60 p-3.5 shadow-sm space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-amber-800 dark:text-[#FFCA88]">
                              <ShieldCheck className="h-3.5 w-3.5 text-[#FFCA88]" />
                              {c.role || "Executive Contact"}
                            </span>
                            <h4 className="font-semibold text-foreground text-base leading-snug">{c.name}</h4>
                            {c.organization && c.organization !== c.name && (
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3" />
                                {c.organization}
                              </p>
                            )}
                          </div>
                          {c.emailStatus === "VERIFIED" ? (
                            <span className="inline-flex h-4 items-center gap-1 rounded-full border border-[#B4E4D6]/40 bg-[#B4E4D6]/15 dark:bg-[#B4E4D6]/10 px-1.5 text-[9.5px] font-medium leading-none text-[#1b7e65] dark:text-[#B4E4D6] shrink-0 select-none">
                              <span className="size-1 rounded-full bg-[#B4E4D6]" />
                              Verified
                            </span>
                          ) : (
                            <span
                              className="inline-flex h-4 items-center gap-1 rounded-full border border-neutral-400/30 bg-neutral-200/50 dark:bg-neutral-800/50 px-1.5 text-[9.5px] font-medium leading-none text-muted-foreground shrink-0 select-none"
                              title="Procedural contact — domain unverified"
                            >
                              Unverified
                            </span>
                          )}
                        </div>

                        {c.facility && (
                          <div className="rounded border border-[#FFCA88]/30 bg-[#FFCA88]/10 px-2.5 py-1 text-xs text-amber-900 dark:text-[#FFCA88]/90">
                            <span className="font-medium text-amber-950 dark:text-[#FFCA88]">Facility: </span>
                            {c.facility}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="inline-flex items-center gap-1.5 text-foreground hover:text-[#B4E4D6] transition-colors font-mono"
                            >
                              <Phone className="h-3.5 w-3.5 text-[#B4E4D6] shrink-0" />
                              <span>{c.phone}</span>
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex items-center gap-1.5 text-foreground hover:text-[#FFCA88] transition-colors truncate"
                              title={c.email}
                            >
                              <Mail className="h-3.5 w-3.5 text-[#FFCA88] shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </a>
                          )}
                          {c.website && (
                            <a
                              href={c.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate col-span-full"
                            >
                              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate underline">{c.website}</span>
                            </a>
                          )}
                        </div>

                        {c.address && <p className="text-[11px] text-muted-foreground">{c.address}</p>}
                        {c.note && (
                          <p className="text-[10px] text-muted-foreground/80 italic pt-1 border-t border-border/30">
                            {c.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-md border border-dashed border-border/60 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No verified corporate decision maker linked to this parcel yet.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Properties are progressively enriched in institutional order.
                    </p>
                  </div>
                )}
              </Section>

              {/* Legal Entity / Secretary of State (if present) */}
              {p.entity && (p.entity.legalName || p.entity.sosFileNumber) && (
                <Section title="Texas Secretary of State Entity">
                  <dl>
                    <DetailRow label="Legal name" value={p.entity.legalName} />
                    <DetailRow label="SOS File #" value={p.entity.sosFileNumber} />
                    <DetailRow label="Taxpayer ID" value={p.entity.taxpayerId} />
                    <DetailRow label="Status" value={p.entity.sosStatus} />
                    <DetailRow label="Registered agent" value={p.entity.registeredAgentName} />
                    <DetailRow label="Agent address" value={p.entity.registeredAgentAddress} />
                    <DetailRow label="Mailing address" value={p.entity.mailingAddress} />
                  </dl>
                </Section>
              )}

              {/* Permits History */}
              <Section title={`Permits${p.permits?.length ? ` (${p.permits.length})` : ""}`}>
                {p.permits?.length ? (
                  <ul className="space-y-3 text-sm">
                    {p.permits.map((pm) => (
                      <li key={pm.id || pm.permitNumber} className="rounded-md border border-border/60 px-3 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium">{pm.permitNumber || "Permit"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[pm.issued, pm.status].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[pm.roofSystem, pm.valuation ? pm.valuation : null].filter(Boolean).join(" · ")}
                        </p>
                        {pm.contractor && (
                          <p className="mt-1 text-xs">
                            Contractor: <ContractorLink name={pm.contractor} />
                          </p>
                        )}
                        {pm.scope && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-4">{pm.scope}</p>
                        )}
                        {(pm.sourceUrl || pm.sourceSystem) && (
                          <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-muted-foreground">Source:</span>
                            {pm.sourceUrl ? (
                              <a
                                href={pm.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                                title={`Open official source record: ${pm.sourceSystem || pm.sourceUrl}`}
                              >
                                <span>{pm.sourceSystem || "Official Source"}</span>
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">{pm.sourceSystem}</span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Zero roofing permits on record with the city. Roof age is derived from CAD structural construction baseline.
                  </p>
                )}
              </Section>

              {/* Source & Audit Trail */}
              <Section title="Source & Pipeline">
                <dl>
                  <DetailRow label="Appraisal roll" value={p.source || "Dallas County Appraisal District (DCAD)"} />
                  <DetailRow label="Ingestion stream" value={p.dataProvenance || "Direct public records warehouse"} />
                  <DetailRow label="Audit date" value={p.provenanceDate || p.retrievedAt || null} />
                </dl>
                <div className="mt-4 pt-3 border-t border-border/60">
                  <Link
                    href={`/parcels/${encodeURIComponent(p.id)}?from=roof-aging`}
                    className="inline-flex items-center gap-1.5 text-sm underline hover:text-foreground font-medium"
                  >
                    <span>Open full lead dossier</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </Section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
