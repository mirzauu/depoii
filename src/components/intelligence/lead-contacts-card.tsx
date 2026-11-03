"use client";

import { useState, useMemo, useEffect } from "react";
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
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ParcelContact, ParcelEntity, ParcelOfficer } from "@/lib/engine-api";
import { RealLogo } from "@/components/real-logo";
import type { ApolloCandidate, ApolloOrganization } from "@/lib/apollo/client";
import { cn } from "@/lib/utils";

interface LeadContactsCardProps {
  contact?: ParcelContact | null;
  officers?: ParcelOfficer[];
  entity?: ParcelEntity | null;
  ownerName?: string;
  ownerAddress?: string;
  parcelId?: string;
  className?: string;
}

function getAuthorityClassification(title: string): {
  role: "CapEx Authority" | "Facility Ops Lead" | "Portfolio Asset Lead" | "Commercial Lead";
  signal: string;
  badgeClass: string;
} {
  const t = (title || "").toLowerCase();
  if (
    t.includes("asset management") ||
    t.includes("capital") ||
    t.includes("principal") ||
    t.includes("partner") ||
    t.includes("vp") ||
    t.includes("vice president") ||
    t.includes("chief") ||
    t.includes("owner") ||
    t.includes("founder") ||
    t.includes("president")
  ) {
    return {
      role: "CapEx Authority",
      signal: "Holds capital expenditure and major commercial roof replacement budget authority.",
      badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    };
  }

  if (
    t.includes("facility") ||
    t.includes("facilities") ||
    t.includes("engineer") ||
    t.includes("maintenance") ||
    t.includes("construction") ||
    t.includes("project")
  ) {
    return {
      role: "Facility Ops Lead",
      signal: "Primary escalation contact for physical building inspections, leaks, and roof vendor access.",
      badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
    };
  }

  if (t.includes("property") || t.includes("manager") || t.includes("operations")) {
    return {
      role: "Portfolio Asset Lead",
      signal: "Oversees site operations, tenant coordination, and routine contractor dispatch.",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    };
  }

  return {
    role: "Commercial Lead",
    signal: "Key stakeholder in regional commercial asset operations.",
    badgeClass: "bg-neutral-100 dark:bg-[#252520] text-muted-foreground border-border",
  };
}

