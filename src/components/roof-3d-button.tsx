"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoofInspector3D } from "@/components/roof-inspector-3d";

interface Roof3DButtonProps {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  variant?: "button" | "pill";
  className?: string;
}

export function Roof3DButton({ lat, lng, address, variant = "pill", className }: Roof3DButtonProps) {
  const [open, setOpen] = useState(false);

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Inspect latest high-resolution aerial imagery"
        className={cn(
          "inline-flex items-center gap-1 font-mono transition cursor-pointer select-none",
          variant === "pill"
            ? "rounded border border-border/60 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#171714] dark:hover:bg-[#20201c] px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            : "rounded-md border border-border/60 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#171714] dark:hover:bg-[#20201c] px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground shadow-xs",
          className
        )}
      >
        <RotateCcw className="size-3 shrink-0" />
        <span>Latest</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-2xl">
            <RoofInspector3D
              lat={lat}
              lng={lng}
              address={address}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
