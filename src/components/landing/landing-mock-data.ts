/** Dummy workspace data for the landing product mock. Not live. */

import type { HailReport, Storm, WarningPolygon } from "@/lib/types";

export type MockCity = "Dallas" | "Fort Worth";

export type MockLead = {
  id: string;
  address: string;
  city: MockCity;
  owner: string;
  ownerMail: string;
  yearBuilt: number;
  stories: number;
  value: number;
  roofSqft: number;
  score: number;
  tier: "core" | "envelope" | "outside";
  hailInches: number;
  hailMiles: number;
  hailDate: string;
  permitStatus: string;
  lat: number;
  lng: number;
  aerial: string;
  aerialDate: string;
  account: string;
  propertyType: string;
};

export type MockHailReport = {
  id: string;
  lat: number;
  lng: number;
  inches: number;
  city: string;
  date: string;
  source: string;
};

export type MockOutcome = {
  id: string;
  leadId: string;
  predicted: number;
  result: "Verified damage" | "Clean roof" | "Partial wear";
  scope: string;
  awarded: number;
  loggedBy: string;
  loggedAt: string;
};

/** Rough NWS-style polygons over north Dallas so DepoiiMap can render the real swath layers. */
const CORE_RING: [number, number][] = [
  [-96.88, 32.96],
  [-96.78, 32.99],
  [-96.74, 32.93],
  [-96.77, 32.87],
  [-96.86, 32.88],
  [-96.88, 32.96],
];
const ENVELOPE_RING: [number, number][] = [
  [-96.92, 33.02],
  [-96.7, 33.04],
  [-96.68, 32.82],
  [-96.78, 32.76],
  [-96.94, 32.8],
  [-96.92, 33.02],
];

const MOCK_WARNINGS: WarningPolygon[] = [
  {
    eventId: 24031401,
    hailTag: 2,
    windTag: 60,
    issue: "2024-03-14T20:12:00Z",
    expire: "2024-03-14T21:45:00Z",
    href: "#",
    tier: "core",
    basis: "NWS severe thunderstorm warning with 2\" hail tag",
    geometry: { type: "Polygon", coordinates: [CORE_RING] },
  },
  {
    eventId: 24031402,
    hailTag: 1,
    windTag: 50,
    issue: "2024-03-14T19:50:00Z",
    expire: "2024-03-14T22:00:00Z",
    href: "#",
    tier: "envelope",
    basis: "Outer warning polygon for the same cell",
    geometry: { type: "Polygon", coordinates: [ENVELOPE_RING] },
  },
];

/** Full Storm object for DepoiiMap — same shape as the signed-in dashboard. */
export const MOCK_STORM: Storm = {
  id: "mock-dfw-2024-03-14",
  name: "DFW supercell · Mar 14, 2024",
  shortName: "DFW Mar 14",
  date: "2024-03-14",
  maxHail: 2,
  reportCount: 6,
  region: "Dallas–Fort Worth",
  maxHailTag: 2,
  center: [-96.82, 32.92],
  source: "NWS / SPC (demo)",
  reports: [], // filled below after MOCK_HAIL
  warnings: MOCK_WARNINGS,
};

