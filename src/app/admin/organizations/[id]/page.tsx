"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ActivityTable, UserManager, adminFetch, type ActivityItem, type AdminOrg, type AdminUser } from "@/components/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Detail = {
  org: AdminOrg;
  members: AdminUser[];
  leads: { id: string; address: string; city: string; stage: string; assignee: string; score: number; price: number; updatedAt: string }[];
  outcomes: { id: string; parcelId: string; stormId: string; loggedAt: string; predictedScore: number; scope: string; contractValue: number }[];
  activity: ActivityItem[];
};

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    adminFetch<Detail>(`/api/admin/orgs/${id}`)
      .then((body) => {
        setDetail(body);
        setName(body.org.name);
      })
      .catch((err: Error) => setError(err.message));
    adminFetch<AdminOrg[]>("/api/admin/orgs").then(setOrgs).catch(() => setOrgs([]));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body: { name?: string; disabled?: boolean }) => {
    setError("");
    setPending(true);
    try {
      await adminFetch(`/api/admin/orgs/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the organization.");
    } finally {
      setPending(false);
    }
  };

  const org = detail?.org;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization"
        title={org?.name || "Organization"}
        description="Members, recent leads, field outcomes, and activity for this workspace."
        actions={org && (
          org.disabled ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>
        )}
      />
      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}
      {org && (
        <div className="flex flex-wrap items-center gap-2 px-4 lg:px-8">
          <Input value={name} onChange={(event) => setName(event.target.value)} className="max-w-sm" aria-label="Organization name" />
          <Button type="button" size="sm" disabled={pending || name.trim() === org.name} onClick={() => patch({ name })}>Rename</Button>
          <Button type="button" size="sm" variant={org.disabled ? "outline" : "destructive"} disabled={pending} onClick={() => patch({ disabled: !org.disabled })}>
            {org.disabled ? "Reactivate" : "Suspend"}
          </Button>
        </div>
      )}

      {!detail && !error && <p className="px-4 text-sm text-muted-foreground lg:px-8">Loading organization…</p>}
      {detail && (
      <>
      <section className="space-y-2">
        <h2 className="px-4 text-sm font-medium lg:px-8">Members</h2>
        <UserManager users={detail.members} orgs={orgs.map((item) => ({ id: item.id, name: item.name }))} onChange={load} />
      </section>

      <section className="space-y-2">
        <h2 className="px-4 text-sm font-medium lg:px-8">Recent leads</h2>
        {!detail.leads.length ? <p className="px-4 text-sm text-muted-foreground lg:px-8">No leads saved for this organization.</p> : (
          <div className="px-4 lg:px-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{lead.address}</TableCell>
                    <TableCell>{lead.city}</TableCell>
                    <TableCell>{lead.stage}</TableCell>
                    <TableCell>{lead.assignee}</TableCell>
                    <TableCell>{lead.score}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(lead.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-4 text-sm font-medium lg:px-8">Recent field outcomes</h2>
        {!detail.outcomes.length ? <p className="px-4 text-sm text-muted-foreground lg:px-8">No field outcomes logged for this organization.</p> : (
          <div className="px-4 lg:px-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcel</TableHead>
                  <TableHead>Storm</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Predicted score</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Logged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.outcomes.map((outcome) => (
                  <TableRow key={outcome.id}>
                    <TableCell>{outcome.parcelId}</TableCell>
                    <TableCell>{outcome.stormId}</TableCell>
                    <TableCell>{outcome.scope}</TableCell>
                    <TableCell>{outcome.predictedScore}</TableCell>
                    <TableCell>{outcome.contractValue.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(outcome.loggedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-4 text-sm font-medium lg:px-8">Activity</h2>
        <ActivityTable rows={detail.activity} />
      </section>
      </>
      )}
    </div>
  );
}
