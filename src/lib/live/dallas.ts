import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { Parcel, Permit } from "@/lib/types";
import { dedupePermits } from "@/lib/live/dedupe";
import { extractContactsFromRecord } from "@/lib/contacts/hygiene";

const UA = "Depoii/1.0 (public-records dashboard)";
const ZIP_URL = "https://www.dallascad.org/ViewPDFs.aspx?type=3&id=%5C%5CDCAD.ORG%5CWEB%5CWEBDATA%5CWEBFORMS%5CDATA%20PRODUCTS%5CDCAD2026_CURRENT.ZIP";
const PARCELS = "https://maps.dcad.org/prdwa/rest/services/Property/ParcelQuery/MapServer/4/query";
const PERMITS = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/NewPermit_2008_2024/FeatureServer/0/query";
const PORTAL = "City of Dallas public permit map, extract through 2024-11-12";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DallasLoad {
  parcels: Parcel[];
  permits: Permit[];
  developments: Permit[];
  /** Set when the permit service itself did not return. */
  permitStatus: "ok" | "failed";
  note: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function streamZipCsv(zip: string, entry: string, onRow: (row: Record<string, string>) => void) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("unzip", ["-p", zip, entry], { stdio: ["ignore", "pipe", "ignore"] });
    const rl = readline.createInterface({ input: child.stdout });
    let headers: string[] | null = null;
    let failed = false;
    rl.on("line", (line) => {
      if (!line) return;
      const cols = parseCsvLine(line);
      if (!headers) {
        headers = cols;
        return;
      }
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      onRow(row);
    });
    child.on("error", (error) => {
      failed = true;
      reject(error);
    });
    child.on("close", (code) => {
      if (failed) return;
      if (code === 0) resolve();
      else reject(new Error(`Could not read ${entry} from the DCAD appraisal file.`));
    });
  });
}

async function appraisalZip() {
  const dir = path.join(process.cwd(), "data", "dcad");
  const dest = path.join(dir, "DCAD2026_CURRENT.ZIP");
  fs.mkdirSync(dir, { recursive: true });
  const fresh = fs.existsSync(dest) && Date.now() - fs.statSync(dest).mtimeMs < WEEK_MS && fs.statSync(dest).size > 50_000_000;
  if (fresh) return dest;
  const res = await fetch(ZIP_URL, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`DCAD appraisal file returned HTTP ${res.status}`);
  const tmp = `${dest}.part`;
  await fs.promises.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);
  return dest;
}