export const MOCK_LEADS: MockLead[] = [
  {
    id: "dcad-16850",
    address: "16850 DALLAS PKWY",
    city: "Dallas",
    owner: "JC & CB HERNANDEZ HOLDINGS LLC",
    ownerMail: "PO BOX 802047, DALLAS TX 75380",
    yearBuilt: 1979,
    stories: 1,
    value: 1625000,
    roofSqft: 11994,
    score: 86,
    tier: "core",
    hailInches: 1.75,
    hailMiles: 3.2,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · no post-storm roof filing",
    lat: 32.9842,
    lng: -96.8298,
    aerial: "/landing/aerials/dcad-16850.jpg",
    aerialDate: "Satellite · Mar 2024",
    account: "000001234567890",
    propertyType: "Commercial / office warehouse",
  },
  {
    id: "dcad-4100",
    address: "4100 Alpha Rd",
    city: "Dallas",
    owner: "NORTHSTAR INDUSTRIAL LLC",
    ownerMail: "4100 ALPHA RD STE 100, DALLAS TX 75244",
    yearBuilt: 1988,
    stories: 1,
    value: 2840000,
    roofSqft: 48200,
    score: 78,
    tier: "core",
    hailInches: 1.5,
    hailMiles: 2.1,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · no post-storm roof filing",
    lat: 32.941,
    lng: -96.835,
    aerial: "/landing/aerials/dcad-4100.jpg",
    aerialDate: "Satellite · Mar 2024",
    account: "000009876543210",
    propertyType: "Industrial flex",
  },
  {
    id: "dcad-12221",
    address: "12221 Merit Dr",
    city: "Dallas",
    owner: "MERIT OFFICE PARTNERS LP",
    ownerMail: "12221 MERIT DR, DALLAS TX 75251",
    yearBuilt: 1995,
    stories: 4,
    value: 9100000,
    roofSqft: 28600,
    score: 71,
    tier: "envelope",
    hailInches: 1.25,
    hailMiles: 4.8,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · non-roof permit on file",
    lat: 32.918,
    lng: -96.772,
    aerial: "/landing/aerials/dcad-12221.jpg",
    aerialDate: "Satellite · Feb 2024",
    account: "000005551112223",
    propertyType: "Mid-rise office",
  },
  {
    id: "dcad-2501",
    address: "2501 Oak Lawn Ave",
    city: "Dallas",
    owner: "OAK LAWN RETAIL TRUST",
    ownerMail: "2501 OAK LAWN AVE, DALLAS TX 75219",
    yearBuilt: 2001,
    stories: 2,
    value: 4200000,
    roofSqft: 15400,
    score: 64,
    tier: "envelope",
    hailInches: 1.0,
    hailMiles: 5.4,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · no post-storm roof filing",
    lat: 32.805,
    lng: -96.807,
    aerial: "/landing/aerials/dcad-2501.jpg",
    aerialDate: "Satellite · Jan 2024",
    account: "000007774445556",
    propertyType: "Retail strip",
  },
];

export const MOCK_FW_LEADS: MockLead[] = [
  {
    id: "tad-1200",
    address: "1200 Summit Ave",
    city: "Fort Worth",
    owner: "SUMMIT COMMERCIAL PARTNERS LLC",
    ownerMail: "1200 SUMMIT AVE, FORT WORTH TX 76102",
    yearBuilt: 1982,
    stories: 2,
    value: 5400000,
    roofSqft: 38600,
    score: 81,
    tier: "core",
    hailInches: 1.5,
    hailMiles: 2.8,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · no post-storm roof filing",
    lat: 32.755,
    lng: -97.332,
    aerial: "/landing/aerials/dcad-4100.jpg",
    aerialDate: "Satellite · Mar 2024",
    account: "FW-000441102",
    propertyType: "Office / warehouse",
  },
  {
    id: "tad-4801",
    address: "4801 Bryant Irvin Rd",
    city: "Fort Worth",
    owner: "SOUTHWEST FLEX PROPERTIES LP",
    ownerMail: "4801 BRYANT IRVIN RD, FORT WORTH TX 76132",
    yearBuilt: 1994,
    stories: 1,
    value: 3180000,
    roofSqft: 52400,
    score: 74,
    tier: "core",
    hailInches: 1.25,
    hailMiles: 3.6,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · no post-storm roof filing",
    lat: 32.678,
    lng: -97.418,
    aerial: "/landing/aerials/dcad-16850.jpg",
    aerialDate: "Satellite · Feb 2024",
    account: "FW-000882210",
    propertyType: "Industrial flex",
  },
  {
    id: "tad-301",
    address: "301 Commerce St",
    city: "Fort Worth",
    owner: "SUNDANCE SQUARE HOLDINGS",
    ownerMail: "301 COMMERCE ST, FORT WORTH TX 76102",
    yearBuilt: 2008,
    stories: 6,
    value: 18200000,
    roofSqft: 22100,
    score: 68,
    tier: "envelope",
    hailInches: 1.0,
    hailMiles: 4.2,
    hailDate: "2024-03-14",
    permitStatus: "Search logged · non-roof permit on file",
    lat: 32.7558,
    lng: -97.3308,
    aerial: "/landing/aerials/dcad-12221.jpg",
    aerialDate: "Satellite · Jan 2024",
    account: "FW-000119933",
    propertyType: "Mid-rise office",
  },
];

