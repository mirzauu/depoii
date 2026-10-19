"use client";

import { PageHeader } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe } from "@/components/use-me";

function roleLabel(role: string, platformRole: string) {
  if (platformRole === "superadmin") return "Super admin";
  if (role === "owner") return "Owner";
  if (role === "rep") return "Rep";
  return role || "Member";
}

export default function SettingsPage() {
  const me = useMe();

  return (
    <div className="pb-10">
      <PageHeader eyebrow="Account" title="Settings" description="The signed-in account for this workspace." />
      <dl className="mx-4 max-w-lg divide-y divide-border rounded-xl border border-border text-sm lg:mx-8">
        <Row label="Name" value={me?.name} />
        <Row label="Email" value={me?.email} />
        <Row label="Organization" value={me?.orgName} />
        <Row label="Role" value={me ? roleLabel(me.role, me.platformRole) : undefined} />
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-muted-foreground">Appearance</dt>
          <dd>
            <ThemeToggle />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
