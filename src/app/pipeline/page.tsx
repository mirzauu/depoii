"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CitySelect } from "@/components/app-shell";
import { DepoiiLoader } from "@/components/depoii-logo";
import { ScorePill } from "@/components/badges";
import { useDepoiiState } from "@/components/depoii-provider";
import { useEngine } from "@/components/use-engine";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mapBrief, type MondayBrief } from "@/lib/engine-api";
import { num, usd } from "@/lib/format";

const PAGE = 25;
const STAGES = ["New", "Contacted", "Inspected", "Bid", "Won", "Lost"] as const;
const field = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type SharedLead = { parcelId: string; stormId: string; stage: string; assignee: string; notes: string };

type Lead = MondayBrief["opportunities"][number];
type ListId = "unresolved" | "all";

function csv(rows: string[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return rows.map((line) => line.map(esc).join(",")).join("\n");
}

export default function PipelinePage() {
  const { jurisdiction } = useDepoiiState();
  const [serverPage, setServerPage] = useState(0);
  const brief = useEngine("brief", { jurisdiction, limit: 500, offset: serverPage * 500 }, mapBrief);
  const leads = brief.data?.opportunities ?? [];
  const [list, setList] = useState<ListId>("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [shared, setShared] = useState<SharedLead[]>([]);
  const [stage, setStage] = useState("");
  const [assignee, setAssignee] = useState("");
  const [minSqft, setMinSqft] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [owner, setOwner] = useState("");
  const [page, setPage] = useState(0);
  const [outcomeFor, setOutcomeFor] = useState<Lead | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");

  const loadShared = () => {
    fetch("/api/leads")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: SharedLead[]) => setShared(Array.isArray(rows) ? rows : []))
      .catch(() => setShared([]));
  };
  useEffect(() => { loadShared(); }, []);

  const recordOf = (o: Lead) => shared.find((row) => row.parcelId === o.parcelId);
  const name = owner.trim().toLowerCase();
  const rows = useMemo(() => leads.filter((o) => {
    const record = shared.find((row) => row.parcelId === o.parcelId);
    if (list === "unresolved" && !o.unresolved) return false;
    if (savedOnly && !record) return false;
    if (stage && (record?.stage || "New") !== stage) return false;
    if (assignee && !(record?.assignee || "").toLowerCase().includes(assignee.toLowerCase())) return false;
    if (o.sqft < minSqft) return false;
    if (o.score < minScore) return false;
    if (name && !`${o.owner} ${o.ownerMail}`.toLowerCase().includes(name)) return false;
    return true;
  }), [leads, list, savedOnly, shared, stage, assignee, minSqft, minScore, name]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageIndex = Math.min(page, pageCount - 1);
  const visible = rows.slice(pageIndex * PAGE, pageIndex * PAGE + PAGE);
  const from = rows.length === 0 ? 0 : pageIndex * PAGE + 1;
  const to = Math.min(rows.length, (pageIndex + 1) * PAGE);

  const choose = (next: ListId) => {
    setList(next);
    setSavedOnly(false);
    setPage(0);
  };

  const saveLead = async (o: Lead, next: Partial<SharedLead> & { stage?: string }) => {
    const current = recordOf(o);
    const stageName = next.stage || current?.stage || "New";
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parcelId: o.parcelId,
        stormId: o.stormId,
        address: o.address,
        city: o.city,
        score: o.score,
        hail: o.hail,
        price: o.value,
        stage: stageName,
        assignee: next.assignee ?? current?.assignee ?? "",
        notes: next.notes ?? current?.notes ?? "",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { promptOutcome?: boolean };
    if (body.promptOutcome) setOutcomeFor(o);
    loadShared();
  };

  const exportCsv = () => {
    const body = [
      ["Address", "City", "Owner", "Owner mailing address", "SqFt", "Year built", "Hail in", "Warning tier", "Pipeline value", "Score", "Unresolved", "Stage", "Rep", "Notes"],
      ...rows.map((o) => {
        const record = shared.find((row) => row.parcelId === o.parcelId);
        return [o.address, o.city, o.owner, o.ownerMail, String(o.sqft), String(o.yearBuilt), String(o.hail), o.tier, String(o.value), String(o.score), o.unresolved ? "yes" : "no", record?.stage || "New", record?.assignee || "", record?.notes || ""];
      }),
    ];
    const url = URL.createObjectURL(new Blob([csv(body)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `depoii-pipeline-${jurisdiction.split(",")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-[calc(100vh-7.5rem)] flex-col lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 border-b border-border p-4 lg:w-60 lg:border-r lg:border-b-0">
        <div className="flex flex-wrap gap-1">
          {([
            ["unresolved", "Unresolved"],
            ["all", "All"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => choose(id)} className={`rounded-md px-2 py-1 text-xs ${list === id && !savedOnly ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => { setSavedOnly(true); setPage(0); }} className={`rounded-md px-2 py-1 text-xs ${savedOnly ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-muted"}`}>
            Saved
          </button>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Jurisdiction
          <CitySelect />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Square feet
          <select value={minSqft} onChange={(e) => { setMinSqft(Number(e.target.value)); setPage(0); }} className={field}>
            {[0, 25_000, 50_000, 100_000, 200_000].map((v) => (
              <option key={v} value={v}>{v ? `${num(v)}+` : "Any"}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Score
          <select value={minScore} onChange={(e) => { setMinScore(Number(e.target.value)); setPage(0); }} className={field}>
            <option value={0}>Any</option>
            <option value={40}>40+</option>
            <option value={60}>60+</option>
            <option value={80}>80+</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Owner
          <input value={owner} onChange={(e) => { setOwner(e.target.value); setPage(0); }} placeholder="Name" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Stage
          <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }} className={field}>
            <option value="">Any</option>
            {STAGES.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Assignee
          <input value={assignee} onChange={(e) => { setAssignee(e.target.value); setPage(0); }} placeholder="Rep" className={field} />
        </label>
      </aside>

      <section className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">Opportunity pipeline</h1>
            <p className="text-xs text-muted-foreground">
              {jurisdiction}{brief.data ? ` · ${brief.data.stormName}` : ""} · {usd(rows.reduce((s, o) => s + o.value, 0), true)} est. planning value
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => rows.forEach((o) => saveLead(o, { stage: "New" }))} disabled={!rows.length}>Add to shared pipeline</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download /> Export
            </Button>
          </div>
        </div>

        {brief.stale && brief.fetchedAt && <p className="px-4 text-xs text-amber-200">Showing the list from {brief.fetchedAt.slice(0, 16).replace("T", " ")} UTC.</p>}
        {brief.error && (
          <div className="flex flex-wrap items-center gap-3 p-4">
            <p className="text-sm text-red-300">{brief.error}</p>
            <button type="button" onClick={brief.retry} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white">Try again</button>
          </div>
        )}
        {brief.loading && rows.length === 0 ? (
          <DepoiiLoader label="Loading buildings…" className="py-16" />
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {savedOnly ? "No saved buildings in this list yet." : `No buildings in ${jurisdiction} match these filters.`}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-background pl-4 whitespace-nowrap">Address</TableHead>
                <TableHead className="whitespace-nowrap">City</TableHead>
                <TableHead className="whitespace-nowrap">Owner</TableHead>
                <TableHead className="whitespace-nowrap">Mailing address</TableHead>
                <TableHead className="whitespace-nowrap">Score</TableHead>
                <TableHead className="text-right whitespace-nowrap">Sq ft</TableHead>
                <TableHead className="text-right whitespace-nowrap">Year built</TableHead>
                <TableHead className="text-right whitespace-nowrap">Hail</TableHead>
                <TableHead className="whitespace-nowrap">Warning</TableHead>
                <TableHead className="whitespace-nowrap">Permit</TableHead>
                <TableHead className="text-right whitespace-nowrap">Est. Value</TableHead>
                <TableHead className="whitespace-nowrap">Stage</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((o) => {
                const href = o.parcelId ? `/parcels/${encodeURIComponent(o.parcelId)}${o.stormId ? `?storm=${encodeURIComponent(o.stormId)}` : ""}` : "/pipeline";
                return (
                  <TableRow key={o.parcelId || o.address}>
                    <TableCell className="sticky left-0 z-10 bg-background pl-4 font-medium whitespace-nowrap">
                      <Link href={href} className="hover:underline">{o.address}</Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{o.city}</TableCell>
                    <TableCell className="max-w-48 truncate whitespace-nowrap">{o.owner || "—"}</TableCell>
                    <TableCell className="max-w-64 truncate whitespace-nowrap" title={o.ownerMail || "No mailing address on the appraisal roll"}>{o.ownerMail || "—"}</TableCell>
                    <TableCell><ScorePill score={o.score} /></TableCell>
                    <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{o.sqft ? num(o.sqft) : "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{o.yearBuilt || "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{o.hail ? `${o.hail}"` : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap capitalize">{o.tier || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {o.permitStatus === "NON_ROOF_PERMIT_DETECTED" ? (
                        <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400" title={o.recentActivity || "Active site with non-roof tenant improvements"}>
                          Active site (Non-roof)
                        </span>
                      ) : o.unresolved ? (
                        <span className="text-red-300">Unresolved</span>
                      ) : (
                        <span className="text-muted-foreground">Roof permit filed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{o.valueLow && o.valueHigh ? `${usd(o.valueLow, true)}–${usd(o.valueHigh, true)}` : usd(o.value, true)}{o.priceFlagged ? " *" : ""}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <select value={recordOf(o)?.stage || "New"} onChange={(e) => saveLead(o, { stage: e.target.value })} className={field}>
                        {STAGES.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Link href={href} className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs whitespace-nowrap hover:bg-muted">Open dossier</Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {outcomeFor && (
          <form
            className="m-4 space-y-2 rounded-md border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              fetch("/api/outcomes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: crypto.randomUUID(),
                  parcelId: outcomeFor.parcelId,
                  stormId: outcomeFor.stormId || "unknown",
                  loggedAt: new Date().toISOString(),
                  predictedScore: outcomeFor.score,
                  factors: {},
                  moistureVerified: false,
                  scope: "none",
                  contractValue: 0,
                  notes: outcomeNote,
                }),
              }).then(() => { setOutcomeFor(null); setOutcomeNote(""); });
            }}
          >
            <p className="text-sm font-medium">Inspection outcome for {outcomeFor.address}</p>
            <textarea value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} placeholder="What did the roof show?" className="h-20 w-full rounded-md border border-border bg-background p-2 text-sm" />
            <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white">Save outcome</button>
          </form>
        )}

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>{from}–{to} of {rows.length}{brief.data && brief.data.totalOpportunities > rows.length ? ` · ${num(brief.data.totalOpportunities)} in this storm` : ""}</span>
          {brief.data && brief.data.totalOpportunities > 500 && (
            <button type="button" className="underline" onClick={() => { setServerPage((n) => n + 1); setPage(0); }}>Next 500</button>
          )}
          <div className="flex gap-2">
            <button type="button" className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>Previous</button>
            <button type="button" className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={pageIndex >= pageCount - 1} onClick={() => setPage(pageIndex + 1)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
