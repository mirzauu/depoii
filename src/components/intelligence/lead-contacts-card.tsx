"use client";

import { useState, useMemo } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Search,
} from "lucide-react";
import type { ParcelContact, ParcelEntity, ParcelOfficer } from "@/lib/engine-api";
import { RealLogo } from "@/components/real-logo";
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
  const [primaryOpen, setPrimaryOpen] = useState(true);
  const [officersOpen, setOfficersOpen] = useState(true);
  const [entityOpen, setEntityOpen] = useState(true);

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

  const deduplicatedOfficers = useMemo(() => {
    if (!officers || !officers.length) return [];
    const map = new Map<string, { name: string; titles: Set<string>; address?: string }>();
    for (const off of officers) {
      const cleanName = (off.name || "").trim();
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (off.title) existing.titles.add(off.title.trim());
        if (!existing.address && off.address) existing.address = off.address;
      } else {
        const titles = new Set<string>();
        if (off.title) titles.add(off.title.trim());
        map.set(key, { name: cleanName, titles, address: off.address });
      }
    }
    return Array.from(map.values()).map((o) => ({
      name: o.name,
      title: Array.from(o.titles).join(" · "),
      address: o.address,
    }));
  }, [officers]);

  const hasOfficers = deduplicatedOfficers.length > 0;
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
    <div className={cn("space-y-4", className)}>
      {/* ================================================================= */}
      {/* BOX 1: PRIMARY DECISION MAKER                                     */}
      {/* ================================================================= */}
      {contact && (
        <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
          <div
            onClick={() => setPrimaryOpen(!primaryOpen)}
            className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
          >
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Primary contact
              </h3>
              {hasDirectPhoneOrEmail ? (
                <span className="rounded px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  Direct Verified
                </span>
              ) : hasOfficers ? (
                <span className="rounded px-2 py-0.5 text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/25">
                  SOS Verified
                </span>
              ) : (
                <span className="rounded px-2 py-0.5 text-[11px] font-medium bg-neutral-100 dark:bg-[#232320] text-muted-foreground border border-border">
                  Public Record
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPrimaryOpen(!primaryOpen);
              }}
              aria-label={primaryOpen ? "Collapse primary contact" : "Expand primary contact"}
              className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              {primaryOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>

          {primaryOpen && (
            <div className="px-5 pb-5 pt-3 border-t border-border space-y-3">
              {/* Executive Bio Header */}
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-foreground">
                    {contact.decisionMakerName || "Executive On Record"}
                  </h4>
                  {contact.decisionMakerTitle && (
                    <p className="text-xs text-muted-foreground">{contact.decisionMakerTitle}</p>
                  )}
                  {contact.organizationName && (
                    <div className="text-xs font-medium text-foreground pt-1 flex items-center gap-2">
                      <RealLogo
                        url={contact.logoUrl}
                        alt={contact.organizationName}
                        size={16}
                        fallback={<Building2 className="size-3.5 text-muted-foreground" />}
                      />
                      <span>{contact.organizationName}</span>
                    </div>
                  )}
                </div>

                {contact.tenantOrFacilityName && (
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">Facility / Anchor Tenant</span>
                    <p className="text-xs font-medium text-foreground">{contact.tenantOrFacilityName}</p>
                  </div>
                )}
              </div>

              {/* Direct Channels (Phone & Email) */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Phone */}
                {contact.phoneNumber ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] px-3.5 py-2.5">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <Phone className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[11px] text-muted-foreground block">
                          {contact.phoneType || "Direct Phone"}
                        </span>
                        <a
                          href={`tel:${contact.phoneNumber.replace(/[^\d+]/g, "")}`}
                          className="text-xs font-semibold text-foreground hover:underline truncate block tabular-nums"
                        >
                          {contact.phoneNumber}
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="size-7 rounded hover:bg-neutral-200 dark:hover:bg-[#232320] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      onClick={() => copy(contact.phoneNumber || "", "phone")}
                      title="Copy phone number"
                    >
                      {copiedField === "phone" ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-neutral-50/50 dark:bg-[#171714]/50 px-3.5 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>Direct phone not on public file</span>
                    <a
                      href={linkedInSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline shrink-0"
                    >
                      LinkedIn
                    </a>
                  </div>
                )}

                {/* Email */}
                {contact.emailAddress ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] px-3.5 py-2.5">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <Mail className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[11px] text-muted-foreground block">
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
                    <button
                      type="button"
                      className="size-7 rounded hover:bg-neutral-200 dark:hover:bg-[#232320] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      onClick={() => copy(contact.emailAddress || "", "email")}
                      title="Copy email address"
                    >
                      {copiedField === "email" ? <Check className="size-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-neutral-50/50 dark:bg-[#171714]/50 px-3.5 py-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>Direct email in research queue</span>
                    <a
                      href={googleSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Search
                    </a>
                  </div>
                )}
              </div>

              {/* External Search Links */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {contact.websiteUrl && (
                  <a
                    href={contact.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-neutral-50 dark:bg-[#171714] px-2.5 py-1 text-xs font-medium text-foreground hover:bg-neutral-100 dark:hover:bg-[#232320] transition-colors"
                  >
                    <Globe className="size-3 text-muted-foreground" />
                    <span>{contact.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                    <ExternalLink className="size-2.5 text-muted-foreground" />
                  </a>
                )}

                <a
                  href={linkedInSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-neutral-50 dark:bg-[#171714] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-[#232320] transition-colors"
                >
                  <Search className="size-3" />
                  <span>Search Decision Maker on LinkedIn</span>
                  <ExternalLink className="size-2.5 opacity-60" />
                </a>

                <a
                  href={googleSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-neutral-50 dark:bg-[#171714] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-[#232320] transition-colors"
                >
                  <Search className="size-3" />
                  <span>Google Company Intelligence</span>
                  <ExternalLink className="size-2.5 opacity-60" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* BOX 2: CORPORATE OFFICERS (TEXAS SOS)                             */}
      {/* ================================================================= */}
      {hasOfficers && (
        <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
          <div
            onClick={() => setOfficersOpen(!officersOpen)}
            className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
          >
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Corporate officers
              </h3>
              <span className="rounded px-2 py-0.5 text-xs font-mono font-medium bg-neutral-100 dark:bg-[#232320] text-muted-foreground border border-border tabular-nums">
                {deduplicatedOfficers.length}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOfficersOpen(!officersOpen);
              }}
              aria-label={officersOpen ? "Collapse corporate officers" : "Expand corporate officers"}
              className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              {officersOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>

          {officersOpen && (
            <div className="px-5 pb-5 pt-3 border-t border-border">
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] divide-y divide-border overflow-hidden">
                {deduplicatedOfficers.map((officer, i) => {
                  const officerLinkedIn = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
                    officer.name + " " + (entity?.legalName || ownerName || "Dallas TX")
                  )}`;
                  const officerGoogle = `https://www.google.com/search?q=${encodeURIComponent(
                    officer.name + " " + (entity?.legalName || ownerName || "Dallas")
                  )}`;
                  return (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="font-semibold text-foreground">{officer.name}</span>
                        {officer.title && (
                          <span className="rounded bg-neutral-100 dark:bg-[#232320] border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
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
                          className="text-sky-600 dark:text-sky-400 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <span>LinkedIn</span>
                          <ExternalLink className="size-2.5 opacity-70" />
                        </a>
                        <span className="text-muted-foreground/30">·</span>
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
        </div>
      )}

      {/* ================================================================= */}
      {/* BOX 3: REGISTERED FILING ENTITY                                   */}
      {/* ================================================================= */}
      {entity && (
        <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
          <div
            onClick={() => setEntityOpen(!entityOpen)}
            className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
          >
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Registered entity
            </h3>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEntityOpen(!entityOpen);
              }}
              aria-label={entityOpen ? "Collapse registered entity" : "Expand registered entity"}
              className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              {entityOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>

          {entityOpen && (
            <div className="px-5 pb-5 pt-3 border-t border-border">
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 text-xs">
                <div className="font-semibold text-foreground text-xs mb-2">
                  Filing Entity: {entity.legalName || ownerName}
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 pt-1 border-t border-border/40">
                  {entity.taxpayerId && (
                    <div>
                      <dt className="text-[11px] text-muted-foreground font-medium">Taxpayer ID</dt>
                      <dd className="font-mono text-foreground font-medium pt-0.5 tabular-nums">{entity.taxpayerId}</dd>
                    </div>
                  )}
                  {entity.sosFileNumber && (
                    <div>
                      <dt className="text-[11px] text-muted-foreground font-medium">SOS File #</dt>
                      <dd className="font-mono text-foreground font-medium pt-0.5 tabular-nums">{entity.sosFileNumber}</dd>
                    </div>
                  )}
                  {entity.sosStatus && (
                    <div>
                      <dt className="text-[11px] text-muted-foreground font-medium">SOS Status</dt>
                      <dd className="text-foreground font-medium pt-0.5">{entity.sosStatus}</dd>
                    </div>
                  )}
                  {entity.registeredAgentName && (
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-[11px] text-muted-foreground font-medium">Registered Agent</dt>
                      <dd className="text-foreground font-medium pt-0.5 truncate">{entity.registeredAgentName}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback Ownership Record */}
      {!hasDirectContact && !hasOfficers && !hasEntity && (
        <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] p-5 text-xs space-y-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Property ownership record
          </h3>
          <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] p-3.5 space-y-1 text-xs">
            <p className="text-muted-foreground">
              Certified Tax Roll Owner: <span className="font-semibold text-foreground">{ownerName || "Not on file"}</span>
            </p>
            {ownerAddress && (
              <p className="text-muted-foreground">
                Mailing Address: <span className="font-medium text-foreground">{ownerAddress}</span>
              </p>
            )}
            <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
              Direct executive phone & email enrichment is currently queued for this property.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
