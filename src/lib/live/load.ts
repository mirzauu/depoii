import { booleanPointInPolygon, distance, point } from "@turf/turf";
import type { MultiPolygon, Polygon } from "geojson";
import { persistLive } from "@/lib/db";
import { dedupePermits } from "@/lib/live/dedupe";
import { extractContactsFromRecord } from "@/lib/contacts/hygiene";
import type { FeedStatus, HailReport, LivePayload, Parcel, Permit, PermitKind, Storm, StormSummary, SwathTier, WarningPolygon } from "@/lib/types";

export { dedupePermits };

const UA = "Depoii/1.0 (public-records dashboard)";
const TTL_MS = 45 * 60 * 1000;
const PARCELS = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/FeatureServer/0/query";
const PERMITS = "https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/Permits/MapServer/0/query";
const PORTAL = "City of Fort Worth Development Services — CIVIC/Permits";
const PERMIT_URL = "https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/Permits/MapServer/0";

/** Dallas and Fort Worth, still on the NWS Fort Worth office. */
const BOX = { west: -97.55, east: -96.45, south: 32.55, north: 33.05 };
const MIN_HAIL = 1;
const NEAR_KM = 8;

const STREET_WORDS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "ST", "STREET", "DR", "DRIVE", "RD", "ROAD", "AVE", "AVENUE", "BLVD", "BOULEVARD", "LN", "LANE", "CT", "COURT", "WAY", "PKWY", "PARKWAY", "CIR", "CIRCLE", "TRL", "TRAIL", "PL", "PLACE", "HWY", "HIGHWAY", "EXPY", "EXPW", "FWY"]);

interface Cache {
  at: number;
  parcels: Parcel[];
  permits: Permit[];
  developments: Permit[];
  reports: HailReport[];
  warnings: Record<string, WarningPolygon[]>;
  hailEvents: StormSummary[] | null;
  hailCenters: Record<string, { lat: number; lng: number }>;
  hailSource: string;
  hailState: string;
  placeKey: string;
  dallasPermit: FeedStatus;
  dallasNote: string;
}

let memory: Cache | null = null;
const warningMemo = new Map<string, WarningPolygon[]>();

let httpDone = 0;
let httpTotal = 0;
let onHttp: ((done: number, total: number) => void) | null = null;

function planHttp(count: number) {
  httpTotal += count;
  onHttp?.(httpDone, Math.max(httpTotal, 1));
}

function trackedFetch(base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    try {
      return await base(input, init);
    } finally {
      httpDone += 1;
      if (httpDone > httpTotal) httpTotal = httpDone;
      onHttp?.(httpDone, httpTotal);
    }
  };
}

async function getJson(url: string): Promise<unknown> {
  const res = await trackedFetch()(url, { headers: { Accept: "application/json", "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${res.status}`);
  return res.json();
}

async function arcgis(url: string, params: Record<string, string>, pageSize = 1000): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const q = new URLSearchParams({ ...params, resultOffset: String(offset), resultRecordCount: String(pageSize), f: "json" });
    const data = (await getJson(`${url}?${q}`)) as { error?: { message?: string }; features?: Record<string, unknown>[]; exceededTransferLimit?: boolean };
    if (data.error) throw new Error(data.error.message || "ArcGIS query failed");
    const features = data.features ?? [];
    rows.push(...features);
    if (!data.exceededTransferLimit && features.length < pageSize) break;
  }
  return rows;
}

const trim = (v: unknown) => String(v ?? "").trim();

function chicagoDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addressKey(num: unknown, street: string, city = "") {
  const n = parseInt(String(num), 10);
  const words = street
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STREET_WORDS.has(w));
  if (!n || !words.length) return null;
  return `${city.toUpperCase()}|${n}|${words.slice(0, 2).join(" ")}`;
}

function membraneFrom(scope: string) {
  const rules: [RegExp, string][] = [
    [/\bTPO\b/i, "TPO"],
    [/\bEPDM\b/i, "EPDM"],
    [/\bPVC\b/i, "PVC"],
    [/tar and gravel|built[\s-]?up|\bBUR\b/i, "Built-up tar and gravel"],
    [/mod[\s-]?bit|modified bitumen/i, "Modified bitumen"],
    [/shingles?/i, "Shingles"],
    [/polyiso|membrane/i, "Membrane (as written on the permit)"],
    [/metal roof|standing seam/i, "Metal"],
  ];
  return rules.find(([re]) => re.test(scope))?.[1];
}

