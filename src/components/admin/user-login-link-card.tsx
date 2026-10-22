"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Power,
  RefreshCw,
  Trash2,
  Sparkles,
  Clock,
  MousePointerClick,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminFetch, field, when } from "@/components/admin/admin-ui";

export type LoginLinkStatus = {
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  maxUses: number | null;
  useCount: number;
  lastUsedAt: string | null;
  expired: boolean;
  exhausted: boolean;
  active: boolean;
  reason: "active" | "deactivated" | "expired" | "exhausted";
};

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    orgName?: string;
    disabled?: boolean;
  };
  initialLink?: LoginLinkStatus | null;
  onChanged?: () => void;
  compact?: boolean;
};

export function UserLoginLinkCard({ user, initialLink, onChanged, compact = false }: Props) {
  const [link, setLink] = useState<LoginLinkStatus | null>(initialLink ?? null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Generation controls
  const [expiresPreset, setExpiresPreset] = useState("14");
  const [customDays, setCustomDays] = useState(14);
  const [clicksPreset, setClicksPreset] = useState("unlimited");
  const [customClicks, setCustomClicks] = useState(1);

  // Sync initialLink if parent updates it
  useEffect(() => {
    if (initialLink !== undefined) {
      setLink(initialLink);
    }
  }, [initialLink]);

  const refreshStatus = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await adminFetch<{ link: LoginLinkStatus | null }>(
        `/api/admin/users/${user.id}/link?_t=${Date.now()}`,
      );
      setLink(res.link);
      onChanged?.();
    } catch {
      // silent background refresh
    } finally {
      setRefreshing(false);
    }
  }, [user.id, onChanged]);

  // Real-time polling every 2.5 seconds + focus listener so click counts reflect live immediately!
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refreshStatus();
      }
    }, 2500);

    const onFocus = () => refreshStatus();
    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshStatus]);

  const createLink = async () => {
    setError("");
    setSuccess("");
    setCopied(false);
    setPending(true);
    try {
      const days = expiresPreset === "custom" ? Math.max(1, customDays) : Number(expiresPreset);
      const maxUses =
        clicksPreset === "unlimited"
          ? null
          : clicksPreset === "custom"
            ? Math.max(1, customClicks)
            : Number(clicksPreset);

      const created = await adminFetch<{ token: string; link: LoginLinkStatus }>(`/api/admin/users/${user.id}/link`, {
        method: "POST",
        body: JSON.stringify({
          expiresInDays: days,
          maxUses,
        }),
      });

      const fullUrl = `${window.location.origin}/api/auth/enter?token=${created.token}`;
      setUrl(fullUrl);
      setLink(created.link);
      setSuccess("New credential-free login link generated!");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sign-in link.");
    } finally {
      setPending(false);
    }
  };

  const toggleActive = async (targetActive: boolean) => {
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const res = await adminFetch<{ ok: boolean; link: LoginLinkStatus }>(`/api/admin/users/${user.id}/link`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: targetActive }),
      });
      setLink(res.link);
      setSuccess(targetActive ? "Sign-in link reactivated!" : "Sign-in link deactivated.");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update link status.");
    } finally {
      setPending(false);
    }
  };

  const revokeLink = async () => {
    if (!confirm(`Are you sure you want to permanently delete the sign-in link for ${user.name}?`)) return;
    setError("");
    setSuccess("");
    setPending(true);
    try {
      await adminFetch(`/api/admin/users/${user.id}/link`, { method: "DELETE" });
      setLink(null);
      setUrl("");
      setSuccess("Sign-in link deleted.");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn off the sign-in link.");
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={compact ? "border border-border/60 bg-muted/20" : "mx-4 lg:mx-8"}>
      <CardHeader className={compact ? "p-4 pb-2" : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">One-Click Sign-In Link</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {link && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refreshStatus}
                  disabled={refreshing}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Check latest click count"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin text-primary" : ""}`} />
                  Sync
                </Button>
                {link.reason === "active" && (
                  <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
                    ● Active & Ready
                  </Badge>
                )}
                {link.reason === "deactivated" && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/15 text-amber-400">
                    Deactivated by Admin
                  </Badge>
                )}
                {link.reason === "expired" && (
                  <Badge variant="destructive" className="border-rose-500/40 bg-rose-500/15 text-rose-300">
                    Expired
                  </Badge>
                )}
                {link.reason === "exhausted" && (
                  <Badge variant="secondary" className="border-purple-500/40 bg-purple-500/15 text-purple-300">
                    Click Limit Reached
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        <CardDescription>
          Generate a direct access link for <strong>{user.name}</strong> ({user.email}
          {user.orgName ? ` · ${user.orgName}` : ""}). When clicked, the user is instantly signed in without entering
          any credentials.
        </CardDescription>
      </CardHeader>

      <CardContent className={compact ? "space-y-4 p-4 pt-2" : "space-y-4"}>
        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Link Status summary if existing link exists */}
        {link && (
          <div className="grid gap-3 rounded-lg border border-border/60 bg-background/50 p-3 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MousePointerClick className="h-3.5 w-3.5 text-primary" /> Clicks Used
                </span>
                {link.useCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {link.useCount} clicked
                  </span>
                )}
              </div>
              <p className="text-base font-bold tracking-tight">
                <span className={link.useCount > 0 ? "text-emerald-400 font-extrabold text-lg" : ""}>
                  {link.useCount}
                </span>
                <span className="text-muted-foreground"> / {link.maxUses !== null ? link.maxUses : "∞"}</span>
                {link.maxUses === 1 && <span className="ml-1 text-xs font-normal text-muted-foreground">(single-use)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {link.lastUsedAt ? `Last clicked: ${when(link.lastUsedAt)}` : "No clicks yet"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Expiration
              </span>
              <p className="text-sm font-semibold">{when(link.expiresAt)}</p>
              <p className="text-xs text-muted-foreground">
                {link.expired ? "Expired" : "Live & valid"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Power className="h-3.5 w-3.5" /> Admin Status
              </span>
              <p className="text-sm font-semibold">
                {link.isActive ? (
                  <span className="text-emerald-400 font-medium">Enabled</span>
                ) : (
                  <span className="text-amber-400 font-medium">Deactivated</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Created: {when(link.createdAt)}</p>
            </div>
          </div>
        )}

        {/* Generated URL Box */}
        {url && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">Login Link (Active & Ready to Share)</span>
              <span className="text-xs text-muted-foreground">No password required</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={url}
                aria-label="Sign-in link"
                className="h-9 min-w-0 flex-1 font-mono text-xs"
              />
              <Button type="button" size="sm" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(url, "_blank")}
                title="Test in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {link && !url && (
          <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <span>A link is registered for this user. Generate a new link below to obtain a fresh shareable URL.</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
              disabled={refreshing}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin text-primary" : ""}`} />
              Refresh
            </Button>
          </div>
        )}

        {/* Generator Controls */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Configure New Link Settings
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Expiration Configuration */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Expires after (Days)</label>
              <select
                aria-label="Expires after"
                value={expiresPreset}
                onChange={(e) => setExpiresPreset(e.target.value)}
                className={`${field} mt-1 w-full text-xs`}
              >
                <option value="1">1 Day (24 hours)</option>
                <option value="3">3 Days</option>
                <option value="7">7 Days (1 week)</option>
                <option value="14">14 Days (2 weeks - default)</option>
                <option value="30">30 Days (1 month)</option>
                <option value="90">90 Days (3 months)</option>
                <option value="custom">Custom days...</option>
              </select>
              {expiresPreset === "custom" && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value) || 1)}
                    className="h-8 text-xs"
                    placeholder="Days until expiration"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              )}
            </div>

            {/* Click Limit Configuration */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Max Allowed Clicks (Auto-deactivate)</label>
              <select
                aria-label="Max allowed clicks"
                value={clicksPreset}
                onChange={(e) => setClicksPreset(e.target.value)}
                className={`${field} mt-1 w-full text-xs`}
              >
                <option value="1">1 Click (Single-use one-time link)</option>
                <option value="3">3 Clicks</option>
                <option value="5">5 Clicks</option>
                <option value="10">10 Clicks</option>
                <option value="unlimited">Unlimited clicks</option>
                <option value="custom">Custom click count...</option>
              </select>
              {clicksPreset === "custom" && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={customClicks}
                    onChange={(e) => setCustomClicks(Number(e.target.value) || 1)}
                    className="h-8 text-xs"
                    placeholder="Max clicks"
                  />
                  <span className="text-xs text-muted-foreground">clicks</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={pending || user.disabled}
              onClick={createLink}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {link ? "Generate New Link" : "Generate Sign-In Link"}
            </Button>

            {link && (
              <>
                {link.isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => toggleActive(false)}
                    className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Deactivate Link
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => toggleActive(true)}
                    className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Reactivate Link
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={revokeLink}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
