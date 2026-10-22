"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Building2,
  CloudLightning,
  ContactRound,
  FileSearch,
  HardHat,
  MapPinned,
  Ruler,
  Satellite,
  Siren,
  Users,
  UserRound,
} from "lucide-react";
import { DepoiiMark } from "@/components/depoii-logo";
import { ScorePill } from "@/components/badges";
import { cn } from "cn";

const SOURCES = [
  { id: "hail", label: "Hail SPC", icon: CloudLightning },
  { id: "appraisal", label: "Appraisal", icon: Building2 },
  { id: "permits", label: "Permits", icon: FileSearch },
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "age", label: "Roof age", icon: Ruler },
  { id: "storm", label: "Storm swath", icon: MapPinned },
  { id: "owner", label: "Owner", icon: UserRound },
  { id: "crm", label: "CRM", icon: ContactRound },
] as const;

/** SVG viewBox coords for desktop diagram */
const CX = 500;
const CY = 220;
const SOURCE_Y = 420;
const SOURCE_XS = [55, 175, 295, 415, 545, 665, 785, 905];

function sourcePath(i: number) {
  const x = SOURCE_XS[i];
  const midY = (SOURCE_Y + CY) / 2 - 20;
  return `M ${x} ${SOURCE_Y - 36} C ${x} ${midY}, ${CX} ${midY + 40}, ${CX} ${CY + 56}`;
}

export function LandingEngine() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (reduceMotion) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActive(true);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  const run = active && !reduceMotion;

  return (
    <section
      ref={sectionRef}
      id="how"
      className={cn(
        "landing-engine relative z-50 scroll-mt-0 overflow-hidden border-t border-border bg-white text-neutral-950",
        active && "landing-engine-active",
        reduceMotion && "landing-engine-static",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(200,240,0,0.14),transparent_55%)]" />

      {/* —— Desktop hub —— */}
      <div className="relative mx-auto hidden min-h-[90dvh] max-w-6xl px-4 py-12 lg:block lg:px-8">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 520"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="engine-path" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#84a000" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#84a000" stopOpacity="0.65" />
            </linearGradient>
          </defs>

          <path
            d={`M ${CX - 70} ${CY} C 360 200, 280 200, 220 210`}
            fill="none"
            stroke="#84a000"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            opacity="0.45"
            className={cn(run && "landing-engine-dash")}
          />

          <path
            d={`M ${CX + 70} ${CY} C 640 200, 720 200, 780 210`}
            fill="none"
            stroke="#84a000"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            opacity="0.45"
            className={cn(run && "landing-engine-dash")}
          />

          {SOURCES.map((_, i) => (
            <g key={SOURCES[i].id}>
              <path
                d={sourcePath(i)}
                fill="none"
                stroke="url(#engine-path)"
                strokeWidth="1.6"
                opacity="0.75"
              />
              {run && (
                <circle r="3.5" fill="#84a000" className="landing-engine-pulse-dot">
                  <animateMotion
                    dur="7s"
                    repeatCount="indefinite"
                    begin={`${i * 0.35}s`}
                    path={sourcePath(i)}
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.08;0.85;1"
                    dur="7s"
                    repeatCount="indefinite"
                    begin={`${i * 0.35}s`}
                  />
                </circle>
              )}
            </g>
          ))}

        </svg>

        <div className="absolute top-[14%] left-[2%] z-10 w-64 xl:left-[3%] xl:w-72">
          <ActionBrief />
        </div>

        <div className="absolute top-[12%] left-1/2 z-10 flex w-56 -translate-x-1/2 flex-col items-center text-center">
          <DepoiiMark animated className="size-28 text-neutral-950" />
          <h3 className="mt-5 text-3xl font-bold tracking-tight text-neutral-950">Depoii</h3>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-sky-800 uppercase">
            AI Engine
          </p>
        </div>

        <div className="absolute top-[14%] right-[2%] z-10 w-64 xl:right-[3%] xl:w-72">
          <LeadCard />
        </div>

        <div className="absolute inset-x-4 bottom-8 z-10 flex justify-between gap-2 xl:inset-x-10">
          {SOURCES.map((s) => (
            <SourceModule key={s.id} label={s.label} icon={s.icon} />
          ))}
        </div>
      </div>

      {/* —— Mobile stack —— */}
      <div className="relative mx-auto flex min-h-[85dvh] max-w-lg flex-col items-center justify-center gap-8 px-5 py-14 lg:hidden">
        <div className="flex flex-col items-center text-center">
          <DepoiiMark animated className="size-24 text-neutral-950" />
          <h3 className="mt-4 text-2xl font-bold tracking-tight text-neutral-950">Depoii</h3>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.22em] text-sky-800 uppercase">
            AI Engine
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          {SOURCES.map((s) => (
            <SourceModule key={s.id} label={s.label} icon={s.icon} compact />
          ))}
        </div>

        <div className="w-full">
          <ActionBrief />
        </div>

        <div className="w-full">
          <LeadCard />
        </div>
      </div>
    </section>
  );
}

function ActionBrief() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.25)] ring-1 ring-[#c8f000]/25">
      <p className="px-3 pt-3 text-[10px] font-semibold tracking-[0.18em] text-sky-800 uppercase">
        Do this next
      </p>
      <ul className="mt-2 divide-y divide-border">
        <li className="flex gap-3 px-3 py-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
            <Siren className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-red-600 uppercase">Storm alert</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-neutral-950">
              Severe hail · ZIP 75248
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Mar 14 · NWS warning active</p>
          </div>
        </li>
        <li className="flex gap-3 px-3 py-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#c8f000]/25 text-neutral-900">
            <Users className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-sky-800 uppercase">Deploy crew</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-neutral-950">
              Send estimators to this ZIP
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">75248 · North Dallas</p>
          </div>
        </li>
        <li className="flex gap-3 px-3 py-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700">
            <MapPinned className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-wide text-sky-700 uppercase">
              Potential leads
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-neutral-950">
              16 roofs found in that area
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Cleared hail · appraisal · permit checks
            </p>
          </div>
        </li>
      </ul>
    </div>
  );
}

function SourceModule({
  label,
  icon: Icon,
  compact,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white text-center shadow-sm",
        compact ? "px-2 py-3" : "min-w-0 flex-1 px-2 py-3",
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-[#c8f000]/30 text-neutral-900">
        <Icon className="size-4" />
      </span>
      <span className="text-[10px] leading-tight font-medium text-neutral-700 sm:text-[11px]">{label}</span>
    </div>
  );
}

function LeadCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.25)] ring-1 ring-[#c8f000]/25">
      <p className="px-3 pt-3 text-[10px] font-semibold tracking-[0.18em] text-sky-800 uppercase">
        Top lead
      </p>
      <div className="relative mt-2 aspect-[16/10] w-full overflow-hidden">
        <Image
          src="/landing/aerials/dcad-16850.jpg"
          alt="Satellite aerial view of commercial roof at 16850 Dallas Pkwy"
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-950">16850 DALLAS PKWY</p>
            <p className="text-[11px] text-muted-foreground">Dallas, TX · ZIP 75248</p>
          </div>
          <ScorePill score={86} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-700">
          <HardHat className="size-3.5 text-sky-800" />
          Worth the drive
        </div>
      </div>
    </div>
  );
}
