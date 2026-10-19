"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ACTIONS, ActivityTable, adminFetch, field, type ActivityItem, type AdminOrg, type AdminUser } from "@/components/admin-ui";

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgId, setOrgId] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    adminFetch<AdminOrg[]>("/api/admin/orgs").then(setOrgs).catch(() => setOrgs([]));
    adminFetch<AdminUser[]>("/api/admin/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (orgId) params.set("orgId", orgId);
    if (userId) params.set("userId", userId);
    if (action) params.set("action", action);
    params.set("limit", "100");
    setLoaded(false);
    adminFetch<ActivityItem[]>(`/api/admin/activity?${params.toString()}`)
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [orgId, userId, action]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Activity"
        description="Sign-ins, account changes, lead saves, and field outcomes recorded from this point forward."
      />
      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}
      <div className="flex flex-wrap gap-2 px-4 lg:px-8">
        <select aria-label="Organization" value={orgId} onChange={(event) => setOrgId(event.target.value)} className={field}>
          <option value="">All organizations</option>
          {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <select aria-label="User" value={userId} onChange={(event) => setUserId(event.target.value)} className={field}>
          <option value="">All users</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
        </select>
        <select aria-label="Action" value={action} onChange={(event) => setAction(event.target.value)} className={field}>
          <option value="">All actions</option>
          {ACTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      {!loaded && !error && <p className="px-4 text-sm text-muted-foreground lg:px-8">Loading activity…</p>}
      {loaded && <ActivityTable rows={rows} />}
    </div>
  );
}