export const MOCK_HAIL: MockHailReport[] = [
  { id: "spc-1", lat: 32.99, lng: -96.84, inches: 1.75, city: "Dallas", date: "2024-03-14", source: "SPC" },
  { id: "spc-2", lat: 32.95, lng: -96.81, inches: 1.5, city: "Dallas", date: "2024-03-14", source: "SPC" },
  { id: "spc-3", lat: 32.91, lng: -96.79, inches: 1.25, city: "Addison", date: "2024-03-14", source: "SPC" },
  { id: "spc-4", lat: 32.88, lng: -96.85, inches: 2.0, city: "Carrollton", date: "2024-03-14", source: "NWS" },
  { id: "spc-5", lat: 32.82, lng: -96.8, inches: 1.0, city: "Dallas", date: "2024-03-14", source: "SPC" },
  { id: "spc-6", lat: 32.86, lng: -96.76, inches: 0.88, city: "Richardson", date: "2024-03-14", source: "SPC" },
];

/** Lead outside the swath — used when “Show unexposed pilot parcels” is on. */
export const MOCK_OUTSIDE_LEAD: MockLead = {
  id: "dcad-outside",
  address: "9000 Forest Ln",
  city: "Dallas",
  owner: "FOREST LANE HOLDINGS LLC",
  ownerMail: "9000 FOREST LN, DALLAS TX 75243",
  yearBuilt: 1985,
  stories: 1,
  value: 1100000,
  roofSqft: 22000,
  score: 22,
  tier: "outside",
  hailInches: 0,
  hailMiles: 12,
  hailDate: "2024-03-14",
  permitStatus: "Outside warning polygons",
  lat: 32.91,
  lng: -96.72,
  aerial: "/landing/aerials/dcad-outside.jpg",
  aerialDate: "Satellite · Jan 2024",
  account: "00000111000222",
  propertyType: "Warehouse",
};

MOCK_STORM.reports = MOCK_HAIL.map(
  (h): HailReport => ({
    id: h.id,
    valid: `${h.date}T21:00:00Z`,
    lat: h.lat,
    lng: h.lng,
    inches: h.inches,
    qualifier: h.inches >= 1.75 ? "M" : "E",
    city: h.city,
    county: "Dallas",
    source: h.source,
    remark: "",
  }),
);

export const MOCK_OUTCOMES: MockOutcome[] = [
  {
    id: "out-1",
    leadId: "dcad-16850",
    predicted: 86,
    result: "Partial wear",
    scope: "Membrane wear at HVAC curbs; no puncture confirmed",
    awarded: 0,
    loggedBy: "Field crew",
    loggedAt: "2024-04-02",
  },
  {
    id: "out-2",
    leadId: "dcad-4100",
    predicted: 78,
    result: "Verified damage",
    scope: "Granule loss + bruised TPO at west bay",
    awarded: 186000,
    loggedBy: "Estimator",
    loggedAt: "2024-04-08",
  },
  {
    id: "out-3",
    leadId: "dcad-12221",
    predicted: 71,
    result: "Clean roof",
    scope: "No storm-related damage found",
    awarded: 0,
    loggedBy: "Field crew",
    loggedAt: "2024-04-11",
  },
  {
    id: "out-4",
    leadId: "dcad-2501",
    predicted: 64,
    result: "Partial wear",
    scope: "Edge metal lift on south parapet; patch quoted",
    awarded: 42000,
    loggedBy: "Estimator",
    loggedAt: "2024-04-15",
  },
  {
    id: "out-5",
    leadId: "tad-1200",
    predicted: 81,
    result: "Verified damage",
    scope: "Impact bruises across west bays; full recover bid",
    awarded: 274000,
    loggedBy: "Field crew",
    loggedAt: "2024-04-18",
  },
  {
    id: "out-6",
    leadId: "tad-4801",
    predicted: 74,
    result: "Clean roof",
    scope: "No storm-related damage found",
    awarded: 0,
    loggedBy: "Estimator",
    loggedAt: "2024-04-20",
  },
];

