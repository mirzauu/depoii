"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  MapPin,
  ExternalLink,
  Phone,
  Mail,
  Shield,
  Layers,
  Award,
  CheckSquare,
  Square,
  Lock,
  FileText,
} from "lucide-react";
import { ContractorLink } from "@/components/contractor-link";
import { RealLogo } from "@/components/real-logo";
import { ParcelDetailDrawer } from "@/components/parcel-detail-drawer";
import { useDepoiiState } from "@/components/depoii-provider";
import { RiskBadge, useDebounced } from "@/components/layout/engine-layout";
import { useEngine } from "@/components/use-engine";
import { Button } from "@/components/ui/button";
import { mapAging, mapDarkMarket, type AgingRoof, type OverdueParcel } from "@/lib/engine-api";
import { num, shortDate, usd } from "@/lib/format";
import { SERVED_AREAS } from "@/lib/us-areas";
import { cn } from "@/lib/utils";

const LIMIT = 100;

const AGED_SKELETON_ROWS = [
  { addrW: "w-44", riskTone: "border-[#DE7272]/50 bg-[#DE7272]/20 text-rose-800 dark:text-[#DE7272]", ageW: "w-12", ownerW: "w-36", contactW: "w-32", mailW: "w-40", sysW: "w-28", contrW: "w-32", costW: "w-24" },
  { addrW: "w-52", riskTone: "border-[#FFCA88]/50 bg-[#FFCA88]/20 text-amber-800 dark:text-[#FFCA88]", ageW: "w-10", ownerW: "w-40", contactW: "w-28", mailW: "w-36", sysW: "w-24", contrW: "w-28", costW: "w-20" },
  { addrW: "w-36", riskTone: "border-[#DE7272]/50 bg-[#DE7272]/20 text-rose-800 dark:text-[#DE7272]", ageW: "w-14", ownerW: "w-32", contactW: "w-36", mailW: "w-44", sysW: "w-32", contrW: "w-36", costW: "w-28" },
  { addrW: "w-48", riskTone: "border-[#FFF6A9]/50 bg-[#FFF6A9]/20 text-yellow-800 dark:text-[#FFF6A9]", ageW: "w-10", ownerW: "w-44", contactW: "w-24", mailW: "w-32", sysW: "w-20", contrW: "w-24", costW: "w-18" },
  { addrW: "w-40", riskTone: "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6]", ageW: "w-12", ownerW: "w-36", contactW: "w-32", mailW: "w-38", sysW: "w-28", contrW: "w-32", costW: "w-22" },
  { addrW: "w-56", riskTone: "border-[#DE7272]/50 bg-[#DE7272]/20 text-rose-800 dark:text-[#DE7272]", ageW: "w-14", ownerW: "w-48", contactW: "w-36", mailW: "w-42", sysW: "w-24", contrW: "w-40", costW: "w-24" },
  { addrW: "w-42", riskTone: "border-[#FFCA88]/50 bg-[#FFCA88]/20 text-amber-800 dark:text-[#FFCA88]", ageW: "w-10", ownerW: "w-34", contactW: "w-30", mailW: "w-36", sysW: "w-32", contrW: "w-28", costW: "w-20" },
  { addrW: "w-38", riskTone: "border-[#FFF6A9]/50 bg-[#FFF6A9]/20 text-yellow-800 dark:text-[#FFF6A9]", ageW: "w-12", ownerW: "w-38", contactW: "w-28", mailW: "w-34", sysW: "w-22", contrW: "w-24", costW: "w-18" },
  { addrW: "w-46", riskTone: "border-[#DE7272]/50 bg-[#DE7272]/20 text-rose-800 dark:text-[#DE7272]", ageW: "w-14", ownerW: "w-40", contactW: "w-34", mailW: "w-40", sysW: "w-30", contrW: "w-36", costW: "w-26" },
  { addrW: "w-40", riskTone: "border-[#FFCA88]/50 bg-[#FFCA88]/20 text-amber-800 dark:text-[#FFCA88]", ageW: "w-10", ownerW: "w-36", contactW: "w-28", mailW: "w-32", sysW: "w-24", contrW: "w-30", costW: "w-20" },
  { addrW: "w-44", riskTone: "border-[#DE7272]/50 bg-[#DE7272]/20 text-rose-800 dark:text-[#DE7272]", ageW: "w-12", ownerW: "w-42", contactW: "w-30", mailW: "w-38", sysW: "w-28", contrW: "w-28", costW: "w-22" },
  { addrW: "w-36", riskTone: "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6]", ageW: "w-10", ownerW: "w-32", contactW: "w-24", mailW: "w-30", sysW: "w-20", contrW: "w-24", costW: "w-18" },
];

const NEVER_SKELETON_ROWS = [
  { addrW: "w-44", ownerW: "w-36", contactW: "w-32", mailW: "w-40", ageW: "w-12", sqftW: "w-16", yrW: "w-12", costW: "w-24" },
  { addrW: "w-52", ownerW: "w-44", contactW: "w-28", mailW: "w-36", ageW: "w-10", sqftW: "w-18", yrW: "w-12", costW: "w-20" },
  { addrW: "w-36", ownerW: "w-32", contactW: "w-36", mailW: "w-44", ageW: "w-14", sqftW: "w-14", yrW: "w-12", costW: "w-28" },
  { addrW: "w-48", ownerW: "w-40", contactW: "w-24", mailW: "w-32", ageW: "w-10", sqftW: "w-20", yrW: "w-12", costW: "w-18" },
  { addrW: "w-40", ownerW: "w-36", contactW: "w-32", mailW: "w-38", ageW: "w-12", sqftW: "w-16", yrW: "w-12", costW: "w-22" },
  { addrW: "w-56", ownerW: "w-48", contactW: "w-36", mailW: "w-42", ageW: "w-14", sqftW: "w-22", yrW: "w-12", costW: "w-24" },
  { addrW: "w-42", ownerW: "w-34", contactW: "w-30", mailW: "w-36", ageW: "w-10", sqftW: "w-14", yrW: "w-12", costW: "w-20" },
  { addrW: "w-38", ownerW: "w-30", contactW: "w-28", mailW: "w-34", ageW: "w-12", sqftW: "w-16", yrW: "w-12", costW: "w-18" },
  { addrW: "w-46", ownerW: "w-42", contactW: "w-34", mailW: "w-40", ageW: "w-14", sqftW: "w-20", yrW: "w-12", costW: "w-26" },
  { addrW: "w-40", ownerW: "w-36", contactW: "w-28", mailW: "w-32", ageW: "w-10", sqftW: "w-14", yrW: "w-12", costW: "w-20" },
  { addrW: "w-44", ownerW: "w-38", contactW: "w-30", mailW: "w-38", ageW: "w-12", sqftW: "w-18", yrW: "w-12", costW: "w-22" },
  { addrW: "w-36", ownerW: "w-28", contactW: "w-24", mailW: "w-30", ageW: "w-10", sqftW: "w-14", yrW: "w-12", costW: "w-18" },
];

