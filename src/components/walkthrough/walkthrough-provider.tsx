"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { driver, type Driver } from "driver.js";
import { getTourForPath, PAGE_TOURS, type PageTourDefinition } from "./walkthrough-steps";
import "./walkthrough.css";

interface WalkthroughContextType {
  startTour: (customKey?: string) => void;
  hasTour: boolean;
  currentTour: PageTourDefinition | null;
  isTourActive: boolean;
  hasCompletedCurrentTour: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType>({
  startTour: () => {},
  hasTour: false,
  currentTour: null,
  isTourActive: false,
  hasCompletedCurrentTour: false,
});

export function useWalkthrough() {
  return useContext(WalkthroughContext);
}

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const [completedTours, setCompletedTours] = useState<Record<string, boolean>>({});

  const currentTour = useMemo(() => getTourForPath(pathname || "/"), [pathname]);

  // Load completion state from localStorage on mount & when pathname changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("depoii_completed_tours");
      if (stored) {
        setCompletedTours(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, [pathname]);

  const markTourCompleted = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = { ...prev, [tourId]: true };
      try {
        localStorage.setItem("depoii_completed_tours", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const startTour = useCallback(
    (customKey?: string) => {
      if (typeof window === "undefined") return;

      const tourDef = customKey
        ? PAGE_TOURS[customKey] || Object.values(PAGE_TOURS).find((t) => t.id === customKey)
        : currentTour;

      if (!tourDef || !tourDef.steps.length) {
        console.warn("[Depoii Walkthrough] No tour steps defined for", customKey || pathname);
        return;
      }

      // Filter steps to those whose targets exist in the DOM, or allow driver to skip missing
      const validSteps = tourDef.steps.filter((s) => {
        if (typeof s.element === "string") {
          return Boolean(document.querySelector(s.element));
        }
        return true;
      });

      const stepsToRun = validSteps.length > 0 ? validSteps : tourDef.steps;

      const d = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(0, 0, 0, 0.7)",
        overlayOpacity: 0.7,
        stagePadding: 8,
        stageRadius: 10,
        popoverClass: "depoii-tour-popover",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Got it ✓",
        allowClose: true,
        skipMissingElement: true,
        smoothScroll: true,
        steps: stepsToRun,
        onDestroyed: () => {
          setIsTourActive(false);
          markTourCompleted(tourDef.id);
        },
      });

      setDriverInstance(d);
      setIsTourActive(true);
      d.drive();
    },
    [currentTour, markTourCompleted, pathname]
  );

  const hasTour = Boolean(currentTour && currentTour.steps.length > 0);
  const hasCompletedCurrentTour = Boolean(currentTour && completedTours[currentTour.id]);

  return (
    <WalkthroughContext.Provider
      value={{
        startTour,
        hasTour,
        currentTour,
        isTourActive,
        hasCompletedCurrentTour,
      }}
    >
      {children}
    </WalkthroughContext.Provider>
  );
}
