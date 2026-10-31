"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import type { ParcelContact, ParcelEntity, ParcelOfficer } from "@/lib/engine-api";
import { RealLogo } from "@/components/real-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LeadContactsCardProps {
  contact?: ParcelContact | null;
  officers?: ParcelOfficer[];
  entity?: ParcelEntity | null;
  ownerName?: string;
  ownerAddress?: string;
  className?: string;
}

export function LeadContactsCard({
  contact,
  officers = [],
  entity,
  ownerName,
  ownerAddress,
  className,
}: LeadContactsCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const hasDirectPhoneOrEmail = Boolean(contact && (contact.phoneNumber || contact.emailAddress));
  const hasDecisionMaker = Boolean(contact?.decisionMakerName);
  const hasDirectContact = hasDirectPhoneOrEmail || hasDecisionMaker;
  const hasOfficers = officers && officers.length > 0;
  const hasEntity = Boolean(entity && (entity.registeredAgentName || entity.legalName));

  const targetOrg = contact?.organizationName || entity?.legalName || ownerName || "";
  const targetPerson = contact?.decisionMakerName || officers[0]?.name || "";
  const linkedInSearchUrl = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
    [targetPerson, targetOrg, "Dallas TX"].filter(Boolean).join(" ")
  )}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    [targetPerson, targetOrg, "Dallas commercial"].filter(Boolean).join(" ")
  )}`;

  return (
    <section className={cn("space-y-4", className)}>
      {/* Minimal Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Decision Maker & Corporate Intelligence</h2>
            {hasDirectPhoneOrEmail ? (
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Direct Contact Verified
              </span>
            ) : hasOfficers ? (
              <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 border border-sky-500/30">
                Texas SOS Officers Verified
              </span>
            ) : (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/30">
                Ownership Record On File
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified executive contact channels, Texas Secretary of State corporate roster, and registered entity profile.
          </p>
        </div>
      </div>

      {/* Primary Decision Maker Panel */}
      {contact && (
        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Primary Contact</span>
              <h3 className="text-base font-bold text-foreground mt-0.5">{contact.decisionMakerName || "Executive On Record"}</h3>
              {contact.decisionMakerTitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{contact.decisionMakerTitle}</p>
              )}
              {contact.organizationName && (
                <div className="text-xs font-semibold text-foreground mt-1.5 flex items-center gap-2">
                  <RealLogo
                    url={contact.logoUrl}
                    alt={contact.organizationName}
                    size={18}
                    fallback={<Building2 className="size-3.5 text-muted-foreground" />}
                  />
                  <span>{contact.organizationName}</span>
                </div>
              )}
            </div>

            {contact.tenantOrFacilityName && (
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Facility / Anchor Tenant</span>
                <p className="text-xs font-semibold text-foreground mt-0.5">{contact.tenantOrFacilityName}</p>
              </div>
            )}
          </div>

          {/* Action Bar: Direct Phone & Email */}
          <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
            {contact.phoneNumber ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <div className="min-w-0 flex items-center gap-2.5">
                  <Phone className="size-3.5 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                      {contact.phoneType || "Direct Phone"}
                    </span>
                    <a
                      href={`tel:${contact.phoneNumber.replace(/[^\d+]/g, "")}`}
                      className="text-xs font-semibold text-foreground hover:underline truncate block"
                    >
                      {contact.phoneNumber}
                    </a>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => copy(contact.phoneNumber || "", "phone")}
                  title="Copy phone number"
                >
                  {copiedField === "phone" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2 bg-muted/10">
                <span className="truncate">Direct phone not on public file</span>
                <a
                  href={linkedInSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-sky-500 hover:underline shrink-0"
                >
                  Search LinkedIn
                </a>
              </div>
            )}

            {contact.emailAddress ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <div className="min-w-0 flex items-center gap-2.5">
                  <Mail className="size-3.5 text-sky-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                      {contact.emailStatus === "corporate_inbox" ? "Corporate Desk" : "Verified Email"}
                    </span>
                    <a
                      href={`mailto:${contact.emailAddress}`}
                      className="text-xs font-semibold text-foreground hover:underline truncate block"
                    >
                      {contact.emailAddress}
                    </a>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => copy(contact.emailAddress || "", "email")}
                  title="Copy email address"
                >
                  {copiedField === "email" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2 bg-muted/10">
                <span className="truncate">Direct email in research queue</span>
                <a
                  href={googleSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0"
                >
                  Google Web
                </a>
              </div>
            )}
          </div>

          {/* Outbound Intelligence Links */}
          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-border/60 text-xs">
            {contact.websiteUrl && (
              <a
                href={contact.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Globe className="size-3 text-muted-foreground" />
                <span>{contact.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                <ExternalLink className="size-2.5 opacity-60" />
              </a>
            )}

            <a
              href={linkedInSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
            >
              <Search className="size-3" />
              <span>Search Decision Maker on LinkedIn</span>
              <ExternalLink className="size-2.5 opacity-70" />
            </a>

            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Search className="size-3" />
              <span>Google Company Intelligence</span>
              <ExternalLink className="size-2.5 opacity-60" />
            </a>
          </div>
        </div>
      )}

      {/* Corporate Officers (Texas SOS) — Pure Horizontal Ledger List (Zero Ragged Orphan Cards) */}
      {hasOfficers && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5" />
            <span>Corporate Officers & Managers (Texas SOS / Comptroller)</span>
          </div>
          <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/60 overflow-hidden">
            {officers.map((officer, i) => {
              const officerLinkedIn = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
                officer.name + " " + (entity?.legalName || ownerName || "Dallas TX")
              )}`;
              const officerGoogle = `https://www.google.com/search?q=${encodeURIComponent(
                officer.name + " " + (entity?.legalName || ownerName || "Dallas")
              )}`;
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="font-semibold text-foreground">{officer.name}</span>
                    {officer.title && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {officer.title}
                      </span>
                    )}
                    {officer.address && (
                      <span className="text-[11px] text-muted-foreground truncate hidden md:inline max-w-xs" title={officer.address}>
                        · {officer.address}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] shrink-0">
                    <a
                      href={officerLinkedIn}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-500 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <span>LinkedIn</span>
                      <ExternalLink className="size-2.5 opacity-70" />
                    </a>
                    <span className="text-muted-foreground/30">|</span>
                    <a
                      href={officerGoogle}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <span>Google</span>
                      <ExternalLink className="size-2.5 opacity-70" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Registered Entity Profile */}
      {entity && (
        <div className="rounded-lg border border-border bg-card/40 p-3.5 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
            <ShieldCheck className="size-3.5 text-sky-500" />
            <span>Filing Entity: {entity.legalName || ownerName}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 pt-1">
            {entity.taxpayerId && (
              <div>
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxpayer ID</dt>
                <dd className="font-mono text-foreground font-medium pt-0.5">{entity.taxpayerId}</dd>
              </div>
            )}
            {entity.sosFileNumber && (
              <div>
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">SOS File #</dt>
                <dd className="font-mono text-foreground font-medium pt-0.5">{entity.sosFileNumber}</dd>
              </div>
            )}
            {entity.sosStatus && (
              <div>
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">SOS Status</dt>
                <dd className="text-foreground font-medium pt-0.5">{entity.sosStatus}</dd>
              </div>
            )}
            {entity.registeredAgentName && (
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Registered Agent</dt>
                <dd className="text-foreground font-medium pt-0.5 truncate">{entity.registeredAgentName}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {!hasDirectContact && !hasOfficers && !hasEntity && (
        <div className="rounded-lg border border-border bg-card/40 p-4 text-xs space-y-1.5">
          <p className="font-semibold text-foreground">Property Ownership Record</p>
          <p className="text-muted-foreground">
            Certified Tax Roll Owner: <span className="font-semibold text-foreground">{ownerName || "Not on file"}</span>
          </p>
          {ownerAddress && (
            <p className="text-muted-foreground">
              Mailing Address: <span className="font-medium text-foreground">{ownerAddress}</span>
            </p>
          )}
          <p className="text-[11px] text-amber-500 pt-1">
            Direct executive phone & email enrichment is currently queued for this property.
          </p>
        </div>
      )}
    </section>
  );
}