function isRoofingScope(scope: string) {
  return /\b(re[\s-]?roof|reroof|tear[\s-]?off|shingles?|tpo|epdm|modified bitumen|built[\s-]?up|roof replacement|roofing system|new roof)\b/i.test(scope);
}

function permitKind(scope: string): PermitKind {
  return /\b(re[\s-]?roof|reroof|tear[\s-]?off|shingles?|replacement|new roof)\b/i.test(scope) ? "reroof" : "repair";
}

function contractorState(name: string) {
  const m = name.match(/,\s*([A-Z]{2})\s+\d{5}\b/);
  return m?.[1] ?? "UNKNOWN";
}

function slug(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\b(INC|LLC|LP|CO|CORP|CORPORATION|COMPANY|LTD)\b/g, "").trim().replace(/\s+/g, "-").slice(0, 48) || "unnamed";
}

function epochDay(ms: unknown) {
  const n = Number(ms);
  if (!n) return "";
  return new Date(n).toISOString().slice(0, 10);
}

async function loadParcels(): Promise<Parcel[]> {
  const features = await arcgis(PARCELS, {
    where: "CITY LIKE 'FORT WORTH%' AND LIVING_ARE >= 25000 AND YEAR_BUILT >= 1920",
    outFields: "ACCOUNT,OWNER_NAME,OWNER_ADDR,OWNER_CITY,OWNER_ZIP,SITUS_ADDR,YEAR_BUILT,LIVING_ARE,CITY,STREET_NO,STREET_NAM",
    returnGeometry: "false",
    returnCentroid: "true",
    outSR: "4326",
    orderByFields: "ACCOUNT",
  });
  return features.flatMap((f) => {
    const a = (f.attributes ?? {}) as Record<string, unknown>;
    const c = f.centroid as { x?: number; y?: number } | undefined;
    if (!c || typeof c.x !== "number" || typeof c.y !== "number") return [];
    const account = trim(a.ACCOUNT);
    const mail = [trim(a.OWNER_ADDR), trim(a.OWNER_CITY), trim(a.OWNER_ZIP)].filter(Boolean).join(", ");
    return [{
      id: `TAD:${account}`,
      market: "fort-worth" as const,
      cadAccount: account,
      cad: "TAD",
      address: trim(a.SITUS_ADDR) || `${trim(a.STREET_NO)} ${trim(a.STREET_NAM)}`.trim(),
      city: "Fort Worth",
      lat: c.y,
      lng: c.x,
      use: "Improved building",
      sqft: Math.round(Number(a.LIVING_ARE) || 0),
      yearBuilt: Math.round(Number(a.YEAR_BUILT) || 0),
      owner: trim(a.OWNER_NAME) || "Owner name blank on the roll",
      ownerAddress: mail,
      recordUrl: `${PARCELS.split("/query")[0]}/query?where=ACCOUNT%3D%27${encodeURIComponent(account)}%27&outFields=*&f=html`,
      tier: "outside" as SwathTier,
      hailInches: 0,
      hailBasis: "Outside the NWS warning polygons for this event.",
      hailProvenance: "depoii-modeled" as const,
    }];
  });
}

function toPermit(f: Record<string, unknown>, kind: PermitKind): Permit | null {
  const a = (f.attributes ?? {}) as Record<string, unknown>;
  const no = trim(a.Permit_No);
  const issued = epochDay(a.File_Date);
  if (!no || !issued) return null;
  const scope = trim(a.B1_WORK_DESC);
  const contractor = trim(a.B1_SPECIAL_TEXT);
  const lat = Number(a.Latitude);
  const lng = Number(a.Longitude);
  const contacts = extractContactsFromRecord(no, a, PORTAL);
  return {
    id: no,
    market: "fort-worth",
    permitNo: no,
    parcelId: null,
    parcelIds: [],
    address: trim(a.Address),
    city: "Fort Worth",
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    contractorId: contractor ? slug(contractor) : null,
    contractorName: contractor || "Contractor not named on the permit",
    contractorState: contractor ? contractorState(contractor) : "UNKNOWN",
    issued,
    valuation: Math.round(Number(a.JobValue) || 0),
    scope: scope || trim(a.Permit_SubType),
    kind,
    membrane: membraneFrom(scope),
    portal: PORTAL,
    recordUrl: PERMIT_URL,
    contacts: contacts.length > 0 ? contacts : undefined,
  };
}