function RoofAgingAgedSkeletonRows() {
  return (
    <>
      {AGED_SKELETON_ROWS.map((row, i) => {
        const delay = `${i * 70}ms`;
        return (
          <tr
            key={i}
            className="border-b border-border/40 dark:border-neutral-800/40 transition-opacity"
            style={{
              opacity: Math.max(0.3, 1 - i * 0.05),
            }}
          >
            {/* Checkbox */}
            <td className="w-10 px-3 py-3 text-center">
              <div
                style={{ animationDelay: delay }}
                className="size-3.5 mx-auto rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-200/70 dark:bg-neutral-800/80 animate-pulse"
              />
            </td>

            {/* Address (Sticky Left) */}
            <td className="sticky left-0 z-10 bg-background dark:bg-[#0b0c10] px-3 py-3 whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]">
              <div
                style={{ animationDelay: delay }}
                className={`h-4 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.addrW}`}
              />
            </td>

            {/* Risk Tier */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-5 w-20 rounded border ${row.riskTone} animate-pulse`}
              />
            </td>

            {/* Age */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse ${row.ageW}`}
              />
            </td>

            {/* Owner / Entity */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.ownerW}`}
              />
            </td>

            {/* Contact / Phone / Email */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div className="space-y-1.5">
                <div
                  style={{ animationDelay: delay }}
                  className={`h-3 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.contactW}`}
                />
                <div
                  style={{ animationDelay: delay }}
                  className="h-3 w-20 rounded bg-neutral-200/70 dark:bg-neutral-800/60 animate-pulse"
                />
              </div>
            </td>

            {/* Mailing Address */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3 rounded bg-neutral-200/70 dark:bg-neutral-800/60 animate-pulse ${row.mailW}`}
              />
            </td>

            {/* Installed */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-3.5 w-12 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse"
              />
            </td>

            {/* Roof System */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse ${row.sysW}`}
              />
            </td>

            {/* Last Contractor */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse ${row.contrW}`}
              />
            </td>

            {/* Priority */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-4 w-8 rounded ml-auto bg-neutral-200 dark:bg-neutral-800/90 animate-pulse"
              />
            </td>

            {/* Est. Replacement */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 ml-auto animate-pulse ${row.costW}`}
              />
            </td>

            {/* Jurisdiction */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-3.5 w-16 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse"
              />
            </td>

            {/* Actions */}
            <td className="px-3 py-3 pr-4 text-right whitespace-nowrap">
              <div className="inline-flex items-center gap-1.5 ml-auto">
                <div
                  style={{ animationDelay: delay }}
                  className="h-7 w-28 rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
                <div
                  style={{ animationDelay: delay }}
                  className="h-7 w-20 rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
              </div>
            </td>
          </tr>
        );
      })}

      {/* Trailing streaming indicator row */}
      <tr>
        <td colSpan={14} className="py-6 text-center bg-transparent">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/70 text-xs text-neutral-500 dark:text-neutral-400 shadow-sm">
            <span className="size-2 rounded-full bg-[#B4E4D6] animate-ping" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Streaming commercial roof aging alarms...</span>
          </div>
        </td>
      </tr>
    </>
  );
}

function RoofAgingNeverSkeletonRows() {
  return (
    <>
      {NEVER_SKELETON_ROWS.map((row, i) => {
        const delay = `${i * 70}ms`;
        return (
          <tr
            key={i}
            className="border-b border-border/40 dark:border-neutral-800/40 transition-opacity"
            style={{
              opacity: Math.max(0.3, 1 - i * 0.05),
            }}
          >
            {/* Checkbox */}
            <td className="w-10 px-3 py-3 text-center">
              <div
                style={{ animationDelay: delay }}
                className="size-3.5 mx-auto rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-200/70 dark:bg-neutral-800/80 animate-pulse"
              />
            </td>

            {/* Address (Sticky Left) */}
            <td className="sticky left-0 z-10 bg-background dark:bg-[#0b0c10] px-3 py-3 whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]">
              <div
                style={{ animationDelay: delay }}
                className={`h-4 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.addrW}`}
              />
            </td>

            {/* Owner */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.ownerW}`}
              />
            </td>

            {/* Contact / Phone / Email */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div className="space-y-1.5">
                <div
                  style={{ animationDelay: delay }}
                  className={`h-3 rounded bg-neutral-200 dark:bg-neutral-800/90 animate-pulse ${row.contactW}`}
                />
                <div
                  style={{ animationDelay: delay }}
                  className="h-3 w-20 rounded bg-neutral-200/70 dark:bg-neutral-800/60 animate-pulse"
                />
              </div>
            </td>

            {/* Mailing Address */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3 rounded bg-neutral-200/70 dark:bg-neutral-800/60 animate-pulse ${row.mailW}`}
              />
            </td>

            {/* Age */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse ${row.ageW}`}
              />
            </td>

            {/* Sq ft */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse ${row.sqftW}`}
              />
            </td>

            {/* Year Built */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200/80 dark:bg-neutral-800/70 ml-auto animate-pulse ${row.yrW}`}
              />
            </td>

            {/* Status */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-5 w-24 rounded border border-[#FFCA88]/50 bg-[#FFCA88]/20 animate-pulse"
              />
            </td>

            {/* Est. Replacement */}
            <td className="px-3 py-3 text-right whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className={`h-3.5 rounded bg-neutral-200 dark:bg-neutral-800/90 ml-auto animate-pulse ${row.costW}`}
              />
            </td>

            {/* Jurisdiction */}
            <td className="px-3 py-3 whitespace-nowrap">
              <div
                style={{ animationDelay: delay }}
                className="h-3.5 w-16 rounded bg-neutral-200/80 dark:bg-neutral-800/70 animate-pulse"
              />
            </td>

            {/* Actions */}
            <td className="px-3 py-3 pr-4 text-right whitespace-nowrap">
              <div className="inline-flex items-center gap-1.5 ml-auto">
                <div
                  style={{ animationDelay: delay }}
                  className="h-7 w-28 rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
                <div
                  style={{ animationDelay: delay }}
                  className="h-7 w-24 rounded-md border border-neutral-300 dark:border-neutral-700/80 bg-neutral-100 dark:bg-neutral-900 animate-pulse"
                />
              </div>
            </td>
          </tr>
        );
      })}

      {/* Trailing streaming indicator row */}
      <tr>
        <td colSpan={12} className="py-6 text-center bg-transparent">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/70 text-xs text-neutral-500 dark:text-neutral-400 shadow-sm">
            <span className="size-2 rounded-full bg-[#FFCA88] animate-ping" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Streaming dark market commercial parcels...</span>
          </div>
        </td>
      </tr>
    </>
  );
}

interface AvailableTerritory {
  id: string;
  name: string;
  isSubscribed: boolean;
  availableSlots: number;
  maxSubscribers: number;
}

export default function RoofAgingPage() {
  const { jurisdiction, setJurisdiction } = useDepoiiState();

  // Mode: "aged" (Last install is old) or "never" (No roofing permit on record)
  const [record, setRecord] = useState<"aged" | "never">("aged");
  const [zone, setZone] = useState<string>("dallas-central-uptown");
  const [permitStatus, setPermitStatus] = useState<"all" | "permitted" | "unpermitted">("all");
  const [includePublic, setIncludePublic] = useState(false);
  const [tier, setTier] = useState("");
  const [minAge, setMinAge] = useState(15);
  const [minVal, setMinVal] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  // Territory and subscription state
  const [territories, setTerritories] = useState<AvailableTerritory[]>([]);
  const [territoriesLoaded, setTerritoriesLoaded] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [turfZips, setTurfZips] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/organization/turf")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.turf?.primaryZips && Array.isArray(data.turf.primaryZips)) {
          setTurfZips(data.turf.primaryZips);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/territories?market=dallas").then((r) => (r.ok ? r.json() : { territories: [] })),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : ({} as { platformRole?: string }))),
    ])
      .then(([tData, meData]: [any, { platformRole?: string }]) => {
        const isSuper = meData?.platformRole === "superadmin";
        setUserRole(meData?.platformRole || "");
        if (Array.isArray(tData.territories)) {
          setTerritories(tData.territories);
          const subscribed = tData.territories.filter((t: AvailableTerritory) => t.isSubscribed);
          if (!isSuper) {
            if (subscribed.length > 0) {
              setZone((prev) => {
                if (subscribed.some((t: AvailableTerritory) => t.id === prev)) return prev;
                return subscribed[0].id;
              });
            } else {
              setZone("none");
            }
          }
        }
        setTerritoriesLoaded(true);
      })
      .catch(() => setTerritoriesLoaded(true));
  }, []);

  // Sorting
  const [sortBy, setSortBy] = useState<"default" | "age" | "cost" | "priority" | "sqft">("default");

  // Selection for claiming
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [unlockedPhones, setUnlockedPhones] = useState<Set<string>>(new Set());
  const [unlockedEmails, setUnlockedEmails] = useState<Set<string>>(new Set());
  const [selectedDrawerParcel, setSelectedDrawerParcel] = useState<string | null>(null);

  const unlockPhone = (id: string) => {
    setUnlockedPhones((prev) => new Set(prev).add(id));
  };

  const unlockEmail = (id: string) => {
    setUnlockedEmails((prev) => new Set(prev).add(id));
  };

  // Claims integration
  const [claims, setClaims] = useState<Map<string, { daysRemaining: number }>>(new Map());
  const [claimPending, setClaimPending] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);

  const loadClaims = () => {
    fetch("/api/claims")
      .then((res) => (res.ok ? res.json() : { claims: [] }))
      .then((data) => {
        const map = new Map<string, { daysRemaining: number }>();
        for (const c of data.claims || []) {
          map.set(c.parcelId, { daysRemaining: c.daysRemaining });
        }
        setClaims(map);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadClaims();
  }, []);

  // Layout toggles
  const [hideFilters, setHideFilters] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jurisdiction: true,
    permit: true,
    age: true,
    risk: true,
    value: true,
    owner: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const q = useDebounced(search);
  const lo = useDebounced(minVal);

  // Queries
  const page = useEngine(
    "permits/roof-aging-alarm",
    {
      jurisdiction,
      zone,
      permit_status: permitStatus,
      risk_tier: tier,
      min_age: minAge,
      min_valuation: lo,
      search: q,
      limit: LIMIT,
      offset,
    },
    mapAging,
    record === "aged"
  );

  const dark = useEngine(
    "parcels/dark-market/overdue",
    {
      min_age: minAge,
      zone,
      search: q,
      limit: LIMIT,
      offset,
      jurisdiction,
      include_public: includePublic,
    },
    mapDarkMarket,
    record === "never"
  );

  // Filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (record === "aged") {
      if (permitStatus !== "all") count++;
      if (tier) count++;
      if (minAge !== 15) count++;
      if (minVal) count++;
      if (search) count++;
    } else {
      if (includePublic) count++;
      if (minAge !== 15) count++;
      if (search) count++;
    }
    return count;
  }, [record, permitStatus, tier, minAge, minVal, search, includePublic]);

  const clearAllFilters = () => {
    setPermitStatus("all");
    setTier("");
    setMinAge(15);
    setMinVal("");
    setSearch("");
    setIncludePublic(false);
    setSortBy("default");
    setOffset(0);
  };

  // Territory subscription memo calculations
  const isSuperAdmin = userRole === "superadmin";
  const subscribedTerritories = useMemo(() => territories.filter((t) => t.isSubscribed), [territories]);
  const selectedTerritory = useMemo(() => territories.find((t) => t.id === zone), [territories, zone]);

  const isLocked = useMemo(() => {
    if (isSuperAdmin) return false;
    if (zone === "none") return true;
    if (record === "aged") {
      if (page.data?.noActiveTerritory || page.data?.unauthorizedZone) return true;
    } else {
      if (dark.data?.noActiveTerritory || dark.data?.unauthorizedZone) return true;
    }
    if (territoriesLoaded && zone !== "all") {
      if (!subscribedTerritories.some((t) => t.id === zone)) return true;
    }
    if (territoriesLoaded && zone === "all" && subscribedTerritories.length === 0) return true;
    return false;
  }, [isSuperAdmin, zone, record, page.data, dark.data, territoriesLoaded, subscribedTerritories]);

  const zoneNameDisplay = useMemo(() => {
    if (zone === "all") return isSuperAdmin ? "All Dallas Metro ⭐" : "All Subscribed Zones";
    if (zone === "none") return "No Active Zone 🔒";
    const t = territories.find((item) => item.id === zone);
    if (t) return `${t.name}${t.isSubscribed ? " ⭐" : " 🔒"}`;
    if (zone === "dallas-central-uptown") return "Central / Uptown / CBD ⭐";
    return zone;
  }, [zone, isSuperAdmin, territories]);

  // Sorted data lists
  const sortedRoofs = useMemo(() => {
    if (isLocked) return [];
    let list = [...(page.data?.roofs || [])];
    if (permitStatus === "permitted") {
      list = list.filter((r) => (r.permitCount && r.permitCount > 0) || r.permitStatus === "permitted");
    } else if (permitStatus === "unpermitted") {
      list = list.filter((r) => (!r.permitCount || r.permitCount === 0) || r.permitStatus === "unpermitted");
    }
    if (sortBy === "age") list.sort((a, b) => (b.age || 0) - (a.age || 0));
    else if (sortBy === "cost") list.sort((a, b) => (b.replacementCost || 0) - (a.replacementCost || 0));
    else if (sortBy === "priority") list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return list;
  }, [page.data?.roofs, permitStatus, sortBy, isLocked]);

  const sortedParcels = useMemo(() => {
    if (isLocked) return [];
    const list = [...(dark.data?.parcels || [])];
    if (sortBy === "age") list.sort((a, b) => (b.age || 0) - (a.age || 0));
    else if (sortBy === "sqft") list.sort((a, b) => (b.sqft || 0) - (a.sqft || 0));
    else if (sortBy === "cost") list.sort((a, b) => (b.reroofValue || 0) - (a.reroofValue || 0));
    return list;
  }, [dark.data?.parcels, sortBy, isLocked]);

  // Selection helpers
  const currentIds = useMemo(() => {
    if (isLocked) return [];
    if (record === "aged") return sortedRoofs.map((r) => r.id);
    return sortedParcels.map((p) => p.parcelId);
  }, [record, sortedRoofs, sortedParcels, isLocked]);

  const isAllSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentIds));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  const claimSelected = async () => {
    if (isLocked) {
      alert("Your organization does not have an active subscription for this territory. Subscribe to this zone in Territories first.");
      return;
    }
    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) {
      alert("Please select one or more properties using the checkboxes.");
      return;
    }
    setClaimPending(true);
    let claimedCount = 0;
    let lastError = "";

    for (const id of targetIds) {
      try {
        const res = await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parcelId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          claimedCount++;
        } else {
          lastError = data.error || "Claim limit reached or already claimed";
        }
      } catch {
        lastError = "Network error claiming property";
      }
    }
    setClaimPending(false);
    loadClaims();
    if (claimedCount > 0) {
      setClaimSuccessMsg(`Claimed ${claimedCount} property${claimedCount > 1 ? "ies" : ""}! Locked to your company for 21 days.`);
    } else if (lastError) {
      alert(lastError);
    }
  };

  const claimOne = async (id: string, label: string) => {
    if (isLocked) {
      alert("Your organization does not have an active subscription for this territory. Subscribe to this zone in Territories first.");
      return;
    }
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setClaimSuccessMsg(`Successfully claimed ${label || "property"}! Locked for 21 days.`);
        loadClaims();
      } else {
        alert(data.error || "Failed to claim property");
      }
    } catch {
      alert("Error claiming property");
    }
  };

  // Pagination totals
  const total = record === "aged" ? (page.data?.total ?? 0) : (dark.data?.total ?? 0);
  const pageIndex = Math.floor(offset / LIMIT);
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LIMIT, total);

  const [previewSkeleton, setPreviewSkeleton] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has("preview_skeleton")) {
        setPreviewSkeleton(true);
      }
    }
  }, []);

  const isDataLoading = record === "aged" ? page.loading : dark.loading;
  const isLoading = isDataLoading || previewSkeleton;
  const isError = record === "aged" ? page.error : dark.error;

  return (
    <div data-tour="roof-aging-container" className="flex h-[calc(100vh-3.5rem)] flex-col bg-background dark:bg-[#0b0c10] text-foreground dark:text-neutral-200 overflow-hidden font-sans text-xs select-none">
      {/* Top Header Section - Fixed */}
      <div className="shrink-0 border-b border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f12] px-5 py-3.5 z-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Aging Roof</h1>
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700/50 flex items-center gap-1.5">
                <Shield className="size-3 text-sky-400" />
                {jurisdiction}
              </span>
              {jurisdiction.includes("Dallas") && zone && (
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium flex items-center gap-1 border",
                  isLocked
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                )}>
                  <span>Zone:</span>
                  <strong className="font-semibold">
                    {zoneNameDisplay}
                  </strong>
                </span>
              )}
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-semibold border",
                isLocked
                  ? "border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88]"
                  : record === "aged"
                  ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/15 text-emerald-800 dark:text-[#B4E4D6]"
                  : "border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88]"
              )}>
                {isLocked ? "Locked Zone" : record === "aged" ? "Permitted Cohort" : "Dark Market"}
              </span>
            </div>
            <p className="text-xs font-medium text-rose-600 dark:text-[#DE7272]">
              Identify commercial facilities with unreplaced membranes past 20–35+ years and verified historical hail exposure.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick KPI stats pills */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              {record === "aged" ? (
                <>
                  <div className="rounded-md border border-border dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#121319] px-2.5 py-1 text-center">
                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 uppercase font-medium">Aging Roofs</span>
                    <p className="text-xs font-bold text-foreground dark:text-white">{page.data && !isLocked ? num(page.data.total) : "—"}</p>
                  </div>
                  <div className="rounded-md border border-border dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#121319] px-2.5 py-1 text-center">
                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 uppercase font-medium">Expired 20y+</span>
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100 flex items-center justify-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#DE7272]" />
                      <span className="text-[#DE7272]">{page.data && !isLocked ? num(page.data.critical) : "—"}</span>
                    </p>
                  </div>
                  <div className="rounded-md border border-border dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#121319] px-2.5 py-1 text-center">
                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 uppercase font-medium">Approaching</span>
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100 flex items-center justify-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#FFCA88]" />
                      <span className="text-amber-700 dark:text-[#FFCA88]">{page.data && !isLocked ? num(page.data.approaching) : "—"}</span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-md border border-border dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#121319] px-2.5 py-1 text-center">
                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 uppercase font-medium">No Permit</span>
                    <p className="text-xs font-bold text-amber-700 dark:text-[#FFCA88]">{dark.data && !isLocked ? num(dark.data.total) : "—"}</p>
                  </div>
                  <div className="rounded-md border border-border dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#121319] px-2.5 py-1 text-center">
                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 uppercase font-medium">Pipeline</span>
                    <p className="text-xs font-bold text-emerald-700 dark:text-[#B4E4D6]">{!isLocked && (dark.data?.pipelineFormatted || (dark.data?.pipelineUSD ? usd(dark.data.pipelineUSD, true) : "…")) || "—"}</p>
                  </div>
                  <div className="rounded-md border border-border dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#121319] px-2.5 py-1 text-center">
                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 uppercase font-medium">Min Age</span>
                    <p className="text-xs font-bold text-amber-600 dark:text-[#FFF6A9]">{minAge} yrs</p>
                  </div>
                </>
              )}
            </div>

            <Button
              size="sm"
              variant="brand"
              disabled={claimPending || isLocked || selectedIds.size === 0}
              onClick={claimSelected}
              className="h-8 gap-1.5 px-3 text-xs disabled:opacity-40"
            >
              <Lock className="size-3.5" />
              <span>{claimPending ? "Claiming..." : `Add to My Claims ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Claim Success Banner */}
      {claimSuccessMsg && (
        <div className="shrink-0 flex items-center justify-between border-b border-[#B4E4D6]/20 bg-[#B4E4D6]/5 px-5 py-2 text-xs text-neutral-200 z-20">
          <div className="flex items-center gap-2">
            <Check className="size-3.5 text-[#B4E4D6]" />
            <span>{claimSuccessMsg}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/claims"
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800/80 px-2 py-0.5 text-[11px] font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              View in My Claims
              <ChevronRight className="size-3 text-neutral-400" />
            </Link>
            <button
              type="button"
              onClick={() => setClaimSuccessMsg(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Action & Filter Sub-Bar - Fixed */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#111216] px-5 py-2.5 text-xs z-20">
        {/* Left Side: Toggle Sidebar & Search */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setHideFilters((prev) => !prev)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 px-2.5 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <Filter className="size-3 text-neutral-500 dark:text-neutral-400" />
            <span>{hideFilters ? "Show Filters" : "Hide Filters"}</span>
          </button>

          {/* Search Input */}
          <div className="relative min-w-[260px] sm:min-w-[340px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder={record === "aged" ? "Search address or contractor…" : "Search address or owner…"}
              className="h-8 w-full rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#16171d] pl-8 pr-3 text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none transition-colors focus:border-neutral-500 dark:focus:border-neutral-700 focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Sorting & Reset */}
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="h-8 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 px-2.5 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Reset filters ({activeFiltersCount})
            </button>
          )}

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900/80 pl-2.5 pr-7 font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white outline-none cursor-pointer"
            >
              <option value="default">⇅ Default Sort</option>
              <option value="age">⇅ Roof Age (Oldest)</option>
              {record === "aged" && <option value="cost">⇅ Est. Replacement Cost</option>}
              {record === "aged" && <option value="priority">⇅ Priority Score</option>}
              {record === "never" && <option value="sqft">⇅ Building Sq ft</option>}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-neutral-500" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Filter Sidebar - Fixed */}
        {!hideFilters && (
          <aside className="w-64 shrink-0 border-r border-border dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-[#0d0e12] p-3 text-xs flex flex-col justify-between overflow-y-auto h-full z-10">
            <div className="space-y-4">
              {/* Segmented Count Tabs: Aged vs Never */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-[#13141a] p-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setRecord("aged");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    record === "aged"
                      ? "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6] font-semibold shadow-sm"
                      : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">Aged Roofs</span>
                  <span className="text-xs font-semibold">{page.data ? num(page.data.total) : "…"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecord("never");
                    setOffset(0);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-md py-1.5 transition-colors border",
                    record === "never"
                      ? "border-[#FFCA88]/50 bg-[#FFCA88]/20 text-amber-800 dark:text-[#FFCA88] font-semibold shadow-sm"
                      : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider">No Permit</span>
                  <span className="text-xs font-semibold">{dark.data ? num(dark.data.total) : "…"}</span>
                </button>
              </div>

              {/* Accordion Filter Items */}
              <div className="space-y-2.5">
                {/* 1. Jurisdiction / Location */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("jurisdiction")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                      <span>Territory</span>
                    </div>
                    {openSections.jurisdiction ? (
                      <ChevronDown className="size-3 text-neutral-500" />
                    ) : (
                      <ChevronRight className="size-3 text-neutral-500" />
                    )}
                  </button>

                  {openSections.jurisdiction && (
                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center gap-1.5 rounded border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/80 px-2 py-1.5 text-[11px] text-neutral-700 dark:text-neutral-300">
                        <Shield className="size-3.5 text-[#B4E4D6] shrink-0" />
                        <span>Active territory: <strong className="text-foreground dark:text-white">{jurisdiction}</strong></span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {SERVED_AREAS.map((a) => (
                          <button
                            key={a.label}
                            type="button"
                            onClick={() => {
                              setJurisdiction(a.label);
                              setOffset(0);
                            }}
                            className={cn(
                              "flex-1 min-w-[70px] rounded border px-2 py-1.5 text-center text-xs font-medium transition-colors",
                              jurisdiction === a.label
                                ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white border-neutral-300 dark:border-white/20 font-semibold shadow-sm"
                                : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            {a.city}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <select
                          value={jurisdiction}
                          onChange={(e) => {
                            setJurisdiction(e.target.value);
                            setOffset(0);
                          }}
                          className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-neutral-900 dark:text-neutral-200 outline-none focus:border-neutral-500 dark:focus:border-neutral-700 cursor-pointer"
                        >
                          {SERVED_AREAS.map((a) => (
                            <option key={a.label} value={a.label}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                      </div>

                      {/* Zone Selector for Dallas */}
                      {jurisdiction.includes("Dallas") && (
                        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                            <span>Dallas Zone</span>
                            {zone === "dallas-central-uptown" && (
                              <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold">100 Roofs</span>
                            )}
                          </div>
                          <div className="relative">
                            <select
                              value={zone}
                              onChange={(e) => {
                                setZone(e.target.value);
                                setOffset(0);
                              }}
                              className="h-8 w-full appearance-none rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] px-2.5 pr-7 text-xs text-neutral-900 dark:text-neutral-200 outline-none focus:border-neutral-500 dark:focus:border-neutral-700 cursor-pointer font-medium"
                            >
                              {territories.length > 0 ? (
                                <>
                                  {zone === "none" && (
                                    <option value="none">🔒 No Active Territory Subscriptions</option>
                                  )}
                                  <option value="all">
                                    {isSuperAdmin ? "⭐ All Dallas Metro (Super Admin)" : "All Subscribed Dallas Zones"}
                                  </option>
                                  {territories.map((t) => {
                                    const isSub = t.isSubscribed || isSuperAdmin;
                                    return (
                                      <option key={t.id} value={t.id}>
                                        {isSub ? `⭐ ${t.name} (Subscribed)` : `🔒 ${t.name} (Locked)`}
                                      </option>
                                    );
                                  })}
                                </>
                              ) : (
                                <>
                                  <option value="dallas-central-uptown">⭐ Central / Uptown / CBD (100 Roofs)</option>
                                  <option value="all">All Dallas Metro</option>
                                  <option value="dallas-north-corridor">North Dallas Corridor</option>
                                  <option value="dallas-east-lakelands">East Dallas / Lake Highlands</option>
                                  <option value="dallas-south-industrial">South Dallas Industrial</option>
                                  <option value="dallas-northwest-suburbs">Northwest / DFW Suburbs</option>
                                </>
                              )}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Permit History Filter (Permit vs No Permit) */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("permit")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                      <span>Permit History</span>
                    </div>
                    {openSections.permit ? (
                      <ChevronDown className="size-3 text-neutral-500" />
                    ) : (
                      <ChevronRight className="size-3 text-neutral-500" />
                    )}
                  </button>

                  {openSections.permit && (
                    <div className="mt-2.5 space-y-1.5">
                      {[
                        { id: "all", label: "All Roofs (Both)", desc: "Permitted & unpermitted CAD roofs", dot: "bg-neutral-400" },
                        { id: "permitted", label: "With Permit On File", desc: "Prior municipal reroof logged", dot: "bg-emerald-500" },
                        { id: "unpermitted", label: "No Permit On File", desc: "Zero city permits (Dark market)", dot: "bg-amber-500" },
                      ].map((item) => {
                        const isSelected = permitStatus === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setPermitStatus(item.id as any);
                              setOffset(0);
                            }}
                            className={cn(
                              "flex w-full items-start justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors border",
                              isSelected
                                ? item.id === "permitted"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold"
                                  : item.id === "unpermitted"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300 font-semibold"
                                    : "border-neutral-300 dark:border-neutral-700 bg-neutral-200/80 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold"
                                : "border-transparent text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#181922] hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <span className={cn("size-2 rounded-full shrink-0 mt-1", item.dot)} />
                              <div>
                                <span className="block leading-tight">{item.label}</span>
                                <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">{item.desc}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="size-3 text-current shrink-0 mt-1" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Minimum Roof Age */}
                <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("age")}
                    className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                      <span>Minimum Roof Age</span>
                    </div>
                    {openSections.age ? (
                      <ChevronDown className="size-3 text-neutral-500" />
                    ) : (
                      <ChevronRight className="size-3 text-neutral-500" />
                    )}
                  </button>

                  {openSections.age && (
                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      {[
                        { v: 10, cls: "border-[#B4E4D6]/50 bg-[#B4E4D6]/20 text-emerald-800 dark:text-[#B4E4D6]" },
                        { v: 15, cls: "border-[#FFF6A9]/50 bg-[#FFF6A9]/20 text-amber-800 dark:text-[#FFF6A9]" },
                        { v: 20, cls: "border-[#FFCA88]/50 bg-[#FFCA88]/20 text-amber-800 dark:text-[#FFCA88]" },
                        { v: 25, cls: "border-[#DE7272]/50 bg-[#DE7272]/20 text-red-800 dark:text-[#DE7272]" },
                      ].map(({ v, cls }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            setMinAge(v);
                            setOffset(0);
                          }}
                          className={cn(
                            "rounded border py-1.5 text-center text-xs font-medium transition-colors",
                            minAge === v
                              ? cn(cls, "font-semibold shadow-sm")
                              : "bg-neutral-100 dark:bg-[#181922] text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          {v}y+
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Risk Tier (Aged Cohort Only) */}
                {record === "aged" && (
                  <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSection("risk")}
                      className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                        <span>Risk Tier</span>
                      </div>
                      {openSections.risk ? (
                        <ChevronDown className="size-3 text-neutral-500" />
                      ) : (
                        <ChevronRight className="size-3 text-neutral-500" />
                      )}
                    </button>

                    {openSections.risk && (
                      <div className="mt-2.5 space-y-1.5">
                        {[
                          { id: "", label: "Any risk tier", dot: null, activeCls: "bg-neutral-200 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold" },
                          { id: "CRITICAL", label: "Critical · 20+ years", dot: "bg-[#DE7272]", activeCls: "bg-[#DE7272]/15 text-red-800 dark:text-[#DE7272] border border-[#DE7272]/30 font-semibold" },
                          { id: "HIGH", label: "High · 15–19 years", dot: "bg-[#FFCA88]", activeCls: "bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88] border border-[#FFCA88]/30 font-semibold" },
                          { id: "MODERATE", label: "Moderate · 10–14 years", dot: "bg-[#FFF6A9]", activeCls: "bg-[#FFF6A9]/15 text-amber-800 dark:text-[#FFF6A9] border border-[#FFF6A9]/30 font-semibold" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setTier(item.id);
                              setOffset(0);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors",
                              tier === item.id
                                ? item.activeCls
                                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#181922] hover:text-neutral-900 dark:hover:text-neutral-200"
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {item.dot && <span className={cn("size-1.5 rounded-full shrink-0", item.dot)} />}
                              {item.label}
                            </span>
                            {tier === item.id && <Check className="size-3 text-current" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Min Historical Value (Aged Cohort Only) */}
                {record === "aged" && (
                  <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSection("value")}
                      className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                        <span>Min Historical Value</span>
                      </div>
                      {openSections.value ? (
                        <ChevronDown className="size-3 text-neutral-500" />
                      ) : (
                        <ChevronRight className="size-3 text-neutral-500" />
                      )}
                    </button>

                    {openSections.value && (
                      <div className="mt-2.5">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
                            $
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={minVal}
                            onChange={(e) => {
                              setMinVal(e.target.value.replace(/[^\d.]/g, ""));
                              setOffset(0);
                            }}
                            placeholder="e.g. 50000"
                            className="h-8 w-full rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#0f1015] pl-6 pr-2 text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-neutral-500 dark:focus:border-neutral-700"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Owner Scope (Dark Market / Never Only) */}
                {record === "never" && (
                  <div className="rounded-md border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#121319] p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSection("owner")}
                      className="flex w-full items-center justify-between text-neutral-800 dark:text-neutral-200 font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                        <span>Owner Scope</span>
                      </div>
                      {openSections.owner ? (
                        <ChevronDown className="size-3 text-neutral-500" />
                      ) : (
                        <ChevronRight className="size-3 text-neutral-500" />
                      )}
                    </button>

                    {openSections.owner && (
                      <div className="mt-2.5 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIncludePublic(false);
                            setOffset(0);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors",
                            !includePublic
                              ? "bg-neutral-200 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#181922] hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          <span>Private owners only</span>
                          {!includePublic && <Check className="size-3 text-foreground dark:text-white" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIncludePublic(true);
                            setOffset(0);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors",
                            includePublic
                              ? "bg-neutral-200 dark:bg-white/10 text-neutral-900 dark:text-white font-semibold"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#181922] hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          <span>Including public owners</span>
                          {includePublic && <Check className="size-3 text-foreground dark:text-white" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Bottom Reset */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#14151b] py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <RotateCcw className="size-3" />
                <span>Reset all filters</span>
              </button>
            )}
          </aside>
        )}

        {/* Main Table Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-background dark:bg-[#0b0c10] overflow-hidden">
          {/* Scrollable Table View */}
          <div className="min-w-0 flex-1 overflow-auto relative">
            {isLoading && (
              <div className="sticky top-0 z-30 h-0.5 w-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div className="h-full w-1/3 bg-neutral-900 dark:bg-white animate-[shimmer-slide_1.2s_infinite_ease-in-out]" />
              </div>
            )}

            {isError ? (
              <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertTriangle className="size-8 text-amber-500" />
                <p className="text-sm font-semibold text-foreground dark:text-neutral-200">Unable to load data</p>
                <p className="max-w-md text-xs text-muted-foreground dark:text-neutral-400">{isError}</p>
                <button
                  type="button"
                  onClick={() => (record === "aged" ? page.retry() : dark.retry())}
                  className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  Try again
                </button>
              </div>
            ) : isLocked ? (
              <div className="flex min-h-[460px] flex-col items-center justify-center p-8 text-center">
                <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl border border-[#FFCA88]/40 bg-[#FFCA88]/15 dark:bg-[#FFCA88]/10 shadow-sm">
                  <Lock className="size-8 text-amber-600 dark:text-[#FFCA88]" />
                  <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[#DE7272] text-[10px] font-bold text-white shadow-sm">
                    !
                  </div>
                </div>

                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {zone === "none"
                    ? "No Active Territory Subscription"
                    : `Territory Locked: ${selectedTerritory?.name || zoneNameDisplay}`}
                </h3>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground dark:text-neutral-400">
                  {zone === "none"
                    ? "Your organization does not have an active territory subscription. Choose an available commercial territory to unlock 20+ year roof aging alarms, verified ownership records, and contractor replacement cycles."
                    : `Access to commercial roof aging alarms, verified ownership dossiers, and direct phone/email intelligence in ${selectedTerritory?.name || "this zone"} requires an active territory subscription.`}
                </p>

                <div className="my-6 grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-3 text-left">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 p-3">
                    <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-200">100+ Commercial Roofs</span>
                    <p className="mt-1 text-[10px] text-muted-foreground dark:text-neutral-400">20y+ aged roofs scored by risk tier & install history</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 p-3">
                    <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-200">Verified Direct Contacts</span>
                    <p className="mt-1 text-[10px] text-muted-foreground dark:text-neutral-400">True property decision makers with phone & email</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 p-3">
                    <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-200">30-Day Exclusive Lock</span>
                    <p className="mt-1 text-[10px] text-muted-foreground dark:text-neutral-400">Claim properties to protect them from competitors</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/territories"
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-900 dark:bg-white px-4 text-xs font-semibold text-white dark:text-neutral-900 shadow hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                  >
                    <span>View Territory Subscriptions & Pricing</span>
                    <ChevronRight className="size-3.5" />
                  </Link>

                  {subscribedTerritories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setZone(subscribedTerritories[0].id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border dark:border-neutral-700 bg-background dark:bg-neutral-900 px-3 text-xs font-medium text-foreground dark:text-neutral-200 hover:bg-muted dark:hover:bg-neutral-800 transition-colors"
                    >
                      <span>Switch to {subscribedTerritories[0].name}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : record === "aged" ? (
              /* AGED ROOFS TABLE */
              sortedRoofs.length === 0 && !isLoading ? (
                <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground dark:text-neutral-400">
                  <Layers className="size-8 text-neutral-400 dark:text-neutral-600" />
                  <p className="text-sm font-medium text-foreground dark:text-neutral-300">No aging roofs match the active criteria</p>
                  <p className="text-xs text-muted-foreground dark:text-neutral-500">Try broadening your minimum age or clearing active filters.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  {/* Sticky Table Header */}
                  <thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#12131a] text-neutral-700 dark:text-neutral-300 font-semibold text-[11px] uppercase tracking-wider border-b border-border dark:border-neutral-800">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          disabled={isLoading}
                          className="hover:text-foreground dark:hover:text-white transition-colors disabled:opacity-40"
                          title="Select all on this page"
                        >
                          {isAllSelected ? (
                            <CheckSquare className="size-3.5 text-sky-500" />
                          ) : (
                            <Square className="size-3.5 text-neutral-400 dark:text-neutral-500" />
                          )}
                        </button>
                      </th>
                      <th className="sticky left-0 z-10 bg-neutral-100 dark:bg-[#12131a] px-3 py-2.5 min-w-[220px]">
                        Address
                      </th>
                      <th className="px-3 py-2.5 min-w-[90px]">Risk</th>
                      <th className="px-3 py-2.5 text-right min-w-[70px]">Age</th>
                      <th className="px-3 py-2.5 min-w-[200px]">Owner / Entity</th>
                      <th className="px-3 py-2.5 min-w-[220px]">Contact & Phone / Email</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Mailing Address</th>
                      <th className="px-3 py-2.5 min-w-[100px]">Installed</th>
                      <th className="px-3 py-2.5 min-w-[140px]">Roof System</th>
                      <th className="px-3 py-2.5 min-w-[160px]">Last Contractor</th>
                      <th className="px-3 py-2.5 text-right min-w-[80px]">Priority</th>
                      <th className="px-3 py-2.5 text-right min-w-[130px]">Est. Replacement</th>
                      <th className="px-3 py-2.5 min-w-[100px]">Jurisdiction</th>
                      <th className="px-3 py-2.5 pr-4 text-right min-w-[110px]">Actions</th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-border dark:divide-neutral-800/60 font-normal">
                    {isLoading ? (
                      <RoofAgingAgedSkeletonRows />
                    ) : (
                      sortedRoofs.map((r) => {
                      const isSelected = selectedIds.has(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "group border-b border-border dark:border-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-[#161722]/80 transition-colors",
                            isSelected && "bg-neutral-100/80 dark:bg-white/[0.03] border-l-2 border-[#B4E4D6]"
                          )}
                        >
                          {/* Selection Checkbox */}
                          <td className="w-10 px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectOne(r.id)}
                              className="hover:text-foreground dark:hover:text-white transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="size-3.5 text-[#B4E4D6]" />
                              ) : (
                                <Square className="size-3.5 text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-700 dark:group-hover:text-neutral-400" />
                              )}
                            </button>
                          </td>

                          {/* Address (Sticky Left) */}
                          <td className="sticky left-0 z-10 bg-background dark:bg-[#0b0c10] group-hover:bg-neutral-50 dark:group-hover:bg-[#161722] px-3 py-3 font-medium transition-colors">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-[260px]">
                              <button
                                type="button"
                                onClick={() => setSelectedDrawerParcel(r.id)}
                                className="text-foreground dark:text-white hover:underline block truncate max-w-[190px] text-left cursor-pointer font-medium"
                                title={`${r.address} — click to view lead dossier & details`}
                              >
                                {r.address}
                              </button>
                              {Boolean(
                                (r.zipCode && turfZips.includes(r.zipCode.slice(0, 5))) ||
                                (r.address && turfZips.some((z) => r.address.includes(z)))
                              ) && (
                                <span className="inline-flex items-center gap-0.5 rounded border border-[#B4E4D6]/50 bg-[#B4E4D6]/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:text-[#B4E4D6] shrink-0">
                                  <Shield className="size-2.5" />
                                  Home Turf
                                </span>
                              )}
                            </div>
                            <span className="block text-[11px] text-muted-foreground dark:text-neutral-400 truncate max-w-[240px]">
                              {r.jurisdiction} · {r.permitCount && r.permitCount > 0 ? (
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium font-mono">
                                  {r.permitNumber && !r.permitNumber.startsWith("DCAD-") ? `permit ${r.permitNumber}` : `${r.permitCount} permit(s) on file`}
                                </span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400 font-medium font-mono">
                                  Unpermitted CAD roof
                                </span>
                              )}
                              {r.laterPermits && r.laterPermits > 0 ? ` · ${r.laterPermits} later permits` : ""}
                            </span>
                          </td>

                          {/* Risk */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <RiskBadge value={r.risk} />
                          </td>

                          {/* Age */}
                          <td className={cn(
                            "px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap font-medium",
                            r.age >= 25 ? "text-red-700 dark:text-[#DE7272]" : r.age >= 20 ? "text-amber-700 dark:text-[#FFCA88]" : r.age >= 15 ? "text-amber-600 dark:text-[#FFF6A9]" : "text-foreground dark:text-neutral-200"
                          )}>
                            {r.age} yrs
                          </td>

                          {/* Owner / Entity */}
                          <td className="px-3 py-3 max-w-64 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {r.logoUrl ? (
                                <RealLogo url={r.logoUrl} alt={r.ownerName || "Entity"} size={20} />
                              ) : null}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium text-neutral-900 dark:text-neutral-200" title={r.ownerName || ""}>
                                  {r.ownerName || "Commercial Owner"}
                                </span>
                                {r.websiteUrl ? (
                                  <a
                                    href={r.websiteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-mono"
                                    title={r.websiteUrl}
                                  >
                                    <span>{r.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                                    <ExternalLink className="size-2.5 opacity-60" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          {/* Contact & Phone / Email (Opportunity Pipeline style) */}
                          <td className="px-3 py-3 max-w-64 whitespace-nowrap">
                            {r.decisionMaker || r.phone || r.email ? (
                              <div className="flex flex-col text-xs leading-tight gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-neutral-900 dark:text-neutral-200 truncate">
                                    {r.decisionMaker || "Decision Maker"}
                                  </span>
                                  {r.decisionMakerTitle ? (
                                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 truncate max-w-28 font-normal">
                                      · {r.decisionMakerTitle}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {r.phone ? (
                                    unlockedPhones.has(r.id) ? (
                                      <a
                                        href={`tel:${r.phone}`}
                                        className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium hover:underline inline-flex items-center gap-1"
                                        title="Click to call"
                                      >
                                        <Phone className="size-2.5" />
                                        <span>{r.phone}</span>
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => unlockPhone(r.id)}
                                        className="inline-flex items-center gap-1 rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300 dark:border-neutral-700/80 px-1.5 py-0.5 text-[10px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                                        title="Reveal direct phone number"
                                      >
                                        <Phone className="size-2.5" />
                                        <span>Access phone</span>
                                      </button>
                                    )
                                  ) : null}

                                  {r.email ? (
                                    unlockedEmails.has(r.id) ? (
                                      <a
                                        href={`mailto:${r.email}`}
                                        className="font-mono text-[11px] text-sky-700 dark:text-sky-400 font-medium hover:underline inline-flex items-center gap-1"
                                        title="Click to email"
                                      >
                                        <Mail className="size-2.5" />
                                        <span>{r.email}</span>
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => unlockEmail(r.id)}
                                        className="inline-flex items-center gap-1 rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300 dark:border-neutral-700/80 px-1.5 py-0.5 text-[10px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                                        title="Reveal direct email address"
                                      >
                                        <Mail className="size-2.5" />
                                        <span>Access email</span>
                                      </button>
                                    )
                                  ) : (
                                    <a
                                      href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent([r.decisionMaker, r.ownerName, "Dallas TX"].filter(Boolean).join(" "))}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-medium"
                                    >
                                      <span>Find on LinkedIn</span>
                                      <ExternalLink className="size-2.5 opacity-70" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent([r.ownerName, r.address, "Dallas TX"].filter(Boolean).join(" "))}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-neutral-400 dark:text-neutral-500 hover:text-sky-500 dark:hover:text-sky-400 inline-flex items-center gap-1"
                                  title="Search LinkedIn for property management/owner"
                                >
                                  <span>Lookup LinkedIn</span>
                                  <ExternalLink className="size-2.5 opacity-60" />
                                </a>
                              </div>
                            )}
                          </td>

                          {/* Mailing Address */}
                          <td className="px-3 py-3 max-w-60 truncate whitespace-nowrap text-muted-foreground dark:text-neutral-400" title={r.ownerMail || "No mailing address on record"}>
                            {r.ownerMail || "—"}
                          </td>

                          {/* Installed */}
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground dark:text-neutral-300">
                            {r.installed ? shortDate(r.installed) : "—"}
                          </td>

                          {/* Roof System */}
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground dark:text-neutral-300">
                            {r.roofSystem || "—"}
                          </td>

                          {/* Last Contractor */}
                          <td className="px-3 py-3 whitespace-nowrap max-w-56 truncate">
                            <ContractorLink name={r.contractor} />
                          </td>

                          {/* Priority */}
                          <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-muted-foreground dark:text-neutral-300">
                            {r.priority || "—"}
                          </td>

                          {/* Est. Replacement */}
                          <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-foreground dark:text-neutral-100 font-medium">
                            {r.replacementCost ? usd(r.replacementCost, true) : "—"}
                          </td>

                          {/* Jurisdiction */}
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground dark:text-neutral-400">
                            {r.jurisdiction}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 pr-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {claims.has(r.id) ? (
                                <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 px-2 text-[11px] font-medium text-emerald-800 dark:text-[#B4E4D6]" title={`Claimed (${claims.get(r.id)?.daysRemaining}d remaining)`}>
                                  <Lock className="size-3 text-[#B4E4D6]" />
                                  Claimed ({claims.get(r.id)?.daysRemaining}d)
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => claimOne(r.id, r.address)}
                                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border dark:border-neutral-700/80 bg-background dark:bg-neutral-900 px-2.5 text-xs font-medium text-foreground dark:text-neutral-200 hover:bg-muted dark:hover:bg-neutral-800 hover:text-foreground dark:hover:text-white transition-all shadow-sm"
                                  title="Add to My Claims (21-day exclusive lock)"
                                >
                                  <Lock className="size-3 text-muted-foreground dark:text-neutral-400" />
                                  Add to My Claims
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDrawerParcel(r.id)}
                                className="inline-flex h-7 items-center rounded-md border border-border dark:border-neutral-700/80 bg-background dark:bg-neutral-900 px-2.5 text-xs font-medium text-foreground dark:text-neutral-300 hover:bg-muted dark:hover:bg-neutral-800 hover:text-foreground dark:hover:text-white transition-colors cursor-pointer"
                              >
                                View details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              )
            ) : (
              /* DARK MARKET (NEVER PERMITTED) TABLE */
              sortedParcels.length === 0 && !isLoading ? (
                <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground dark:text-neutral-400">
                  <Layers className="size-8 text-neutral-400 dark:text-neutral-600" />
                  <p className="text-sm font-medium text-foreground dark:text-neutral-300">No overdue buildings found</p>
                  <p className="text-xs text-muted-foreground dark:text-neutral-500">Try adjusting minimum building age or owner scope.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  {/* Sticky Table Header */}
                  <thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-[#12131a] text-neutral-700 dark:text-neutral-300 font-semibold text-[11px] uppercase tracking-wider border-b border-border dark:border-neutral-800">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          disabled={isLoading}
                          className="hover:text-foreground dark:hover:text-white transition-colors disabled:opacity-40"
                          title="Select all on this page"
                        >
                          {isAllSelected ? (
                            <CheckSquare className="size-3.5 text-sky-500" />
                          ) : (
                            <Square className="size-3.5 text-neutral-400 dark:text-neutral-500" />
                          )}
                        </button>
                      </th>
                      <th className="sticky left-0 z-10 bg-neutral-100 dark:bg-[#12131a] px-3 py-2.5 min-w-[220px]">
                        Address
                      </th>
                      <th className="px-3 py-2.5 min-w-[180px]">Owner / Entity</th>
                      <th className="px-3 py-2.5 min-w-[220px]">Contact & Phone / Email</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Mailing Address</th>
                      <th className="px-3 py-2.5 text-right min-w-[70px]">Age</th>
                      <th className="px-3 py-2.5 text-right min-w-[80px]">Sq ft</th>
                      <th className="px-3 py-2.5 text-right min-w-[80px]">Year Built</th>
                      <th className="px-3 py-2.5 min-w-[120px]">Status</th>
                      <th className="px-3 py-2.5 text-right min-w-[130px]">Est. Replacement</th>
                      <th className="px-3 py-2.5 min-w-[100px]">Jurisdiction</th>
                      <th className="px-3 py-2.5 pr-4 text-right min-w-[120px]">Actions</th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-border dark:divide-neutral-800/60 font-normal">
                    {isLoading ? (
                      <RoofAgingNeverSkeletonRows />
                    ) : (
                      sortedParcels.map((p) => {
                        const isSelected = selectedIds.has(p.parcelId);
                      return (
                        <tr
                          key={p.parcelId}
                          className={cn(
                            "group border-b border-border dark:border-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-[#161722]/80 transition-colors",
                            isSelected && "bg-neutral-100/80 dark:bg-white/[0.03] border-l-2 border-[#FFCA88]"
                          )}
                        >
                          {/* Selection Checkbox */}
                          <td className="w-10 px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectOne(p.parcelId)}
                              className="hover:text-foreground dark:hover:text-white transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="size-3.5 text-[#FFCA88]" />
                              ) : (
                                <Square className="size-3.5 text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-700 dark:group-hover:text-neutral-400" />
                              )}
                            </button>
                          </td>

                          {/* Address (Sticky Left) */}
                          <td className="sticky left-0 z-10 bg-background dark:bg-[#0b0c10] group-hover:bg-neutral-50 dark:group-hover:bg-[#161722] px-3 py-3 font-medium transition-colors">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-[260px]">
                              <button
                                type="button"
                                onClick={() => setSelectedDrawerParcel(p.parcelId)}
                                className="text-foreground dark:text-white hover:underline block truncate max-w-[190px] text-left cursor-pointer font-medium"
                                title={`${p.address || p.parcelId} — click to view lead dossier & details`}
                              >
                                {p.address || p.parcelId}
                              </button>
                              {Boolean(
                                (p.zipCode && turfZips.includes(p.zipCode.slice(0, 5))) ||
                                (p.address && turfZips.some((z) => p.address.includes(z)))
                              ) && (
                                <span className="inline-flex items-center gap-0.5 rounded border border-[#B4E4D6]/50 bg-[#B4E4D6]/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:text-[#B4E4D6] shrink-0">
                                  <Shield className="size-2.5" />
                                  Home Turf
                                </span>
                              )}
                            </div>
                            <span className="block text-[11px] text-muted-foreground dark:text-neutral-400 truncate max-w-[240px]">
                              {p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")} · {p.parcelId}
                            </span>
                          </td>

                          {/* Owner / Entity */}
                          <td className="px-3 py-3 max-w-64 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {p.logoUrl ? (
                                <RealLogo url={p.logoUrl} alt={p.owner || "Entity"} size={20} />
                              ) : null}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium text-neutral-900 dark:text-neutral-200" title={p.owner || ""}>
                                  {p.owner || "Commercial Owner"}
                                </span>
                                {p.websiteUrl ? (
                                  <a
                                    href={p.websiteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-mono"
                                    title={p.websiteUrl}
                                  >
                                    <span>{p.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                                    <ExternalLink className="size-2.5 opacity-60" />
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          {/* Contact & Phone / Email (Opportunity Pipeline style) */}
                          <td className="px-3 py-3 max-w-64 whitespace-nowrap">
                            {p.decisionMaker || p.phone || p.email ? (
                              <div className="flex flex-col text-xs leading-tight gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-neutral-900 dark:text-neutral-200 truncate">
                                    {p.decisionMaker || "Decision Maker"}
                                  </span>
                                  {p.decisionMakerTitle ? (
                                    <span className="text-[10px] text-muted-foreground dark:text-neutral-400 truncate max-w-28 font-normal">
                                      · {p.decisionMakerTitle}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {p.phone ? (
                                    unlockedPhones.has(p.parcelId) ? (
                                      <a
                                        href={`tel:${p.phone}`}
                                        className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium hover:underline inline-flex items-center gap-1"
                                        title="Click to call"
                                      >
                                        <Phone className="size-2.5" />
                                        <span>{p.phone}</span>
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => unlockPhone(p.parcelId)}
                                        className="inline-flex items-center gap-1 rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300 dark:border-neutral-700/80 px-1.5 py-0.5 text-[10px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                                        title="Reveal direct phone number"
                                      >
                                        <Phone className="size-2.5" />
                                        <span>Access phone</span>
                                      </button>
                                    )
                                  ) : null}

                                  {p.email ? (
                                    unlockedEmails.has(p.parcelId) ? (
                                      <a
                                        href={`mailto:${p.email}`}
                                        className="font-mono text-[11px] text-sky-700 dark:text-sky-400 font-medium hover:underline inline-flex items-center gap-1"
                                        title="Click to email"
                                      >
                                        <Mail className="size-2.5" />
                                        <span>{p.email}</span>
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => unlockEmail(p.parcelId)}
                                        className="inline-flex items-center gap-1 rounded bg-neutral-100 dark:bg-[#16171d] border border-neutral-300 dark:border-neutral-700/80 px-1.5 py-0.5 text-[10px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
                                        title="Reveal direct email address"
                                      >
                                        <Mail className="size-2.5" />
                                        <span>Access email</span>
                                      </button>
                                    )
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground dark:text-neutral-500 italic">
                                Enriching contact…
                              </span>
                            )}
                          </td>

                          {/* Mailing Address */}
                          <td className="px-3 py-3 max-w-56 truncate whitespace-nowrap text-muted-foreground dark:text-neutral-400" title={p.ownerMail || "No mailing address on record"}>
                            {p.ownerMail || "—"}
                          </td>

                          {/* Age */}
                          <td className={cn(
                            "px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap font-medium",
                            p.age && p.age >= 25 ? "text-red-700 dark:text-[#DE7272]" : p.age && p.age >= 20 ? "text-amber-700 dark:text-[#FFCA88]" : p.age && p.age >= 15 ? "text-amber-600 dark:text-[#FFF6A9]" : "text-foreground dark:text-neutral-200"
                          )}>
                            {p.age ? `${p.age} yrs` : "—"}
                          </td>

                          {/* Sq ft */}
                          <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-foreground dark:text-neutral-300">
                            {p.sqft ? num(p.sqft) : "—"}
                          </td>

                          {/* Year Built */}
                          <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-foreground dark:text-neutral-300">
                            {p.yearBuilt || "—"}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            {(() => {
                              const u = (p.urgency || "").toUpperCase();
                              const isCrit = u.includes("CRITICAL") || u.includes("URGENT") || (p.age && p.age >= 25);
                              const isHigh = u.includes("HIGH") || (p.age && p.age >= 20);
                              const isMod = u.includes("MODERATE") || (p.age && p.age >= 15);
                              const pillCls = isCrit
                                ? "border-[#DE7272]/50 bg-[#DE7272]/15 text-red-800 dark:text-[#DE7272]"
                                : isHigh
                                  ? "border-[#FFCA88]/50 bg-[#FFCA88]/15 text-amber-800 dark:text-[#FFCA88]"
                                  : isMod
                                    ? "border-[#FFF6A9]/50 bg-[#FFF6A9]/15 text-amber-800 dark:text-[#FFF6A9]"
                                    : "border-border bg-muted/60 text-muted-foreground";
                              const dotCls = isCrit ? "bg-[#DE7272]" : isHigh ? "bg-[#FFCA88]" : isMod ? "bg-[#FFF6A9]" : "bg-neutral-500";
                              return (
                                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", pillCls)}>
                                  <span className={cn("size-1.5 rounded-full shrink-0", dotCls)} />
                                  {p.urgency || "Zero permit history"}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Est. Replacement */}
                          <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap text-foreground dark:text-neutral-100 font-medium">
                            {p.reroofValueFormatted || (p.reroofValue ? usd(p.reroofValue, true) : "—")}
                          </td>

                          {/* Jurisdiction */}
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground dark:text-neutral-400">
                            {p.jurisdiction || [p.city, p.state].filter(Boolean).join(", ")}
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 pr-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {claims.has(p.parcelId) ? (
                                <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#B4E4D6]/50 bg-[#B4E4D6]/20 px-2 text-[11px] font-medium text-emerald-800 dark:text-[#B4E4D6]" title={`Claimed (${claims.get(p.parcelId)?.daysRemaining}d remaining)`}>
                                  <Lock className="size-3 text-[#B4E4D6]" />
                                  Claimed ({claims.get(p.parcelId)?.daysRemaining}d)
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => claimOne(p.parcelId, p.address || p.parcelId)}
                                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border dark:border-neutral-700/80 bg-background dark:bg-neutral-900 px-2.5 text-xs font-medium text-foreground dark:text-neutral-200 hover:bg-muted dark:hover:bg-neutral-800 hover:text-foreground dark:hover:text-white transition-all shadow-sm"
                                  title="Add to My Claims (21-day exclusive lock)"
                                >
                                  <Lock className="size-3 text-muted-foreground dark:text-neutral-400" />
                                  Add to My Claims
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDrawerParcel(p.parcelId)}
                                className="inline-flex h-7 items-center rounded-md border border-border dark:border-neutral-700/80 bg-background dark:bg-neutral-900 px-2.5 text-xs font-medium text-foreground dark:text-neutral-300 hover:bg-muted dark:hover:bg-neutral-800 hover:text-foreground dark:hover:text-white transition-colors cursor-pointer"
                              >
                                View details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* Bottom Pagination Bar - Fixed */}
          <div className="shrink-0 flex items-center justify-between border-t border-border dark:border-neutral-800/80 bg-background dark:bg-[#0e0f14] px-5 py-3 text-xs text-muted-foreground dark:text-neutral-400 z-10">
            <div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-foreground dark:text-neutral-200">
                  <span className="size-2 rounded-full bg-[#B4E4D6] animate-ping" />
                  <span className="font-medium text-xs">Streaming {jurisdiction} roof aging alarms...</span>
                </div>
              ) : (
                <>
                  <span>
                    {isLocked ? "0 of 0 roofs" : `${from}–${to} of ${num(total)} roofs`}
                  </span>
                  <span className="text-muted-foreground/70 dark:text-neutral-500 ml-2 hidden sm:inline">
                    · Territory: {isLocked ? zoneNameDisplay : jurisdiction}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isLoading || isLocked || pageIndex === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                className="rounded border border-border dark:border-neutral-800 bg-background dark:bg-neutral-900 px-2.5 py-1 text-foreground dark:text-neutral-300 hover:bg-muted dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-1 text-foreground dark:text-neutral-400 font-medium">
                {isLoading ? "..." : isLocked ? "1 / 1" : `${pageIndex + 1} / ${pageCount}`}
              </span>
              <button
                type="button"
                disabled={isLoading || isLocked || pageIndex >= pageCount - 1}
                onClick={() => setOffset(offset + LIMIT)}
                className="rounded border border-border dark:border-neutral-800 bg-background dark:bg-neutral-900 px-2.5 py-1 text-foreground dark:text-neutral-300 hover:bg-muted dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Property & Lead Detailed Dossier Drawer */}
      <ParcelDetailDrawer
        parcelId={selectedDrawerParcel}
        onClose={() => setSelectedDrawerParcel(null)}
        titlePrefix="Roof Aging Lead Dossier"
      />
    </div>
  );
}
