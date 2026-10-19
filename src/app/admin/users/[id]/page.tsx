"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { ActivityTable, UserManager, adminFetch, when, type ActivityItem, type AdminOrg, type AdminUser } from "@/components/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Detail = {
  user: AdminUser;
  link: { createdAt: string; expiresAt: string; active: boolean } | null;
  activity: ActivityItem[];
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    adminFetch<Detail>(`/api/admin/users/${id}`).then(setDetail).catch((err: Error) => setError(err.message));
    adminFetch<AdminOrg[]>("/api/admin/orgs").then(setOrgs).catch(() => setOrgs([]));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const createLink = async () => {
    setError("");
    setCopied(false);
    setPending(true);
    try {
      const created = await adminFetch<{ token: string; expiresAt: string }>(`/api/admin/users/${id}/link`, { method: "POST" });
      setUrl(`${window.location.origin}/api/auth/enter?token=${created.token}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the sign-in link.");
    } finally {
      setPending(false);
    }
  };

  const revokeLink = async () => {
    setError("");
    setPending(true);
    try {
      await adminFetch(`/api/admin/users/${id}/link`, { method: "DELETE" });
      setUrl("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn off the sign-in link.");
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const user = detail?.user;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User"
        title={user?.name || "User"}
        description={user ? `${user.email} · ${user.orgName}` : "Sign-in history and a one-click link for this account."}
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

          <Card className="mx-4 lg:mx-8">
            <CardHeader>
              <CardTitle>One-click sign-in link</CardTitle>
              <CardDescription>
                Anyone who opens this link is signed in as {user.name} and lands on the home page. No email or password. The link works for 14 days. Creating a new one turns the previous link off.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail?.link?.active && !url && (
                <p className="text-sm text-muted-foreground">A link is already active until {when(detail.link.expiresAt)}. Create a new one to copy the address again.</p>
              )}
              {url && (
                <div className="flex flex-wrap items-center gap-2">
                  <input readOnly value={url} aria-label="Sign-in link" className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm" />
                  <Button type="button" size="sm" variant="outline" onClick={copy}>{copied ? "Copied" : "Copy link"}</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending || user.disabled} onClick={createLink}>
                  {detail?.link?.active || url ? "Create a new link" : "Create sign-in link"}
                </Button>
                {detail?.link && (
                  <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={revokeLink}>Turn off link</Button>
                )}
              </div>
            </CardContent>
          </Card>

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
