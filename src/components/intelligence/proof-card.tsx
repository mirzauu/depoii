import Link from "next/link";
import { ArrowRight, FileText, UserCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FACTOR_LABELS, vulnerabilityRating, type Opportunity } from "@/lib/engine/score";
import { longDate, num, usd } from "@/lib/format";
import type { ScoreWeights } from "@/lib/types";
import { ContractorLink } from "./contractor-link";
import { ProvenanceBadge, ScorePill, TdiBadge, TierBadge } from "./badges";

export function FactorBars({ o }: { o: Opportunity }) {
  return (
    <div className="space-y-2">
      {(Object.keys(FACTOR_LABELS) as (keyof ScoreWeights)[]).map((f) => (
        <div key={f} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">{FACTOR_LABELS[f]}</span>
          <span className="font-mono tabular-nums">{f === "permitAbsence" && !o.permitKnown ? "—" : o.factors[f]}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${f === "permitAbsence" && !o.permitKnown ? 0 : o.factors[f]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, prov, note }: { label: string; value: React.ReactNode; prov: React.ComponentProps<typeof ProvenanceBadge>["kind"]; note?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <ProvenanceBadge kind={prov} />
      </div>
      <div className="text-sm font-medium">{value}</div>
      {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}

export function ProofCard({ o, compact = false }: { o: Opportunity; compact?: boolean }) {
  const { parcel } = o;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{parcel.address}</p>
          <p className="text-xs text-muted-foreground">
            {parcel.city}, TX · {parcel.use} · {num(parcel.sqft)} sq ft
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TierBadge tier={o.tier} hail={o.hailInches || undefined} />
            {o.tier !== "outside" && <TdiBadge tdi={o.tdi} />}
          </div>
        </div>
        <div className="text-right">
          <ScorePill score={o.score} className="h-9 min-w-12 text-lg" />
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Opportunity</p>
        </div>
      </div>

      <div>
        <Row
          label="Hail"
          prov={o.parcel.hailProvenance ?? "source-record"}
          value={o.tier === "outside" ? "Outside the NWS warning polygons" : `${o.hailInches}" · ${o.tier === "core" ? "core warning" : "warning polygon"}`}
          note={o.parcel.hailBasis ?? `${longDate(o.storm.date)} · size factor ${o.factors.severity}/100`}
        />
        <Row label="Year built" prov="source-record" value={`${o.parcel.yearBuilt} · ${o.roofAge} years on the roll · ${vulnerabilityRating(o.roofAge)}`} note={o.roofBaselineBasis} />
        <Row
          label={o.parcel.city === "Dallas" ? "Dallas roofing permit" : "Fort Worth roofing permit"}
          prov="source-record"
          value={
            !o.permitKnown
              ? "Permit record not retrieved"
              : o.resolvingPermit
                ? `Permit ${o.resolvingPermit.permitNo} filed ${o.resolvingPermit.issued}`
                : o.tier === "outside"
                  ? "Not inside a warning polygon"
                  : "No matching roofing permit since the storm date"
          }
          note={o.resolvingPermit ? <span className="inline-flex flex-wrap items-center gap-2"><ContractorLink name={o.resolvingPermit.contractorName} /> · {o.resolvingPermit.valuation ? usd(o.resolvingPermit.valuation) + " job value" : "no job value on the permit"}</span> : "Matched on street number and street name. A permit at a different address will not show here."}
        />
        <Row label="Membrane" prov={o.archetype.provenance} value={o.archetype.label} note={o.archetype.basis} />
        <Row label="Replacement estimate (Benchmark)" prov="depoii-modeled" value={usd(o.pipelineValue)} note={`Rough planning estimate (${o.parcel.cad} area × $14/sq ft). Not an appraisal or formal contractor estimate.`} />
        {((o.resolvingPermit?.contacts?.length ?? 0) + o.permits.reduce((acc, p) => acc + (p.contacts?.length ?? 0), 0) > 0) && (
          <Row
            label="Permit Contacts"
            prov="source-record"
            value={
              <span className="inline-flex items-center gap-1.5 text-[#B4E4D6]">
                <UserCheck className="h-4 w-4" />
                {(o.resolvingPermit?.contacts?.length ?? 0) + o.permits.reduce((acc, p) => acc + (p.contacts?.length ?? 0), 0)} direct contact{((o.resolvingPermit?.contacts?.length ?? 0) + o.permits.reduce((acc, p) => acc + (p.contacts?.length ?? 0), 0)) > 1 ? "s" : ""} on file
              </span>
            }
            note="Direct phone or email on record from municipal permit filings."
          />
        )}
      </div>

      {!compact && <FactorBars o={o} />}

      <div className="flex flex-wrap gap-2">
        <Link href={`/property/${parcel.id}`} className={buttonVariants({ size: "sm" })}>
          Property dossier <ArrowRight />
        </Link>
        {o.tier !== "outside" && (
          <Link href={`/property/${parcel.id}/brief`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            <FileText /> Advisory brief
          </Link>
        )}
      </div>
    </div>
  );
}
