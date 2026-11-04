import React from "react";

/**
 * Clay-style category pill with kinetic trailing discs.
 * Modeled directly after clay.com's DATA, AGENTS, and GTM INFRASTRUCTURE badges.
 */
export function ClayBadge({
  label,
  color = "blue",
}: {
  label: string;
  color?: "blue" | "teal" | "rose" | "amber";
}) {
  const colorMap = {
    blue: {
      pill: "bg-[#1E5BF6] text-white shadow-sm shadow-[#1E5BF6]/25",
      disc1: "bg-[#1E5BF6]/35 border-blue-400/40",
      disc2: "bg-[#1E5BF6]/18 border-blue-300/30",
    },
    teal: {
      pill: "bg-[#0A8F82] text-white shadow-sm shadow-[#0A8F82]/25",
      disc1: "bg-[#0A8F82]/35 border-teal-400/40",
      disc2: "bg-[#0A8F82]/18 border-teal-300/30",
    },
    rose: {
      pill: "bg-[#E11D48] text-white shadow-sm shadow-[#E11D48]/25",
      disc1: "bg-[#E11D48]/35 border-rose-400/40",
      disc2: "bg-[#E11D48]/18 border-rose-300/30",
    },
    amber: {
      pill: "bg-[#D97706] text-white shadow-sm shadow-[#D97706]/25",
      disc1: "bg-[#D97706]/35 border-amber-400/40",
      disc2: "bg-[#D97706]/18 border-amber-300/30",
    },
  };

  const scheme = colorMap[color];

  return (
    <div className="inline-flex items-center select-none">
      {/* Front Solid Pill */}
      <div
        className={`relative z-10 flex h-7 items-center rounded-full px-3.5 text-[11px] font-bold tracking-wider uppercase ${scheme.pill}`}
      >
        {label}
      </div>

      {/* Trailing Discs (Clay's trademark layered sliding trail) */}
      <div
        className={`-ml-2.5 h-7 w-4.5 rounded-r-full border-r ${scheme.disc1}`}
      />
      <div
        className={`-ml-3 h-7 w-4.5 rounded-r-full border-r ${scheme.disc2}`}
      />
    </div>
  );
}

/**
 * Bespoke Depoii Icon: The Monday Priority List / Verified Feed
 * Commercial roof geometry with verified 3-tier inspection pulses.
 */
export function DepoiiPriorityIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Soft volumetric base */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="10"
        fill="#EFF6FF"
        stroke="#BFDBFE"
        strokeWidth="1.5"
      />
      
      {/* Commercial roof grid plane */}
      <path
        d="M14 26L24 18L34 26L24 34L14 26Z"
        fill="#DBEAFE"
        stroke="#3B82F6"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      
      {/* Structural grid lines */}
      <path d="M24 18V34" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M19 22L29 30" stroke="#93C5FD" strokeWidth="1" />
      <path d="M29 22L19 30" stroke="#93C5FD" strokeWidth="1" />

      {/* Priority Check Floating Badge */}
      <circle cx="34" cy="14" r="7" fill="#1E5BF6" />
      <path
        d="M31 14L33 16L37 12"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Bespoke Depoii Icon: Piercing the LLC Veil / Ownership Intelligence
 * Layered corporate shell hexagon with central diagnostic lens de-cloaking the real owner.
 */
export function DepoiiVeilIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Soft volumetric base */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="10"
        fill="#F0FDFA"
        stroke="#99F6E4"
        strokeWidth="1.5"
      />

      {/* Corporate LLC Shell Hexagon */}
      <path
        d="M24 12L34 18V30L24 36L14 30V18L24 12Z"
        fill="#CCFBF1"
        stroke="#0D9488"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* De-cloaked Person / Keyhole aperture */}
      <circle cx="24" cy="21" r="3.5" fill="#0A8F82" />
      <path
        d="M18.5 29.5C18.5 26.5 21 26 24 26C27 26 29.5 26.5 29.5 29.5"
        stroke="#0A8F82"
        strokeWidth="1.75"
        strokeLinecap="round"
      />

      {/* Transparency / Scanning aperture ray */}
      <path
        d="M12 24H36"
        stroke="#14B8A6"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

/**
 * Bespoke Depoii Icon: Doppler Hail Radar Swath
 * Concentric radar swath wave arcs with severe storm polygon footprint.
 */
export function DepoiiRadarSwathIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Soft volumetric base */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="10"
        fill="#FFF1F2"
        stroke="#FECDD3"
        strokeWidth="1.5"
      />

      {/* Radar Wave Arc 1 (Outer) */}
      <path
        d="M14 34C14 22.9543 22.9543 14 34 14"
        stroke="#FDA4AF"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Radar Wave Arc 2 (Mid) */}
      <path
        d="M18 34C18 25.1634 25.1634 18 34 18"
        stroke="#FB7185"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Radar Severe Core Pulse */}
      <path
        d="M22 34C22 27.3726 27.3726 22 34 22"
        stroke="#E11D48"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Hail Impact Parcel Pin */}
      <circle cx="28" cy="28" r="4.5" fill="#E11D48" />
      <circle cx="28" cy="28" r="1.75" fill="white" />
    </svg>
  );
}

/**
 * Bespoke Depoii Icon: Roof Aging Alarms / Capital Cycles
 * Commercial roof membrane strata with warranty expiration clock dial.
 */
export function DepoiiRoofAgingIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Soft volumetric base */}
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="10"
        fill="#FFFBEB"
        stroke="#FDE68A"
        strokeWidth="1.5"
      />

      {/* Circular 20-Year Timeline Dial */}
      <circle
        cx="24"
        cy="24"
        r="11"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeDasharray="4 2"
      />

      {/* Aging Critical Sector (20+ yrs expired segment) */}
      <path
        d="M24 13C30.0751 13 35 17.9249 35 24H24V13Z"
        fill="#FDE68A"
        stroke="#D97706"
        strokeWidth="1.5"
      />

      {/* Clock Hands / Indicator */}
      <path
        d="M24 17V24L28 26.5"
        stroke="#B45309"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Critical Status Alert Dot */}
      <circle cx="34" cy="14" r="3" fill="#D97706" />
    </svg>
  );
}

/**
 * Small brand/source icons for the Clay-style integration badges
 */
export function SourceBadge({
  name,
  code,
  color = "blue",
}: {
  name: string;
  code: string;
  color?: "blue" | "teal" | "rose" | "amber";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 border-blue-200/80",
    teal: "bg-teal-50 text-teal-700 border-teal-200/80",
    rose: "bg-rose-50 text-rose-700 border-rose-200/80",
    amber: "bg-amber-50 text-amber-800 border-amber-200/80",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${styles[color]}`}>
      <span className="font-mono text-[9px] uppercase tracking-wider opacity-75">{code}</span>
      <span>{name}</span>
    </div>
  );
}

