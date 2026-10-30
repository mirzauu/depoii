"use client";

import Link from "next/link";
import { use } from "react";
import { Info } from "lucide-react";
import { ContractorBody } from "@/components/contractor-dialog";
import { EngineLayout, EngineState } from "@/components/engine-layout";
import { useContractor } from "@/components/contractor-link";
import { mapContractorProfile, type ContractorProfile } from "@/lib/engine-api";
import { useEngine } from "@/components/use-engine";

function blank(name: string): ContractorProfile {
  return {
    id: name,
    name,
    license: "",
    permits: 0,
    valuation: 0,
    valuationLabel: "",
    share: 0,
    roofSystem: "",
    jurisdiction: "",
    aliases: [],
    recentPermitIds: [],
    website: "",
    logoUrl: "",
    hq: "",
    phone: "",
    founded: "",
    crew: "",
    certifications: [],
    leadership: [],
    ownership: "",
    acquisition: "",
    subcontracting: "",
    maNotes: "",
  };
}

export default function ContractorPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const decoded = decodeURIComponent(name);
  const { contractor: indexed } = useContractor(decoded);
  const profileQuery = useEngine(
    "contractors/profile",
    { name: decoded },
    mapContractorProfile,
    true,
  );
  const contractor = profileQuery.data ?? indexed ?? (profileQuery.loading ? null : blank(decoded));

  return (
    <EngineLayout
      title={decoded}
      subtitle="Contractor profile from the data engine, with verified external intelligence and permits filed under this name."
      actions={<Link href="/competitors" className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted">Leaderboard</Link>}
    >
      <div className="p-4 space-y-4">
        {/* Calibration Banner */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-[#FFCA88]">
              <Info className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-amber-900 dark:text-[#FFCA88]">
                  Contractor Data Updates Underway
                </p>
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-[#FFCA88]">
                  100% Verified by Nov 5
                </span>
              </div>
              <p className="text-xs text-amber-900/80 dark:text-[#FFCA88]/80 leading-relaxed">
                We are currently validating and cross-referencing all contractor permit volumes and contact records across North Texas. Complete, 100% verified intelligence will be ready by <strong>November 5th</strong>.
              </p>
            </div>
          </div>
        </div>

        <EngineState loading={!contractor && profileQuery.loading} error={profileQuery.error} empty={false} onRetry={profileQuery.retry}>
          {contractor && <ContractorBody contractor={contractor} hideTitle />}
        </EngineState>
      </div>
    </EngineLayout>
  );
}
