"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Clock, ShieldCheck, Trash2, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { adminFetch, field, when, type AdminOrg } from "@/components/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const emptyForm = { name: "", ownerName: "", ownerEmail: "", ownerPassword: "" };

interface TerritoryOption {
  id: string;
  name: string;
  total_parcels?: number;
  total_pipeline_value?: number;
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Free Trial Modal State
  const [trialOrg, setTrialOrg] = useState<AdminOrg | null>(null);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [trialZone, setTrialZone] = useState("dallas-central-uptown");
  const [trialDays, setTrialDays] = useState(14);
  const [trialClaims, setTrialClaims] = useState(3);
  const [trialPending, setTrialPending] = useState(false);
  const [trialSuccessMsg, setTrialSuccessMsg] = useState("");

  const load = useCallback(() => {
    adminFetch<AdminOrg[]>("/api/admin/orgs").then(setOrgs).catch((err: Error) => setError(err.message)).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    // Load territories for the trial modal selector
    fetch("/api/admin/territories")
      .then((res) => (res.ok ? res.json() : { territories: [] }))
      .then((data) => {
        if (data.territories?.length) {
          setTerritories(data.territories);
        }
      })
      .catch(() => {});
  }, [load]);

  const openTrialModal = (org: AdminOrg) => {
    setTrialOrg(org);
    setTrialSuccessMsg("");
    // If org has an active trial, pre-select its zone
    const existing = org.activeSubscriptions?.[0];
    if (existing?.territory_id) {
      setTrialZone(existing.territory_id);
    } else {
      setTrialZone("dallas-central-uptown");
    }
    setTrialDays(14);
    setTrialClaims(3);
  };

