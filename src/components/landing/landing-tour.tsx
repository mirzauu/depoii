"use client";

import { useEffect, useState } from "react";
import { MobileTourPhone } from "@/components/landing-phone-shell";

export type TourHighlight = "leads" | "record" | "city" | "pipeline" | "map" | "outcomes" | "aging";

export type TourScene = {
  path: "/" | "/pipeline" | "/map" | "/outcomes" | "/roof-aging";
  city: "Dallas" | "Fort Worth";
  openRecord: boolean;
  highlight: TourHighlight;
  /** -1 mock left · +1 mock right */
  dock: -1 | 1;
};

export type TourStop = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  note?: string;
  mobileNote?: string;
  scene: TourScene;
};

/** Four full-viewport stops: mock stays docked on the left, caption on the right. */
export const TOUR_STOPS: TourStop[] = [
  {
    id: "tour-1",
    eyebrow: "Released leads",
    title: "Start with roofs that already cleared the checks",
    body: "This is the Monday list — not every storm point on a map. These Dallas buildings cleared hail, appraisal, and a logged permit search.",
    note: "Click a row, open the dossier, or use the sidebar — the mock is fully interactive.",
    mobileNote: "Tap a row or use the tabs at the bottom of the phone — the mock is interactive.",
    scene: {
      path: "/",
      city: "Dallas",
      openRecord: false,
      highlight: "leads",
      dock: -1,
    },
  },
  {
    id: "tour-2",
    eyebrow: "What’s on a row",
    title: "Owner, roof size, hail, and the permit search — with sources",
    body: "Open the record and you get the facts your estimator needs before anyone drives: who owns it, how big the roof is, the nearby hail report, and whether the city search found a filing.",
    note: "Not a damage claim — public records plus what your crew confirms on the roof.",
    scene: {
      path: "/",
      city: "Dallas",
      openRecord: true,
      highlight: "record",
      dock: -1,
    },
  },
  {
    id: "tour-3",
    eyebrow: "Hail map",
    title: "See where the storm actually hit — then chase only roofs inside it",
    body: "The red swath is the warning area. Blue dots are SPC hail reports. Red and amber pins are commercial roofs that cleared the checks. You skip buildings outside the storm instead of driving every address on a radar screenshot.",
    note: "Same MapLibre hail map as the signed-in app — zoom, click pins, and toggle outside parcels.",
    mobileNote: "Pinch to zoom, tap pins, then open a lead from the sheet.",
    scene: {
      path: "/map",
      city: "Dallas",
      openRecord: false,
      highlight: "map",
      dock: -1,
    },
  },
  {
    id: "tour-4",
    eyebrow: "Roof aging alarm",
    title: "Old roofs, expired warranties, and who last put them on",
    body: "Critical means 20+ years since the last permitted install. High and moderate are approaching end of term. You also see roofs with no roofing permit on record — aged buildings that never show up on a storm list alone.",
    note: "Filter by risk tier or minimum age. Last contractor names help you know who already worked that roof.",
    scene: {
      path: "/roof-aging",
      city: "Dallas",
      openRecord: false,
      highlight: "aging",
      dock: -1,
    },
  },
];

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

function TourCaption({
  stop,
  mobile,
}: {
  stop: TourStop;
  mobile?: boolean;
}) {
  const note = mobile && stop.mobileNote ? stop.mobileNote : stop.note;
  return (
    <div className={mobile ? "mx-auto w-full max-w-lg px-6 py-12 sm:px-8" : "w-full"}>
      <p className="text-sm font-medium tracking-wide text-sky-800">{stop.eyebrow}</p>
      <h2
        id={`${stop.id}-title`}
        className="mt-2 text-xl font-semibold tracking-tight sm:text-[1.65rem] sm:leading-snug lg:text-[1.7rem]"
      >
        {stop.title}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">{stop.body}</p>
      {note ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground/90">{note}</p>
      ) : null}
    </div>
  );
}

function DesktopTour() {
  return (
    <>
      {TOUR_STOPS.map((stop, index) => {
        // dock -1 → mock left, caption right; dock +1 → mock right, caption left
        const captionOnRight = stop.scene.dock === -1;
        return (
          <section
            key={stop.id}
            id={stop.id}
            className={`landing-snap-panel relative scroll-mt-0 overflow-hidden border-t border-border ${
              index % 2 === 0 ? "bg-muted/40" : "bg-background"
            }`}
            aria-labelledby={`${stop.id}-title`}
          >
            <div
              className="flex h-full items-center py-10"
              style={{
                // Caption column = remaining space beside the measured mock width
                paddingLeft: captionOnRight
                  ? "calc(var(--landing-pad, 2rem) + var(--landing-mock-w, 52rem) + var(--landing-gap, 1.5rem))"
                  : "var(--landing-pad, 2rem)",
                paddingRight: captionOnRight
                  ? "var(--landing-pad, 2rem)"
                  : "calc(var(--landing-pad, 2rem) + var(--landing-mock-w, 52rem) + var(--landing-gap, 1.5rem))",
              }}
            >
              <div
                id={`${stop.id}-copy`}
                className="w-full"
                style={{ maxWidth: "var(--landing-caption-w, 24rem)" }}
              >
                <TourCaption stop={stop} />
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}

function MobileTour() {
  return (
    <>
      {TOUR_STOPS.map((stop, index) => {
        const tone = index % 2 === 0 ? "bg-muted/40" : "bg-background";
        return (
          <div key={stop.id}>
            <section
              id={stop.id}
              className={`landing-snap-panel relative scroll-mt-0 border-t border-border ${tone}`}
              aria-labelledby={`${stop.id}-title`}
            >
              <div id={`${stop.id}-copy`}>
                <TourCaption stop={stop} mobile />
              </div>
            </section>
            <section
              id={`${stop.id}-mock`}
              className={`landing-mock-panel relative scroll-mt-0 border-t border-border ${tone}`}
              aria-label={`${stop.eyebrow} product preview`}
            >
              <MobileTourPhone scene={stop.scene} />
            </section>
          </div>
        );
      })}
    </>
  );
}

export function LandingTour() {
  const narrow = useIsNarrow();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div id="tour">
      {/* Avoid duplicate ids: render one layout after we know the viewport */}
      {!ready ? <DesktopTour /> : narrow ? <MobileTour /> : <DesktopTour />}
    </div>
  );
}
