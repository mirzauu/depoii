"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Briefcase, ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight, House, Info, Layers, Search, Shield, Users, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { DepoiiAiMark, DepoiiMark } from "./depoii-logo";
import { useMe } from "@/hooks/use-me";

type NavIcon = LucideIcon | React.ComponentType<{ className?: string; title?: string }>;
type NavLink = { href: string; label: string; match?: string[]; engine?: boolean; badge?: string; disabled?: boolean; permission?: string };
type NavGroup = { id: string; label: string; icon: NavIcon; items: NavLink[]; match?: string[] };

export const TOP: (NavLink & { icon: NavIcon })[] = [
  { href: "/", label: "Overview", icon: House, permission: "nav:overview" },
  { href: "", label: "AI Assistant", icon: DepoiiAiMark, badge: "Soon", disabled: true },
];

export const GROUPS: NavGroup[] = [
  {
    id: "leads",
    label: "Leads",
    icon: Briefcase,
    items: [
      { href: "/pipeline", label: "Opportunity Pipeline", match: ["/parcels", "/property"], permission: "nav:pipeline" },
      { href: "/roof-aging", label: "Roof Aging Alarm", engine: true, permission: "nav:roof_aging" },
      { href: "/map", label: "Hail Map", engine: true, permission: "nav:map" },
      { href: "/territory", label: "Territory Explorer", match: ["/territory"], permission: "nav:territory" },
      { href: "/claims", label: "My Claims", match: ["/claims"], permission: "nav:claims" },
    ],
  },
  {
    id: "prospect",
    label: "Prospect and enrich",
    icon: Search,
    items: [
      { href: "/permits", label: "Permit", engine: true, permission: "nav:permits" },
      { href: "/buildings", label: "Building", engine: true, permission: "nav:buildings" },
      { href: "/contractors", label: "Contractors", match: ["/contractors"], engine: true, permission: "nav:contractors" },
      { href: "/competitors", label: "Leaderboard", engine: true, permission: "nav:competitors" },
    ],
  },
  {
    id: "organization",
    label: "Organization",
    icon: Users,
    items: [
      { href: "/outcomes", label: "Field Outcomes", permission: "nav:outcomes" },
      { href: "/team", label: "Team", permission: "nav:team" },
      { href: "", label: "CRM", badge: "Soon", disabled: true, permission: "nav:crm" },
    ],
  },
];

export const FLAT_NAV: NavLink[] = [...TOP, ...GROUPS.flatMap((g) => g.items)];

export const ENGINE_PATHS = [...TOP.filter((i) => i.engine).map((i) => i.href), ...GROUPS.flatMap((g) => g.items).filter((i) => i.engine).map((i) => i.href), "/territory", "/claims", "/pipeline", "/team", "/outcomes", "/crm", "/buildings", "/settings", "/login", "/admin", "/parcels", "/contractors", "/jobsites", "/multiphase", "/capital", "/dark-market", "/storm-targets", "/competitors", "/map"];

export const SidebarPreview = createContext<{ path: string; go: (href: string) => void } | null>(null);

