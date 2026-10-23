"use client";

import React from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "cn";
import { useWalkthrough } from "./walkthrough-provider";

interface PageTourButtonProps {
  label?: string;
  variant?: "header" | "pill" | "outline" | "ghost" | "compact";
  tourKey?: string;
  className?: string;
}

export function PageTourButton({
  label,
  variant = "pill",
  tourKey,
  className,
}: PageTourButtonProps) {
  const { startTour, hasTour, currentTour, isTourActive, hasCompletedCurrentTour } = useWalkthrough();

  if (!hasTour && !tourKey) {
    return null;
  }

  const buttonText = label || (currentTour ? `Tour: ${currentTour.title}` : "Take Page Tour");

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={() => startTour(tourKey)}
        disabled={isTourActive}
        title={currentTour ? `Take interactive walkthrough of ${currentTour.title}` : "Take page tour"}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-muted hover:border-foreground/20 active:scale-95 disabled:opacity-50",
          className
        )}
      >
        <Lightbulb className="size-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
        <span className="hidden sm:inline font-semibold">Page Tour</span>
        {!hasCompletedCurrentTour && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
        )}
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => startTour(tourKey)}
        disabled={isTourActive}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-400/20 hover:border-amber-400/60 active:scale-95 shadow-sm disabled:opacity-50",
          className
        )}
      >
        <Lightbulb className="size-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
        <span>{buttonText}</span>
        {!hasCompletedCurrentTour && (
          <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-bold text-neutral-950 uppercase tracking-wider">
            New
          </span>
        )}
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => startTour(tourKey)}
        disabled={isTourActive}
        title={buttonText}
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
          className
        )}
      >
        <Lightbulb className="size-4 text-amber-400 fill-amber-400/25" />
        {!hasCompletedCurrentTour && (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => startTour(tourKey)}
      disabled={isTourActive}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm disabled:opacity-50",
        className
      )}
    >
      <Lightbulb className="size-3.5 text-amber-400 fill-amber-400/25" />
      <span>{buttonText}</span>
    </button>
  );
}

export function HeaderTourButton() {
  return <PageTourButton variant="header" />;
}
