"use client";

import { useEffect, useState } from "react";
import { MobileTourPhone } from "@/components/landing-phone-shell";
import {
  ClayBadge,
  DepoiiPriorityIcon,
  DepoiiVeilIcon,
  DepoiiRadarSwathIcon,
  DepoiiRoofAgingIcon,
  SourceBadge,
} from "./clay-icons";

export type TourHighlight = "leads" | "record" | "city" | "pipeline" | "map" | "outcomes" | "aging";

export type TourScene = {
  path: "/" | "/pipeline" | "/map" | "/outcomes" | "/roof-aging";
  city: "Dallas" | "Fort Worth";
  openRecord: boolean;
  highlight: TourHighlight;
  /** -1 mock left · +1 mock right */
  dock: -1 | 1;
};

export type TourSource = {
  name: string;
  code: string;
};

export type TourStop = {
  id: string;
  badgeLabel: string;
  badgeColor: "blue" | "teal" | "rose" | "amber";
  IconComponent: React.ComponentType<{ className?: string }>;
  titleBase: string;
  titleHighlight: string;
  highlightColor: string;
  hoverColor: string;
  body: string;
  sources: TourSource[];
  proofHeadline: string;
  proofDetail: string;
  actionText: string;
  actionHref: string;
  note?: string;
  mobileNote?: string;
  scene: TourScene;
  sectionBg: string;
  sectionBorder: string;
};