function NavTo({ href, className, title, onClick, children }: { href: string; className?: string; title?: string; onClick?: () => void; children: ReactNode }) {
  const preview = useContext(SidebarPreview);
  if (!preview) {
    return (
      <Link href={href} title={title} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      title={title}
      className={className}
      onClick={() => {
        onClick?.();
        preview.go(href);
      }}
    >
      {children}
    </button>
  );
}

export function isActive(path: string, link: NavLink, fromParam?: string | null) {
  if (link.href === "/") return path === "/";
  if (link.href === "/pipeline" && fromParam === "roof-aging") return false;
  if (link.href === "/roof-aging" && fromParam === "roof-aging" && (path.startsWith("/parcels") || path.startsWith("/property"))) return true;
  return [link.href, ...(link.match ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
}

function groupActive(path: string, group: NavGroup, fromParam?: string | null) {
  return group.items.some((i) => isActive(path, i, fromParam)) || (group.match ?? []).some((p) => path.startsWith(p));
}

const GROUPS_KEY = "depoii:nav-groups-v4";
const RAIL_KEY = "depoii:sidebar";
const DEFAULT_OPEN = Object.fromEntries(GROUPS.map((group) => [group.id, group.id !== "organization"]));

export function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const preview = useContext(SidebarPreview);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (!res.ok) return;
    router.replace("/login");
    router.refresh();
  };

  return (
    <div ref={box} className={cn("relative", collapsed && "flex justify-center")}>
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        title="Account"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed ? "size-9" : "w-full gap-2.5 px-3 py-2 text-sm",
        )}
      >
        <Info className="size-4 shrink-0" />
        {!collapsed && <span className="flex-1 text-left">Account</span>}
      </button>
      {open && !preview && (
        <div className="absolute bottom-full left-2 z-50 mb-1 w-40 rounded-md border border-border bg-popover p-1 text-sm shadow-md">
          <Link href="/settings" onClick={() => setOpen(false)} className="block rounded-md px-2 py-1.5 hover:bg-muted">
            Settings
          </Link>
          <button type="button" onClick={logout} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
            Log out
          </button>
        </div>
      )}
      {open && preview && (
        <div className="absolute bottom-full left-2 z-50 mb-1 w-44 rounded-md border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md">
          Sample workspace. Sign in for your team.
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const livePath = usePathname();
  const preview = useContext(SidebarPreview);
  const path = preview?.path ?? livePath;
  const me = useMe();
  const adminLink = { href: "/admin", label: "Super Admin", match: ["/admin"] };
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [logoOn, setLogoOn] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const logoTimer = useRef(0);

  const [fromParam, setFromParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      setFromParam(sp.get("from"));
    }
  }, [path]);

  useEffect(() => {
    setNavReady(true);
    setCollapsed(localStorage.getItem(RAIL_KEY) === "collapsed");
    try {
      const saved = JSON.parse(localStorage.getItem(GROUPS_KEY) || "null");
      if (saved && typeof saved === "object") setOpen((prev) => ({ ...prev, ...saved }));
    } catch {}
  }, []);

  useEffect(() => {
    const current = GROUPS.find((g) => groupActive(path, g, fromParam));
    if (current) setOpen((o) => (o[current.id] ? o : { ...o, [current.id]: true }));
  }, [path, fromParam]);

  useEffect(() => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(open));
  }, [open]);

  const setRail = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(RAIL_KEY, value ? "collapsed" : "open");
  };

  const onGroup = (id: string) => {
    if (collapsed) {
      setRail(false);
      setOpen((o) => ({ ...o, [id]: true }));
    } else {
      setOpen((o) => ({ ...o, [id]: !o[id] }));
    }
  };

  const canAccess = (perm?: string) => {
    if (!perm) return true;
    if (me?.platformRole === "superadmin" || me?.role === "owner") return true;
    if (!me?.permissions || me.permissions.length === 0) return true;
    if (me.permissions.includes("*")) return true;
    return me.permissions.includes(perm);
  };

  const orgLabel = navReady && me?.orgName?.trim() ? me.orgName.trim() : "Organization";

  const visibleTop = TOP.filter((link) => canAccess(link.permission));
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    label: group.id === "organization" ? orgLabel : group.label,
    items: group.items.filter((item) => canAccess(item.permission)),
  })).filter((group) => group.items.length > 0);

  const mainGroups = visibleGroups.filter((g) => g.id !== "organization");
  const orgGroup = visibleGroups.find((g) => g.id === "organization");

  const fade = cn("overflow-hidden whitespace-nowrap transition-opacity duration-150", collapsed ? "opacity-0" : "opacity-100");
  const row = "flex w-full items-center gap-2.5 overflow-hidden rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground";

  const renderGroup = (group: NavGroup, up = false) => {
    const Icon = group.icon;
    const expanded = !collapsed && !!open[group.id];
    const here = groupActive(path, group, fromParam);
    const Chevron = up ? ChevronUp : ChevronDown;

    const itemsNode = (
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden" inert={!expanded}>
          <div className={cn("flex flex-col gap-0.5", up ? "pt-0.5 pb-1" : "py-0.5")}>
            {group.items.map((item) =>
              item.disabled ? (
                <div
                  key={item.label}
                  title={`${item.label} (Coming Soon)`}
                  aria-disabled="true"
                  className="w-full rounded-md py-1.5 pr-3 pl-9 text-left text-sm whitespace-nowrap text-muted-foreground/60 cursor-not-allowed select-none flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full border border-current/30 bg-current/10 px-1.5 py-0.5 text-[10px] font-medium text-current">
                      {item.badge}
                    </span>
                  )}
                </div>
              ) : (
                <NavTo
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "w-full rounded-md py-1.5 pr-3 pl-9 text-left text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-between",
                    isActive(path, item, fromParam) && "bg-muted font-medium text-foreground",
                  )}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full border border-current/30 bg-current/10 px-1.5 py-0.5 text-[10px] font-medium text-current">
                      {item.badge}
                    </span>
                  )}
                </NavTo>
              ),
            )}
          </div>
        </div>
      </div>
    );

    const buttonNode = (
      <button
        type="button"
        onClick={() => onGroup(group.id)}
        title={group.label}
        aria-expanded={expanded}
        className={cn(row, collapsed && here && "bg-muted text-foreground", !collapsed && here && "text-foreground")}
      >
        <Icon className="size-4 shrink-0" />
        <span className={cn(fade, "flex-1 text-left truncate")}>{group.label}</span>
        <Chevron
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            expanded ? "rotate-180" : "rotate-0",
            collapsed && "opacity-0",
          )}
        />
      </button>
    );

    return (
      <div key={group.id} className="flex flex-col">
        {up && itemsNode}
        {buttonNode}
        {!up && itemsNode}
      </div>
    );
  };

  return (
    <aside className={cn("sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border bg-card/40 transition-[width] duration-200 ease-out lg:flex print:hidden", preview && "flex! h-full", collapsed ? "w-16" : "w-60")}>
      <div className="flex items-center gap-2 px-4 py-4">
        <NavTo
          href="/"
          title="Depoii"
          className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
          onClick={() => {
            setLogoOn(true);
            window.clearTimeout(logoTimer.current);
            logoTimer.current = window.setTimeout(() => setLogoOn(false), 1000);
          }}
        >
          <DepoiiMark animated={logoOn} className="size-7 text-foreground" />
          <span className={cn(fade, "text-lg font-bold tracking-tight")}>Depoii</span>
        </NavTo>
        {!collapsed && (
          <button type="button" onClick={() => setRail(true)} title="Collapse sidebar" className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button type="button" onClick={() => setRail(false)} title="Expand sidebar" className="mx-auto mb-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronsRight className="size-4" />
        </button>
      )}

      <nav data-tour="sidebar-nav" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2 pb-2">
        {visibleTop.map((link) => {
          const Icon = link.icon;
          if (link.disabled) {
            return (
              <div
                key={link.label}
                title={`${link.label} (Coming Soon)`}
                aria-disabled="true"
                className={cn(row, "cursor-not-allowed select-none text-muted-foreground/60 hover:bg-transparent hover:text-muted-foreground/60 justify-between")}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="size-4 shrink-0" />
                  <span className={fade}>{link.label}</span>
                </div>
                {link.badge && (
                  <span className={cn(fade, "rounded-full border border-current/30 bg-current/10 px-1.5 py-0.5 text-[10px] font-medium text-current")}>
                    {link.badge}
                  </span>
                )}
              </div>
            );
          }
          return (
            <NavTo key={link.href} href={link.href} title={link.label} className={cn(row, isActive(path, link, fromParam) && "bg-muted font-medium text-foreground")}>
              <Icon className="size-4 shrink-0" />
              <span className={fade}>{link.label}</span>
            </NavTo>
          );
        })}

        {mainGroups.length > 0 && <div className="my-2 border-t border-border" />}

        {mainGroups.map((g) => renderGroup(g))}

        {navReady && me?.platformRole === "superadmin" && (
          <div className="mt-auto border-t border-border pt-2">
            <NavTo href={adminLink.href} title={adminLink.label} className={cn(row, isActive(path, adminLink, fromParam) && "bg-muted font-medium text-foreground")}>
              <Shield className="size-4 shrink-0" />
              <span className={fade}>{adminLink.label}</span>
            </NavTo>
          </div>
        )}
      </nav>
      <div className="border-t border-border p-2 flex flex-col gap-0.5">
        {orgGroup && renderGroup(orgGroup, true)}
        <AccountMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
