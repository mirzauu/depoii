import { latestSnapshot, latestSnapshots, outcomeFor, parcelByAccount, permitsForAccount, reportsForStorm, warningCount, type PermitRow, type SnapshotRow } from "@/lib/db";

function qualifier(code: string) {
  if (code === "M") return "measured";
  if (code === "E") return "estimated";
  return "reported";
}

function permitLine(permit: PermitRow) {
  const membrane = permit.membrane ? ` Membrane named on the permit: ${permit.membrane}.` : "";
  return `${permit.permit_no} filed ${permit.issued} (${permit.kind}). ${permit.scope} Contractor on the filing: ${permit.contractor_name}. Job value recorded by the city: ${permit.valuation ? `$${permit.valuation.toLocaleString("en-US")}` : "none"}.${membrane}`;
}

function snapshotLine(snapshot: SnapshotRow) {
  return `Depoii score ${snapshot.score} on ${snapshot.scored_on} for storm ${snapshot.storm_date}. Tier: ${snapshot.tier}. Hail used in the score: ${snapshot.hail_inches}". ${snapshot.hail_basis} ${snapshot.unresolved ? "No roofing permit matched this address on or after the storm date." : "A roofing permit matched this address on or after the storm date, or the permit site was not fetched so absence was not scored."}`;
}

export async function accountCard(account: string, stormDate?: string) {
  const parcel = await parcelByAccount(account);
  if (!parcel) return null;
  const permits = await permitsForAccount(account);
  const snapshot = await latestSnapshot(account, stormDate);
  const outcome = await outcomeFor(account, snapshot?.storm_date);
  const cad = parcel.city === "Dallas" ? "Dallas Central Appraisal District" : "Tarrant Appraisal District";
  const permitOffice = parcel.city === "Dallas" ? "Dallas" : "Fort Worth";
  const lines = [
    `${parcel.address}, ${parcel.city}. ${cad} account ${parcel.account.includes(":") ? parcel.account.split(":").slice(1).join(":") : parcel.account}.`,
    `Owner of record: ${parcel.owner}.`,
    parcel.owner_address ? `Mailing address on the roll: ${parcel.owner_address}.` : "No mailing address on the roll.",
    `Year built and building area are not on the release record. Roof age and roof area are not stated.`,
    permits.length ? `${permitOffice} permits matched to this address: ${permits.map(permitLine).join(" ")}` : `No ${permitOffice} permit in the store is matched to this address.`,
    snapshot ? snapshotLine(snapshot) : "No score snapshot is stored for this account.",
    outcome
      ? `Field outcome logged ${outcome.loggedAt}: moisture ${outcome.moistureVerified ? "verified" : "not verified"}, scope ${outcome.scope}, contract value ${outcome.contractValue || 0}.${outcome.notes ? " Notes: " + outcome.notes : ""}`
      : "No field outcome is logged for this account.",
  ];
  return {
    card: lines.join(" "),
    parcel,
    permits,
    snapshot: snapshot ?? null,
    outcome: outcome ?? null,
  };
}

export async function stormCard(stormDate: string) {
  const reports = await reportsForStorm(stormDate);
  const warnings = await warningCount(stormDate);
  const scores = await latestSnapshots(stormDate);
  if (!reports.length && !warnings && !scores.rows.length) return null;
  const largest = reports[0];
  const buildings = [];
  for (const row of scores.rows) {
    const parcel = await parcelByAccount(row.account);
    buildings.push({
      account: row.account,
      address: parcel?.address ?? row.account,
      owner: parcel?.owner ?? "",
      score: row.score,
      tier: row.tier,
      hailInches: row.hail_inches,
      unresolved: Boolean(row.unresolved),
    });
  }
  const lines = [
    `Storm day ${stormDate}, North Texas (NWS Fort Worth office).`,
    reports.length
      ? `NWS Fort Worth hail reports stored: ${reports.length}. Largest: ${largest.inches}" (${qualifier(largest.qualifier)}) at ${largest.city || largest.county} on ${largest.valid}.`
      : "No NWS hail reports are stored for this day.",
    `NWS warning polygons stored: ${warnings}.`,
    scores.scoredOn
      ? `Latest scoring day ${scores.scoredOn}: ${scores.exposed} buildings inside a warning polygon, ${scores.unresolved} with no matching roofing permit after the storm.`
      : "No score snapshot is stored for this storm.",
    buildings.length ? `Highest scores: ${buildings.map((b) => `${b.address} (${b.owner}, score ${b.score}, ${b.hailInches}")`).join("; ")}.` : "",
  ];
  return { card: lines.filter(Boolean).join(" "), stormDate, reports, warningCount: warnings, scoredOn: scores.scoredOn, exposed: scores.exposed, unresolved: scores.unresolved, buildings };
}
