"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WEIGHTS, rankOpportunities, type Opportunity } from "@/lib/engine/score";
import type { FieldOutcome, LivePayload, MarketId, Parcel, Permit, PermitKind, ScoreWeights, Storm, StormSummary } from "@/lib/types";

interface DepoiiState {
  ready: boolean;
  loading: boolean;
  /** Finished steps divided by the steps this live load actually runs. 0 to 1. */
  progress: number;
  error: string | null;
  refresh: () => void;
  coverage: string;
  fetchedAt: string | null;
  storms: StormSummary[];
  storm: Storm | null;
  setStormId: (id: string) => void;
  city: MarketId;
  setCity: (city: MarketId) => void;
  jurisdiction: string;
  setJurisdiction: (jurisdiction: string) => void;
  parcels: Parcel[];
  permits: Permit[];
  developments: Permit[];
  weights: ScoreWeights;
  setWeights: (w: ScoreWeights) => void;
  opportunities: Opportunity[];
  outcomes: FieldOutcome[];
  addOutcome: (o: FieldOutcome) => void;
  setOutcomes: (o: FieldOutcome[]) => void;
}

const Ctx = createContext<DepoiiState | null>(null);
const KEY = "depoii:v3-dallas-pilot";

// Leaderboard, Hail Map, and Field Outcomes are engine/local-backed; do not block them on the ArcGIS live stream.
const LIVE_PREFIXES = ["/property", "/capital"];

function needsLive(path: string) {
  return LIVE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function placeName(jurisdiction: string) {
  return jurisdiction.split(",")[0].trim().toLowerCase();
}

function marketFor(place: string): MarketId {
  return place.includes("fort worth") ? "fort-worth" : "dallas";
}

function servedJurisdiction(value: unknown): string {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "dallas, tx" || text === "dallas") return "Dallas, TX";
  if (text === "fort worth, tx" || text.startsWith("fort worth")) return "Fort Worth, TX";
  return "Dallas, TX";
}

function permitKind(category: string): PermitKind {
  const text = category.toLowerCase();
  if (text.includes("new")) return "new-commercial";
  if (text.includes("repair")) return "repair";
  return "reroof";
}

function asPermit(row: {
  id: string;
  number: string;
  issued: string;
  address: string;
  city: string;
  valuation: number;
  category: string;
  membrane: string;
  contractor: string;
  lat: number;
  lng: number;
}, market: MarketId): Permit {
  const contractor = row.contractor.trim();
  return {
    id: row.id,
    market,
    permitNo: row.number,
    parcelId: null,
    parcelIds: [],
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    contractorId: contractor ? contractor.toLowerCase() : null,
    contractorName: contractor || "Contractor not named on the permit",
    contractorState: "UNKNOWN",
    issued: row.issued,
    valuation: row.valuation,
    scope: row.category,
    kind: permitKind(row.category),
    membrane: row.membrane || undefined,
    portal: "Depoii data engine",
    recordUrl: "",
  };
}