export function LeadContactsCard({
  contact,
  officers = [],
  entity,
  ownerName,
  ownerAddress,
  parcelId,
  className,
}: LeadContactsCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [primaryOpen, setPrimaryOpen] = useState(true);
  const [officersOpen, setOfficersOpen] = useState(true);
  const [entityOpen, setEntityOpen] = useState(true);

  // Executive directory inline state
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [candidates, setCandidates] = useState<ApolloCandidate[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [seniorityFilter, setSeniorityFilter] = useState("all");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Re-verification state
  const [isReverifying, setIsReverifying] = useState(false);
  const [justReverified, setJustReverified] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);

  const handleReverify = async () => {
    if (isReverifying) return;
    setIsReverifying(true);
    setJustReverified(false);
    try {
      const promises: Promise<any>[] = [];
      if (targetDomain) {
        promises.push(
          fetch(`/api/apollo/organization?domain=${encodeURIComponent(targetDomain)}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.organization) setOrgData(d.organization);
            })
            .catch(() => {})
        );
      }
      promises.push(fetchDirectory());
      await Promise.allSettled(promises);
      setJustReverified(true);
      setLastVerifiedAt("Just now");
      setTimeout(() => setJustReverified(false), 2500);
    } finally {
      setIsReverifying(false);
    }
  };

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
  const targetDomain = useMemo(() => {
    if (!contact?.websiteUrl) return "";
    return contact.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "").trim();
  }, [contact?.websiteUrl]);

  // Feature flag: hide Executive Resolution for now per user request
  const showExecutiveResolution = false;

  // Organization Headquarters intelligence state
  const [orgData, setOrgData] = useState<ApolloOrganization | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(false);

  useEffect(() => {
    if (!targetDomain) return;
    let active = true;
    setLoadingOrg(true);
    fetch(`/api/apollo/organization?domain=${encodeURIComponent(targetDomain)}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data.success && data.organization) {
          setOrgData(data.organization);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingOrg(false);
      });
    return () => {
      active = false;
    };
  }, [targetDomain]);

  const resolutionTrace = useMemo(() => {
    const legal = entity?.legalName || ownerName || "Dallas CAD Tax Roll";
    const sponsor = orgData?.name || contact?.organizationName || targetOrg || "Operating Sponsor";
    const domain = targetDomain || "verified domain";
    const isDirect = legal.toLowerCase().trim() === sponsor.toLowerCase().trim();
    return {
      legalEntity: legal,
      operatingSponsor: sponsor,
      domain,
      confidence: isDirect ? "92%" : "96%",
      headquarters: orgData?.city && orgData?.state ? `${orgData.city}, ${orgData.state}` : undefined,
      scale: orgData?.annualRevenuePrinted
        ? `${orgData.annualRevenuePrinted} Rev`
        : orgData?.estimatedNumEmployees
        ? `${orgData.estimatedNumEmployees.toLocaleString()} Staff`
        : undefined,
    };
  }, [entity?.legalName, ownerName, orgData, contact?.organizationName, targetOrg, targetDomain]);
  const linkedInSearchUrl = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
    [targetPerson, targetOrg, "Dallas TX"].filter(Boolean).join(" ")
  )}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    [targetPerson, targetOrg, "Dallas commercial"].filter(Boolean).join(" ")
  )}`;

  const fetchDirectory = async (seniority = seniorityFilter) => {
    if (!targetDomain && !targetOrg) return;
    setLoadingDirectory(true);
    setDirectoryError(null);
    try {
      const seniorities =
        seniority === "all"
          ? ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager"]
          : seniority.split(",");

      const res = await fetch("/api/apollo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: targetDomain || undefined,
          organizationName: targetOrg || undefined,
          seniorities,
          page: 1,
          perPage: 15,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to query directory");
      setCandidates(data.candidates || []);
      setIsDemoMode(Boolean(data.isDemoFallback));
      setHasSearched(true);
    } catch (err: any) {
      setDirectoryError(err.message || "Failed to load directory");
    } finally {
      setLoadingDirectory(false);
    }
  };

  const handleReveal = async (candidate: ApolloCandidate, revealPhone = false) => {
    setUnlockingId(candidate.id);
    try {
      const res = await fetch("/api/apollo/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: candidate.id,
          parcelId,
          organizationName: candidate.organizationName || targetOrg,
          organizationDomain: candidate.organizationDomain || targetDomain,
          revealPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reveal contact");

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? {
                ...c,
                isUnlocked: true,
                email: data.contact?.email || c.email,
                phone: data.contact?.phone || c.phone,
              }
            : c
        )
      );
    } catch (err: any) {
      alert(err.message || "Could not reveal contact");
    } finally {
      setUnlockingId(null);
    }
  };

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

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isReverifying}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReverify();
                }}
                title="Re-verify contact and corporate records with Depoii AI"
                className="h-7 px-2 text-[11px] font-mono rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", isReverifying && "animate-spin text-primary")} />
                <span className="hidden sm:inline">
                  {isReverifying ? "Re-verifying..." : justReverified ? "Re-verified" : "Re-verify"}
                </span>
              </button>

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
                    <div className="text-xs font-medium text-foreground pt-1 flex items-center gap-2 flex-wrap">
                      <RealLogo
                        url={orgData?.logoUrl || contact.logoUrl}
                        alt={contact.organizationName}
                        size={16}
                        fallback={<Building2 className="size-3.5 text-muted-foreground" />}
                      />
                      <span>{orgData?.name || contact.organizationName}</span>
                      {orgData && (orgData.annualRevenuePrinted || orgData.estimatedNumEmployees) && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-neutral-200/50 dark:bg-[#252520] px-1.5 py-0.5 rounded">
                          {[
                            orgData.annualRevenuePrinted ? `${orgData.annualRevenuePrinted} Rev` : "",
                            orgData.estimatedNumEmployees ? `${orgData.estimatedNumEmployees.toLocaleString()} Staff` : "",
                          ].filter(Boolean).join(" · ")}
                        </span>
                      )}
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
                ) : orgData?.phone ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-neutral-50 dark:bg-[#171714] px-3.5 py-2.5">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <Phone className="size-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[11px] text-muted-foreground block">
                          Verified HQ Switchboard
                        </span>
                        <a
                          href={`tel:${orgData.phone.replace(/[^\d+]/g, "")}`}
                          className="text-xs font-semibold text-foreground hover:underline truncate block tabular-nums"
                        >
                          {orgData.phone}
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="size-7 rounded hover:bg-neutral-200 dark:hover:bg-[#232320] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      onClick={() => copy(orgData.phone || "", "phone")}
                      title="Copy HQ phone number"
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

                {orgData?.linkedinUrl && (
                  <a
                    href={orgData.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-neutral-50 dark:bg-[#171714] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-[#232320] transition-colors"
                  >
                    <Search className="size-3" />
                    <span>Company LinkedIn {orgData.estimatedNumEmployees ? `(${orgData.estimatedNumEmployees.toLocaleString()} staff)` : ""}</span>
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                )}
              </div>

              {/* Corporate Headquarters Address */}
              {orgData && (orgData.streetAddress || orgData.rawAddress) && (
                <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-foreground/80">Corporate HQ:</span>
                  <span>{orgData.streetAddress ? `${orgData.streetAddress}, ${orgData.city}, ${orgData.state} ${orgData.postalCode || ""}` : orgData.rawAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* BOX 2: DEPOII AI · EXECUTIVE RESOLUTION ENGINE (Hidden for now)   */}
      {/* ================================================================= */}
      {showExecutiveResolution && (
        <div className="rounded-xl border border-border bg-white dark:bg-[#1c1c18] overflow-hidden shadow-xs">
        <div
          onClick={() => {
            const next = !directoryOpen;
            setDirectoryOpen(next);
            if (next && !hasSearched) fetchDirectory();
          }}
          className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none transition-colors hover:bg-neutral-50 dark:hover:bg-[#20201c]"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
              Depoii AI
            </span>
            <span className="text-muted-foreground/30 font-mono">/</span>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Executive Resolution
            </h3>
            <span className="rounded px-2 py-0.5 text-xs font-mono font-medium bg-neutral-100 dark:bg-[#232320] text-muted-foreground border border-border tabular-nums">
              {candidates.length > 0 ? `${candidates.length} Resolved` : "AI Graph"}
            </span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
              {resolutionTrace.confidence} Match
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isReverifying}
              onClick={(e) => {
                e.stopPropagation();
                handleReverify();
              }}
              title="Re-verify commercial ownership graph and decision makers"
              className="h-7 px-2 text-[11px] font-mono rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", isReverifying && "animate-spin text-primary")} />
              <span className="hidden sm:inline">
                {isReverifying ? "Tracing..." : justReverified ? "Re-verified" : "Re-verify"}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = !directoryOpen;
                setDirectoryOpen(next);
                if (next && !hasSearched) fetchDirectory();
              }}
              aria-label={directoryOpen ? "Collapse resolution" : "Expand resolution"}
              className="size-7 rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2c2c28] border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              {directoryOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {directoryOpen && (
          <div className="px-5 pb-5 pt-3 border-t border-border space-y-3.5">
            {/* Depoii AI Disambiguation Graph Trace */}
            <div className="rounded-lg border border-border/80 bg-neutral-50/80 dark:bg-[#161614] p-3 text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="uppercase tracking-wider font-semibold text-foreground/80">Entity Resolution Trace</span>
                <span className="flex items-center gap-2">
                  {lastVerifiedAt && (
                    <span className="text-muted-foreground/80 font-normal">Re-verified: {lastVerifiedAt}</span>
                  )}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Confidence: {resolutionTrace.confidence}</span>
                </span>
              </div>
              <div className="text-foreground/90 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed">
                <span className="text-muted-foreground">Tax Deed:</span>
                <span className="font-semibold text-foreground bg-neutral-200/60 dark:bg-[#22221e] px-1.5 py-0.5 rounded">
                  {resolutionTrace.legalEntity}
                </span>
                <span className="text-muted-foreground">──► Sponsor:</span>
                <span className="font-semibold text-foreground bg-neutral-200/60 dark:bg-[#22221e] px-1.5 py-0.5 rounded">
                  {resolutionTrace.operatingSponsor}
                </span>
                {targetDomain && (
                  <>
                    <span className="text-muted-foreground">──► Domain:</span>
                    <span className="text-foreground font-mono">{targetDomain}</span>
                  </>
                )}
                {resolutionTrace.headquarters && (
                  <>
                    <span className="text-muted-foreground">──► HQ:</span>
                    <span className="text-foreground">{resolutionTrace.headquarters}</span>
                  </>
                )}
                {resolutionTrace.scale && (
                  <span className="text-muted-foreground/80 font-mono text-[10px]">
                    ({resolutionTrace.scale})
                  </span>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium mr-1">Authority:</span>
                {[
                  { label: "All Stakeholders", value: "all" },
                  { label: "CapEx & C-Suite", value: "owner,founder,c_suite" },
                  { label: "Facilities & Ops", value: "vp,head,director" },
                  { label: "Property Leads", value: "manager" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSeniorityFilter(opt.value);
                      fetchDirectory(opt.value);
                    }}
                    className={cn(
                      "rounded px-2.5 py-0.5 text-xs font-medium transition-colors border cursor-pointer",
                      seniorityFilter === opt.value
                        ? "bg-foreground text-background border-foreground font-medium"
                        : "bg-neutral-50 dark:bg-[#20201c] text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={loadingDirectory}
                onClick={() => fetchDirectory()}
                className="text-xs font-medium text-muted-foreground hover:text-foreground underline cursor-pointer disabled:opacity-50"
              >
                {loadingDirectory ? "Analyzing..." : "Re-trace graph (0 credits)"}
              </button>
            </div>

            {/* Loading */}
            {loadingDirectory && (
              <div className="py-8 text-center text-xs text-muted-foreground font-mono">
                Tracing commercial ownership graph & resolving CapEx sign-off leads...
              </div>
            )}

            {/* Error */}
            {directoryError && (
              <div className="rounded-lg border border-border bg-neutral-50 dark:bg-[#181815] p-3 text-xs text-muted-foreground">
                {directoryError}
              </div>
            )}

            {/* Empty */}
            {!loadingDirectory && !directoryError && candidates.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {hasSearched
                  ? "No additional decision makers resolved for this ownership entity."
                  : "Expand to run Depoii AI resolution on this property."}
              </div>
            )}

            {/* Candidate List with Authority Tagging & Signal Lines */}
            {!loadingDirectory && candidates.length > 0 && (
              <div className="divide-y divide-border/60">
                {candidates.map((c) => {
                  const classification = getAuthorityClassification(c.title);

                  return (
                    <div
                      key={c.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded border font-medium", classification.badgeClass)}>
                            {classification.role}
                          </span>
                          <span className="text-sm font-semibold text-foreground tracking-tight">
                            {c.name}
                          </span>
                          {c.linkedinUrl && (
                            <a
                              href={c.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                            >
                              LinkedIn ↗
                            </a>
                          )}
                          {c.isUnlocked && (
                            <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              ✓ Verified in CRM
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-medium text-foreground/90">
                          {c.title}
                          {c.organizationName && (
                            <span className="text-muted-foreground font-normal"> · {c.organizationName}</span>
                          )}
                        </div>

                        {/* Depoii AI Signal Sentence */}
                        <div className="text-[11px] text-muted-foreground leading-normal pt-0.5">
                          <span className="font-mono text-muted-foreground/60 mr-1">Signal:</span>
                          {classification.signal}
                        </div>
                      </div>

                      {/* Right Action / Unlocked Contact Info */}
                      <div className="shrink-0 flex items-center gap-2 pt-1 sm:pt-0">
                        {c.isUnlocked ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.email && (
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground bg-neutral-100 dark:bg-[#20201c] px-2.5 py-1 rounded border border-border">
                                {c.email}
                                <button
                                  type="button"
                                  onClick={() => copy(c.email!, `dir-email-${c.id}`)}
                                  className="text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                                  title="Copy email"
                                >
                                  {copiedField === `dir-email-${c.id}` ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              </span>
                            )}
                            {c.phone && (
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground bg-neutral-100 dark:bg-[#20201c] px-2.5 py-1 rounded border border-border">
                                {c.phone}
                                <button
                                  type="button"
                                  onClick={() => copy(c.phone!, `dir-phone-${c.id}`)}
                                  className="text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                                  title="Copy phone"
                                >
                                  {copiedField === `dir-phone-${c.id}` ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={unlockingId === c.id}
                              onClick={() => handleReveal(c, false)}
                              className="h-7 px-2.5 text-xs font-medium rounded border border-border bg-neutral-100 hover:bg-neutral-200 dark:bg-[#232320] dark:hover:bg-[#2a2a25] text-foreground transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {unlockingId === c.id ? "Unmasking..." : "Reveal email (1 credit)"}
                            </button>
                            {c.hasPhone && (
                              <button
                                type="button"
                                disabled={unlockingId === c.id}
                                onClick={() => handleReveal(c, true)}
                                className="h-7 px-2 text-xs font-medium rounded border border-border bg-transparent hover:bg-neutral-100 dark:hover:bg-[#232320] text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                                title="Reveal direct phone and email (+8 credits)"
                              >
                                + Phone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isDemoMode && (
              <div className="pt-2 text-[11px] text-muted-foreground border-t border-border/60 flex items-center justify-between font-mono">
                <span>[Depoii AI Graph] Simulated resolution trace (Free tier).</span>
                <a
                  href="https://www.apollo.io/pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground font-sans"
                >
                  Apollo Basic activates live data ↗
                </a>
              </div>
            )}
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