export type MockPermit = {
  id: string;
  permitNo: string;
  address: string;
  city: MockCity;
  type: string;
  status: "Issued" | "Final" | "Expired" | "Open";
  filed: string;
  valuation: number;
  contractor: string;
};

export const MOCK_PERMITS: MockPermit[] = [
  {
    id: "p1",
    permitNo: "BLD-2024-11802",
    address: "16850 DALLAS PKWY",
    city: "Dallas",
    type: "Mechanical · RTU swap",
    status: "Issued",
    filed: "2024-02-11",
    valuation: 48000,
    contractor: "North Texas HVAC",
  },
  {
    id: "p2",
    permitNo: "BLD-2023-44190",
    address: "4100 Alpha Rd",
    city: "Dallas",
    type: "Roofing · TPO recover",
    status: "Final",
    filed: "2023-08-22",
    valuation: 312000,
    contractor: "Summit Commercial Roofing",
  },
  {
    id: "p3",
    permitNo: "BLD-2022-90211",
    address: "12221 Merit Dr",
    city: "Dallas",
    type: "Electrical · service upgrade",
    status: "Final",
    filed: "2022-11-03",
    valuation: 86000,
    contractor: "Merit Electric Co",
  },
  {
    id: "p4",
    permitNo: "BLD-2024-2201",
    address: "1200 Summit Ave",
    city: "Fort Worth",
    type: "Roofing · inspection only",
    status: "Open",
    filed: "2024-03-28",
    valuation: 12000,
    contractor: "DFW Membrane Pros",
  },
  {
    id: "p5",
    permitNo: "BLD-2021-7744",
    address: "4801 Bryant Irvin Rd",
    city: "Fort Worth",
    type: "Roofing · modified bitumen",
    status: "Expired",
    filed: "2021-05-14",
    valuation: 198000,
    contractor: "Metroplex Roofing Co",
  },
  {
    id: "p6",
    permitNo: "BLD-2024-5510",
    address: "2501 Oak Lawn Ave",
    city: "Dallas",
    type: "Building · storefront remodel",
    status: "Issued",
    filed: "2024-01-19",
    valuation: 145000,
    contractor: "Oak Lawn Builders",
  },
];

export type MockBuilding = {
  id: string;
  address: string;
  city: MockCity;
  propertyType: string;
  yearBuilt: number;
  stories: number;
  roofSqft: number;
  value: number;
  owner: string;
};

export const MOCK_BUILDINGS: MockBuilding[] = [
  ...MOCK_LEADS.map((l) => ({
    id: l.id,
    address: l.address,
    city: l.city,
    propertyType: l.propertyType,
    yearBuilt: l.yearBuilt,
    stories: l.stories,
    roofSqft: l.roofSqft,
    value: l.value,
    owner: l.owner,
  })),
  ...MOCK_FW_LEADS.map((l) => ({
    id: l.id,
    address: l.address,
    city: l.city,
    propertyType: l.propertyType,
    yearBuilt: l.yearBuilt,
    stories: l.stories,
    roofSqft: l.roofSqft,
    value: l.value,
    owner: l.owner,
  })),
];

export type MockContractor = {
  id: string;
  name: string;
  license: string;
  phone: string;
  hq: string;
  jobs: number;
  specialty: string;
};