/** Four full-viewport stops: mock stays docked on the left, caption on the right. */
export const TOUR_STOPS: TourStop[] = [
  {
    id: "tour-1",
    badgeLabel: "Verified Priority Feed",
    badgeColor: "blue",
    IconComponent: DepoiiPriorityIcon,
    titleBase: "Start with commercial roofs that ",
    titleHighlight: "already cleared the checks",
    highlightColor: "text-[#1E5BF6]",
    hoverColor: "hover:text-[#1E5BF6]",
    body: "Skip driving every random warehouse. These Dallas–Fort Worth buildings cleared three strict public filters: Doppler hail impact, county appraisal parcel verification, and an active municipal permit search.",
    sources: [
      { name: "NOAA SPC Swath", code: "SPC" },
      { name: "Dallas CAD / TAD", code: "CAD" },
      { name: "City Permits", code: "BLD" },
    ],
    proofHeadline: "100% Pre-Cleared Leads",
    proofDetail: "Zero blind cold driving. Every record links to Doppler hail impact, parcel deed, and municipal permit filings.",
    actionText: "Claim your territory feed",
    actionHref: "#pilot",
    sectionBg: "bg-[#F3F7FD]",
    sectionBorder: "border-[#DCE7F9]",
    note: "Tip: Click any row in the mock on the left to inspect verified appraisal and permit filings.",
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
    badgeLabel: "Ownership Intelligence",
    badgeColor: "teal",
    IconComponent: DepoiiVeilIcon,
    titleBase: "Stop hitting LLC brick walls — ",
    titleHighlight: "see the real building owner",
    highlightColor: "text-[#0A8F82]",
    hoverColor: "hover:text-[#0A8F82]",
    body: "Most commercial properties are hidden behind shell LLCs. Depoii correlates county appraisal rolls, corporate filings, and permit records to reveal the true managing partner, roof area, and permit history before your estimator dials.",
    sources: [
      { name: "TX Sec of State", code: "SOS" },
      { name: "County Appraisal", code: "TAX" },
      { name: "Permit Registry", code: "BLD" },
    ],
    proofHeadline: "Direct Decision-Makers",
    proofDetail: "Bypasses shell LLCs to surface managing partner officers, physical headquarters, and contact phone numbers.",
    actionText: "Inspect property dossier",
    actionHref: "#pilot",
    sectionBg: "bg-[#F0F9F5]",
    sectionBorder: "border-[#D5EFE6]",
    note: "Tip: Click 'Open dossier' on 16850 Dallas Pkwy in the mock to see the managing partner behind the LLC.",
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
    badgeLabel: "NWS Radar Swath",
    badgeColor: "rose",
    IconComponent: DepoiiRadarSwathIcon,
    titleBase: "Chase roofs inside the storm swath — ",
    titleHighlight: "not radar screenshots",
    highlightColor: "text-[#E11D48]",
    hoverColor: "hover:text-[#E11D48]",
    body: "The red swath is the verified warning boundary. Blue points are SPC ground hail reports. Amber and red pins are commercial properties that cleared the checks. You skip undamaged buildings instead of driving every address in town.",
    sources: [
      { name: "NEXRAD Level II", code: "RADAR" },
      { name: "SPC Ground Truth", code: "HAIL" },
      { name: "MapLibre Vector", code: "GIS" },
    ],
    proofHeadline: "Polygon-Level Exclusion",
    proofDetail: "Filters out unaffected commercial parcels automatically so your crew only bids buildings inside the verified hail boundary.",
    actionText: "Explore DFW hail corridor",
    actionHref: "#pilot",
    sectionBg: "bg-[#FFF2F4]",
    sectionBorder: "border-[#FED9DF]",
    note: "Tip: Drag and zoom the MapLibre radar map on the left to test the polygon boundary and commercial pins.",
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
    badgeLabel: "Capital Cycles",
    badgeColor: "amber",
    IconComponent: DepoiiRoofAgingIcon,
    titleBase: "Find $250k+ non-storm replacements ",
    titleHighlight: "before warranty expires",
    highlightColor: "text-[#D97706]",
    hoverColor: "hover:text-[#D97706]",
    body: "Critical means 20+ years since the last permitted install. These building owners are facing expired manufacturer warranties and budgeting capital expenditures. Depoii flags aging commercial membranes before storm chasers even show up.",
    sources: [
      { name: "Permit Archive", code: "HIST" },
      { name: "Warranty Tracker", code: "TERM" },
      { name: "Substrate Roll", code: "TPO" },
    ],
    proofHeadline: "Pre-Storm Capital Replacements",
    proofDetail: "Identifies 15–25+ year commercial membrane systems (TPO, Built-Up, Mod-Bit) and the contractor who previously installed them.",
    actionText: "Filter aging roof inventory",
    actionHref: "#pilot",
    sectionBg: "bg-[#FDF8EE]",
    sectionBorder: "border-[#F7E8CF]",
    note: "Tip: Filter by risk tier or minimum age to isolate commercial buildings whose manufacturer warranties have lapsed.",
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
  const IconComponent = stop.IconComponent;

  return (
    <div className={mobile ? "mx-auto w-full max-w-lg px-6 py-12 sm:px-8" : "w-full"}>
      {/* Top Header Row: Clay Badge + Custom Bespoke Depoii Icon */}
      <div className="flex items-center justify-between gap-4">
        <ClayBadge label={stop.badgeLabel} color={stop.badgeColor} />
        <IconComponent className="h-11 w-11 drop-shadow-xs" />
      </div>

      {/* Two-Tone Clay Headline */}
      <h2
        id={`${stop.id}-title`}
        className="mt-5 text-[1.65rem] font-bold leading-[1.18] tracking-tight text-neutral-950 sm:text-[1.85rem] lg:text-[1.95rem]"
      >
        <span>{stop.titleBase}</span>
        <span className={stop.highlightColor}>{stop.titleHighlight}</span>
      </h2>

      {/* Clay-Style Body Copy */}
      <p className="mt-3.5 text-[15px] leading-[1.68] text-neutral-600 sm:text-base">
        {stop.body}
      </p>

      {/* Clay-Style Source Verification & Proof Capsule */}
      <div className="mt-6 rounded-2xl border border-neutral-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xs">
        {/* Source Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {stop.sources.map((source, idx) => (
            <SourceBadge
              key={idx}
              name={source.name}
              code={source.code}
              color={stop.badgeColor}
            />
          ))}
        </div>

        {/* Proof Statement */}
        <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-neutral-600">
          <span className="font-semibold text-neutral-900">{stop.proofHeadline}</span>
          <span className="mx-1.5 text-neutral-300">·</span>
          <span>{stop.proofDetail}</span>
        </p>
      </div>

      {/* Primary Action Link (Clay style) */}
      <div className="mt-6 flex items-center justify-between">
        <a
          href={stop.actionHref}
          className={`group inline-flex items-center gap-2 text-[14.5px] font-bold text-neutral-950 transition-colors ${stop.hoverColor}`}
        >
          <span>{stop.actionText}</span>
          <span className="text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-current">
            →
          </span>
        </a>
      </div>

      {/* Subtle Workflow Tip */}
      {note ? (
        <p className="mt-4 border-l-2 border-neutral-200 pl-3 text-xs leading-relaxed text-neutral-400">
          {note}
        </p>
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
            className={`landing-snap-panel relative scroll-mt-0 overflow-hidden border-t ${stop.sectionBorder} ${stop.sectionBg}`}
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
                className="w-full max-w-[28rem] xl:max-w-[31rem]"
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
        // Use per-stop color
        return (
          <div key={stop.id}>
            <section
              id={stop.id}
              className={`landing-snap-panel relative scroll-mt-0 border-t ${stop.sectionBorder} ${stop.sectionBg}`}
              aria-labelledby={`${stop.id}-title`}
            >
              <div id={`${stop.id}-copy`}>
                <TourCaption stop={stop} mobile />
              </div>
            </section>
            <section
              id={`${stop.id}-mock`}
              className={`landing-mock-panel relative scroll-mt-0 border-t ${stop.sectionBorder} ${stop.sectionBg}`}
              aria-label={`${stop.badgeLabel} product preview`}
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
