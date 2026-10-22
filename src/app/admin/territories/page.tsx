"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  MapPin, 
  Users, 
  Lock, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Layers,
  Settings,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DepoiiLoader } from "@/components/depoii-logo";
import { usd } from "@/lib/format";

interface Subscriber {
  id: string;
  territory_id: string;
  org_id: string;
  org_name: string;
  tier: string;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  is_trial?: boolean;
  trial_days_left?: number | null;
}

interface ClaimItem {
  id: string;
  parcel_id: string;
  territory_id: string;
  claimed_by_org_id: string;
  org_name: string;
  address: string;
  claimed_at: string;
  expires_at: string;
  activity_deadline: string;
  status: string;
}

interface TerritoryItem {
  id: string;
  market: string;
  name: string;
  description: string;
  zip_codes: string[];
  max_subscribers: number;
  total_parcels: number;
  total_pipeline_value: number;
  total_sqft: number;
  subscribers: Subscriber[];
  waitlist: Subscriber[];
  activeClaims: ClaimItem[];
}

interface OrgItem {
  id: string;
  name: string;
  subscription_tier: string;
  max_active_claims: number;
  max_monthly_claims: number;
}

export default function AdminTerritoriesPage() {
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [allClaims, setAllClaims] = useState<ClaimItem[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedTerritory, setSelectedTerritory] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedTier, setSelectedTier] = useState("pro_territory");
  const [isTrial, setIsTrial] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = () => {
    fetch("/api/admin/territories")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load territory admin data");
        return res.json();
      })
      .then((data) => {
        setTerritories(data.territories || []);
        setAllClaims(data.allClaims || []);
        setAllOrgs(data.allOrgs || []);
        if (data.territories?.length && !selectedTerritory) {
          setSelectedTerritory(data.territories[0].id);
        }
        if (data.allOrgs?.length && !selectedOrg) {
          setSelectedOrg(data.allOrgs[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerritory || !selectedOrg) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isTrial
            ? {
                action: "grant_trial",
                territoryId: selectedTerritory,
                orgId: selectedOrg,
                trialDays,
                maxActiveClaims: 3,
                maxMonthlyClaims: 10,
              }
            : {
                action: "assign_subscription",
                territoryId: selectedTerritory,
                orgId: selectedOrg,
                tier: selectedTier,
              }
        ),
      });
      if (!res.ok) throw new Error("Assignment failed");
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error assigning subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (territoryId: string, orgId: string) => {
    if (!confirm("Are you sure you want to revoke this contractor's territory access?")) return;

    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_subscription",
          territoryId,
          orgId,
        }),
      });
      if (!res.ok) throw new Error("Removal failed");
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error removing subscription");
    }
  };

  const handleOverrideRelease = async (claimId: string) => {
    if (!confirm("Admin override: Release this claim immediately back to pool?")) return;

    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "override_release_claim",
          claimId,
        }),
      });
      if (!res.ok) throw new Error("Override failed");
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error overriding claim");
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Territory & Claim Lock Management
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Superadmin controls: assign contractor zones, override claim locks, manage subscriber capacities, and view waitlists.
        </p>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center">
          <DepoiiLoader label="Loading territory administration data..." />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Quick Assign Form */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Assign Organization to Territory
              </h2>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full">
                <input
                  type="checkbox"
                  checked={isTrial}
                  onChange={(e) => setIsTrial(e.target.checked)}
                  className="rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                />
                <Sparkles className="h-3 w-3 text-purple-400" />
                Grant as Free Trial
              </label>
            </div>
            <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1 font-medium">Select Zone</label>
                <select
                  value={selectedTerritory}
                  onChange={(e) => setSelectedTerritory(e.target.value)}
                  className="w-full h-8 rounded-md border border-border bg-background px-2"
                >
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subscribers.length}/{t.max_subscribers})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-medium">Select Roofing Org</label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="w-full h-8 rounded-md border border-border bg-background px-2"
                >
                  {allOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.subscription_tier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-medium">
                  {isTrial ? "Trial Duration" : "Subscription Tier"}
                </label>
                {isTrial ? (
                  <select
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                    className="w-full h-8 rounded-md border border-purple-500/50 bg-background px-2 text-purple-300"
                  >
                    <option value={7}>7 Days (Flash Trial · 3 locks)</option>
                    <option value={14}>14 Days (Standard Trial · 3 locks)</option>
                    <option value={30}>30 Days (Extended Trial · 3 locks)</option>
                  </select>
                ) : (
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2"
                  >
                    <option value="pro_territory">Pro Territory ($1,199/mo · 10 Active)</option>
                    <option value="exclusive_zone">Exclusive Zone ($2,499/mo · 15 Active)</option>
                  </select>
                )}
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className={isTrial ? "w-full h-8 font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-1.5" : "w-full h-8 font-semibold"}
                >
                  {isTrial && <Sparkles className="h-3.5 w-3.5" />}
                  {isSubmitting ? "Assigning..." : isTrial ? `Grant ${trialDays}-Day Free Trial` : "Confirm Territory Access"}
                </Button>
              </div>
            </form>
          </div>

          {/* Zones Overview */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Dallas Territory Zones ({territories.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {territories.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{t.name}</h3>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t.total_parcels} parcels · {usd(t.total_pipeline_value)}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {t.subscribers.length} / {t.max_subscribers} Capped
                    </Badge>
                  </div>

                  {/* Active Subscribers */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                    <div className="font-semibold text-muted-foreground text-[11px]">Active Subscribers:</div>
                    {t.subscribers.length === 0 ? (
                      <div className="text-muted-foreground italic text-[11px]">No active contractors</div>
                    ) : (
                      t.subscribers.map((sub) => (
                        <div key={sub.org_id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                          <span className="font-medium text-foreground">{sub.org_name}</span>
                          <div className="flex items-center gap-1.5">
                            {sub.is_trial ? (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-semibold gap-1">
                                <Sparkles className="h-2.5 w-2.5 text-purple-400" />
                                Trial ({sub.trial_days_left != null ? `${sub.trial_days_left}d` : "active"})
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground uppercase">{sub.tier.replace("_", " ")}</span>
                            )}
                            <button
                              onClick={() => handleRemove(t.id, sub.org_id)}
                              className="text-destructive hover:opacity-80 ml-1"
                              title="Revoke subscription"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Waitlist if any */}
                  {t.waitlist.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-border/40 text-xs">
                      <div className="font-semibold text-amber-500 text-[11px]">Waitlist Queue ({t.waitlist.length}):</div>
                      {t.waitlist.map((w) => (
                        <div key={w.org_id} className="text-[11px] text-muted-foreground">
                          • {w.org_name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Claims in this zone */}
                  <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex justify-between">
                    <span>Active Claims Locked:</span>
                    <span className="font-semibold text-foreground">{t.activeClaims.length} properties</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Active Claims Lock Table */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Active Property Claims Lock Registry ({allClaims.length})
            </h2>

            {allClaims.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No active property claims currently locked in any territory.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">Property Address</th>
                      <th className="p-3">Zone</th>
                      <th className="p-3">Claimed By Org</th>
                      <th className="p-3">Claimed Date</th>
                      <th className="p-3">Activity Deadline</th>
                      <th className="p-3">TTL Expiry</th>
                      <th className="p-3 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {allClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium text-foreground">
                          <Link href={`/parcels/${claim.parcel_id}`} className="hover:underline flex items-center gap-1">
                            <span>{claim.address}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        </td>
                        <td className="p-3 capitalize">{claim.territory_id.replace("dallas-", "").replace(/-/g, " ")}</td>
                        <td className="p-3 font-semibold text-primary">{claim.org_name}</td>
                        <td className="p-3 text-muted-foreground">{new Date(claim.claimed_at).toLocaleDateString()}</td>
                        <td className="p-3 font-medium text-amber-500">
                          {new Date(claim.activity_deadline).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-muted-foreground">{new Date(claim.expires_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() => handleOverrideRelease(claim.id)}
                            className="h-6 text-[11px]"
                          >
                            Force Release
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
