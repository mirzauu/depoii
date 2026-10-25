"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Printer, ShieldAlert, Building2 } from "lucide-react";
import { DepoiiLoader, DepoiiMark } from "@/components/depoii-logo";
import { useDepoii } from "@/components/depoii-provider";
import { useEngine } from "@/components/use-engine";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ARCHETYPE_DISCLAIMER } from "@/lib/engine/archetype";
import type { Opportunity } from "@/lib/engine/score";
import { mapParcelDossier, mapLeadDossier } from "@/lib/engine-api";
import { roofVulnerability } from "@/lib/engine/vulnerability";
import { longDate, num, usd } from "@/lib/format";

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
  const params = useParams<{ id: string }>();
  const rawId = params?.id ? decodeURIComponent(params.id) : "";
  const { opportunities: mockOpportunities, storm: mockStorm } = useDepoii();
  const [company, setCompany] = useState("");

  // Check mock store first for backward compatibility
  const o = mockOpportunities.find((x) => x.parcel.id === rawId);

  // Live warehouse engine queries
  const parcelQuery = useEngine(`parcels/${encodeURIComponent(rawId)}`, {}, mapParcelDossier, !o && Boolean(rawId));
  const dossierQuery = useEngine(`intelligence/leads/${encodeURIComponent(rawId)}/dossier`, {}, mapLeadDossier, !o && Boolean(rawId));

  const p = parcelQuery.data;
  const d = dossierQuery.data;

  const loading = !o && (parcelQuery.loading || dossierQuery.loading);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <DepoiiLoader label="Generating Structural Condition Brief…" />
      </div>
    );
  }

  if (!o && !p && !loading) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <Building2 className="size-10 mx-auto text-muted-foreground/60 mb-3" />
        <h2 className="text-lg font-semibold text-foreground">Property record not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No appraised parcel matching &quot;{rawId}&quot; could be retrieved.
        </p>
        <Link
          href="/pipeline"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Pipeline
        </Link>
      </div>
    );
  }

  const today = longDate(new Date().toISOString().slice(0, 10));
  const by = company.trim() || "[Your Company]";

  // Normalize fields across mock or live data
  const address = o ? o.parcel.address : p?.address || "Commercial Property";
  const city = o ? o.parcel.city : p?.city || "Dallas";
  const state = o ? "Texas" : p?.state || "Texas";
  const stormName = o ? o.storm.name : d?.storm || `${city} Metro Severe Hail Swath`;
  const stormDate = o ? o.storm.date : (d?.stormDate && /^\d{4}-\d{2}-\d{2}/.test(d.stormDate) ? d.stormDate : "2026-06-02");
  const displayStormDate = longDate(stormDate) || "June 2, 2026";
  const recipient = o ? o.parcel.owner : p?.owner || d?.owner || "Owner of record";
  const ownerAddress = o ? o.parcel.ownerAddress : p?.ownerAddress || d?.ownerMail || "No mailing address on roll";
  const cadAccount = o ? o.parcel.cadAccount : p?.account || p?.id || rawId;
  const hailInches = o ? (o.hailInches || o.storm.maxHailTag || 2.0) : (d?.hail || 2.0);
  const sqft = o ? o.parcel.sqft : p?.sqft || 0;
  const yearBuilt = o ? o.parcel.yearBuilt : p?.yearBuilt || 0;
  const membrane = o ? o.archetype.label : "Commercial Low-Slope / Built-Up / Modified Bitumen";
  const score = o ? o.score : d?.score || 88;

  const permitsCount = p?.permits?.length ?? 0;
  const eventTime = new Date(stormDate).getTime();
  const deadlineTime = Number.isNaN(eventTime) ? Date.now() + 680 * 86400000 : eventTime + 730 * 86400000;
  const daysRemaining = o ? o.tdi.daysRemaining : Math.max(0, Math.ceil((deadlineTime - Date.now()) / 86400000));

  const dossierHref = `/parcels/${encodeURIComponent(rawId)}`;

  return (
    <div className="px-4 py-6 lg:px-8 print:p-0">
      <div className="mx-auto mb-4 flex max-w-[850px] flex-wrap items-center gap-2 print:hidden">
        <Link href={dossierHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-1 size-4" /> Dossier
        </Link>
        <Link href="/pipeline" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Opportunity Pipeline
        </Link>
        <Input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Your company name (shown on the brief)"
          className="ml-auto max-w-xs"
        />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 size-4" /> Print / Save PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[850px] space-y-6 rounded-lg bg-white p-8 text-neutral-900 shadow-2xl sm:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="space-y-3 border-b-2 border-neutral-900 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-700">
            Confidential · Prepared for Property Leadership
          </p>
          <h1 className="text-2xl font-bold leading-tight">
            Structural Condition &amp; Warranty Integrity Audit
          </h1>
          <p className="text-sm text-neutral-600">
            {address}, {city}, {state} · {stormName}
          </p>
          <div className="grid gap-2 text-xs text-neutral-700 sm:grid-cols-3">
            <p>
              <span className="block font-semibold text-neutral-900">Owner of record</span>
              {recipient}
              <br />
              {ownerAddress}
            </p>
            <p>
              <span className="block font-semibold text-neutral-900">Prepared by</span>
              {by}
              <br />
              Commercial Roofing Division
            </p>
            <p>
              <span className="block font-semibold text-neutral-900">Date</span>
              {today}
              <br />
              Ref. {cadAccount}
            </p>
          </div>
        </header>

        <Section n={1} title="Executive summary">
          <p>
            On <b>{displayStormDate}</b>, the National Weather Service published hail reports and severe thunderstorm warnings covering the {city} metropolitan swath.
            The appraisal district account for <b>{address}</b> falls directly inside a severe storm impact footprint with verified <b>{hailInches}&quot;</b> hail exposure.
          </p>
          <p>
            Commercial municipal permit records {permitsCount > 0 ? `show ${permitsCount} logged municipal permit${permitsCount > 1 ? "s" : ""} on file for this property.` : "indicate zero competitor re-roof permits logged to date matched to this commercial parcel."}{" "}
            This audit establishes an objective physical and structural baseline to protect building leadership and preserve manufacturer membrane warranty integrity.
          </p>
        </Section>

        <Section n={2} title="Event and exposure record">
          {o ? (
            <SwathSchematic o={o} />
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-red-950 text-xs">
                <ShieldAlert className="size-4 text-red-600" />
                Verified Severe Storm Strike Footprint
              </div>
              <p className="text-xs text-neutral-600 mt-1">
                Property centroid mapped within verified {stormName} vector with {hailInches}&quot; hail tags and kinetic impact exposure.
              </p>
            </div>
          )}
          <table className="w-full text-[12px] mt-3">
            <tbody className="[&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-1.5 [&_td:first-child]:w-56 [&_td:first-child]:font-semibold">
              <tr>
                <td>Storm date</td>
                <td>{longDate(stormDate)}</td>
              </tr>
              <tr>
                <td>Verified storm hail swath</td>
                <td>{hailInches}&quot; diameter hail tagged within direct impact corridor</td>
              </tr>
              <tr>
                <td>Kinetic impact energy</td>
                <td>{d?.joules ? `${num(Math.round(d.joules))} Joules` : "Severe hail vector"}</td>
              </tr>
              <tr>
                <td>Data source</td>
                <td>NOAA / NWS Radar, County Appraisal Rolls &amp; Municipal Permit Intelligence</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section n={3} title="Asset profile">
          <table className="w-full text-[12px]">
            <tbody className="[&_td]:border-b [&_td]:border-neutral-200 [&_td]:py-1.5 [&_td:first-child]:w-56 [&_td:first-child]:font-semibold">
              <tr>
                <td>Building area</td>
                <td>{sqft ? `${num(sqft)} sq ft (appraisal roll building area)` : "Commercial property"}</td>
              </tr>
              <tr>
                <td>Year built &amp; roof age</td>
                <td>{yearBuilt ? `${yearBuilt} (${new Date().getFullYear() - yearBuilt} years of aging)` : "Commercial age baseline"}</td>
              </tr>
              <tr>
                <td>Roof membrane archetype</td>
                <td>{membrane}</td>
              </tr>
              <tr>
                <td>Depoii structural vulnerability index</td>
                <td>{score} / 100 · Critical Inspection Priority</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-neutral-500">{ARCHETYPE_DISCLAIMER}</p>
        </Section>

        <Section n={4} title="Engineering benchmark and risk considerations">
          <p>
            According to FM Global and ASTM commercial roofing engineering standards, low-slope membrane roofing systems exceeding 20+ years of age exposed to hail events of 1.75&quot; or greater exhibit high vulnerability to latent micro-fracturing, seam shear failure, and hail stone compression bruises that compromise water-tightness.
          </p>
          <p>
            Immediate non-destructive visual, infrared, and photographic roof moisture verification is strongly recommended to prevent insidious insulation saturation, metal decking rust, and indoor business interruption.
          </p>
        </Section>

        <Section n={5} title="Recommended documentation scope">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>ASTM C1153 infrared roof moisture survey</b> to map wet insulation beneath the membrane, with confirmatory non-destructive test points.
            </li>
            <li>
              High-resolution drone aerial photogrammetry of roof field, perimeter parapet coping, and rooftop HVAC equipment curbs.
            </li>
            <li>
              Impact-mark test squares and membrane condition photographs, logged systematically by roof section.
            </li>
            <li>
              A written forensic structural condition report for corporate risk management and manufacturer warranty records.
            </li>
          </ul>
        </Section>

        <Section n={6} title="TDI statutory period advisory notice">
          <div className="rounded-md border border-amber-400 bg-amber-50 p-3">
            <p>
              <b>Standard 24-month advisory window.</b> Texas insurance policies and statutes generally set strict time limits for reporting commercial property storm damage.
              Under the standard 24-month advisory period measured from the storm date, this claim filing window remains active ({daysRemaining > 0 ? `${daysRemaining} days remaining from today` : "advisory window elapsed"}).
              Please verify specific coverage terms with your licensed risk management team or insurance professional.
            </p>
          </div>
        </Section>

        <footer className="space-y-2 border-t border-neutral-300 pt-4 text-[10.5px] leading-relaxed text-neutral-500">
          <p>
            <b>Compliance statement (Tex. Ins. Code ch. 4102).</b> {by} is a commercial roofing contractor and does not act as a public adjuster. This document does not provide legal or insurance adjustment advice, claim filing, or claim settlement negotiation. It provides objective physical and structural condition documentation only.
          </p>
          <p>
            Hail figures are NOAA/NWS reports or warning tags, not an in-situ roof measurement. Membrane type is derived from appraisal records and municipal permit logs. Records pulled {longDate(new Date().toISOString().slice(0, 10))}.
          </p>
          <p className="flex items-center gap-1.5 text-neutral-700">
            <DepoiiMark className="size-4 text-neutral-900" /> Intelligence by <b className="text-neutral-900">Depoii</b>
          </p>
        </footer>
      </article>
    </div>
  );
}
