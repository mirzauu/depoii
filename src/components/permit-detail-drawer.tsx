"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ContractorLink } from "@/components/contractor-link";
import { useMe } from "@/hooks/use-me";
import { CheckCircle2 } from "lucide-react";
import type { EnginePermit } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";

interface PermitDetailDrawerProps {
  permit: EnginePermit | null;
  onClose: () => void;
  onViewParcel?: (parcelId: string) => void;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
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

export function PermitDetailDrawer({ permit, onClose, onViewParcel }: PermitDetailDrawerProps) {
  const me = useMe();
  if (!permit) {
    return (
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const isPrePermit = Boolean(permit.isPrePermit);
  const contractorNameLower = (permit.contractor || "").toLowerCase();
  const isOwnInstallation = Boolean(
    contractorNameLower &&
      ((me?.orgName && contractorNameLower.includes(me.orgName.toLowerCase())) ||
        (me?.contractorId && (contractorNameLower.includes("new view") || contractorNameLower.includes("mob home"))))
  );

  const isGenericContractor =
    !permit.contractor ||
    permit.contractor.toLowerCase().includes("file") ||
    permit.contractor.toLowerCase().includes("licensed") ||
    permit.contractor.toLowerCase().includes("unknown") ||
    permit.contractor.toLowerCase().includes("tbd");

  const fullAddress = [permit.address, permit.city, permit.state, permit.zip]
    .filter(Boolean)
    .join(", ");

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    fullAddress || permit.address
  )}`;

  return (
    <Sheet open={Boolean(permit)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-mono text-base font-semibold">
            {permit.permitNumber}
          </SheetTitle>
          <SheetDescription>
            {fullAddress || permit.address || "City of Dallas Building Inspection record"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-4">
          {/* Company Completed Project Banner */}
          {isOwnInstallation && (
            <div className="rounded-md border border-[#B4E4D6]/50 bg-[#B4E4D6]/15 px-3 py-2 text-xs text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#1b7e65] dark:text-[#B4E4D6] shrink-0" />
              <div>
                <span className="font-semibold text-emerald-800 dark:text-[#B4E4D6]">
                  Installed by Your Company:
                </span>{" "}
                Verified project on municipal record. Auto-suppressed from cold outreach queue.
              </div>
            </div>
          )}

          {/* Minimal Depoii pastel mint banner when pre-permit bidding is open */}
          {isPrePermit && (
            <div className="rounded-md border border-[#B4E4D6]/40 bg-[#B4E4D6]/10 px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200">
              <span className="font-semibold text-emerald-800 dark:text-[#B4E4D6]">
                Bid window open:
              </span>{" "}
              {permit.bidWindowStatus || permit.status || "Plan review"} · Municipal application filed prior to general contractor award.
            </div>
          )}

          {/* Core Specifications */}
          <Section title="Permit specifications">
            <dl>
              <DetailRow label="Permit number" value={<span className="font-mono">{permit.permitNumber}</span>} />
              <DetailRow label="Valuation" value={permit.valuation ? usd(permit.valuation, true) : "Unspecified"} />
              <DetailRow
                label="Status"
                value={
                  isPrePermit ? (
                    <span className="inline-flex items-center rounded border border-[#B4E4D6]/40 bg-[#B4E4D6]/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-[#B4E4D6]">
                      {permit.bidWindowStatus || permit.status || "Plan review"}
                    </span>
                  ) : (
                    permit.status || "Active"
                  )
                }
              />
              <DetailRow label="Roof system" value={permit.roofSystem || "Unspecified"} />
              <DetailRow label="Category" value={permit.category || "Commercial"} />
              <DetailRow label="Square footage" value={permit.sqft ? `${num(permit.sqft)} sq ft` : null} />
              <DetailRow label="Scope of work" value={permit.description || null} />
            </dl>
          </Section>

          {/* Contractor & Contacts */}
          <Section title="Contractor & Contacts">
            <dl>
              <DetailRow
                label="Contractor"
                value={
                  !isGenericContractor && permit.contractor ? (
                    <ContractorLink name={permit.contractor} />
                  ) : (
                    <span className="text-muted-foreground italic">Contractor not selected (open to bid)</span>
                  )
                }
              />
              <DetailRow label="Architect / Design" value={permit.architectName || permit.designFirm || null} />
              <DetailRow
                label="Owner phone"
                value={
                  permit.ownerPhone ? (
                    <a href={`tel:${permit.ownerPhone}`} className="underline hover:text-foreground">
                      {permit.ownerPhone}
                    </a>
                  ) : null
                }
              />
            </dl>
          </Section>

          {/* Timeline & Milestones */}
          <Section title="Milestones & Timeline">
            <dl>
              <DetailRow label="Applied date" value={permit.appliedDate ? shortDate(permit.appliedDate) : null} />
              <DetailRow label="Issue date" value={permit.issued ? shortDate(permit.issued) : "Pending issuance"} />
              <DetailRow
                label="Hail window"
                value={
                  permit.hailWindow ? (
                    <span className="text-amber-800 dark:text-[#FFCA88] font-medium">
                      Matched to hail storm window (180d)
                    </span>
                  ) : null
                }
              />
              <DetailRow label="Storm event" value={permit.storm || null} />
            </dl>
          </Section>

          {/* Location & Property Information */}
          <Section title="Location & Property">
            <dl>
              <DetailRow label="Address" value={fullAddress || permit.address} />
              <DetailRow label="Jurisdiction" value={permit.jurisdiction || "Dallas, TX"} />
              <DetailRow
                label="Parcel / Account"
                value={
                  permit.parcelId ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{permit.parcelId}</span>
                      {onViewParcel && (
                        <button
                          type="button"
                          onClick={() => onViewParcel(permit.parcelId)}
                          className="text-xs text-primary underline hover:text-foreground"
                        >
                          View building dossier
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unmatched parcel</span>
                  )
                }
              />
              <DetailRow
                label="Coordinates"
                value={
                  permit.lat != null && permit.lng != null
                    ? `${permit.lat.toFixed(5)}, ${permit.lng.toFixed(5)}`
                    : null
                }
              />
              <DetailRow
                label="Map"
                value={
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Open in Google Maps
                  </a>
                }
              />
            </dl>
          </Section>

          {permit.parcelId && onViewParcel && (
            <p className="mt-5 text-sm pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => onViewParcel(permit.parcelId)}
                className="underline hover:text-foreground font-medium"
              >
                Open building dossier
              </button>
              <span className="text-muted-foreground"> — view certified CAD assessment, owner records, and property history.</span>
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
