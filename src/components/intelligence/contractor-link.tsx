"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { mapLeaderboard, type ContractorProfile } from "@/lib/engine-api";
import { useEngine } from "@/components/use-engine";

const IndexContext = createContext<{ index: Map<string, ContractorProfile>; loading: boolean }>({ index: new Map(), loading: true });

export function contractorKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function ContractorIndex({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const needsLogos = /^\/(permits|jobsites|roof-aging|multiphase|competitors|capital|property|parcels|contractors)(\/|$)/.test(path);
  const board = useEngine("contractors/leaderboard", { limit: 500 }, mapLeaderboard, needsLogos);
  const index = useMemo(() => {
    const map = new Map<string, ContractorProfile>();
    for (const contractor of board.data?.contractors ?? []) {
      for (const name of [contractor.name, ...contractor.aliases]) {
        const key = contractorKey(name);
        if (key && !map.has(key)) map.set(key, contractor);
      }
    }
    return map;
  }, [board.data]);
  return <IndexContext.Provider value={{ index, loading: board.loading }}>{children}</IndexContext.Provider>;
}

export function useContractor(name: string) {
  const { index, loading } = useContext(IndexContext);
  return { contractor: index.get(contractorKey(name)) ?? null, loading };
}

function Logo({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[9px] font-semibold">{name.slice(0, 2).toUpperCase()}</span>;
  }
  return <img src={url} alt="" width={20} height={20} className="size-5 shrink-0 rounded bg-white object-contain p-px" onError={() => setFailed(true)} />;
}

const UNNAMED = /^(not named|not on record|contractor not named|on municipal record|licensed commercial contractor|public record contractor|unknown contractor|unknown|self|—|-)?$/i;

export function ContractorLink({ name }: { name: string }) {
  const { contractor: known } = useContractor(name);
  const label = name.trim();
  if (!label || UNNAMED.test(label)) return <span className="text-muted-foreground">Contractor not named on the city extract</span>;
  const href = `/contractors/${encodeURIComponent(known?.name || label)}`;
  return (
    <Link href={href} className="inline-flex max-w-full items-center gap-2 hover:underline">
      <Logo url={known?.logoUrl ?? ""} name={label} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
