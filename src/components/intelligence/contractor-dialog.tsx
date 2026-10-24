"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { engineGet, mapPermitSearch, mapContractorProfile, type ContractorProfile, type EnginePermit } from "@/lib/engine-api";
import { pct, shortDate, usd } from "@/lib/format";
import { DepoiiLoader } from "@/components/depoii-logo";

function mapsUrl(address: string, lat: number | null, lng: number | null) {
  if (lat != null && lng != null) return `https://www.google.com/maps?q=${lat},${lng}&t=k`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function ContractorDialog({ contractor, onClose }: { contractor: ContractorProfile | null; onClose: () => void }) {
  return (
    <Dialog open={!!contractor} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        {contractor && <ContractorBody contractor={contractor} />}
      </DialogContent>
    </Dialog>
  );
}

export function ContractorBody({ contractor: initial, hideTitle = false }: { contractor: ContractorProfile; hideTitle?: boolean }) {
  const [profile, setProfile] = useState<ContractorProfile | null>(null);

  useEffect(() => {
    if (!initial.phone && !initial.website && !initial.rcatProfileUrl && !initial.bbbProfileUrl) {
      const controller = new AbortController();
      engineGet("contractors/profile", { name: initial.name || initial.id }, mapContractorProfile, controller.signal)
        .then((res) => { if (res) setProfile(res); })
        .catch(() => {});
      return () => controller.abort();
    }
  }, [initial.name, initial.id, initial.phone, initial.website, initial.rcatProfileUrl, initial.bbbProfileUrl]);

  const contractor = profile ?? initial;
  const [permits, setPermits] = useState<EnginePermit[] | null>(null);
  const [matched, setMatched] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const names = [contractor.name, ...contractor.aliases.filter((alias) => alias !== contractor.name)];
    setPermits(null);
    setError(null);
    (async () => {
      let last: EnginePermit[] = [];
      for (const name of names) {
        const page = await engineGet("permits/search", { contractor: name, limit: 100, sort_by: "date_desc" }, mapPermitSearch, controller.signal);
        last = page.permits;
        if (page.permits.length) {
          setMatched(name);
          setPermits(page.permits);
          return;
        }
      }
      setMatched("");
      setPermits(last);
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "The data engine did not respond.");
      setPermits([]);
    });
    return () => controller.abort();
  }, [contractor]);
  const facts: [string, string][] = [
    ["License", contractor.license],
    ["Phone", contractor.phone],
    ["Website", contractor.website],
    ["Headquarters", contractor.hq],
    ["Year founded", contractor.founded],
    ["Crew capacity", contractor.crew],
    ["Certifications", contractor.certifications.join(", ")],
    ["Ownership", contractor.ownership],
    ["Acquisition", contractor.acquisition],
    ["Subcontracting", contractor.subcontracting],
    ["Notes", contractor.maNotes],
  ];
  const aliases = contractor.aliases.filter((alias) => alias.trim().toLowerCase() !== contractor.name.trim().toLowerCase());

  return (
    <>
            <div>
              {!hideTitle && (
                <h2 className="flex items-center gap-3 text-lg font-semibold">
                  {contractor.logoUrl ? <img src={contractor.logoUrl} alt="" width={40} height={40} className="size-10 rounded-md bg-white object-contain p-1" /> : null}
                  {contractor.name}
                </h2>
              )}
              <p className="text-sm text-muted-foreground">
                {contractor.jurisdiction || "All locations"} · {contractor.permits.toLocaleString()} permits · {contractor.valuationLabel || usd(contractor.valuation, true)}{contractor.share > 0 ? ` · ${pct(contractor.share, 1)} share` : ""} · {contractor.roofSystem || "roof system not stated"}
              </p>
            </div>
            {aliases.length > 0 && (
              <p className="text-xs text-muted-foreground">Also filed as {aliases.join(", ")}</p>
            )}
            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="permits">All permits</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-4">
                {(contractor.rcatProfileUrl || contractor.bbbProfileUrl || contractor.linkedinCompanyUrl) && (
                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Verified Credentials & External Profiles
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {contractor.rcatProfileUrl && (
                        <a
                          href={contractor.rcatProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
                        >
                          <span className="font-semibold text-red-400">RCAT</span>
                          <span>{contractor.rcatLicenseType || "Licensed Contractor"}{contractor.rcatLicenseNumber ? ` (${contractor.rcatLicenseNumber})` : ""}</span>
                          <span className="text-[10px] opacity-75">↗</span>
                        </a>
                      )}
                      {contractor.bbbProfileUrl && (
                        <a
                          href={contractor.bbbProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/20"
                        >
                          <span className="font-semibold text-blue-400">BBB</span>
                          <span>{contractor.bbbRating ? `Rating: ${contractor.bbbRating}` : ""}{contractor.bbbAccredited ? " · Accredited" : ""}</span>
                          <span className="text-[10px] opacity-75">↗</span>
                        </a>
                      )}
                      {contractor.linkedinCompanyUrl && (
                        <a
                          href={contractor.linkedinCompanyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/20"
                        >
                          <span className="font-semibold text-sky-400">LinkedIn</span>
                          <span>Company Profile</span>
                          <span className="text-[10px] opacity-75">↗</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <dl className="grid gap-3 py-2 text-sm sm:grid-cols-2">
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="break-words">{value || "Not on record"}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Leadership</h3>
                  {contractor.leadership.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">Not on record</p>
                  ) : (
                    <ul className="mt-2 space-y-3 pb-2">
                      {contractor.leadership.map((person) => (
                        <li key={person.name}>
                          <p className="text-sm font-medium">{person.name}</p>
                          {person.title && <p className="text-xs text-muted-foreground">{person.title}</p>}
                          <p className="text-xs">
                            {[person.phone, person.email].filter(Boolean).join(" · ")}
                            {person.linkedin && (
                              <>
                                {" · "}
                                <a href={person.linkedin} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">LinkedIn</a>
                              </>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="permits">
                {permits == null && !error && <DepoiiLoader label={`Loading permits for ${contractor.name}…`} className="py-8" />}
                {error && <p className="py-6 text-sm text-red-300">{error}</p>}
                {permits && !permits.length && <p className="py-6 text-sm text-muted-foreground">No permits matched this contractor name or its aliases. The leaderboard name often differs from the name printed on the permit.</p>}
                {matched && matched !== contractor.name && <p className="pb-2 text-xs text-muted-foreground">Matched permits filed as {matched}.</p>}
                {!!permits?.length && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permit</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="hidden md:table-cell">Scope</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permits.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <span className="font-medium">{p.permitNumber}</span>
                            <span className="block text-xs text-muted-foreground">{p.issued ? shortDate(p.issued) : "—"} · {p.status || p.category}</span>
                          </TableCell>
                          <TableCell className="max-w-48">
                            <span className="block truncate">{p.address || "Address not published"}</span>
                            {(p.address || (p.lat != null && p.lng != null)) && (
                              <a href={mapsUrl(p.address, p.lat, p.lng)} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">Satellite</a>
                            )}
                          </TableCell>
                          <TableCell className="hidden max-w-64 truncate md:table-cell" title={p.description}>{p.description || "—"}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{p.valuation ? usd(p.valuation, true) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
    </>
  );
}
