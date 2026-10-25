"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ContractorLink } from "@/components/contractor-link";
import { useDepoii } from "@/components/depoii-provider";
import { ProvenanceBadge } from "@/components/badges";
import { ProofCard } from "@/components/proof-card";
import { PermitContactsCard } from "@/components/permit-contacts-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ARCHETYPE_DISCLAIMER } from "@/lib/engine/archetype";
import { roofVulnerability } from "@/lib/engine/vulnerability";
import { longDate, shortDate, usd } from "@/lib/format";
import type { FieldOutcome } from "@/lib/types";

import { useRouter } from "next/navigation";
import { DepoiiLoader } from "@/components/depoii-logo";

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { opportunities, storm } = useDepoii();
  const o = opportunities.find((x) => x.parcel.id === id);

  useEffect(() => {
    if (!o && id) {
      router.replace(`/parcels/${encodeURIComponent(id)}`);
    }
  }, [o, id, router]);

  if (!o) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <DepoiiLoader label="Loading property record…" />
      </div>
    );
  }
  const v = roofVulnerability(o);
  const { parcel } = o;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow={`Property dossier · ${parcel.cadAccount}`}
        title={parcel.address}
        description={`${parcel.city}, TX · scored against ${storm.name}`}
        actions={
          o.tier !== "outside" && (
            <Link href={`/property/${parcel.id}/brief`} className={buttonVariants()}>
              Generate C-suite advisory brief
            </Link>
          )
        }
      />
      <div className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity proof card</CardTitle>
            <CardDescription>The score shows how each factor contributes. Every row is labeled by data provenance.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProofCard o={o} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision-maker intelligence</CardTitle>
              <CardDescription>Decision 3 · Who do we contact?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Owner of record ({parcel.cad === "DCAD" ? "Dallas Central Appraisal District" : "Tarrant Appraisal District"})</p>
                  <p className="font-medium">{parcel.owner}</p>
                  <p className="text-xs text-muted-foreground">{parcel.ownerAddress || "No mailing address on this record."}</p>
                  <a href={parcel.recordUrl} className="text-xs text-sky-300 underline" target="_blank" rel="noreferrer">Appraisal record</a>
                </div>
                <ProvenanceBadge kind="source-record" />
              </div>
              <p className="text-[11px] text-muted-foreground">This feed has no facility director, asset manager, email, or phone. Those are not on the appraisal roll.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roof Vulnerability Index</CardTitle>
              <CardDescription>FM 4470 guidelines reference · comparative, not a certification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-semibold">{v.index}</span>
                <span className="rounded-full border border-[#DE7272]/40 bg-[#DE7272]/10 px-2 py-0.5 text-xs text-[#DE7272]">{v.rating}</span>
                <ProvenanceBadge kind="depoii-modeled" className="ml-auto" />
              </div>
              <p>{v.fmBenchmark}</p>
              <p className="text-muted-foreground">{v.recommendation}</p>
              <p className="text-[11px] text-muted-foreground">{ARCHETYPE_DISCLAIMER}</p>
            </CardContent>
          </Card>
        </div>

        <PermitContactsCard permits={o.permits} />

        <Card>
          <CardHeader>
            <CardTitle>Municipal permit history</CardTitle>
            <CardDescription>Permits in {parcel.city} whose address matches this account</CardDescription>
          </CardHeader>
          <CardContent>
            {o.permits.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No Fort Worth roofing or 2026 new-construction permit matched this address.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {o.permits.map((p) => (
                  <li key={p.id} className="border-l-2 border-border pl-3">
                    <p className="font-mono text-xs">{p.permitNo} · {shortDate(p.issued)}</p>
                    <p>{p.scope}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ContractorLink name={p.contractorName} /> · {usd(p.valuation)} declared · {p.portal}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <OutcomeForm key={`${o.parcel.id}-${o.storm.id}`} o={o} />
      </div>
    </div>
  );
}

function OutcomeForm({ o }: { o: NonNullable<ReturnType<typeof useDepoii>["opportunities"][number]> }) {
  const { addOutcome, outcomes } = useDepoii();
  const existing = outcomes.find((x) => x.parcelId === o.parcel.id && x.stormId === o.storm.id);
  const [moisture, setMoisture] = useState(existing?.moistureVerified ?? false);
  const [scope, setScope] = useState<FieldOutcome["scope"]>(existing?.scope ?? "none");
  const [value, setValue] = useState(existing ? String(existing.contractValue) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saved, setSaved] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    addOutcome({
      id: existing?.id ?? `${o.parcel.id}:${o.storm.id}`,
      parcelId: o.parcel.id,
      stormId: o.storm.id,
      loggedAt: new Date().toISOString().slice(0, 10),
      predictedScore: o.score,
      factors: o.factors,
      moistureVerified: moisture,
      scope,
      contractValue: Number(value.replace(/[^0-9.]/g, "")) || 0,
      notes,
    });
    setSaved(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log field outcome</CardTitle>
        <CardDescription>Closed-loop feedback. Inspection results recalibrate the scoring weights for {longDate(o.storm.date)}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={moisture} onChange={(e) => setMoisture(e.target.checked)} className="accent-red-500" />
            Subsurface saturation verified (infrared / cores)
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Approved scope
            <select value={scope} onChange={(e) => setScope(e.target.value as FieldOutcome["scope"])} className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground">
              <option value="none">No damage / no scope</option>
              <option value="repair">Repair scope approved</option>
              <option value="replacement">Full roof replacement approved</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Contract value awarded
            <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 340000" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Field notes
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Drone + IR survey, wet insulation at NE drains…" />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="brand">{existing ? "Update outcome" : "Log outcome"}</Button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-[#B4E4D6]">
                <CheckCircle2 className="size-4" /> Saved · <Link href="/outcomes" className="underline">view calibration</Link>
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
