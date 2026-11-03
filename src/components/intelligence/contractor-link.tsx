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

function cleanBaseKey(name: string) {
  return contractorKey(
    name
      .split("(")[0]
      .replace(/\b(llc|l\.l\.c|inc|corp|co\.|company|roofing|roof|commercial|services|enterprises|builders|group)\b/gi, "")
  );
}

function extractDomain(urlOrName: string): string {
  if (!urlOrName) return "";
  try {
    const raw = urlOrName.trim();
    if (raw.includes(".") && !raw.includes(" ")) {
      const u = raw.startsWith("http") ? raw : "https://" + raw;
      const host = new URL(u).hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes(".")) return host;
    }
  } catch {}
  return "";
}

export function ContractorIndex({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const needsLogos = /^\/(permits|jobsites|roof-aging|multiphase|competitors|capital|property|parcels|contractors)(\/|$)/.test(path);
  const board = useEngine("contractors/leaderboard", { limit: 2000 }, mapLeaderboard, needsLogos);
  const index = useMemo(() => {
    const map = new Map<string, ContractorProfile>();
    for (const contractor of board.data?.contractors ?? []) {
      const candidates = [contractor.name, ...(contractor.aliases || [])];
      for (const name of candidates) {
        if (!name) continue;
        const key = contractorKey(name);
        if (key && !map.has(key)) map.set(key, contractor);

        if (name.includes("(")) {
          const noParen = contractorKey(name.split("(")[0]);
          if (noParen && !map.has(noParen)) map.set(noParen, contractor);
        }

        const base = cleanBaseKey(name);
        if (base && base.length >= 3 && !map.has(base)) {
          map.set(base, contractor);
        }
      }
    }
    return map;
  }, [board.data]);
  return <IndexContext.Provider value={{ index, loading: board.loading }}>{children}</IndexContext.Provider>;
}

export function useContractor(name: string) {
  const { index, loading } = useContext(IndexContext);
  if (!name) return { contractor: null, loading };

  const rawKey = contractorKey(name);
  let contractor = index.get(rawKey);

  if (!contractor && name.includes("(")) {
    contractor = index.get(contractorKey(name.split("(")[0]));
  }

  if (!contractor) {
    const base = cleanBaseKey(name);
    if (base && base.length >= 3) {
      contractor = index.get(base);
    }
  }

  if (!contractor) {
    for (const [k, v] of index.entries()) {
      if (k.length >= 4 && (rawKey.startsWith(k) || k.startsWith(rawKey))) {
        contractor = v;
        break;
      }
    }
  }

  return { contractor: contractor ?? null, loading };
}

function Logo({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const firstLetter = (name || "C").trim().charAt(0).toUpperCase() || "C";

  if (!url || failed) {
    return (
      <span className="grid size-5 shrink-0 place-items-center rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700/60 uppercase">
        {firstLetter}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      width={20}
      height={20}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-5 shrink-0 rounded bg-white dark:bg-neutral-900 object-contain p-0.5 border border-neutral-200 dark:border-neutral-800 shadow-sm"
    />
  );
}

const UNNAMED = /^(not named|not on record|contractor not named|on municipal record|licensed commercial contractor|public record contractor|unknown contractor|unknown|self|—|-)?$/i;

export function ContractorLink({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const { contractor: known } = useContractor(name);
  const label = (name || "").trim();
  if (!label || UNNAMED.test(label)) return <span className="text-muted-foreground">Contractor not named on the city extract</span>;

  let finalLogo = logoUrl || known?.logoUrl || "";
  if (!finalLogo && known?.website) {
    const domain = extractDomain(known.website);
    if (domain) {
      finalLogo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    }
  }
  if (!finalLogo) {
    const domain = extractDomain(label);
    if (domain) {
      finalLogo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    }
  }

  const href = `/contractors/${encodeURIComponent(known?.name || label)}`;
  return (
    <Link href={href} className="inline-flex max-w-full items-center gap-2 hover:underline">
      <Logo url={finalLogo} name={label} />
      <span className="truncate font-medium">{label}</span>
    </Link>
  );
}
