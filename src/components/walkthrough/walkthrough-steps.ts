import type { DriveStep } from "driver.js";

export interface PageTourDefinition {
  id: string;
  title: string;
  badge?: string;
  steps: DriveStep[];
}

export const PAGE_TOURS: Record<string, PageTourDefinition> = {
  "/": {
    id: "overview",
    title: "Overview Tour",
    badge: "Dashboard Guide",
    steps: [
      {
        element: '[data-tour="sidebar-nav"]',
        popover: {
          title: "Command Center Navigation",
          description:
            "Navigate each stage of your commercial roofing pipeline — from live storm intelligence and hail maps to lead dossiers, contractor permits, and territory claims.",
          side: "right",
          align: "start",
        },
      },
      {
        element: '[data-tour="city-selector"]',
        popover: {
          title: "Metro Jurisdiction & Storm Selector",
          description:
            "Switch metro areas (e.g. Dallas, Fort Worth) and choose specific National Weather Service hail events to view localized radar swaths.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: '[data-tour="hero-dispatch"]',
        popover: {
          title: "Tactical Storm Dispatch",
          description:
            "Your daily operational marching order. Depoii correlates radar hail size with commercial roof ages and public permit searches to direct your crews to the highest-yield ZIP codes.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="card-zip"]',
        popover: {
          title: "Target ZIP Intelligence",
          description:
            "Highlights ZIP codes with high building density in the storm path. Click any ZIP to filter the lead table below, or click the card to open the interactive Hail Map.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="card-condition"]',
        popover: {
          title: "Roof Aging & Fatigue",
          description:
            "Identifies buildings with roofs over 20+ years old. Aged roofs under hail impact represent your highest-probability insurance replacement targets. Click to open Roof Aging.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="card-permits"]',
        popover: {
          title: "Permits & Exclusive Lock",
          description:
            "Zero competitor permits means a clear runway with no rivals canvassing yet. Click to claim territory and secure a 21-day exclusive lock on these buildings.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: '[data-tour="overview-stats"]',
        popover: {
          title: "Key Market Metrics",
          description:
            "Aggregated commercial pipeline valuation, verified square footage under assessment, and active unpermitted lead targets.",
          side: "top",
          align: "start",
        },
      },
      {
        element: '[data-tour="released-records"]',
        popover: {
          title: "Released Lead Pipeline",
          description:
            "Each building is scored (0–100) based on hail intensity, roof square footage, and property condition. Click 'Open dossier' to see owner details or 'Add to pipeline' to begin tracking.",
          side: "top",
          align: "start",
        },
      },
    ],
  },
  "/pipeline": {
    id: "pipeline",
    title: "Opportunity Pipeline",
    badge: "Leads Guide",
    steps: [
      {
        element: '[data-tour="pipeline-header"]',
        popover: {
          title: "Deal Pipeline Management",
          description:
            "Track commercial roofing opportunities through every deal stage — from discovery and inspection to proposal and closed re-roof contracts.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: '[data-tour="pipeline-content"]',
        popover: {
          title: "Active Commercial Opportunities",
          description:
            "Review Depoii score ratings, verified square footage, and contact details. Advance cards as inspections and bids conclude.",
          side: "top",
          align: "start",
        },
      },
    ],
  },
  "/map": {
    id: "map",
    title: "Hail Swath Map",
    badge: "Map Guide",
    steps: [
      {
        element: '[data-tour="map-container"]',
        popover: {
          title: "Interactive Radar Swath",
          description:
            "Visualize radar hail tracks overlaid directly on commercial parcel boundaries. Red and amber contours indicate severe hail density.",
          side: "bottom",
          align: "start",
        },
      },
    ],
  },
  "/roof-aging": {
    id: "roof-aging",
    title: "Roof Aging Alarm",
    badge: "Condition Guide",
    steps: [
      {
        element: '[data-tour="roof-aging-container"]',
        popover: {
          title: "Aging Roof Intelligence",
          description:
            "Pinpoint commercial structures nearing end-of-life (20–30+ years) before severe storm events occur.",
          side: "bottom",
          align: "start",
        },
      },
    ],
  },
  "/territory": {
    id: "territory",
    title: "Territory Claims",
    badge: "Territory Guide",
    steps: [
      {
        element: '[data-tour="territory-container"]',
        popover: {
          title: "Territory Exclusivity & Locks",
          description:
            "Claim city zones and lock properties with 21-day exclusivity to prevent competing contractors from working the same leads.",
          side: "bottom",
          align: "start",
        },
      },
    ],
  },
};

export function getTourForPath(pathname: string): PageTourDefinition | null {
  // Exact match first
  if (PAGE_TOURS[pathname]) {
    return PAGE_TOURS[pathname];
  }

  // Prefix match for nested routes
  const prefixKey = Object.keys(PAGE_TOURS).find(
    (key) => key !== "/" && pathname.startsWith(key),
  );
  if (prefixKey) {
    return PAGE_TOURS[prefixKey];
  }

  return null;
}
