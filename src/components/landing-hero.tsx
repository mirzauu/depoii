"use client";

import { useEffect, useRef, useState } from "react";
import { DepoiiMark } from "@/components/depoii-logo";
import {
  applyLandingDesktopLayout,
  clearLandingDesktopLayout,
  computeLandingDesktopLayout,
} from "@/components/landing-desktop-layout";
import { LandingMock } from "@/components/landing-mock";
import { TOUR_STOPS, type TourScene } from "@/components/landing-tour";

const NAV = [
  { label: "Product", href: "#tour-1" },
  { label: "How it works", href: "#how" },
  { label: "Pilot", href: "#pilot" },
];

const DEFAULT_SCENE: TourScene = {
  path: "/",
  city: "Dallas",
  openRecord: false,
  highlight: "leads",
  dock: -1,
};

function pickActiveTourIndex(): number {
  const vh = window.innerHeight;
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < TOUR_STOPS.length; i++) {
    const el =
      document.getElementById(`${TOUR_STOPS[i].id}-copy`) ??
      document.getElementById(TOUR_STOPS[i].id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const score = -Math.abs(center - vh / 2);
    const visible = rect.bottom > vh * 0.15 && rect.top < vh * 0.85;
    if (visible && score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function LandingHero() {
  const trackRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [dock, setDock] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [scene, setScene] = useState<TourScene>(DEFAULT_SCENE);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;

    const syncLayout = () => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        clearLandingDesktopLayout();
        return;
      }
      applyLandingDesktopLayout(computeLandingDesktopLayout(window.innerWidth));
    };

    const update = () => {
      frame = 0;
      if (window.matchMedia("(max-width: 1023px)").matches) {
        clearLandingDesktopLayout();
        setProgress(0);
        setDock(0);
        setDismissed(false);
        setScene(DEFAULT_SCENE);
        return;
      }

      syncLayout();

      const vh = window.innerHeight;
      const rect = track.getBoundingClientRect();
      const travel = Math.max(1, track.offsetHeight - vh);
      const heroProgress = Math.min(1, Math.max(0, -rect.top / travel));
      setProgress(heroProgress);

      const last =
        document.getElementById(`${TOUR_STOPS[TOUR_STOPS.length - 1].id}-copy`) ??
        document.getElementById(TOUR_STOPS[TOUR_STOPS.length - 1].id);
      const lastBottom = last?.getBoundingClientRect().bottom ?? Infinity;
      const tourDone = lastBottom < vh * 0.4;
      setDismissed(tourDone);

      const active = pickActiveTourIndex();
      const heroStillOnScreen = rect.bottom > vh * 0.2;
      if (heroStillOnScreen) {
        setDock(0);
        setScene(DEFAULT_SCENE);
      } else if (!tourDone && active >= 0) {
        const next = TOUR_STOPS[active].scene;
        setScene(next);
        setDock((prev) => (prev === next.dock ? prev : next.dock));
      } else if (!tourDone) {
        setDock(0);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      clearLandingDesktopLayout();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const pinned = progress >= 0.9;
  const anim = pinned ? 1 : progress;
  const dashboardY = pinned ? 0 : 68 - anim * 68;
  const dashboardOpacity = dismissed ? 0 : 1;
  const dashboardScale = pinned ? 1 : 0.9 + anim * 0.1;
  const copyFade = 1 - progress * 0.65;
  const copyLift = progress * -56;

  // dock -1 → left column, +1 → right column, 0 → centered (hero)
  const mockLeft =
    dock === 0
      ? "calc(50% - var(--landing-mock-w, 52rem) / 2)"
      : dock === -1
        ? "var(--landing-pad, 2rem)"
        : "calc(var(--landing-pad, 2rem) + var(--landing-caption-w, 22rem) + var(--landing-gap, 1.5rem))";

  return (
    <>
      <section
        ref={trackRef}
        className="landing-hero relative h-[200vh] max-lg:h-auto max-lg:min-h-dvh"
      >
        <div className="sticky top-0 h-dvh overflow-hidden max-lg:relative max-lg:h-auto max-lg:min-h-dvh max-lg:overflow-visible">
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: "url(/landing/hero-roof.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center 45%",
            }}
          />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.88)_0%,rgba(248,250,252,0.45)_32%,rgba(15,23,42,0.15)_58%,rgba(15,23,42,0.55)_100%)]" />

          <header className="relative z-50 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
            <a href="#top" className="flex items-center gap-2 text-neutral-950">
              <DepoiiMark className="size-7" />
              <span className="text-[1.35rem] font-bold tracking-tight">Depoii</span>
            </a>
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
              {NAV.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-[13px] font-medium text-neutral-800/90 transition-colors hover:text-neutral-950"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <a
              href="#pilot"
              className="inline-flex h-9 items-center rounded-full bg-[#c8f000] px-4 text-[13px] font-semibold text-neutral-900 transition hover:bg-[#d4ff2e]"
            >
              Get started
            </a>
          </header>

          <div
            className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-5 pt-10 pb-16 text-center sm:px-8 sm:pt-14 max-lg:pb-20"
            style={{ opacity: copyFade, transform: `translateY(${copyLift}px)` }}
          >
            <p className="text-sm font-medium tracking-wide text-neutral-700">
              For Dallas–Fort Worth commercial roofers
            </p>
            <h1 className="mt-3 max-w-[16ch] text-[2.15rem] leading-[1.08] font-bold tracking-tight text-neutral-950 sm:text-[3.1rem] md:text-[3.4rem]">
              Know which commercial roofs are worth the drive
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-700 sm:text-base">
              Hail reports, county appraisal records, and city permit searches for DFW — each fact with
              its source — so your crew checks the short list before you roll a truck.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#pilot"
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#c8f000] px-5 text-sm font-semibold text-neutral-900 transition hover:bg-[#d4ff2e]"
              >
                Join the free pilot
                <span aria-hidden>→</span>
              </a>
            </div>
            <p className="mt-8 text-xs font-medium tracking-wide text-neutral-600 uppercase lg:hidden">
              Scroll for the product tour
            </p>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden h-[28%] bg-[linear-gradient(180deg,transparent_0%,rgba(248,250,252,0.35)_45%,rgba(15,23,42,0.25)_100%)] lg:block" />
        </div>
      </section>

      {/* Desktop-only floating product mock — width/left tied to --landing-* vars */}
      <div
        id="dashboard"
        className="pointer-events-none fixed top-[14%] bottom-[5%] z-40 hidden lg:block"
        style={{
          left: mockLeft,
          width: "var(--landing-mock-w, min(52rem, 58vw))",
          transition: pinned
            ? "left 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease"
            : "left 0.35s ease, opacity 0.25s ease",
          opacity: dashboardOpacity,
          pointerEvents: "none",
        }}
        aria-hidden={dismissed}
      >
        <div
          className="pointer-events-auto h-full w-full will-change-transform"
          style={{
            transform: `translate3d(0, ${dashboardY}%, 0) scale(${dashboardScale})`,
            transformOrigin: "center top",
            transition: pinned
              ? "transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)"
              : "transform 0.2s ease",
            pointerEvents: dismissed ? "none" : pinned || progress > 0.15 ? "auto" : "none",
            filter: pinned || progress > 0.2 ? "none" : "drop-shadow(0 -12px 40px rgba(0,0,0,0.28))",
          }}
        >
          <LandingMock scene={scene} />
        </div>
      </div>
    </>
  );
}