export const MOCK_CONTRACTORS: MockContractor[] = [
  {
    id: "c1",
    name: "Summit Commercial Roofing",
    license: "TACLB-44102",
    phone: "(214) 555-0188",
    hq: "Carrollton, TX",
    jobs: 42,
    specialty: "TPO / modified bitumen",
  },
  {
    id: "c2",
    name: "North Texas Roof Systems",
    license: "TACLB-22891",
    phone: "(972) 555-0142",
    hq: "Plano, TX",
    jobs: 31,
    specialty: "Single-ply recover",
  },
  {
    id: "c3",
    name: "DFW Membrane Pros",
    license: "TACLB-10944",
    phone: "(817) 555-0199",
    hq: "Fort Worth, TX",
    jobs: 27,
    specialty: "Built-up / gravel",
  },
  {
    id: "c4",
    name: "Metroplex Roofing Co",
    license: "TACLB-33018",
    phone: "(469) 555-0160",
    hq: "Irving, TX",
    jobs: 19,
    specialty: "EPDM / edge metal",
  },
  {
    id: "c5",
    name: "Lone Star Commercial Roof",
    license: "TACLB-55120",
    phone: "(214) 555-0117",
    hq: "Dallas, TX",
    jobs: 14,
    specialty: "Hail restoration",
  },
];

export type MockCompetitor = {
  id: string;
  name: string;
  wins: number;
  bids: number;
  avgAward: number;
  territory: string;
};

export const MOCK_COMPETITORS: MockCompetitor[] = [
  { id: "lb1", name: "Summit Commercial Roofing", wins: 11, bids: 28, avgAward: 214000, territory: "North Dallas" },
  { id: "lb2", name: "North Texas Roof Systems", wins: 8, bids: 22, avgAward: 188000, territory: "Collin / Denton" },
  { id: "lb3", name: "DFW Membrane Pros", wins: 7, bids: 19, avgAward: 162000, territory: "Tarrant" },
  { id: "lb4", name: "Metroplex Roofing Co", wins: 5, bids: 17, avgAward: 141000, territory: "DFW metro" },
  { id: "lb5", name: "Lone Star Commercial Roof", wins: 4, bids: 15, avgAward: 129000, territory: "Dallas proper" },
];

export type MockTeammate = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: "Active" | "Invite pending";
  lastActive: string;
};

export const MOCK_TEAM: MockTeammate[] = [
  {
    id: "tm1",
    name: "Alex Rivera",
    role: "Owner",
    email: "alex@demo-roofing.com",
    status: "Active",
    lastActive: "Today",
  },
  {
    id: "tm2",
    name: "Jordan Blake",
    role: "Estimator",
    email: "jordan@demo-roofing.com",
    status: "Active",
    lastActive: "Yesterday",
  },
  {
    id: "tm3",
    name: "Sam Ortiz",
    role: "Field lead",
    email: "sam@demo-roofing.com",
    status: "Active",
    lastActive: "2 days ago",
  },
  {
    id: "tm4",
    name: "Casey Nguyen",
    role: "Sales",
    email: "casey@demo-roofing.com",
    status: "Invite pending",
    lastActive: "—",
  },
];

