"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { adminFetch, field, when, type AdminOrg } from "@/components/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const emptyForm = { name: "", ownerName: "", ownerEmail: "", ownerPassword: "" };

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    adminFetch<AdminOrg[]>("/api/admin/orgs").then(setOrgs).catch((err: Error) => setError(err.message)).finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

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
        description="Create a workspace and its first owner. Rename or suspend a workspace without deleting its leads or outcomes."
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
              <TableHead>Status</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Outcomes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  {editing === org.id ? (
                    <Input value={draft} onChange={(event) => setDraft(event.target.value)} className={field} />
                  ) : (
                    <Link href={`/admin/organizations/${org.id}`} className="font-medium underline-offset-4 hover:underline">{org.name}</Link>
                  )}
                </TableCell>
                <TableCell>{org.disabled ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                <TableCell>{org.members}</TableCell>
                <TableCell>{org.leads}</TableCell>
                <TableCell>{org.outcomes}</TableCell>
                <TableCell className="whitespace-nowrap">{when(org.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
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
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
