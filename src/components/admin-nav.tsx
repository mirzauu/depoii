"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/activity", label: "Activity" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pt-4 lg:px-8">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? path === "/admin" : path === link.href || path.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn("shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground", active && "border-foreground/30 bg-muted font-medium text-foreground")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