async function arcgis(url: string, params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, f: "json" });
  const res = await fetch(`${url}?${q}`, { headers: { Accept: "application/json", "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`Dallas records returned HTTP ${res.status}`);
  const data = (await res.json()) as { error?: { message?: string }; features?: { attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }[] };
  if (data.error) throw new Error(data.error.message || "Dallas map query failed");
  return data.features ?? [];
}

function centroid(ring: number[][] | undefined) {
  if (!ring?.length) return null;
  let lng = 0;
  let lat = 0;
  for (const pair of ring) {
    lng += pair[0];
    lat += pair[1];
  }
  return { lng: lng / ring.length, lat: lat / ring.length };
}

async function locate(ids: string[]) {
  const found = new Map<string, { lat: number; lng: number }>();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 25) batches.push(ids.slice(i, i + 25));
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      const where = `PARCELID IN (${batch.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`;
      const features = await arcgis(PARCELS, {
        where,
        outFields: "PARCELID",
        returnGeometry: "true",
        outSR: "4326",
      });
      for (const feature of features) {
        const id = String(feature.attributes?.PARCELID ?? "").trim();
        const point = centroid(feature.geometry?.rings?.[0]);
        if (id && point) found.set(id, { lat: point.lat, lng: point.lng });
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  return found;
}

async function loadParcels(): Promise<Parcel[]> {
  const zip = await appraisalZip();
  const buildings = new Map<string, { area: number; year: number; name: string }>();
  await streamZipCsv(zip, "COM_DETAIL.CSV", (row) => {
    const area = Math.round(Number(row.GROSS_BLDG_AREA) || 0);
    const year = Math.round(Number(row.YEAR_BUILT) || 0);
    if (area < 25000 || year < 1920) return;
    const account = row.ACCOUNT_NUM.trim();
    const prev = buildings.get(account);
    if (!prev || area > prev.area) buildings.set(account, { area, year, name: row.PROPERTY_NAME.trim() });
  });
  const accounts = new Map<string, { address: string; owner: string; mail: string; parcelId: string }>();
  await streamZipCsv(zip, "ACCOUNT_INFO.CSV", (row) => {
    if ((row.PROPERTY_CITY || "").trim().toUpperCase() !== "DALLAS") return;
    const account = row.ACCOUNT_NUM.trim();
    if (!buildings.has(account)) return;
    const address = `${row.STREET_NUM} ${row.FULL_STREET_NAME}`.replace(/\s+/g, " ").trim();
    const mail = [row.OWNER_ADDRESS_LINE1, row.OWNER_ADDRESS_LINE2, row.OWNER_CITY, row.OWNER_STATE, row.OWNER_ZIPCODE].map((p) => (p || "").trim()).filter(Boolean).join(", ");
    accounts.set(account, {
      address,
      owner: (row.OWNER_NAME1 || "").trim() || "Owner name blank on the roll",
      mail,
      parcelId: (row.GIS_PARCEL_ID || account).trim(),
    });
  });
  const points = await locate([...accounts.values()].map((a) => a.parcelId));
  const parcels: Parcel[] = [];
  for (const [account, info] of accounts) {
    const point = points.get(info.parcelId);
    const building = buildings.get(account);
    if (!point || !building) continue;
    parcels.push({
      id: `DCAD:${account}`,
      market: "dallas",
      cadAccount: account,
      cad: "DCAD",
      address: info.address,
      city: "Dallas",
      lat: point.lat,
      lng: point.lng,
      use: building.name || "Commercial improvement",
      sqft: building.area,
      yearBuilt: building.year,
      owner: info.owner,
      ownerAddress: info.mail,
      recordUrl: `https://www.dallascad.org/AcctDetailCom.aspx?ID=${encodeURIComponent(account)}`,
    });
  }
  return parcels;
}

function issuedDay(ms: unknown) {
  const n = Number(ms);
  if (!n) return "";
  return new Date(n).toISOString().slice(0, 10);
}

function toPermit(attributes: Record<string, unknown>, kind: Permit["kind"]): Permit | null {
  const no = String(attributes.PERMIT_No ?? "").trim();
  const issued = issuedDay(attributes.ISSUE_DATE);
  if (!no || !issued) return null;
  const scope = String(attributes.WORK_DESCRIPTION ?? "").replace(/\s+/g, " ").trim();
  const lat = Number(attributes.lat);
  const lng = Number(attributes.lng);
  const contacts = extractContactsFromRecord(`DALLAS:${no}`, attributes, PORTAL);
  return {
    id: `DALLAS:${no}`,
    market: "dallas",
    permitNo: no,
    parcelId: null,
    parcelIds: [],
    address: String(attributes.ADDRESS ?? "").replace(/\s+/g, " ").trim(),
    city: "Dallas",
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    contractorId: null,
    contractorName: "Contractor not named on the permit",
    contractorState: "UNKNOWN",
    issued,
    valuation: Math.round(Number(attributes.VALUE) || 0),
    scope: scope || String(attributes.PERMIT_TYPE ?? "").trim(),
    kind,
    membrane: undefined,
    portal: PORTAL,
    recordUrl: PERMITS.split("/query")[0],
    contacts: contacts.length > 0 ? contacts : undefined,
  };
}

async function permitRows(where: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const features = await arcgis(PERMITS, {
      where,
      outFields: "PERMIT_No,PERMIT_TYPE,ISSUE_DATE,ADDRESS,VALUE,AREA,WORK_DESCRIPTION",
      returnGeometry: "true",
      outSR: "4326",
      orderByFields: "ISSUE_DATE DESC",
      resultOffset: String(offset),
      resultRecordCount: "1000",
    });
    for (const feature of features) {
      const g = feature.geometry as { x?: number; y?: number } | undefined;
      rows.push({ ...(feature.attributes ?? {}), lat: g?.y, lng: g?.x });
    }
    if (features.length < 1000) break;
  }
  return rows;
}

async function loadPermits() {
  const roof = await permitRows("COMMERCIAL = 'Y' AND ISSUE_DATE >= DATE '2023-01-01' AND UPPER(WORK_DESCRIPTION) LIKE '%ROOF%'");
  const permits = dedupePermits(
    roof.flatMap((row) => {
      const scope = String(row.WORK_DESCRIPTION ?? "");
      if (!/\b(re[\s-]?roof|reroof|tear[\s-]?off|shingles?|tpo|epdm|modified bitumen|built[\s-]?up|roof replacement|roofing system|new roof)\b/i.test(scope)) return [];
      const kind = /\b(re[\s-]?roof|reroof|tear[\s-]?off|shingles?|replacement|new roof)\b/i.test(scope) ? "reroof" : "repair";
      const permit = toPermit(row, kind);
      return permit ? [permit] : [];
    }),
  );
  const built = await permitRows("COMMERCIAL = 'Y' AND AREA >= 20000 AND ISSUE_DATE >= DATE '2024-01-01'");
  const developments = dedupePermits(
    built.flatMap((row) => {
      const text = `${row.PERMIT_TYPE ?? ""} ${row.WORK_DESCRIPTION ?? ""}`.toUpperCase();
      if (!/\bNEW\b/.test(text)) return [];
      const permit = toPermit(row, "new-commercial");
      if (!permit) return [];
      const area = Math.round(Number(row.AREA) || 0);
      permit.scope = `${area ? area.toLocaleString("en-US") + " sq ft — " : ""}${permit.scope}`.trim();
      return [permit];
    }),
  ).slice(0, 40);
  return { permits, developments };
}

export async function loadDallas(): Promise<DallasLoad> {
  const parcels = await loadParcels();
  try {
    const { permits, developments } = await loadPermits();
    return {
      parcels,
      permits,
      developments,
      permitStatus: "ok",
      note: "Dallas permits are the City of Dallas public GIS extract through 12 Nov 2024. DallasNow does not publish a queryable feed for 2025–2026, so those years are not shown.",
    };
  } catch {
    return {
      parcels,
      permits: [],
      developments: [],
      permitStatus: "failed",
      note: "The Dallas permit site did not return. Dallas buildings are shown without a permit match, and a missing permit is not treated as unresolved.",
    };
  }
}