export function DepoiiProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [stormId, setStormIdState] = useState<string | null>(null);
  const [city, setCity] = useState<MarketId>("dallas");
  const [jurisdiction, setJurisdictionState] = useState("Dallas, TX");
  const [enginePermits, setEnginePermits] = useState<Permit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [outcomes, setOutcomes] = useState<FieldOutcome[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const path = usePathname();
  const jurisdictionRef = useRef(jurisdiction);
  jurisdictionRef.current = jurisdiction;
  const loadedFor = useRef<string | null>(null);
  const outcomesLoaded = useRef(false);

  const load = useCallback(async (id: string | null, refresh = false, jurisdictionName?: string) => {
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (id) q.set("storm", id);
      if (refresh) q.set("refresh", "1");
      q.set("jurisdiction", jurisdictionName || jurisdictionRef.current);
      const res = await fetch(`/api/live?${q}`);
      if (!res.ok || !res.body) throw new Error(`Live feeds returned HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let payload: LivePayload | null = null;
      for (;;) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as { done?: number; total?: number; data?: LivePayload; error?: string };
          if (message.error) throw new Error(message.error);
          if (message.done != null && message.total) setProgress(message.done / message.total);
          if (message.data) payload = message.data;
        }
        if (chunk.done) break;
      }
      if (!payload) throw new Error("The public feeds did not respond.");
      setPayload(payload);
      setStormIdState(payload.storm.id);
      loadedFor.current = jurisdictionName || jurisdictionRef.current;
      setProgress(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The public feeds did not respond.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate saved weights, then fetch live records */
  useEffect(() => {
    let imported: FieldOutcome[] | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (saved.weights) setWeights(saved.weights);
      // City-of-Dallas pilot is the active market; do not reopen on Fort Worth by default.
      let nextJurisdiction = servedJurisdiction(saved.jurisdiction) || "Dallas, TX";
      if (/^fort worth/i.test(nextJurisdiction)) nextJurisdiction = "Dallas, TX";
      setCity(marketFor(placeName(nextJurisdiction)));
      setJurisdictionState(nextJurisdiction);
      if (Array.isArray(saved.outcomes) && saved.outcomes.length) imported = saved.outcomes;
    } catch {
      localStorage.removeItem(KEY);
    }
    setHydrated(true);
    if (imported?.length) {
      void fetch("/api/outcomes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcomes: imported }) });
    }
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify({ stormId, weights, city, jurisdiction }));
  }, [hydrated, stormId, weights, city, jurisdiction]);

  const setJurisdiction = useCallback((next: string) => {
    const allowed = servedJurisdiction(next);
    setJurisdictionState(allowed);
    setCity(marketFor(placeName(allowed)));
    setEnginePermits(null);
    loadedFor.current = null;
  }, []);

  useEffect(() => {
    if (!hydrated || !needsLive(path)) return;
    if (loadedFor.current === jurisdiction && payload) return;
    void load(null, false, jurisdiction);
  }, [hydrated, path, jurisdiction, payload, load]);

  useEffect(() => {
    if (!hydrated || !needsLive(path)) return;
    let cancelled = false;
    const market = marketFor(placeName(jurisdiction));
    fetch(`/api/permits?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { permits?: Parameters<typeof asPermit>[0][] } | null) => {
        if (cancelled) return;
        const rows = Array.isArray(body?.permits) ? body.permits : [];
        setEnginePermits(rows.map((row) => asPermit(row, market)));
      })
      .catch(() => {
        if (!cancelled) setEnginePermits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, path, jurisdiction]);

  useEffect(() => {
    if (!hydrated || (path !== "/outcomes" && !path.startsWith("/property")) || outcomesLoaded.current) return;
    outcomesLoaded.current = true;
    void fetch("/api/outcomes")
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        if (Array.isArray(rows)) setOutcomes(rows);
      })
      .catch(() => undefined);
  }, [hydrated, path]);

  const setStormId = useCallback((id: string) => {
    setStormIdState(id);
    void load(id, false, jurisdictionRef.current);
  }, [load]);

  const parcels = useMemo(() => {
    if (!payload) return [];
    const place = placeName(jurisdiction);
    return payload.parcels.filter((p) => {
      const city = p.city.trim().toLowerCase();
      return city === place || place.startsWith(city) || city.startsWith(place);
    });
  }, [payload, jurisdiction]);
  const permits = enginePermits ?? [];
  const developments = useMemo(() => permits.filter((p) => p.kind === "new-commercial"), [permits]);
  const opportunities = useMemo(
    () => (payload ? rankOpportunities(parcels, payload.storm, permits, weights, undefined, payload.permitFeeds) : []),
    [payload, parcels, permits, weights],
  );
  const visibleOutcomes = useMemo(() => {
    // Without a live parcel roll (engine/local pages), show every logged outcome.
    if (!parcels.length) return outcomes;
    const ids = new Set(parcels.map((p) => p.id));
    return outcomes.filter((o) => ids.has(o.parcelId));
  }, [outcomes, parcels]);

  const value: DepoiiState = {
    ready: Boolean(payload),
    loading,
    progress,
    error,
    refresh: () => void load(stormId, true),
    coverage: payload?.coverage ?? "",
    fetchedAt: payload?.fetchedAt ?? null,
    storms: payload?.storms ?? [],
    storm: payload?.storm ?? null,
    setStormId,
    city,
    setCity,
    jurisdiction,
    setJurisdiction,
    parcels,
    permits,
    developments,
    weights,
    setWeights,
    opportunities,
    outcomes: visibleOutcomes,
    addOutcome: (o) => {
      setOutcomes((xs) => [o, ...xs.filter((x) => x.parcelId !== o.parcelId || x.stormId !== o.stormId)]);
      void fetch("/api/outcomes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) });
    },
    setOutcomes: (next) => {
      setOutcomes(next);
      if (next.length === 0) void fetch("/api/outcomes", { method: "DELETE" });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDepoiiState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDepoiiState must be used inside DepoiiProvider");
  return v;
}

const EMPTY_STORM: Storm = {
  id: "",
  name: "Loading Storm...",
  shortName: "Loading",
  date: "",
  maxHail: 0,
  reportCount: 0,
  region: "",
  maxHailTag: 0,
  center: [32.75, -97.33],
  source: "",
  reports: [],
  warnings: [],
};

export function useDepoii() {
  const v = useDepoiiState();
  return {
    ...v,
    storm: v.storm ?? EMPTY_STORM,
  } as DepoiiState & { storm: Storm };
}