async function loadRoofPermits(): Promise<Permit[]> {
  const features = await arcgis(PERMITS, {
    where: "Permit_Type='Commercial Building Permit' AND File_Date >= DATE '2023-01-01' AND (UPPER(B1_WORK_DESC) LIKE '%ROOF%' OR UPPER(B1_WORK_DESC) LIKE '%SHINGLE%' OR UPPER(B1_WORK_DESC) LIKE '%TPO%')",
    outFields: "Permit_No,Address,File_Date,JobValue,SqFt,Use_Type,B1_WORK_DESC,B1_SPECIAL_TEXT,Latitude,Longitude",
    returnGeometry: "false",
    orderByFields: "File_Date",
  });
  return dedupePermits(features.flatMap((f) => {
    const scope = trim((f.attributes as { B1_WORK_DESC?: string } | undefined)?.B1_WORK_DESC);
    if (!isRoofingScope(scope)) return [];
    const p = toPermit(f, permitKind(scope));
    return p ? [p] : [];
  }));
}

async function loadDevelopments(): Promise<Permit[]> {
  const features = await arcgis(PERMITS, {
    where: "Permit_Type='Commercial Building Permit' AND Permit_SubType='New' AND File_Date >= DATE '2026-01-01'",
    outFields: "Permit_No,Address,File_Date,JobValue,SqFt,Use_Type,B1_WORK_DESC,B1_SPECIAL_TEXT,Latitude,Longitude",
    returnGeometry: "false",
    orderByFields: "File_Date DESC",
  }, 500);
  const rows: Permit[] = [];
  for (const f of features) {
    const a = (f.attributes ?? {}) as Record<string, unknown>;
    const sqft = Number(a.SqFt);
    if (!sqft || sqft < 20000) continue;
    const p = toPermit(f, "new-commercial");
    if (!p) continue;
    const use = trim(a.Use_Type);
    p.scope = `${use ? use + " — " : ""}${p.scope}`.trim();
    p.membrane = undefined;
    rows.push(p);
  }
  return dedupePermits(rows).slice(0, 40);
}

async function loadReports(): Promise<HailReport[]> {
  const q = new URLSearchParams({
    wfo: "FWD",
    sts: "2024-03-01T00:00:00Z",
    ets: new Date(Date.now() + 86400000).toISOString(),
    west: String(BOX.west),
    east: String(BOX.east),
    south: String(BOX.south),
    north: String(BOX.north),
  });
  const data = (await getJson(`https://mesonet.agron.iastate.edu/geojson/lsr.geojson?${q}`)) as {
    features?: { properties: Record<string, unknown> }[];
  };
  return (data.features ?? []).flatMap((f, i) => {
    const p = f.properties;
    if (p.typetext !== "HAIL") return [];
    const inches = Number(p.magf);
    if (!inches || inches < MIN_HAIL) return [];
    return [{
      id: `${p.product_id ?? i}-${p.valid}`,
      valid: String(p.valid),
      lat: Number(p.lat),
      lng: Number(p.lon),
      inches,
      qualifier: trim(p.qualifier),
      city: trim(p.city),
      county: trim(p.county),
      source: trim(p.source),
      remark: trim(p.remark),
    }];
  });
}

async function loadWarnings(day: string): Promise<WarningPolygon[]> {
  if (warningMemo.has(day)) return warningMemo.get(day)!;
  const q = new URLSearchParams({ wfo: "FWD", sts: `${day}T05:00:00Z`, ets: `${addDays(day, 1)}T06:00:00Z` });
  const data = (await getJson(`https://mesonet.agron.iastate.edu/geojson/sbw.geojson?${q}`)) as {
    features?: { properties: Record<string, unknown>; geometry: Polygon | MultiPolygon }[];
  };
  const rows: WarningPolygon[] = (data.features ?? []).flatMap((f) => {
    if (f.properties.phenomena !== "SV" || f.properties.significance !== "W" || !f.geometry) return [];
    return [{
      eventId: Number(f.properties.eventid),
      hailTag: Number(f.properties.hailtag) || 0,
      windTag: Number(f.properties.windtag) || 0,
      issue: String(f.properties.issue ?? ""),
      expire: String(f.properties.expire ?? ""),
      href: String(f.properties.href ?? ""),
      tier: "envelope" as const,
      basis: "",
      geometry: f.geometry,
    }];
  });
  warningMemo.set(day, rows);
  return rows;
}