  const handleGrantTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialOrg) return;
    setTrialPending(true);
    setError("");

    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant_trial",
          orgId: trialOrg.id,
          territoryId: trialZone,
          trialDays,
          maxActiveClaims: trialClaims,
          maxMonthlyClaims: 10,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grant free trial");

      setTrialSuccessMsg(`14-day free trial activated for ${trialOrg.name}!`);
      load();
      setTimeout(() => {
        setTrialOrg(null);
        setTrialSuccessMsg("");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error granting trial");
    } finally {
      setTrialPending(false);
    }
  };

  const handleRevokeSubscription = async (territoryId: string) => {
    if (!trialOrg) return;
    if (!confirm(`Are you sure you want to revoke this zone from ${trialOrg.name}?`)) return;

    setTrialPending(true);
    try {
      const res = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_subscription",
          orgId: trialOrg.id,
          territoryId,
        }),
      });
      if (!res.ok) throw new Error("Revocation failed");
      setTrialSuccessMsg("Access revoked.");
      load();
      setTimeout(() => {
        setTrialOrg(null);
        setTrialSuccessMsg("");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error revoking");
    } finally {
      setTrialPending(false);
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await adminFetch("/api/admin/orgs", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the organization.");
    } finally {
      setPending(false);
    }
  };

  const patch = async (id: string, body: { name?: string; disabled?: boolean }) => {
    setError("");
    setPending(true);
    try {
      await adminFetch(`/api/admin/orgs/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the organization.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Organizations"
        description="Create workspaces, manage roofing contractor free trials, assign Dallas zones, or suspend organizations."
      />
      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}
      <Card className="mx-4 lg:mx-8">
        <CardHeader><CardTitle>New organization</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Organization
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className="mt-1" />
            </label>
            <label className="text-sm">Owner name
              <Input value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">Owner email
              <Input type="email" value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} required className="mt-1" />
            </label>
            <label className="text-sm">Owner password
              <Input type="password" value={form.ownerPassword} onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })} required minLength={8} autoComplete="new-password" className="mt-1" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>Create organization</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {!loaded && !error && <p className="px-4 text-sm text-muted-foreground lg:px-8">Loading organizations…</p>}
      {loaded && (
      <div className="px-4 lg:px-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plan & Territory</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Outcomes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => {
              const activeSub = org.activeSubscriptions?.[0];
              const isTrial = activeSub?.is_trial;

              return (
                <TableRow key={org.id}>
                  <TableCell>
                    {editing === org.id ? (
                      <Input value={draft} onChange={(event) => setDraft(event.target.value)} className={field} />
                    ) : (
                      <Link href={`/admin/organizations/${org.id}`} className="font-medium underline-offset-4 hover:underline">{org.name}</Link>
                    )}
                  </TableCell>
                  <TableCell>
                    {activeSub ? (
                      isTrial ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge className="w-fit bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs gap-1 font-semibold">
                            <Sparkles className="h-3 w-3 text-purple-400" />
                            Trial: {activeSub.territory_name}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {activeSub.trial_days_left != null ? `${activeSub.trial_days_left}d remaining` : "Active"} · {org.maxActiveClaims || 3} locks
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="w-fit text-xs border-primary/40 text-foreground font-semibold">
                            {activeSub.territory_name}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground uppercase">{activeSub.tier.replace("_", " ")}</span>
                        </div>
                      )
                    ) : (
                      <Badge variant="secondary" className="text-xs text-muted-foreground bg-muted/60">
                        Shared (No Territory)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{org.disabled ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                  <TableCell>{org.members}</TableCell>
                  <TableCell>{org.leads}</TableCell>
                  <TableCell>{org.outcomes}</TableCell>
                  <TableCell className="whitespace-nowrap">{when(org.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isTrial ? "secondary" : "outline"}
                        className={isTrial ? "border-purple-500/40 text-purple-300 hover:bg-purple-500/10" : "gap-1"}
                        onClick={() => openTrialModal(org)}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                        {isTrial ? "Manage Trial" : "Free Trial"}
                      </Button>
                      {editing === org.id ? (
                        <>
                          <Button type="button" size="sm" disabled={pending} onClick={() => patch(org.id, { name: draft })}>Save</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(org.id); setDraft(org.name); }}>Rename</Button>
                      )}
                      <Button type="button" size="sm" variant={org.disabled ? "outline" : "destructive"} disabled={pending} onClick={() => patch(org.id, { disabled: !org.disabled })}>
                        {org.disabled ? "Reactivate" : "Suspend"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Free Trial Modal */}
      <Dialog open={Boolean(trialOrg)} onOpenChange={(open) => !open && setTrialOrg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Free Trial Management
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Grant or adjust a time-limited Dallas territory trial with exclusive claim-locking access for{" "}
              <strong className="text-foreground">{trialOrg?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {trialSuccessMsg ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-400 text-sm font-medium text-center">
              {trialSuccessMsg}
            </div>
          ) : (
            <form onSubmit={handleGrantTrial} className="space-y-4 pt-2">
              {/* Existing active subscription notice */}
              {trialOrg?.activeSubscriptions && trialOrg.activeSubscriptions.length > 0 && (
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300">
                      Currently Active Zone:
                    </span>
                    <Badge variant="outline" className="text-[11px] border-purple-400/40 text-purple-200">
                      {trialOrg.activeSubscriptions[0].is_trial
                        ? `${trialOrg.activeSubscriptions[0].trial_days_left}d trial remaining`
                        : "Paid Subscription"}
                    </Badge>
                  </div>
                  <div className="text-xs text-foreground font-medium">
                    {trialOrg.activeSubscriptions[0].territory_name}
                  </div>
                  <div className="pt-1 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={trialPending}
                      className="h-7 text-xs gap-1"
                      onClick={() => handleRevokeSubscription(trialOrg.activeSubscriptions![0].territory_id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      End / Revoke Access Now
                    </Button>
                  </div>
                </div>
              )}

              {/* Territory Zone Selection */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Assign Territory Zone
                </label>
                <select
                  value={trialZone}
                  onChange={(e) => setTrialZone(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                >
                  {territories.length > 0 ? (
                    territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.id === "dallas-central-uptown" ? "⭐ (Recommended Free Trial Zone)" : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="dallas-central-uptown">Dallas Central / Uptown / CBD ⭐ (Recommended Trial Zone)</option>
                      <option value="dallas-north-corridor">Dallas North Corridor</option>
                      <option value="dallas-east-white-rock">Dallas East / White Rock</option>
                      <option value="dallas-south-i35">Dallas South / I-35 Industrial</option>
                      <option value="dallas-west-stemmons">Dallas West / Stemmons</option>
                    </>
                  )}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  ⭐ <strong>Dallas Central / Uptown</strong> has 41 verified leads, 100% decision-maker phone & email enrichment, and $24.5M pipeline.
                </p>
              </div>

              {/* Duration Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Trial Duration
                  </label>
                  <select
                    value={trialDays}
                    onChange={(e) => setTrialDays(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                  >
                    <option value={7}>7 Days (Flash Trial)</option>
                    <option value={14}>14 Days (Standard Trial)</option>
                    <option value={30}>30 Days (Extended)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Active Claim Locks
                  </label>
                  <select
                    value={trialClaims}
                    onChange={(e) => setTrialClaims(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                  >
                    <option value={3}>3 Active Claims (Recommended)</option>
                    <option value={5}>5 Active Claims</option>
                    <option value={10}>10 Active Claims</option>
                  </select>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Automatic Expiration Guardrail
                </div>
                <p>
                  When the trial expires after {trialDays} days, the contractor will automatically revert to no active territory (leads and claim-locks locked) unless upgraded to paid.
                </p>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTrialOrg(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={trialPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {trialPending ? "Activating..." : `Activate ${trialDays}-Day Free Trial`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

