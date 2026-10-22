"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LandingMock } from "@/components/landing-mock";
import type { TourScene } from "@/components/landing-tour";
import { cn } from "cn";

export function PhoneShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto flex h-full w-full max-w-[22.5rem] flex-col rounded-[1.85rem] border-[3px] border-neutral-950 bg-neutral-950 p-[7px] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute top-[14px] left-1/2 z-30 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black"
        aria-hidden
      />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.35rem] bg-background">
        {children}
      </div>
      <div
        className="mx-auto mt-1.5 mb-0.5 h-[4px] w-[108px] shrink-0 rounded-full bg-neutral-600/85"
        aria-hidden
      />
    </div>
  );
}

/** In-flow phone mock — only mounts the interactive app when near the viewport. */
export function MobileTourPhone({
  scene,
  className,
}: {
  scene: TourScene;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setLive(true);
      },
      { rootMargin: "30% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "landing-mock-panel flex h-[min(92dvh,720px)] w-full items-center justify-center px-4 py-6",
        className,
      )}
    >
      <PhoneShell className="h-full max-h-[min(86dvh,680px)]">
        {live ? (
          <LandingMock scene={scene} />
        ) : (
          <div className="flex h-full items-center justify-center bg-neutral-950 px-6 text-center text-sm text-neutral-400">
            Scroll to open the product
          </div>
        )}
      </PhoneShell>
    </div>
  );
}