export const PIPELINE_STAGES = ["New", "Contacted", "Inspected", "Bid", "Won", "Lost"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type MockAgingRoof = {
  id: string;
  address: string;
  city: MockCity;
  installed: string;
  age: number;
  risk: "CRITICAL" | "HIGH" | "MODERATE";
  roofSystem: string;
  contractor: string;
  priority: number;
  replacementCost: number;
  permitNumber: string;
  laterPermits: number;
  /** Year-built proxy when no roofing permit exists */
  neverPermitted?: boolean;
};

/** Roof aging alarm demo rows — old installs, experienced contractors, risk tiers. */
export const MOCK_AGING_ROOFS: MockAgingRoof[] = [
  {
    id: "age-1",
    address: "16850 DALLAS PKWY",
    city: "Dallas",
    installed: "1998-06-12",
    age: 26,
    risk: "CRITICAL",
    roofSystem: "Modified bitumen",
    contractor: "Summit Commercial Roofing",
    priority: 94,
    replacementCost: 168000,
    permitNumber: "BLD-1998-44102",
    laterPermits: 0,
  },
  {
    id: "age-2",
    address: "4100 Alpha Rd",
    city: "Dallas",
    installed: "2004-03-22",
    age: 20,
    risk: "CRITICAL",
    roofSystem: "TPO · 60 mil",
    contractor: "North Texas Roof Systems",
    priority: 88,
    replacementCost: 412000,
    permitNumber: "BLD-2004-11880",
    laterPermits: 1,
  },
  {
    id: "age-3",
    address: "12221 Merit Dr",
    city: "Dallas",
    installed: "2008-11-04",
    age: 16,
    risk: "HIGH",
    roofSystem: "Built-up / gravel",
    contractor: "DFW Membrane Pros",
    priority: 76,
    replacementCost: 245000,
    permitNumber: "BLD-2008-90211",
    laterPermits: 0,
  },
  {
    id: "age-4",
    address: "2501 Oak Lawn Ave",
    city: "Dallas",
    installed: "2011-05-18",
    age: 13,
    risk: "MODERATE",
    roofSystem: "EPDM",
    contractor: "Metroplex Roofing Co",
    priority: 61,
    replacementCost: 132000,
    permitNumber: "BLD-2011-33450",
    laterPermits: 2,
  },
  {
    id: "age-5",
    address: "9000 Forest Ln",
    city: "Dallas",
    installed: "",
    age: 39,
    risk: "CRITICAL",
    roofSystem: "Unknown · no roofing permit",
    contractor: "—",
    priority: 91,
    replacementCost: 308000,
    permitNumber: "",
    laterPermits: 0,
    neverPermitted: true,
  },
  {
    id: "age-6",
    address: "1200 Summit Ave",
    city: "Fort Worth",
    installed: "2001-09-30",
    age: 23,
    risk: "CRITICAL",
    roofSystem: "TPO · 45 mil",
    contractor: "DFW Membrane Pros",
    priority: 90,
    replacementCost: 295000,
    permitNumber: "FW-2001-8821",
    laterPermits: 0,
  },
  {
    id: "age-7",
    address: "4801 Bryant Irvin Rd",
    city: "Fort Worth",
    installed: "2009-04-12",
    age: 15,
    risk: "HIGH",
    roofSystem: "Modified bitumen",
    contractor: "Metroplex Roofing Co",
    priority: 72,
    replacementCost: 356000,
    permitNumber: "FW-2009-4410",
    laterPermits: 1,
  },
  {
    id: "age-8",
    address: "301 Commerce St",
    city: "Fort Worth",
    installed: "",
    age: 18,
    risk: "HIGH",
    roofSystem: "Unknown · no roofing permit",
    contractor: "—",
    priority: 79,
    replacementCost: 210000,
    permitNumber: "",
    laterPermits: 0,
    neverPermitted: true,
  },
];

export function agingStats(roofs: MockAgingRoof[]) {
  return {
    total: roofs.length,
    pipeline: roofs.reduce((s, r) => s + r.replacementCost, 0),
    critical: roofs.filter((r) => r.risk === "CRITICAL").length,
    approaching: roofs.filter((r) => r.risk === "HIGH" || r.risk === "MODERATE").length,
  };
}

export function leadsForCity(city: MockCity): MockLead[] {
  return city === "Dallas" ? MOCK_LEADS : MOCK_FW_LEADS;
}

export function leadById(id: string | null | undefined): MockLead | undefined {
  if (!id) return undefined;
  if (id === MOCK_OUTSIDE_LEAD.id) return MOCK_OUTSIDE_LEAD;
  return MOCK_LEADS.find((l) => l.id === id) ?? MOCK_FW_LEADS.find((l) => l.id === id);
}
