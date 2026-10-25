"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings, Shield } from "lucide-react";
import type { OrgRole } from "@/lib/roles";
import { ContractorIdentityCard } from "@/components/organization/contractor-identity-card";

type Member = { id: string; name: string; email: string; role: string; roleColor?: string };
type Invite = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};

const field = "mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm";

export default function TeamPage() {
  const me = useMe();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [availableRoles, setAvailableRoles] = useState<OrgRole[]>([]);
  const [orgName, setOrgName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("rep");
  const [pending, setPending] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState("");
  const [updatingMemberId, setUpdatingMemberId] = useState("");

  const load = useCallback(() => {
    fetch("/api/auth/reps")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          orgName?: string;
          members?: Member[];
          invites?: Invite[];
          roles?: OrgRole[];
        };
        if (!res.ok) throw new Error(body.error || "Could not load the team.");
        setOrgName(body.orgName || "");
        setMembers(body.members || []);
        setInvites(body.invites || []);
        if (body.roles && body.roles.length > 0) {
          setAvailableRoles(body.roles);
          // Default selection to Rep if present
          const hasRep = body.roles.find((r) => r.name.toLowerCase() === "rep");
          if (hasRep) setRole("rep");
          else setRole(body.roles[0].name.toLowerCase());
        }
        setLoaded(true);
        setError("");
      })
      .catch((err: unknown) => {
        setLoaded(true);
        setError(err instanceof Error ? err.message : "Could not load the team.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch("/api/auth/reps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!res.ok) {
      setError(body.error || "Could not send that invite.");
      return;
    }
    setName("");
    setEmail("");
    load();
  };

  const changeMemberRole = async (memberId: string, newRole: string) => {
    setUpdatingMemberId(memberId);
    setError("");
    try {
      const res = await fetch("/api/auth/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_role", memberId, role: newRole }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Could not update role.");
        return;
      }
      load();
    } catch {
      setError("Network error updating role.");
    } finally {
      setUpdatingMemberId("");
    }
  };

  const manageInvite = async (inviteId: string, action: "resend" | "cancel") => {
    setBusyInviteId(inviteId);
    setError("");
    const res = await fetch("/api/auth/reps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId, action }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusyInviteId("");
    if (!res.ok) {
      setError(body.error || `Could not ${action} that invite.`);
      return;
    }
    load();
  };

  const isOwner = me?.role === "owner" || me?.platformRole === "superadmin";
  const isSuperAdmin = me?.platformRole === "superadmin";

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 lg:px-8 pt-4">
        <div>
          <PageHeader
            eyebrow={orgName || "Organization"}
            title="Team"
            description="People with access to this organization. New members join after accepting an email invite."
          />
        </div>
        {isOwner && (
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 hover:underline shrink-0"
          >
            <Shield className="size-3.5" />
            <span>Manage Roles & Permissions in Settings →</span>
          </Link>
        )}
      </div>

      <ContractorIdentityCard isOwner={isOwner} isSuperAdmin={isSuperAdmin} />

      {error && <p className="px-4 text-sm text-red-300 lg:px-8">{error}</p>}

      <div className="px-4 lg:px-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{member.email}</TableCell>
                <TableCell>
                  {isOwner && member.email !== me?.email ? (
                    <select
                      value={member.role.toLowerCase()}
                      disabled={updatingMemberId === member.id}
                      onChange={(e) => changeMemberRole(member.id, e.target.value)}
                      className="h-8 rounded border border-border bg-background px-2 text-xs font-medium capitalize"
                    >
                      {availableRoles.length ? (
                        availableRoles.map((r) => (
                          <option key={r.id} value={r.name.toLowerCase()}>
                            {r.name} {!r.isSystem ? "(Custom)" : ""}
                          </option>
                        ))
                      ) : (
                        <option value={member.role.toLowerCase()}>{member.role}</option>
                      )}
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: member.roleColor || "#38bdf8" }}
                      />
                      <span className="capitalize font-medium text-xs">{member.role}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    Active
                  </span>
                </TableCell>
                <TableCell className="text-right" />
              </TableRow>
            ))}
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell>{invite.name || "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{invite.email}</TableCell>
                <TableCell className="capitalize font-medium text-xs">{invite.role}</TableCell>
                <TableCell>
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-200">
                    Pending
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {isOwner ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyInviteId === invite.id}
                        onClick={() => void manageInvite(invite.id, "resend")}
                      >
                        {busyInviteId === invite.id ? "Working…" : "Resend"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyInviteId === invite.id}
                        onClick={() => void manageInvite(invite.id, "cancel")}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {!members.length && !invites.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  {loaded ? "No one is on this team yet." : "Loading the team…"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isOwner && (
        <form onSubmit={add} className="mx-4 grid max-w-xl gap-3 rounded-lg border border-border p-5 lg:mx-8 bg-card/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Invite someone to team</p>
            <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">
              Configure roles in Settings →
            </Link>
          </div>
          <label className="text-xs font-medium text-muted-foreground">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Colleague full name" className={field} />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="colleague@domain.com" className={field} />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={field}
            >
              {availableRoles.length > 0 ? (
                availableRoles.map((r) => (
                  <option key={r.id || r.name} value={r.name.toLowerCase()}>
                    {r.name} {!r.isSystem ? "— (Custom Role)" : `— (${r.permissions.length === 1 && r.permissions[0] === '*' ? 'Full Access' : `${r.permissions.length} permissions`})`}
                  </option>
                ))
              ) : (
                <>
                  <option value="rep">Rep</option>
                  <option value="estimator">Estimator</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </>
              )}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={pending} className="w-fit mt-1">
            {pending ? "Sending invite…" : "Send Team Invite"}
          </Button>
        </form>
      )}
    </div>
  );
}
