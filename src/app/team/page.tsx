"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { useMe } from "@/components/use-me";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Member = { id: string; name: string; email: string; role: string };
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
  const [orgName, setOrgName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"rep" | "owner">("rep");
  const [pending, setPending] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState("");

  const load = useCallback(() => {
    fetch("/api/auth/reps")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          orgName?: string;
          members?: Member[];
          invites?: Invite[];
        };
        if (!res.ok) throw new Error(body.error || "Could not load the team.");
        setOrgName(body.orgName || "");
        setMembers(body.members || []);
        setInvites(body.invites || []);
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
    setRole("rep");
    load();
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

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow={orgName || "Organization"}
        title="Team"
        description="People with access to this organization. New people join after they accept an email invite."
      />
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
                <TableCell>{member.name || "—"}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            ))}
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell>{invite.name || "—"}</TableCell>
                <TableCell>{invite.email}</TableCell>
                <TableCell className="capitalize">{invite.role}</TableCell>
                <TableCell>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                    Pending
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {me?.role === "owner" ? (
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
      {me?.role === "owner" && (
        <form onSubmit={add} className="mx-4 grid max-w-xl gap-3 rounded-lg border border-border p-4 lg:mx-8">
          <p className="text-sm font-medium">Invite someone</p>
          <label className="text-sm">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required className={field} />
          </label>
          <label className="text-sm">
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className={field} />
          </label>
          <label className="text-sm">
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as "rep" | "owner")} className={field}>
              <option value="rep">Rep</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            {pending ? "Sending invite…" : "Add to team"}
          </Button>
        </form>
      )}
    </div>
  );
}
