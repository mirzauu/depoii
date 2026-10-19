"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const field = "h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const ACTIONS: { id: string; label: string }[] = [
  { id: "auth.sign_in", label: "Signed in" },
  { id: "auth.sign_up", label: "Signed up" },
  { id: "auth.link_sign_in", label: "Opened sign-in link" },
  { id: "user.login_link", label: "Created sign-in link" },
  { id: "user.login_link_revoke", label: "Turned off sign-in link" },
  { id: "org.create", label: "Created organization" },
  { id: "org.rename", label: "Renamed organization" },
  { id: "org.suspend", label: "Suspended organization" },
  { id: "org.reactivate", label: "Reactivated organization" },
  { id: "user.create", label: "Created user" },
  { id: "user.role", label: "Changed role" },
  { id: "user.move", label: "Moved user" },
  { id: "user.password_reset", label: "Reset password" },
  { id: "user.disable", label: "Disabled user" },
  { id: "user.enable", label: "Enabled user" },
  { id: "user.superadmin_grant", label: "Granted super admin" },
  { id: "user.superadmin_revoke", label: "Revoked super admin" },
  { id: "lead.save", label: "Saved lead" },
  { id: "outcome.save", label: "Saved field outcome" },
];

const ACTION_LABEL = Object.fromEntries(ACTIONS.map((item) => [item.id, item.label]));

export type ActivityItem = {
  id: number;
  at: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string;
  orgId: string | null;
  orgName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
  orgName: string;
  orgDisabled: boolean;
  disabled: boolean;
  platformRole: string;
  lastSeenAt: string;
  lastLoginAt: string;
  createdAt: string;
};

export type AdminOrg = {
  id: string;
  name: string;
  disabled: boolean;
  createdAt: string;
  members: number;
  leads: number;
  outcomes: number;
};

export function when(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function actionLabel(action: string) {
  return ACTION_LABEL[action] || action;
}

export function detailText(detail: Record<string, unknown>) {
  const parts = Object.entries(detail)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length ? parts.join(" · ") : "—";
}

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export function ActivityTable({ rows }: { rows: ActivityItem[] }) {
  if (!rows.length) return <p className="px-4 text-sm text-muted-foreground lg:px-8">No activity matches this view.</p>;
  return (
    <div className="px-4 lg:px-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{when(row.at)}</TableCell>
              <TableCell>{actionLabel(row.action)}</TableCell>
              <TableCell>{row.actorName || row.actorEmail || "—"}</TableCell>
              <TableCell>{row.orgName || "—"}</TableCell>
              <TableCell className="max-w-md truncate">{detailText(row.detail)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserEditor({
  user,
  orgs,
  pending,
  onPatch,
}: {
  user: AdminUser;
  orgs: { id: string; name: string }[];
  pending: boolean;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [role, setRole] = useState(user.role);
  const [orgId, setOrgId] = useState(user.orgId);
  const [password, setPassword] = useState("");
  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Role" value={role} onChange={(event) => setRole(event.target.value)} className={field}>
          <option value="owner">Owner</option>
          <option value="rep">Rep</option>
        </select>
        <select aria-label="Organization" value={orgId} onChange={(event) => setOrgId(event.target.value)} className={field}>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
        <Button type="button" size="sm" disabled={pending} onClick={() => onPatch(user.id, { role, orgId })}>Save role and organization</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="max-w-xs" autoComplete="new-password" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || password.length < 8}
          onClick={async () => {
            await onPatch(user.id, { password });
            setPassword("");
          }}
        >
          Reset password
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={user.disabled ? "outline" : "destructive"} disabled={pending} onClick={() => onPatch(user.id, { disabled: !user.disabled })}>
          {user.disabled ? "Enable account" : "Disable account"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onPatch(user.id, { platformRole: user.platformRole === "superadmin" ? "" : "superadmin" })}
        >
          {user.platformRole === "superadmin" ? "Revoke super admin" : "Grant super admin"}
        </Button>
      </div>
    </div>
  );
}

export function UserManager({
  users,
  orgs,
  onChange,
}: {
  users: AdminUser[];
  orgs: { id: string; name: string }[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError("");
    setPending(true);
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setPending(false);
    }
  };

  if (!users.length) return <p className="px-4 text-sm text-muted-foreground lg:px-8">No users in this list.</p>;

  return (
    <div className="space-y-2 px-4 lg:px-8">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <Fragment key={user.id}>
              <TableRow>
                <TableCell>
                  <Link href={`/admin/users/${user.id}`} className="font-medium underline-offset-4 hover:underline">{user.name}</Link>
                  {user.platformRole === "superadmin" && <Badge variant="outline">Super admin</Badge>}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.orgName}
                  {user.orgDisabled && <span className="ml-2 text-xs text-muted-foreground">Suspended</span>}
                </TableCell>
                <TableCell className="capitalize">{user.role}</TableCell>
                <TableCell>{user.disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap">{when(user.lastLoginAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                  <Link href={`/admin/users/${user.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Details</Link>
                  <Button type="button" size="sm" variant="outline" onClick={() => setOpen((current) => (current === user.id ? null : user.id))}>
                    {open === user.id ? "Close" : "Manage"}
                  </Button>
                  </div>
                </TableCell>
              </TableRow>
              {open === user.id && (
                <TableRow key={`${user.id}-edit`}>
                  <TableCell colSpan={7}>
                    <UserEditor
                      key={`${user.id}:${user.role}:${user.orgId}:${user.disabled}:${user.platformRole}`}
                      user={user}
                      orgs={orgs}
                      pending={pending}
                      onPatch={patch}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