function classify(warnings: WarningPolygon[], reports: HailReport[]): WarningPolygon[] {
  return warnings.flatMap((w) => {
    let holds15 = false;
    let holds2 = false;
    for (const r of reports) {
      if (r.inches < 1.5) continue;
      let inside = false;
      try {
        inside = booleanPointInPolygon(point([r.lng, r.lat]), w.geometry);
      } catch {
        inside = false;
      }
      if (!inside) continue;
      holds15 = true;
      if (r.inches >= 2) holds2 = true;
    }
    const core = w.hailTag >= 2 || holds2;
    const envelope = core || w.hailTag >= 1 || holds15;
    if (!envelope) return [];
    const basis = core
      ? w.hailTag >= 2
        ? `NWS warning ${w.eventId} hail tag ${w.hailTag}"`
        : `NWS warning ${w.eventId} contains a measured or estimated report of 2" or larger`
      : w.hailTag >= 1
        ? `NWS warning ${w.eventId} hail tag ${w.hailTag}"`
        : `NWS warning ${w.eventId} contains a report of 1.5" or larger`;
    return [{ ...w, tier: core ? "core" as const : "envelope" as const, basis }];
  });
}

function tagParcels(parcels: Parcel[], warnings: WarningPolygon[], reports: HailReport[]): Parcel[] {
  const cores = warnings.filter((w) => w.tier === "core");
  const envs = warnings.filter((w) => w.tier === "envelope");
  return parcels.map((parcel) => {
    const pt = point([parcel.lng, parcel.lat]);
    const inside = (w: WarningPolygon) => {
      try {
        return booleanPointInPolygon(pt, w.geometry);
      } catch {
        return false;
      }
    };
    const coreHit = cores.find(inside);
    const envHit = coreHit ?? envs.find(inside);
    const tier: SwathTier = coreHit ? "core" : envHit ? "envelope" : "outside";
    let best: HailReport | null = null;
    let bestKm = Infinity;
    for (const r of reports) {
      const km = distance(pt, point([r.lng, r.lat]), { units: "kilometers" });
      if (km <= NEAR_KM && km < bestKm) {
        best = r;
        bestKm = km;
      }
    }
    const tag = (coreHit ?? envHit)?.hailTag ?? 0;
    const inches = best ? Math.max(best.inches, tier === "outside" ? 0 : tag) : tier === "outside" ? 0 : tag;
    const qual = best?.qualifier === "M" ? "measured" : best?.qualifier === "E" ? "estimated" : "reported";
    const hailBasis = best
      ? `Largest NWS hail report within ${NEAR_KM} km: ${best.inches}" (${qual}) at ${best.city || best.county}, ${best.valid.replace("T", " ").replace("Z", " UTC")}.${best.remark ? " " + best.remark : ""} This is not a reading taken on this roof.`
      : envHit
        ? `Inside ${envHit.basis}. No NWS hail report within ${NEAR_KM} km of this parcel.`
        : "This parcel is outside the NWS severe-thunderstorm warning polygons for this event.";
    const hailProvenance = best ? "source-record" as const : envHit ? "radar-modeled" as const : "depoii-modeled" as const;
    return { ...parcel, tier, hailInches: inches, hailBasis, hailProvenance };
  });
}

function linkPermits(parcels: Parcel[], permits: Permit[]) {
  const byKey = new Map<string, Parcel[]>();
  for (const parcel of parcels) {
    const key = addressKey(parcel.address.split(" ")[0], parcel.address, parcel.city);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(parcel);
    byKey.set(key, list);
  }
  return permits.map((p) => {
    const key = addressKey(p.address.split(" ")[0], p.address, p.city);
    const hits = (key && byKey.get(key)) || [];
    const ids = hits.map((h) => h.id);
    return { ...p, parcelIds: ids, parcelId: ids[0] ?? null };
  });
}

function catalog(reports: HailReport[]): StormSummary[] {
  const byDay = new Map<string, HailReport[]>();
  for (const r of reports) {
    const day = chicagoDate(r.valid);
    const list = byDay.get(day) ?? [];
    list.push(r);
    byDay.set(day, list);
  }
  return [...byDay.entries()]
    .filter(([, rs]) => Math.max(...rs.map((r) => r.inches)) >= 1.5 && rs.length >= 2)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([day, rs]) => {
      const max = Math.max(...rs.map((r) => r.inches));
      const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
      const long = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
      return {
        id: day,
        date: day,
        name: `${long} — North Texas hail reports`,
        shortName: `${label} · North Texas`,
        maxHail: max,
        reportCount: rs.length,
      };
    });
}

