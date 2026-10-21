import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Parcel, Permit } from "@/lib/types";

const BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
const PORTAL = "ATTOM building permit history";

export interface AttomBuilding {
  yearBuilt: number | null;
  sqft: number | null;
  roofCover: string | null;
  permits: Permit[];
}

function cacheDb() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "attom.sqlite"));
  db.exec(`CREATE TABLE IF NOT EXISTS attom_building (
    address_key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  )`);
  return db;
}

export function addressKey(address: string, city: string) {
  return `${city}|${address}`.toUpperCase().replace(/\s+/g, " ").trim();
}

function roofKind(text: string): Permit["kind"] | null {
  if (!/\b(re[\s-]?roof|reroof|tear[\s-]?off|shingles?|tpo|epdm|modified bitumen|built[\s-]?up|roof replacement|roofing|new roof|roof cover)\b/i.test(text)) return null;
  return /\b(re[\s-]?roof|reroof|tear[\s-]?off|shingles?|replacement|new roof)\b/i.test(text) ? "reroof" : "repair";
}

export function parseAttomBuilding(detail: unknown, permitsBody: unknown, parcel: Parcel): AttomBuilding {
  const prop = (detail as { property?: Record<string, unknown>[] })?.property?.[0] ?? {};
  const summary = (prop.summary ?? {}) as { yearbuilt?: number };
  const size = ((prop.building as { size?: { universalsize?: number; grosssize?: number } })?.size) ?? {};
  const cover = (prop.building as { construction?: { roofcover?: string } } | undefined)?.construction?.roofcover?.trim() || "";
  const year = Math.round(Number(summary.yearbuilt) || 0);
  const sqft = Math.round(Number(size.universalsize || size.grosssize) || 0);
  const raw = ((permitsBody as { property?: { buildingPermits?: Record<string, unknown>[] }[] })?.property?.[0]?.buildingPermits) ?? [];
  const permits: Permit[] = [];
  for (const row of raw) {
    const description = String(row.description ?? "");
    const type = String(row.type ?? "");
    const kind = roofKind(`${type} ${description}`);
    const issued = String(row.effectiveDate ?? "").slice(0, 10);
    const permitNo = String(row.permitNumber ?? "").trim();
    if (!kind || !issued || !permitNo) continue;
    const business = String(row.businessName ?? "").trim();
    permits.push({
      id: `ATTOM:${permitNo}`,
      market: parcel.market,
      permitNo,
      parcelId: parcel.id,
      parcelIds: [parcel.id],
      address: parcel.address,
      city: parcel.city,
      lat: parcel.lat,
      lng: parcel.lng,
      contractorId: null,
      contractorName: business || "Contractor not named on the permit",
      contractorState: "UNKNOWN",
      issued,
      valuation: 0,
      scope: (description || type).replace(/\s+/g, " ").trim(),
      kind,
      portal: PORTAL,
      recordUrl: "",
    });
  }
  return {
    yearBuilt: year >= 1800 ? year : null,
    sqft: sqft >= 1000 ? sqft : null,
    roofCover: cover && !/^unknown$/i.test(cover) ? cover : null,
    permits,
  };
}

async function getJson(pathAndQuery: string) {
  const key = process.env.ATTOM_API_KEY;
  if (!key) throw new Error("ATTOM_API_KEY is not set");
  const res = await fetch(`${BASE}${pathAndQuery}`, { headers: { apikey: key, Accept: "application/json" } });
  if (!res.ok) throw new Error(`ATTOM ${res.status}`);
  return res.json();
}

async function fetchBuilding(parcel: Parcel): Promise<AttomBuilding> {
  const address1 = encodeURIComponent(parcel.address);
  const address2 = encodeURIComponent(`${parcel.city}, TX`);
  const q = `address1=${address1}&address2=${address2}`;
  const [detail, permitsBody] = await Promise.all([
    getJson(`/property/detail?${q}`),
    getJson(`/property/buildingpermits?${q}`),
  ]);
  return parseAttomBuilding(detail, permitsBody, parcel);
}

function applyBuilding(parcel: Parcel, building: AttomBuilding) {
  if (building.yearBuilt) {
    parcel.yearBuilt = building.yearBuilt;
    parcel.yearBasis = "ATTOM property detail year built";
  }
  if (building.sqft) parcel.sqft = building.sqft;
  if (building.roofCover) parcel.roofCover = building.roofCover;
  parcel.permitSource = "attom";
}

/** Fill year, size, roof cover, and roof permits for in-swath Dallas buildings. Cached after the first read. */
export async function enrichDallasAttom(parcels: Parcel[], intoPermits: Permit[], limit = 60) {
  if (!process.env.ATTOM_API_KEY) return { fetched: 0, cached: 0 };
  const dallas = parcels.filter((p) => p.market === "dallas" && p.permitSource !== "attom");
  const targets = [
    ...dallas.filter((p) => p.tier && p.tier !== "outside"),
    ...dallas.filter((p) => !p.tier || p.tier === "outside"),
  ];
  const db = cacheDb();
  const read = db.prepare("SELECT payload FROM attom_building WHERE address_key = ?");
  const write = db.prepare("INSERT OR REPLACE INTO attom_building (address_key, payload, fetched_at) VALUES (?, ?, ?)");
  let fetched = 0;
  let cached = 0;
  const pending: Parcel[] = [];
  for (const parcel of targets) {
    const row = read.get(addressKey(parcel.address, parcel.city)) as { payload: string } | undefined;
    if (!row) {
      pending.push(parcel);
      continue;
    }
    const building = JSON.parse(row.payload) as AttomBuilding;
    applyBuilding(parcel, building);
    intoPermits.push(...building.permits.map((p) => ({ ...p, parcelId: parcel.id, parcelIds: [parcel.id] })));
    cached += 1;
  }
  const queue = pending.slice(0, limit);
  const workers = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const parcel = queue[cursor++];
      try {
        const building = await fetchBuilding(parcel);
        write.run(addressKey(parcel.address, parcel.city), JSON.stringify(building), new Date().toISOString());
        applyBuilding(parcel, building);
        intoPermits.push(...building.permits);
        fetched += 1;
      } catch {
        // Leave the appraisal year in place and do not treat a missing ATTOM read as "no permit".
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  db.close();
  return { fetched, cached };
}
