"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import {
  ActivityTable,
  UserManager,
  UserLoginLinkCard,
  adminFetch,
  when,
  type ActivityItem,
  type AdminOrg,
  type AdminUser,
  type LoginLinkStatus,
} from "@/components/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Detail = {
  user: AdminUser;
  link: LoginLinkStatus | null;
  activity: ActivityItem[];
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    adminFetch<Detail>(`/api/admin/users/${id}`).then(setDetail).catch((err: Error) => setError(err.message));
    adminFetch<AdminOrg[]>("/api/admin/orgs").then(setOrgs).catch(() => setOrgs([]));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const user = detail?.user;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User"
        title={user?.name || "User"}
        description={user ? `${user.email} · ${user.orgName}` : "Sign-in history, direct access link, and settings for this account."}
        actions={user && (
          <div className="flex items-center gap-2">
            {user.disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="secondary">Active</Badge>}
            <Link href="/admin/users" className="text-sm text-muted-foreground underline-offset-4 hover:underline">All users</Link>
          </div>
        )}
      />
      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}
      {!detail && !error && <p className="px-4 text-sm text-muted-foreground lg:px-8">Loading user…</p>}
      {user && (
        <>
          <div className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            <Card>
              <CardHeader>
                <CardDescription>Last login</CardDescription>
                <CardTitle className="text-xl">{when(user.lastLoginAt)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Last visit</CardDescription>
                <CardTitle className="text-xl">{when(user.lastSeenAt)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Role</CardDescription>
                <CardTitle className="text-xl capitalize">{user.role}{user.platformRole === "superadmin" ? " · Super admin" : ""}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Account created</CardDescription>
                <CardTitle className="text-xl">{when(user.createdAt)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <UserLoginLinkCard
            user={{ id: user.id, name: user.name, email: user.email, orgName: user.orgName, disabled: user.disabled }}
            initialLink={detail?.link}
            onChanged={load}
          />

          <section className="space-y-2">
            <h2 className="px-4 text-sm font-medium lg:px-8">Account</h2>
            <UserManager users={[user]} orgs={orgs.map((org) => ({ id: org.id, name: org.name }))} onChange={load} />
          </section>

          <section className="space-y-2">
            <h2 className="px-4 text-sm font-medium lg:px-8">Activity</h2>
            <ActivityTable rows={detail?.activity ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
