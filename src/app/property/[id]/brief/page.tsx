"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { DepoiiMark } from "@/components/depoii-logo";
import { useDepoii } from "@/components/depoii-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARCHETYPE_DISCLAIMER } from "@/lib/engine/archetype";
import type { Opportunity } from "@/lib/engine/score";
import { roofVulnerability } from "@/lib/engine/vulnerability";
import { longDate, num } from "@/lib/format";

function SwathSchematic({ o }: { o: Opportunity }) {
  const shapes = o.storm.warnings.flatMap((w) => {
    const rings = w.geometry.type === "Polygon" ? [w.geometry.coordinates[0]] : w.geometry.coordinates.map((poly) => poly[0]);
    return rings.map((pts) => ({ pts, tier: w.tier }));
  });
  const all = [...shapes.flatMap((s) => s.pts), [o.parcel.lng, o.parcel.lat]];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  let [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  if (maxX === minX) { minX -= 0.01; maxX += 0.01; }
  if (maxY === minY) { minY -= 0.01; maxY += 0.01; }
  const W = 520;
  const H = 220;
  const sx = (x: number) => 10 + ((x - minX) / (maxX - minX)) * (W - 20);
  const sy = (y: number) => H - 10 - ((y - minY) / (maxY - minY)) * (H - 20);
  const path = (pts: number[][]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ") + "Z";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border border-neutral-300 bg-neutral-50" role="img" aria-label="NWS warning polygons relative to the property">
      {shapes.map((s, i) => (
        <path key={i} d={path(s.pts)} fill={s.tier === "core" ? "#dc262640" : "#f59e0b33"} stroke={s.tier === "core" ? "#dc2626" : "#d97706"} strokeWidth={1.5} />
      ))}
      <circle cx={sx(o.parcel.lng)} cy={sy(o.parcel.lat)} r={6} fill="#111" stroke="#fff" strokeWidth={2} />
      <text x={sx(o.parcel.lng) + 10} y={sy(o.parcel.lat) + 4} fontSize={12} fontWeight={600} fill="#111">{o.parcel.address}</text>
      <text x={12} y={18} fontSize={10} fill="#555">Amber: NWS severe thunderstorm warning · Red: warning with a 2&quot;+ hail tag or report</text>
    </svg>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-2">
      <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wider text-neutral-800">
        {n}. {title}
      </h2>
      <div className="space-y-2 text-[13px] leading-relaxed text-neutral-800">{children}</div>
    </section>
  );
}

export default function BriefPage() {
  const { id } = useParams<{ id: string }>();
  const { opportunities } = useDepoii();
  const [company, setCompany] = useState("");
  const o = opportunities.find((x) => x.parcel.id === id);

  if (!o) return <div className="p-10 text-center text-sm text-muted-foreground">That account is not in the Fort Worth extract.</div>;
  if (o.tier === "outside")
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        This property is outside the selected storm swath, so no loss advisory applies. Pick another storm in the header, or go{" "}
        <Link href={`/property/${o.parcel.id}`} className="underline">back to the dossier</Link>.
      </div>
    );

  const v = roofVulnerability(o);
  const { parcel, storm } = o;
  const recipient = parcel.owner;
  const today = longDate(new Date().toISOString().slice(0, 10));
  const by = company.trim() || "[Your Company]";

  return (
    <div className="px-4 py-6 lg:px-8 print:p-0">
      <div className="mx-auto mb-4 flex max-w-[850px] flex-wrap items-center gap-2 print:hidden">
        <Link href={`/property/${parcel.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft /> Dossier
        </Link>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company name (shown on the brief)" className="ml-auto max-w-xs" />
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print / Save PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[850px] space-y-6 rounded-lg bg-white p-8 text-neutral-900 shadow-2xl sm:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="space-y-3 border-b-2 border-neutral-900 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-700">Confidential · Prepared for Property Leadership</p>
          <h1 className="text-2xl font-bold leading-tight">Structural Condition &amp; Warranty Integrity Audit</h1>
          <p className="text-sm text-neutral-600">
            {parcel.address}, {parcel.city}, Texas · {storm.name}
          </p>
          <div className="grid gap-2 text-xs text-neutral-700 sm:grid-cols-3">
            <p><span className="block font-semibold text-neutral-900">Owner of record</span>{recipient}<br />{parcel.ownerAddress || "No mailing address on the roll"}</p>
            <p><span className="block font-semibold text-neutral-900">Prepared by</span>{by}<br />Commercial Roofing Division</p>
            <p><span className="block font-semibold text-neutral-900">Date</span>{today}<br />Ref. {parcel.cadAccount}</p>
          </div>
        </header>

        <Section n={1} title="Executive summary">
          <p>
            On <b>{longDate(storm.date)}</b>, the National Weather Service Fort Worth office published hail reports and severe thunderstorm warnings covering parts of North Texas.
            The {parcel.cad === "DCAD" ? "Dallas Central Appraisal District" : "Tarrant Appraisal District"} account for <b>{parcel.address}</b> falls inside {o.tier === "core" ? "a warning polygon classed as core because it carried a 2 inch or larger hail tag or contained such a report" : "a severe thunderstorm warning polygon"}.
          </p>
          <p>{o.parcel.hailBasis}</p>
          <p>
            {parcel.permitSource === "attom" ? "ATTOM" : parcel.city === "Dallas" ? "City of Dallas" : "City of Fort Worth"} permit records {o.resolvingPermit ? `include ${o.resolvingPermit.permitNo}, filed ${o.resolvingPermit.issued}, matched to this street address` : o.permitKnown ? "show no roofing permit filed on or after the storm date" : "were not retrieved for this building, so this brief does not say that no permit exists"}.
            This brief does not state that the roof is damaged.
          </p>
        </Section>

        <Section n={2} title="Event and exposure record">
          <SwathSchematic o={o} />
          <table className="w-full text-[12px]">
            <tbody className="[&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-1.5 [&_td:first-child]:w-56 [&_td:first-child]:font-semibold">
              <tr><td>Storm date</td><td>{longDate(storm.date)}</td></tr>
              <tr><td>Largest nearby NWS report</td><td>{o.hailInches ? `${o.hailInches}" within 8 km` : "None within 8 km"}</td></tr>
              <tr><td>Largest warning hail tag that day</td><td>{storm.maxHailTag ? `${storm.maxHailTag}"` : "No warning carried a hail tag"}</td></tr>
              <tr><td>Data source</td><td>{storm.source}</td></tr>
            </tbody>
          </table>
        </Section>

        <Section n={3} title="Asset profile">
          <table className="w-full text-[12px]">
            <tbody className="[&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-1.5 [&_td:first-child]:w-56 [&_td:first-child]:font-semibold">
              <tr><td>{parcel.cad} building area</td><td>{num(parcel.sqft)} sq ft. This is the appraisal living/building area, not a measured roof area. Account {parcel.cadAccount}.</td></tr>
              <tr><td>Year built</td><td>{parcel.yearBuilt} ({o.roofBaselineBasis})</td></tr>
              <tr><td>Membrane</td><td>{o.archetype.label}. {o.archetype.basis}</td></tr>
              <tr><td>Depoii age/hail index</td><td>{v.index}/100 · {v.rating}. This is a weighting of public fields, not an inspection.</td></tr>
            </tbody>
          </table>
          <p className="text-[11px] text-neutral-500">{ARCHETYPE_DISCLAIMER}</p>
        </Section>

        <Section n={4} title="Engineering benchmark and risk considerations">
          <p>{v.fmBenchmark}</p>
          <p>{v.recommendation}</p>
        </Section>

        <Section n={5} title="Recommended documentation scope">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>ASTM C1153 infrared roof moisture survey</b> to map wet insulation beneath the membrane, with confirmatory core samples.</li>
            <li>High-resolution drone imagery of field, perimeter, flashing and rooftop equipment curbs.</li>
            <li>Impact-mark test squares and membrane condition photographs, logged by roof section.</li>
            <li>A written condition report for your risk management team and the membrane manufacturer.</li>
          </ul>
        </Section>

        <Section n={6} title="TDI statutory period advisory notice">
          <div className="rounded-md border border-amber-400 bg-amber-50 p-3">
            <p>
              <b>Standard 24-month advisory window.</b> Texas insurance policies and statutes generally set time limits for reporting property damage.
              Under a standard 24-month advisory period measured from the storm date, the window for this event{" "}
              {o.tdi.status === "closed" ? <>elapsed on <b>{longDate(o.tdi.deadline)}</b></> : <>closes on <b>{longDate(o.tdi.deadline)}</b> ({o.tdi.daysRemaining} days from today)</>}.
              Your actual policy terms may differ. Please confirm the deadlines that apply with your licensed insurance professional or risk management team.
            </p>
          </div>
        </Section>

        <footer className="space-y-2 border-t border-neutral-300 pt-4 text-[10.5px] leading-relaxed text-neutral-500">
          <p>
            <b>Compliance statement (Tex. Ins. Code ch. 4102).</b> {by} is a roofing contractor and does not act as a public adjuster. This document does not
            give advice on insurance coverage, claim filing or claim settlement, and does not negotiate on behalf of the property owner. It provides objective
            physical-condition documentation only. Direct all insurance questions to your licensed insurance professional.
          </p>
          <p>Hail figures are NWS reports or warning tags, not a measurement on this roof. Membrane type is omitted unless a permit states it. Records pulled {longDate(new Date().toISOString().slice(0, 10))}.</p>
          <p className="flex items-center gap-1.5 text-neutral-700">
            <DepoiiMark className="size-4 text-neutral-900" /> Intelligence by <b className="text-neutral-900">Depoii</b>
          </p>
        </footer>
      </article>
    </div>
  );
}
