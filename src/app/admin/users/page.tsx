"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { UserManager, adminFetch, field, type AdminOrg, type AdminUser } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const emptyForm = { name: "", email: "", password: "", orgId: "", role: "rep" };

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    adminFetch<AdminUser[]>("/api/admin/users").then(setUsers).catch((err: Error) => setError(err.message)).finally(() => setLoaded(true));
    adminFetch<AdminOrg[]>("/api/admin/orgs").then((rows) => {
      setOrgs(rows);
      setForm((current) => ({ ...current, orgId: current.orgId || rows[0]?.id || "" }));
    }).catch(() => setOrgs([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await adminFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ ...emptyForm, orgId: form.orgId, role: "rep" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the user.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description="Create accounts, change roles, move someone to another organization, reset a password, or disable an account."
      />
      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}
      <Card className="mx-4 lg:mx-8">
        <CardHeader><CardTitle>New user</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Name
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">Email
              <Input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">Password
              <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1" />
            </label>
            <label className="text-sm">Organization
              <select required value={form.orgId} onChange={(event) => setForm({ ...form, orgId: event.target.value })} className={`${field} mt-1 w-full`}>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Role
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className={`${field} mt-1 w-full`}>
                <option value="rep">Rep</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={pending || !form.orgId}>Create user</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {!loaded && !error && <p className="px-4 text-sm text-muted-foreground lg:px-8">Loading users…</p>}
      {loaded && <UserManager users={users} orgs={orgs.map((org) => ({ id: org.id, name: org.name }))} onChange={load} />}
    </div>
  );
}
