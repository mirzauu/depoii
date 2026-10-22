"use client";

import { useState } from "react";
import { Building2, Check, Copy, ExternalLink, Mail, Phone, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import type { ParcelContact, ParcelEntity, ParcelOfficer } from "@/lib/engine-api";
import { RealLogo } from "@/components/real-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LeadContactsCardProps {
  contact?: ParcelContact | null;
  officers?: ParcelOfficer[];
  entity?: ParcelEntity | null;
  ownerName?: string;
  ownerAddress?: string;
}

export function LeadContactsCard({ contact, officers = [], entity, ownerName, ownerAddress }: LeadContactsCardProps) {
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
  const targetPerson = contact?.decisionMakerName || (officers[0]?.name) || "";
  const linkedInSearchUrl = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent([targetPerson, targetOrg, "Dallas TX"].filter(Boolean).join(" "))}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent([targetPerson, targetOrg, "Dallas commercial"].filter(Boolean).join(" "))}`;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="size-5 text-emerald-500" />
            <CardTitle className="text-base font-semibold">Verified Decision Maker & Contacts</CardTitle>
          </div>
          {hasDirectPhoneOrEmail ? (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
              Direct Contact Verified
            </Badge>
          ) : hasOfficers ? (
            <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs">
              Texas SOS Officers Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
              Ownership Record On File
            </Badge>
          )}
        </div>
        <CardDescription>
          {hasDirectPhoneOrEmail
            ? "Direct decision maker, facility operations, and executive leadership contact intelligence."
            : "Texas Secretary of State corporate officers, managers, and registered agent intelligence."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {contact && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Decision Maker</p>
                <h4 className="text-base font-bold text-foreground mt-0.5">{contact.decisionMakerName || "Executive On Record"}</h4>
                {contact.decisionMakerTitle && (
                  <p className="text-xs text-muted-foreground">{contact.decisionMakerTitle}</p>
                )}
                {contact.organizationName && (
                  <div className="text-xs font-semibold text-foreground mt-1.5 flex items-center gap-2">
                    <RealLogo
                      url={contact.logoUrl}
                      alt={contact.organizationName}
                      size={20}
                      fallback={<Building2 className="size-3.5 text-muted-foreground" />}
                    />
                    <span>{contact.organizationName}</span>
                  </div>
                )}
              </div>
              {contact.tenantOrFacilityName && (
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Facility / Anchor Tenant</p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">{contact.tenantOrFacilityName}</p>
                </div>
              )}
            </div>

            {/* Direct Phone & Email Action Bar */}
            <div className="grid gap-2 sm:grid-cols-2 pt-1">
              {contact.phoneNumber ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-background p-2.5">
                  <div className="min-w-0 flex items-center gap-2">
                    <Phone className="size-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        {contact.phoneType || "Direct Phone"}
                      </p>
                      <a
                        href={`tel:${contact.phoneNumber.replace(/[^\d+]/g, "")}`}
                        className="text-sm font-semibold text-foreground hover:underline truncate block"
                      >
                        {contact.phoneNumber}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => copy(contact.phoneNumber, "phone")}
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2 bg-background/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="size-4 opacity-40 shrink-0" />
                    <span className="truncate">Direct line not on public file</span>
                  </div>
                  <a
                    href={linkedInSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-500 hover:underline shrink-0"
                  >
                    <Search className="size-3" />
                    <span>Find on LinkedIn</span>
                  </a>
                </div>
              )}

              {contact.emailAddress ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-background p-2.5">
                  <div className="min-w-0 flex items-center gap-2">
                    <Mail className="size-4 text-sky-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        {contact.emailStatus === "corporate_inbox" ? "Corporate Desk" : "Verified Email"}
                      </p>
                      <a
                        href={`mailto:${contact.emailAddress}`}
                        className="text-sm font-semibold text-foreground hover:underline truncate block"
                      >
                        {contact.emailAddress}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => copy(contact.emailAddress, "email")}
                    title="Copy email"
                  >
                    {copiedField === "email" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2 bg-background/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="size-4 opacity-40 shrink-0" />
                    <span className="truncate">Email research in progress</span>
                  </div>
                  <a
                    href={googleSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Search className="size-3" />
                    <span>Search Web</span>
                  </a>
                </div>
              )}
            </div>

            {/* Verified Website & Quick Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-border/50 text-xs">
              {contact.websiteUrl ? (
                <a
                  href={contact.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-sky-500 hover:underline"
                >
                  <RealLogo url={contact.logoUrl} alt="" size={14} />
                  <span>Company Website: {contact.websiteUrl.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="size-3" />
                </a>
              ) : null}

              <a
                href={linkedInSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
              >
                <Search className="size-3" />
                <span>Search Decision Maker on LinkedIn</span>
                <ExternalLink className="size-2.5 opacity-70" />
              </a>

              <a
                href={googleSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Search className="size-3" />
                <span>Google Company</span>
                <ExternalLink className="size-2.5 opacity-70" />
              </a>
            </div>
          </div>
        )}

        {/* Corporate Officers & Registered Agents */}
        {hasOfficers && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="size-3.5" />
              <span>Corporate Officers & Managers (Texas SOS / Comptroller)</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {officers.map((officer, i) => {
                const officerLinkedIn = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(officer.name + " " + (entity?.legalName || ownerName || "Dallas TX"))}`;
                const officerGoogle = `https://www.google.com/search?q=${encodeURIComponent(officer.name + " " + (entity?.legalName || ownerName || "Dallas"))}`;
                return (
                  <div key={i} className="rounded-md border border-border bg-card p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground">{officer.name}</span>
                      {officer.title && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          {officer.title}
                        </Badge>
                      )}
                    </div>
                    {officer.address && (
                      <p className="text-muted-foreground truncate text-[11px]" title={officer.address}>
                        {officer.address}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <a
                        href={officerLinkedIn}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-500 hover:underline font-medium"
                      >
                        <Search className="size-2.5" />
                        <span>Find on LinkedIn</span>
                        <ExternalLink className="size-2.5 opacity-70" />
                      </a>
                      <span className="text-muted-foreground/40">·</span>
                      <a
                        href={officerGoogle}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                      >
                        <span>Google</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Registered Entity Information */}
        {entity && (
          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
              <ShieldCheck className="size-3.5 text-sky-500" />
              <span>Entity Profile: {entity.legalName || ownerName}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {entity.taxpayerId && (
                <div>
                  <dt className="text-[10px] text-muted-foreground">Taxpayer ID</dt>
                  <dd className="font-mono text-foreground font-medium">{entity.taxpayerId}</dd>
                </div>
              )}
              {entity.sosFileNumber && (
                <div>
                  <dt className="text-[10px] text-muted-foreground">SOS File #</dt>
                  <dd className="font-mono text-foreground font-medium">{entity.sosFileNumber}</dd>
                </div>
              )}
              {entity.sosStatus && (
                <div>
                  <dt className="text-[10px] text-muted-foreground">Status</dt>
                  <dd className="text-foreground font-medium">{entity.sosStatus}</dd>
                </div>
              )}
              {entity.registeredAgentName && (
                <div className="col-span-2">
                  <dt className="text-[10px] text-muted-foreground">Registered Agent</dt>
                  <dd className="text-foreground font-medium">{entity.registeredAgentName}</dd>
                  {entity.registeredAgentAddress && (
                    <p className="text-[11px] text-muted-foreground truncate">{entity.registeredAgentAddress}</p>
                  )}
                </div>
              )}
            </dl>
          </div>
        )}

        {!hasDirectContact && !hasOfficers && !hasEntity && (
          <div className="rounded-md border border-border bg-muted/20 p-4 text-xs space-y-2">
            <p className="font-medium text-foreground">Property Owner Record</p>
            <p className="text-muted-foreground">Owner: <span className="font-semibold text-foreground">{ownerName || "Not on file"}</span></p>
            {ownerAddress && (
              <p className="text-muted-foreground">Mailing Address: <span className="font-medium text-foreground">{ownerAddress}</span></p>
            )}
            <p className="text-[11px] text-amber-500 pt-1">
              Direct executive phone & email enrichment is in progress for this property.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