export async function loadLive(opts: { stormId?: string | null; refresh?: boolean; jurisdiction?: string | null }, onProgress?: (done: number, total: number) => void): Promise<LivePayload> {
  httpDone = 0;
  httpTotal = 0;
  onHttp = onProgress ?? null;
  const state = opts.jurisdiction?.split(",")[1]?.trim().toUpperCase() || "TX";
  const city = opts.jurisdiction?.split(",")[0]?.trim() || "";
  if (memory && (!memory.hailCenters || memory.hailState !== state)) {
    memory = null;
    warningMemo.clear();
  }
  if (opts.refresh) {
    memory = null;
    warningMemo.clear();
  }
  const placeKey = `${city}|${state}`;
  const local = /^(dallas|fort worth)$/i.test(city);
  if (!memory || Date.now() - memory.at > TTL_MS) {
    const skipWarehouse = Boolean(city) && (state !== "TX" || !local);
    const { loadDallas } = await import("@/lib/live/dallas");
    const { loadEngine } = await import("@/lib/live/engine");
    if (!skipWarehouse) planHttp(3);
    const engine = skipWarehouse ? { fortWorth: null, dallas: null, note: "" } : await loadEngine(trackedFetch(), city.toLowerCase().includes("fort worth") ? "fort-worth" : "dallas");
    const engineFw = engine.fortWorth && engine.fortWorth.parcels.length > 0 && engine.fortWorth.permitsOk ? engine.fortWorth : null;
    const engineDal = engine.dallas && engine.dallas.parcels.length > 0 && engine.dallas.permitsOk ? engine.dallas : null;
    const [parcels, permits, developments, reports, dallas] = await Promise.all([
      engineFw || skipWarehouse ? Promise.resolve([] as Parcel[]) : loadParcels(),
      engineFw || skipWarehouse ? Promise.resolve([] as Permit[]) : loadRoofPermits(),
      engineFw || skipWarehouse ? Promise.resolve([] as Permit[]) : loadDevelopments(),
      Promise.resolve([] as HailReport[]),
      engineDal || skipWarehouse
        ? Promise.resolve({
            parcels: engineDal?.parcels ?? [],
            permits: engineDal?.permits ?? [],
            developments: engineDal?.developments ?? [],
            permitStatus: "ok" as const,
            note: skipWarehouse ? "" : "Dallas parcels and permits were read from the Depoii data engine.",
          })
        : loadDallas().catch(() => ({
            parcels: [] as Parcel[],
            permits: [] as Permit[],
            developments: [] as Permit[],
            permitStatus: "failed" as const,
            note: "Dallas appraisal and permit records were not fetched. Dallas buildings are not shown.",
          })),
    ]);
    const dallasNote = [engine.note, dallas.note].filter(Boolean).join(" ");
    memory = {
      at: Date.now(),
      parcels: [...(engineFw ? engineFw.parcels : parcels), ...dallas.parcels],
      permits: [...(engineFw ? engineFw.permits : permits), ...dallas.permits],
      developments: [...(engineFw ? engineFw.developments : developments), ...dallas.developments],
      reports,
      warnings: {},
      hailEvents: null,
      hailCenters: {},
      hailSource: "",
      hailState: state,
      placeKey: "",
      dallasPermit: dallas.permitStatus,
      dallasNote,
    };
  }
  if (memory.placeKey !== placeKey && city && (state !== "TX" || !local)) {
    const { loadCityParcels } = await import("@/lib/live/engine");
    planHttp(city.toLowerCase().endsWith(" city") ? 2 : 1);
    const cityParcels = await loadCityParcels(city, state, trackedFetch());
    if (cityParcels.length) {
      memory.parcels = cityParcels;
      memory.placeKey = placeKey;
    }
  }
  const { loadHailEvents } = await import("@/lib/live/engine");
  const wanted = opts.stormId && /^\d{4}-\d{2}-\d{2}$/.test(opts.stormId) ? opts.stormId : undefined;
  if (!memory.hailEvents || (wanted && !memory.warnings[wanted])) {
    planHttp(1);
    const hail = await loadHailEvents(wanted, trackedFetch(), state);
    if (hail) {
      memory.hailEvents = hail.events;
      memory.hailCenters = hail.centers;
      memory.hailSource = hail.source;
      memory.warnings[hail.selected.date] = hail.selected.warnings;
      memory.reports = [...memory.reports.filter((r) => chicagoDate(r.valid) !== hail.selected.date), ...hail.selected.reports];
    }
  }
  if (!memory.hailEvents && !memory.reports.length) {
    planHttp(1);
    memory.reports = await loadReports();
  }
  const cataloged = memory.hailEvents?.length ? memory.hailEvents : catalog(memory.reports);
  // Soft fallback so Hail Map / live gate stay usable when NWS/IEM is down.
  const fallbackStorm: StormSummary = {
    id: "dfw-fallback",
    date: new Date().toISOString().slice(0, 10),
    name: "Dallas–Fort Worth (no NWS hail catalog loaded)",
    shortName: "DFW",
    maxHail: 0,
    reportCount: 0,
  };
  const storms = cataloged.length ? cataloged : [fallbackStorm];
  const centers = memory.hailCenters;
  const overMarket = (id: string) => {
    const c = centers?.[id];
    return !!c && c.lng >= BOX.west && c.lng <= BOX.east && c.lat >= BOX.south && c.lat <= BOX.north;
  };
  const summary = storms.find((s) => s.id === opts.stormId) ?? storms.find((s) => overMarket(s.id)) ?? storms[0];
  let dayReports = memory.reports.filter((r) => chicagoDate(r.valid) === summary.date);
  let warnings = memory.warnings[summary.date] ?? [];
  if (cataloged.length && memory.hailEvents && (!warnings.length || !dayReports.length)) {
    planHttp(1);
    const hail = await loadHailEvents(summary.date, trackedFetch(), state);
    if (hail) {
      memory.warnings[hail.selected.date] = hail.selected.warnings;
      memory.reports = [...memory.reports.filter((r) => chicagoDate(r.valid) !== hail.selected.date), ...hail.selected.reports];
      dayReports = hail.selected.reports;
      warnings = hail.selected.warnings;
    }
  }
  if (cataloged.length && !memory.warnings[summary.date]) {
    planHttp(1);
    try {
      warnings = classify(await loadWarnings(summary.date), dayReports);
      memory.warnings[summary.date] = warnings;
    } catch {
      warnings = [];
      memory.warnings[summary.date] = [];
    }
  }
  const parcels = tagParcels(memory.parcels, warnings, dayReports);
  const engineDallas = parcels.some((p) => p.market === "dallas" && p.permitSource === "engine");
  const { enrichDallasAttom } = await import("@/lib/live/attom");
  const attomPermits: Permit[] = [];
  if (!engineDallas) {
    const attom = await enrichDallasAttom(parcels, attomPermits);
    if (attom.fetched || attom.cached) {
      memory.dallasNote = "Dallas year built, building size, roof cover, and permit history come from ATTOM as each building is read. A building ATTOM has not been read for is not marked unresolved.";
    }
  }
  const permits = linkPermits(parcels, [...memory.permits, ...attomPermits]);
  const developments = linkPermits(parcels, memory.developments);
  const maxTag = warnings.reduce((m, w) => Math.max(m, w.hailTag), 0);
  const center = dayReports.reduce<[number, number]>((acc, r) => [acc[0] + r.lng, acc[1] + r.lat], [0, 0]);
  const storm: Storm = {
    ...summary,
    region: "Dallas–Fort Worth, North Texas",
    maxHailTag: maxTag,
    center: dayReports.length ? [center[0] / dayReports.length, center[1] / dayReports.length] : [-97.33, 32.75],
    source: memory.hailSource || "NWS Fort Worth local storm reports and storm-based warning polygons, via the Iowa Environmental Mesonet",
    reports: dayReports,
    warnings,
  };
  const payload: LivePayload = {
    fetchedAt: new Date(memory.at).toISOString(),
    permitFeeds: { "fort-worth": "ok", dallas: memory.dallasPermit },
    coverage: `Live public records for Fort Worth and Dallas. Fort Worth parcels are the Tarrant Appraisal District roll and permits are the City of Fort Worth layer. Dallas parcels are the Dallas Central Appraisal District commercial file, joined to the DCAD map for location. ${memory.dallasNote} Hail is NWS Fort Worth office reports and warning polygons across both cities. Other cities are not shown.`,
    storms,
    storm,
    parcels,
    permits,
    developments,
  };
  await persistLive(payload);
  onHttp = null;
  return payload;
}
