"use client";

import Link from "next/link";
import { use } from "react";
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
      <div className="p-4">
        <EngineState loading={!contractor && profileQuery.loading} error={profileQuery.error} empty={false} onRetry={profileQuery.retry}>
          {contractor && <ContractorBody contractor={contractor} hideTitle />}
        </EngineState>
      </div>
    </EngineLayout>
  );
}
