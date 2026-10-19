"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, Phone, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Permit, PermitContact, PermitContactRole } from "@/lib/types";

interface PermitContactsCardProps {
  permits: Permit[];
  className?: string;
}

const ROLE_CONFIG: Record<
  PermitContactRole,
  { label: string; badgeClass: string; desc: string }
> = {
  applicant: {
    label: "Permit Applicant / PM",
    badgeClass: "border-sky-500/40 bg-sky-500/10 text-sky-400 dark:text-sky-300",
    desc: "Authorized filer for municipal permit work",
  },
  owner_rep: {
    label: "Property Owner / Rep",
    badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300",
    desc: "Named building owner or asset manager",
  },
  contractor: {
    label: "Prior Roofing Contractor",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-400 dark:text-amber-300",
    desc: "Contractor on prior commercial filing",
  },
  architect: {
    label: "Architect / Engineer",
    badgeClass: "border-purple-500/40 bg-purple-500/10 text-purple-400 dark:text-purple-300",
    desc: "Design professional listed on permit",
  },
  unknown: {
    label: "Filing Contact",
    badgeClass: "border-border bg-muted/40 text-muted-foreground",
    desc: "Public filing contact",
  },
};

export function PermitContactsCard({ permits, className }: PermitContactsCardProps) {
  // Collect all existing contacts across the permits
  const initialContacts: PermitContact[] = permits.flatMap((p) => p.contacts ?? []);
  const [contacts, setContacts] = useState<PermitContact[]>(initialContacts);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingPermitId, setLoadingPermitId] = useState<string | null>(null);

  const handleCopy = (c: PermitContact) => {
    const lines = [
      `Name: ${c.name}`,
      `Role: ${ROLE_CONFIG[c.role]?.label || c.role}`,
      c.company ? `Company: ${c.company}` : null,
      c.phoneFormatted || c.phone ? `Phone: ${c.phoneFormatted || c.phone}` : null,
      c.email ? `Email: ${c.email}` : null,
      `Source: ${c.source}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFetchOnDemand = async (p: Permit) => {
    setLoadingPermitId(p.id);
    try {
      const q = new URLSearchParams();
      if (p.recordUrl) q.set("recordUrl", p.recordUrl);
      const res = await fetch(`/api/permits/${encodeURIComponent(p.id)}/contacts?${q}`);
      if (res.ok) {
        const data = (await res.json()) as { contacts: PermitContact[] };
        if (Array.isArray(data.contacts) && data.contacts.length > 0) {
          setContacts((prev) => {
            const map = new Map<string, PermitContact>();
            prev.forEach((item) => map.set(item.id, item));
            data.contacts.forEach((item) => map.set(item.id, item));
            return [...map.values()];
          });
        }
      }
    } finally {
      setLoadingPermitId(null);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              Verified Permit Contacts
            </CardTitle>
            <CardDescription className="text-xs">
              Extracted from municipal filings · direct applicants, owner reps & prior contractors
            </CardDescription>
          </div>
          {contacts.length > 0 && (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-5 text-center">
            <p className="text-sm font-medium text-foreground">No contacts yet in bulk feed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              County appraisal records only provide LLC names and tax addresses. You can scan municipal permit records for filer emails and phones.
            </p>
            {permits.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {permits.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={loadingPermitId === p.id}
                    onClick={() => handleFetchOnDemand(p)}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingPermitId === p.id ? "animate-spin" : ""}`} />
                    Scan {p.permitNo} for contacts
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => {
              const roleInfo = ROLE_CONFIG[c.role] || ROLE_CONFIG.unknown;
              const isCopied = copiedId === c.id;

              return (
                <div
                  key={c.id}
                  className="rounded-md border border-border/70 bg-card/60 p-3.5 transition-colors hover:border-border"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${roleInfo.badgeClass}`}
                        >
                          {roleInfo.label}
                        </span>
                        {c.deliverability === "verified" && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            Verified MX
                          </span>
                        )}
                        {c.deliverability === "generic" && (
                          <span className="text-[11px] text-amber-400">
                            Generic Box
                          </span>
                        )}
                      </div>
                      {c.company && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.company}</p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopy(c)}
                    >
                      {isCopied ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Contact Methods */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {(c.phoneFormatted || c.phone) && (
                      <a
                        href={`tel:${c.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/50 px-2.5 py-1 font-mono text-foreground hover:bg-muted/60"
                      >
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        {c.phoneFormatted || c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background/50 px-2.5 py-1 text-foreground hover:bg-muted/60"
                      >
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        {c.email}
                      </a>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Source: {c.source}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
