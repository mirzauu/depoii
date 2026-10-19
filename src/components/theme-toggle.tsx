"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  // null until mount so SSR and first client paint match (theme script may flip <html> class).
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function toggle() {
    if (dark == null) return;
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("depoii:theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark == null ? "Theme" : dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark == null ? "Theme" : dark ? "Light mode" : "Dark mode"}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
      suppressHydrationWarning
    >
      {dark == null ? <span className="size-4" aria-hidden /> : dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
