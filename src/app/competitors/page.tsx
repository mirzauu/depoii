"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app-shell";
import { ProvenanceBadge } from "@/components/badges";
import { useDepoii } from "@/components/depoii-provider";
import { DepoiiMap, type MapPoint } from "@/components/depoii-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { competitorStats } from "@/lib/engine/competitors";
import { contractorsFrom } from "@/lib/live/contractors";
import { ContractorLink } from "@/components/contractor-link";
import { DepoiiLoader } from "@/components/depoii-logo";
import { useEngine } from "@/components/use-engine";
import { looksLikePersonName, mapLeaderboard } from "@/lib/engine-api";
import { pct, usd } from "@/lib/format";

const RANGES = {
  "12m": { label: "Last 12 months", from: "2025-10-01" },
  storm: { label: "90 days after selected storm", from: "" },
  all: { label: "Since Jan 2023", from: "2023-01-01" },
} as const;

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

interface RecentPermit {
  id: string;
  number: string;
  issued: string;
  address: string;
  city: string;
  valuation: number;
  category: string;
  contractor: string;
  lat: number;
  lng: number;
}

export default function CompetitorsPage() {
  const { storm, storms, permits, jurisdiction } = useDepoii();
  const [recent, setRecent] = useState<RecentPermit[]>([]);
  const board = useEngine("contractors/leaderboard", { jurisdiction, limit: 100 }, mapLeaderboard);
  const leaders = board.data?.contractors ?? null;

  useEffect(() => {
    let cancelled = false;
    const q = encodeURIComponent(jurisdiction);
    setRecent([]);
    fetch(`/api/permits?jurisdiction=${q}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((jobs) => {
        if (cancelled) return;
        const rows = Array.isArray(jobs?.permits) ? (jobs.permits as RecentPermit[]) : [];
        setRecent(rows.filter((p) => p.contractor && !looksLikePersonName(p.contractor)));
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jurisdiction]);
  const [today, setToday] = useState("2026-10-18");
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  const [rangeKey, setRangeKey] = useState<keyof typeof RANGES>("all");
  const contractors = useMemo(() => contractorsFrom(permits), [permits]);

  const range = useMemo(() => {
    if (rangeKey === "storm") {
      const end = new Date(new Date(storm.date).getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
      return { from: storm.date, to: end < today ? end : today };
    }
    return { from: RANGES[rangeKey].from, to: today };
  }, [rangeKey, storm, today]);

  const stats = useMemo(() => competitorStats(permits, contractors, storms, range), [permits, contractors, storms, range]);
  const active = stats.filter((s) => s.permits > 0);
  const totalPermits = active.reduce((s, c) => s + c.permits, 0);
  const totalValue = active.reduce((s, c) => s + c.filingValue, 0);

  const velocity = useMemo(() => {
    const months = stats[0]?.monthly.map((m) => m.month) ?? [];
    const top = stats.slice(0, 8);
    return months.map((m, i) => ({ month: m, ...Object.fromEntries(top.map((s) => [s.contractor.id, s.monthly[i].permits])) }));
  }, [stats]);

  const points: MapPoint[] = permits
    .filter((p) => p.contractorId && p.kind !== "new-commercial" && p.issued >= range.from && p.issued <= range.to)
    .map((p) => ({
      id: p.id,
      lng: p.lng,
      lat: p.lat,
      state: "custom",
      color: contractors.find((c) => c.id === p.contractorId)?.color,
      title: `${p.contractorName} · ${p.permitNo} · ${usd(p.valuation)}`,
    }));

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Decision 5 · Where are competitors winning?"
        title="Competitor War Room"
        description={`${jurisdiction} rankings are calculated by the data engine from the permit warehouse. The table below is that leaderboard. Recent jobs are the latest permits the engine returned for this jurisdiction.`}
        actions={
          <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value as keyof typeof RANGES)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
            {Object.entries(RANGES).map(([k, r]) => (
              <option key={k} value={k}>{r.label}</option>
            ))}
          </select>
        }
      />

      <div className="mx-4 lg:mx-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
        <span className="font-semibold text-amber-100">Beta Preview:</span> The Dallas Competitor Leaderboard is currently being re-indexed to isolate pure commercial reroof filings and filter municipal placeholders. Demos should focus on the verified building opportunity pipeline.
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">Estimated permit share <ProvenanceBadge kind="depoii-modeled" /></CardTitle>
            <CardDescription>
              {leaders?.length ? `${leaders.length} engine-ranked contractors · ${usd(leaders.reduce((s, c) => s + c.valuation, 0), true)} permitted value` : `${totalPermits} roofing permits · ${usd(totalValue, true)} city filing value`}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {(leaders ?? active).length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">No roofing permits in this window.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(leaders ?? []).length ? leaders!.map((s) => ({ name: s.name, volume: +(s.share * 100).toFixed(1), value: +(s.share * 100).toFixed(1) })) : active.map((s) => ({ name: s.contractor.name, volume: +(s.shareByVolume * 100).toFixed(1), value: +(s.shareByValue * 100).toFixed(1) }))} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" unit="%" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="volume" name="Share by volume %" fill="#38bdf8" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="value" name="Share by filing value %" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permit velocity</CardTitle>
            <CardDescription>Monthly filings by contractor. Out-of-state spikes cluster after named hail events.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={velocity}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} minTickGap={24} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} width={24} />
                <Tooltip contentStyle={tooltipStyle} />
                {stats.slice(0, 8).map((s) => s.contractor).map((c) => (
                  <Line key={c.id} type="monotone" dataKey={c.id} name={c.name} stroke={c.color} dot={false} strokeWidth={1.75} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contractor leaderboard</CardTitle>
            <CardDescription>
              {leaders == null ? "Asking the data engine…" : `${leaders.length} contractors in ${jurisdiction}, ranked by permitted valuation.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Contractor</TableHead>
                  <TableHead className="text-right">Permits</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">City filing value</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Post-storm filings</TableHead>
                  <TableHead className="pr-6">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(leaders ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-6">
                      <ContractorLink name={s.name} />
                      <span className="block pl-7 text-xs text-muted-foreground">{s.roofSystem || "Roof system not stated"}{s.license ? ` · license ${s.license}` : ""}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{s.permits}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{s.share > 0 ? pct(s.share, 1) : "—"}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{usd(s.valuation, true)}</TableCell>
                    <TableCell className="pr-6 text-xs">
                      <Link href={`/contractors/${encodeURIComponent(s.name)}`} className="text-primary hover:underline font-medium">Profile →</Link>
                    </TableCell>
                  </TableRow>
                ))}
                {leaders == null && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <DepoiiLoader label="Asking the data engine…" className="py-8" />
                    </TableCell>
                  </TableRow>
                )}
                {leaders?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="pl-6 text-sm text-muted-foreground">
                      {recent.length > 0
                        ? `${jurisdiction} has permits, but the engine left them off the ranking because the contractor name is generic, such as Licensed Commercial Contractor or Property Owner.`
                        : `No contractor ranking for ${jurisdiction}.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <CardDescription>Latest permits the engine returned for {jurisdiction}. This is a page of the warehouse, not the full {jurisdiction} history.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Permit</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="hidden md:table-cell">Contractor</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="pr-6 text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.slice(0, 12).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{p.number}</span>
                      <span className="block text-xs text-muted-foreground">{p.issued || "Issue date blank"}</span>
                    </TableCell>
                    <TableCell>{p.address}{p.city ? `, ${p.city}` : ""}</TableCell>
                    <TableCell className="hidden max-w-56 md:table-cell"><ContractorLink name={p.contractor} /></TableCell>
                    <TableCell className="hidden sm:table-cell">{p.category}</TableCell>
                    <TableCell className="pr-6 text-right font-mono tabular-nums">{usd(p.valuation, true)}</TableCell>
                  </TableRow>
                ))}
                {recent.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="pl-6 text-sm text-muted-foreground">No permits returned for {jurisdiction}.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Territory footprint</CardTitle>
            <CardDescription>Permit locations colored by contractor, overlaid on the {storm.shortName} swath.</CardDescription>
          </CardHeader>
          <CardContent>
            <DepoiiMap storm={storm} points={points} className="h-[420px] rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

