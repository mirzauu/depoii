"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Key,
  Layers,
  Mail,
  Plus,
  RotateCcw,
  Send,
  Shield,
  Sliders,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "cn";
import type { PermissionDefinition, OrgRole } from "@/lib/roles";
import type { UserNotificationSettings } from "@/lib/notifications";

type TabId = "account" | "notifications" | "roles";

export default function SettingsPage() {
  const me = useMe();
  const [activeTab, setActiveTab] = useState<TabId>("account");

  // Notifications State
  const [notifSettings, setNotifSettings] = useState<UserNotificationSettings | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Roles State
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionDefinition[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Role Edit/Create Modal State
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [isNewRole, setIsNewRole] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [roleColor, setRoleColor] = useState("#38bdf8");
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [roleModalSaving, setRoleModalSaving] = useState(false);
  const [roleModalError, setRoleModalError] = useState("");

  // Load Notification Settings
  useEffect(() => {
    if (activeTab === "notifications" && !notifSettings) {
      setNotifLoading(true);
      fetch("/api/settings/notifications")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.settings) setNotifSettings(data.settings);
        })
        .finally(() => setNotifLoading(false));
    }
  }, [activeTab, notifSettings]);

  // Load Roles & Permissions
  const loadRoles = () => {
    setRolesLoading(true);
    fetch("/api/settings/roles")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRoles(data.roles || []);
          setAllPermissions(data.permissions || []);
          setCanManageRoles(Boolean(data.canManageRoles));
        }
      })
      .finally(() => setRolesLoading(false));
  };

  useEffect(() => {
    if (activeTab === "roles") {
      loadRoles();
    }
  }, [activeTab]);

  // Save Notifications
  const saveNotifications = async () => {
    if (!notifSettings) return;
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifSettings),
      });
      if (res.ok) {
        setNotifSaved(true);
        setTimeout(() => setNotifSaved(false), 3000);
      }
    } finally {
      setNotifSaving(false);
    }
  };

  // Send Test Email
  const sendTestNotification = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/notifications/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, msg: data.message || "Test email sent successfully!" });
      } else {
        setTestResult({ ok: false, msg: data.error || "Failed to send test email." });
      }
    } catch {
      setTestResult({ ok: false, msg: "Network error sending test email." });
    } finally {
      setTestSending(false);
    }
  };

  // Open Role Modal for Creating
  const openCreateRole = () => {
    setIsNewRole(true);
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setRoleColor("#38bdf8");
    // Default to common rep permissions as a starting template
    setRolePerms([
      "nav:overview", "nav:pipeline", "nav:roof_aging", "nav:map",
      "nav:claims", "nav:buildings", "leads:claim", "outcomes:log",
    ]);
    setRoleModalError("");
    setRoleModalOpen(true);
  };

  // Open Role Modal for Editing
  const openEditRole = (role: OrgRole) => {
    setIsNewRole(false);
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description);
    setRoleColor(role.color);
    setRolePerms([...role.permissions]);
    setRoleModalError("");
    setRoleModalOpen(true);
  };

  // Save Role (Create or Update)
  const saveRole = async () => {
    if (!roleName.trim()) {
      setRoleModalError("Role name is required.");
      return;
    }
    setRoleModalSaving(true);
    setRoleModalError("");
    try {
      const url = isNewRole ? "/api/settings/roles" : `/api/settings/roles/${editingRole?.id}`;
      const method = isNewRole ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName.trim(),
          description: roleDesc.trim(),
          color: roleColor,
          permissions: rolePerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoleModalError(data.error || "Failed to save role.");
        return;
      }
      setRoleModalOpen(false);
      loadRoles();
    } catch {
      setRoleModalError("Failed to save role.");
    } finally {
      setRoleModalSaving(false);
    }
  };

  // Delete Role
  const deleteRole = async (role: OrgRole) => {
    if (role.isSystem) return;
    if (!confirm(`Are you sure you want to delete the role "${role.name}"? Any members assigned to this role will be reassigned to standard Rep.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/settings/roles/${role.id}`, { method: "DELETE" });
      if (res.ok) {
        loadRoles();
      } else {
        const data = await res.json();
        alert(data.error || "Could not delete role.");
      }
    } catch {
      alert("Error deleting role.");
    }
  };

  // Toggle single permission checkbox in modal
  const togglePerm = (permId: string) => {
    setRolePerms((curr) =>
      curr.includes(permId) ? curr.filter((p) => p !== permId) : [...curr, permId]
    );
  };

  const roleLabel = (role: string, platformRole: string) => {
    if (platformRole === "superadmin") return "Super admin";
    if (role === "owner") return "Owner";
    if (role === "rep") return "Rep";
    return role || "Member";
  };

  const COLOR_SWATCHES = [
    { label: "Purple", hex: "#a855f7" },
    { label: "Blue", hex: "#3b82f6" },
    { label: "Sky", hex: "#38bdf8" },
    { label: "Emerald", hex: "#10b981" },
    { label: "Amber", hex: "#eab308" },
    { label: "Rose", hex: "#f43f5e" },
    { label: "Indigo", hex: "#6366f1" },
    { label: "Slate", hex: "#64748b" },
  ];

  const navPermissions = allPermissions.filter((p) => p.category === "navigation");
  const leadPermissions = allPermissions.filter((p) => p.category === "leads");
  const adminPermissions = allPermissions.filter((p) => p.category === "management");

  return (
    <div className="space-y-6 pb-14">
      <PageHeader
        eyebrow="Workspace Administration"
        title="Settings"
        description="Manage your account profile, email notification delivery, and custom organization roles."
      />

      {/* Settings Navigation Tabs */}
      <div className="mx-4 max-w-4xl lg:mx-8">
        <div className="flex border-b border-border/80 gap-1 pb-px overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === "account"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <User className="size-4" />
            <span>Profile & Account</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === "notifications"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Bell className="size-4" />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === "roles"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Shield className="size-4" />
            <span>Roles & Permissions</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PROFILE & ACCOUNT */}
      {activeTab === "account" && (
        <div className="mx-4 max-w-2xl space-y-6 lg:mx-8">
          <div className="rounded-xl border border-border bg-card/40 p-5 shadow-xs space-y-4">
            <h3 className="text-base font-semibold">User Profile</h3>
            <p className="text-xs text-muted-foreground">
              Your identity and assigned seat in this Depoii workspace.
            </p>

            <dl className="divide-y divide-border/60 text-sm">
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Full Name</dt>
                <dd className="font-medium text-foreground">{me?.name || "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Email Address</dt>
                <dd className="font-mono text-xs text-foreground">{me?.email || "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Organization</dt>
                <dd className="font-medium text-foreground">{me?.orgName || "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <Badge variant="outline" className="font-mono text-xs">
                    {me ? roleLabel(me.role, me.platformRole) : "—"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-5 shadow-xs flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Theme & Appearance</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle between dark mode and light mode interface.</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      )}

      {/* TAB 2: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="mx-4 max-w-3xl space-y-6 lg:mx-8">
          {notifLoading ? (
            <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              Loading notification settings…
            </div>
          ) : notifSettings ? (
            <>
              {/* Master Email Switch */}
              <div className="rounded-xl border border-border bg-card/40 p-5 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-sky-400" />
                      <p className="text-sm font-semibold">Email Notifications</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enable or pause all automated email alert deliveries for your account ({me?.email}).
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings.emailEnabled}
                      onChange={(e) =>
                        setNotifSettings({ ...notifSettings, emailEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Delivery Frequency */}
              <div className="rounded-xl border border-border bg-card/40 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-emerald-400" />
                  <p className="text-sm font-semibold">Notification Cadence</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select how frequently alert digests and trigger emails should be batched to your inbox.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {[
                    { id: "instant", label: "Real-time (Instant)", desc: "Immediate email as soon as event occurs" },
                    { id: "hourly_digest", label: "Hourly Digest", desc: "Batch alerts into hourly rollups" },
                    { id: "daily_digest", label: "Daily Brief (Recommended)", desc: "Morning summary delivered at 7:00 AM" },
                    { id: "weekly_summary", label: "Weekly Digest", desc: "Consolidated brief delivered every Monday" },
                  ].map((cadence) => (
                    <button
                      key={cadence.id}
                      type="button"
                      onClick={() =>
                        setNotifSettings({
                          ...notifSettings,
                          frequency: cadence.id as UserNotificationSettings["frequency"],
                        })
                      }
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all",
                        notifSettings.frequency === cadence.id
                          ? "border-sky-500/80 bg-sky-500/10 shadow-xs"
                          : "border-border/70 hover:border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{cadence.label}</span>
                        {notifSettings.frequency === cadence.id && (
                          <Check className="size-3.5 text-sky-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{cadence.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Triggers */}
              <div className="rounded-xl border border-border bg-card/40 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-purple-400" />
                  <p className="text-sm font-semibold">Alert Event Triggers</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose which severe weather and pipeline opportunities trigger an alert.
                </p>

                <div className="space-y-4 divide-y divide-border/60">
                  {/* Hail Event Alert */}
                  <div className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold">Severe Hail Storm Reports</p>
                        <p className="text-[11px] text-muted-foreground">
                          Trigger alert when SPC or NWS radar records hail in your tracked area.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifSettings.alertHailReports}
                        onChange={(e) =>
                          setNotifSettings({ ...notifSettings, alertHailReports: e.target.checked })
                        }
                        className="size-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </div>
                    {notifSettings.alertHailReports && (
                      <div className="pl-4 pt-1 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Minimum Hail Diameter:</span>
                        <select
                          value={String(notifSettings.minHailSize)}
                          onChange={(e) =>
                            setNotifSettings({
                              ...notifSettings,
                              minHailSize: Number(e.target.value),
                            })
                          }
                          className="h-8 rounded border border-border bg-background px-2 text-xs font-mono"
                        >
                          <option value="1.0">1.00&quot; (Quarter size)</option>
                          <option value="1.25">1.25&quot; (Half dollar size)</option>
                          <option value="1.5">1.50&quot; (Ping pong ball size)</option>
                          <option value="1.75">1.75&quot; (Golf ball size)</option>
                          <option value="2.0">2.00&quot; (Hen egg size)</option>
                          <option value="2.5">2.50&quot;+ (Tennis ball size)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* New Lead Alert */}
                  <div className="pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold">New High-Scoring Commercial Leads</p>
                        <p className="text-[11px] text-muted-foreground">
                          Alert when newly ingested or rescored commercial buildings cross score threshold.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifSettings.alertNewLeads}
                        onChange={(e) =>
                          setNotifSettings({ ...notifSettings, alertNewLeads: e.target.checked })
                        }
                        className="size-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </div>
                    {notifSettings.alertNewLeads && (
                      <div className="pl-4 pt-1 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Minimum Opportunity Score:</span>
                        <select
                          value={String(notifSettings.minLeadScore)}
                          onChange={(e) =>
                            setNotifSettings({
                              ...notifSettings,
                              minLeadScore: Number(e.target.value),
                            })
                          }
                          className="h-8 rounded border border-border bg-background px-2 text-xs font-mono"
                        >
                          <option value="70">Score 70+ (Moderate)</option>
                          <option value="80">Score 80+ (High - Recommended)</option>
                          <option value="85">Score 85+ (Prime)</option>
                          <option value="90">Score 90+ (Critical urgency)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Roof Aging Alarm */}
                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">Roof Aging Alarm Milestones</p>
                      <p className="text-[11px] text-muted-foreground">
                        Notify when commercial roofs enter the 20+ year aging window without recent permits.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifSettings.alertRoofAging}
                      onChange={(e) =>
                        setNotifSettings({ ...notifSettings, alertRoofAging: e.target.checked })
                      }
                      className="size-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Claim Expiration Warning */}
                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">48h Claim Inactivity Reminders</p>
                      <p className="text-[11px] text-muted-foreground">
                        Receive 48-hour warnings before an exclusive property territory lock auto-releases.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifSettings.alertClaimDeadlines}
                      onChange={(e) =>
                        setNotifSettings({ ...notifSettings, alertClaimDeadlines: e.target.checked })
                      }
                      className="size-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Competitor Contractor Permitting */}
                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">Competitor Permitting Activity</p>
                      <p className="text-[11px] text-muted-foreground">
                        Alert when competitor roofers pull commercial permits in your active territory.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifSettings.alertContractorActivity}
                      onChange={(e) =>
                        setNotifSettings({
                          ...notifSettings,
                          alertContractorActivity: e.target.checked,
                        })
                      }
                      className="size-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="rounded-xl border border-border bg-card/40 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Quiet Hours (Do Not Disturb)</p>
                    <p className="text-xs text-muted-foreground">
                      Hold non-critical notifications during nighttime hours.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.quietHoursEnabled}
                    onChange={(e) =>
                      setNotifSettings({ ...notifSettings, quietHoursEnabled: e.target.checked })
                    }
                    className="size-4 rounded border-border accent-primary cursor-pointer"
                  />
                </div>
                {notifSettings.quietHoursEnabled && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs text-muted-foreground">From:</span>
                    <input
                      type="time"
                      value={notifSettings.quietHoursStart}
                      onChange={(e) =>
                        setNotifSettings({ ...notifSettings, quietHoursStart: e.target.value })
                      }
                      className="h-8 rounded border border-border bg-background px-2 text-xs font-mono"
                    />
                    <span className="text-xs text-muted-foreground">To:</span>
                    <input
                      type="time"
                      value={notifSettings.quietHoursEnd}
                      onChange={(e) =>
                        setNotifSettings({ ...notifSettings, quietHoursEnd: e.target.value })
                      }
                      className="h-8 rounded border border-border bg-background px-2 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={saveNotifications}
                    disabled={notifSaving}
                    className="gap-2"
                  >
                    {notifSaving ? (
                      "Saving preferences…"
                    ) : notifSaved ? (
                      <>
                        <Check className="size-4 text-emerald-400" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      "Save Notification Preferences"
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={sendTestNotification}
                    disabled={testSending}
                    className="gap-2 text-xs"
                  >
                    <Send className="size-3.5" />
                    <span>{testSending ? "Sending test…" : "Send Test Email"}</span>
                  </Button>
                </div>

                {testResult && (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      testResult.ok ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {testResult.msg}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 3: ROLES & PERMISSIONS */}
      {activeTab === "roles" && (
        <div className="mx-4 max-w-4xl space-y-6 lg:mx-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Organization Roles & Sidebar Permissions</h3>
              <p className="text-xs text-muted-foreground">
                Control which navigation links and action privileges are visible to each team member role.
              </p>
            </div>
            {canManageRoles && (
              <Button onClick={openCreateRole} size="sm" className="gap-1.5 shrink-0">
                <Plus className="size-4" />
                <span>Create Custom Role</span>
              </Button>
            )}
          </div>

          {rolesLoading ? (
            <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              Loading organization roles…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((role) => {
                const isWildcard = role.permissions.includes("*");
                const navCount = isWildcard
                  ? navPermissions.length
                  : role.permissions.filter((p) => p.startsWith("nav:")).length;

                return (
                  <div
                    key={role.id}
                    className="rounded-xl border border-border bg-card/40 p-4 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full shrink-0"
                            style={{ backgroundColor: role.color }}
                          />
                          <p className="text-sm font-semibold">{role.name}</p>
                          {role.isSystem ? (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              System
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-sky-500/20 text-sky-300">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {role.memberCount} {role.memberCount === 1 ? "member" : "members"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {role.description || "No description provided."}
                      </p>

                      {/* Permissions Summary Badges */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Sidebar Access:</span>
                          <span className="font-mono text-foreground font-medium">
                            {isWildcard ? "Full Access (All links)" : `${navCount} of ${navPermissions.length} items`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                          {isWildcard ? (
                            <span className="rounded bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 text-[10px] font-mono">
                              * All Pages & Features Unlocked
                            </span>
                          ) : (
                            role.permissions.slice(0, 6).map((p) => {
                              const found = allPermissions.find((item) => item.id === p);
                              return (
                                <span
                                  key={p}
                                  className="rounded bg-muted border border-border/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {found?.label || p}
                                </span>
                              );
                            })
                          )}
                          {!isWildcard && role.permissions.length > 6 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{role.permissions.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {canManageRoles && (
                      <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRole(role)}
                          className="h-7 text-xs px-2.5"
                        >
                          Edit Permissions
                        </Button>
                        {!role.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRole(role)}
                            className="h-7 text-xs px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            title="Delete custom role"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT ROLE MODAL DIALOG */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold">
                  {isNewRole ? "Create Custom Organization Role" : `Edit Role: ${editingRole?.name}`}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define title, badge color, and exact sidebar and feature access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="size-5" />
              </button>
            </div>

            {roleModalError && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-400">
                {roleModalError}
              </div>
            )}

            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              {/* Role Name & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Role Name</label>
                  <input
                    type="text"
                    value={roleName}
                    disabled={editingRole?.isSystem}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="e.g. Storm Chaser, Estimator, Closer"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary outline-hidden"
                  />
                  {editingRole?.isSystem && (
                    <p className="text-[10px] text-muted-foreground">System role names cannot be renamed.</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Badge Color</label>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        onClick={() => setRoleColor(swatch.hex)}
                        title={swatch.label}
                        className={cn(
                          "size-6 rounded-full border-2 transition-transform",
                          roleColor === swatch.hex ? "border-foreground scale-110" : "border-transparent opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Role Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <input
                  type="text"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Responsibilities, territory purview, or field duties"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-primary outline-hidden"
                />
              </div>

              {/* Permissions Header & Bulk Toggles */}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Role Permissions</p>
                    <p className="text-xs text-muted-foreground">
                      Check the sidebar items and actions unlocked for this role.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRolePerms(allPermissions.map((p) => p.id))}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setRolePerms([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Section 1: Sidebar Navigation */}
                <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-sky-400" />
                    <span>Sidebar Navigation Access</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {navPermissions.map((perm) => {
                      const checked = rolePerms.includes(perm.id) || rolePerms.includes("*");
                      return (
                        <label
                          key={perm.id}
                          className={cn(
                            "flex items-start gap-2.5 rounded-md border p-2 text-xs cursor-pointer transition-colors",
                            checked
                              ? "bg-sky-500/10 border-sky-500/40 text-foreground"
                              : "border-border/60 text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(perm.id)}
                            className="mt-0.5 size-3.5 rounded border-border accent-primary cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold block">{perm.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight block">
                              {perm.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Lead & Pipeline Actions */}
                <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flame className="size-3.5 text-amber-400" />
                    <span>Lead & Opportunity Capabilities</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {leadPermissions.map((perm) => {
                      const checked = rolePerms.includes(perm.id) || rolePerms.includes("*");
                      return (
                        <label
                          key={perm.id}
                          className={cn(
                            "flex items-start gap-2.5 rounded-md border p-2 text-xs cursor-pointer transition-colors",
                            checked
                              ? "bg-amber-500/10 border-amber-500/40 text-foreground"
                              : "border-border/60 text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(perm.id)}
                            className="mt-0.5 size-3.5 rounded border-border accent-primary cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold block">{perm.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight block">
                              {perm.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: Management */}
                <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Key className="size-3.5 text-purple-400" />
                    <span>Organization Administration</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {adminPermissions.map((perm) => {
                      const checked = rolePerms.includes(perm.id) || rolePerms.includes("*");
                      return (
                        <label
                          key={perm.id}
                          className={cn(
                            "flex items-start gap-2.5 rounded-md border p-2 text-xs cursor-pointer transition-colors",
                            checked
                              ? "bg-purple-500/10 border-purple-500/40 text-foreground"
                              : "border-border/60 text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(perm.id)}
                            className="mt-0.5 size-3.5 rounded border-border accent-primary cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold block">{perm.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight block">
                              {perm.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRoleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveRole}
                disabled={roleModalSaving}
              >
                {roleModalSaving ? "Saving role…" : isNewRole ? "Create Role" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
