"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { 
  Building2, 
  CheckCircle2, 
  ExternalLink, 
  HardHat, 
  ShieldCheck, 
  Sparkles, 
  Unlink, 
  Search,
  MapPin,
  Phone,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LinkedContractorProfile, ContractorMatchCandidate } from "@/lib/contractor-intelligence";

interface ContractorIdentityCardProps {
  isOwner?: boolean;
  isSuperAdmin?: boolean;
}

export function ContractorIdentityCard({ isOwner, isSuperAdmin }: ContractorIdentityCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linked, setLinked] = useState<LinkedContractorProfile | null>(null);
  const [suggestions, setSuggestions] = useState<ContractorMatchCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [linkingId, setLinkingId] = useState("");

  const load = useCallback(async (queryParam?: string) => {
    try {
      setLoading(true);
      const url = queryParam 
        ? `/api/organization/contractor?query=${encodeURIComponent(queryParam)}` 
        : `/api/organization/contractor`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contractor data");
      setLinked(data.linked || null);
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading contractor profile");
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLink = async (contractorId: string, matchedVia: "auto" | "manual" = "manual") => {
    try {
      setLinkingId(contractorId);
      setError("");
      const res = await fetch("/api/organization/contractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractorId, matchedVia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link profile");
      setLinked(data.linked || null);
      setSuggestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error linking contractor");
    } finally {
      setLinkingId("");
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Are you sure you want to unlink this contractor profile from this organization?")) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/organization/contractor", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unlink profile");
      setLinked(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error unlinking profile");
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    load(searchQuery.trim());
  };

  if (loading) {
    return (
      <div className="mx-4 lg:mx-8 rounded-xl border border-border/60 bg-card/40 p-5 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="h-8 w-72 bg-muted rounded mb-2" />
        <div className="h-4 w-96 bg-muted rounded" />
      </div>
    );
  }

  // 1. STATE: CONTRACTOR ALREADY LINKED
  if (linked) {
    return (
      <div className="mx-4 lg:mx-8 rounded-xl border border-border/80 bg-card/50 p-5 shadow-xs transition-all">
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#B4E4D6]/15 text-[#1b7e65] dark:text-[#B4E4D6] border border-[#B4E4D6]/30">
                <CheckCircle2 className="size-3 text-[#1b7e65] dark:text-[#B4E4D6]" />
                Verified Municipal Contractor Entity
              </span>
              {linked.bbbRating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88] border border-[#FFCA88]/30">
                  <ShieldCheck className="size-3" />
                  BBB {linked.bbbRating}
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <HardHat className="size-5 text-muted-foreground" />
              {linked.canonicalName}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {linked.hqAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {linked.hqAddress}
                </span>
              )}
              {linked.phoneNumber && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3" />
                  {linked.phoneNumber}
                </span>
              )}
              {linked.websiteUrl && (
                <a 
                  href={linked.websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1 hover:underline text-foreground"
                >
                  <ExternalLink className="size-3" />
                  {linked.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/contractors/${encodeURIComponent(linked.canonicalName)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
            >
              Public Profile
              <ArrowRight className="size-3" />
            </Link>
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlink}
                title="Unlink contractor identity (Super Admin only)"
                className="text-xs text-muted-foreground hover:text-red-400"
              >
                <Unlink className="size-3.5 mr-1" />
                Unlink Profile
              </Button>
            )}
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/60">
          <div className="rounded-lg bg-background/50 p-2.5 border border-border/40">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dallas Permits</p>
            <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{linked.totalPermits}</p>
          </div>
          <div className="rounded-lg bg-background/50 p-2.5 border border-border/40">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Recorded Valuation</p>
            <p className="text-xl font-bold tracking-tight text-[#1b7e65] dark:text-[#B4E4D6] mt-0.5">{linked.totalValuationFormatted}</p>
          </div>
          <div className="rounded-lg bg-background/50 p-2.5 border border-border/40">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Lead Intelligence</p>
            <p className="text-xs font-medium text-foreground mt-1.5">Auto-Suppression Active</p>
          </div>
          <div className="rounded-lg bg-background/50 p-2.5 border border-border/40">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Circle Prospecting</p>
            <p className="text-xs font-medium text-[#1b7e65] dark:text-[#B4E4D6] mt-1.5">15 Neighborhood Clusters</p>
          </div>
        </div>

        {/* RECENT VERIFIED PERMITS ACCORDION/SNIPPET */}
        {linked.recentPermits.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="font-medium text-foreground">Recent Verified Installations on File:</span>
              <span>Showing last {Math.min(linked.recentPermits.length, 3)} of {linked.totalPermits} jobs</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {linked.recentPermits.slice(0, 3).map((p) => (
                <div key={p.id} className="p-2 rounded border border-border/50 bg-background/30 text-xs">
                  <p className="font-semibold text-foreground truncate">{p.address}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                    <span>${p.valuation.toLocaleString()}</span>
                    <span>{p.probableRoofSystem}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isSuperAdmin && (
          <div className="mt-3 pt-2 text-[11px] text-muted-foreground/80 flex items-center justify-between">
            <span>Verified and linked by Depoii Super Admin.</span>
            <span>To request changes or unlink, contact your Depoii account representative.</span>
          </div>
        )}
      </div>
    );
  }

  // 2. STATE: UNLINKED
  return (
    <div className="mx-4 lg:mx-8 rounded-xl border border-dashed border-border/80 bg-card/30 p-5 space-y-4">
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#FFCA88]/40 bg-[#FFCA88]/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-[#FFCA88]">
              <ShieldCheck className="size-3" />
              Depoii Super Admin Verification Required
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-1">
            <HardHat className="size-4 text-muted-foreground" />
            Municipal Contractor Profile Unlinked
          </h3>
          <p className="text-xs text-muted-foreground max-w-xl">
            Your organization is not yet linked to a verified municipal contractor profile. Only Depoii Super Admins can verify and link municipal contractor profiles to unlock automated Territory Defense, Competitor Encroachment Radars, and Stronghold Sector intelligence.
          </p>
        </div>

        {isSuperAdmin && (
          <form onSubmit={handleSearch} className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Admin search contractor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 rounded-md border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden"
            />
            <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={searching}>
              <Search className="size-3" />
            </Button>
          </form>
        )}
      </div>

      {isSuperAdmin && suggestions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs font-medium text-foreground">
            Matching municipal records found ({suggestions.length}):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {suggestions.map((candidate) => (
              <div 
                key={candidate.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-background/50 hover:bg-card/70 transition-colors"
              >
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-foreground truncate max-w-[240px]">
                      {candidate.canonicalName}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/30 text-amber-400">
                      {candidate.confidenceScore}% match
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {candidate.totalPermits} permits · ${candidate.totalValuation.toLocaleString()} volume · {candidate.matchReason}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs shrink-0 bg-[#B4E4D6] hover:bg-[#9dd8c7] text-[#0f4e3e] font-semibold border-none"
                  disabled={linkingId === candidate.id}
                  onClick={() => handleLink(candidate.id, "auto")}
                >
                  {linkingId === candidate.id ? "Linking..." : "Link Profile (Admin)"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
