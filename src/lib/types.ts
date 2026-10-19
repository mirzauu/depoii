import type { MultiPolygon, Polygon } from "geojson";

/** Every surfaced data point is labeled with where it came from. */
export type Provenance = "source-record" | "radar-modeled" | "depoii-modeled";

export type MarketId = "fort-worth" | "dallas";

/** ok means the permit query returned. failed means it did not, which is not the same as no permit on file. */
export type FeedStatus = "ok" | "failed";

export type PermitFeeds = Record<MarketId, FeedStatus>;

export type SwathTier = "core" | "envelope" | "outside";

export interface HailReport {
  id: string;
  valid: string;
  lat: number;
  lng: number;
  inches: number;
  /** NWS LSR qualifier: M measured, E estimated, or blank. */
  qualifier: string;
  city: string;
  county: string;
  source: string;
  remark: string;
}

export interface WarningPolygon {
  eventId: number;
  hailTag: number;
  windTag: number;
  issue: string;
  expire: string;
  href: string;
  tier: "core" | "envelope";
  /** Why this official polygon was classed core or envelope. */
  basis: string;
  geometry: Polygon | MultiPolygon;
}

export interface StormSummary {
  id: string;
  name: string;
  shortName: string;
  date: string;
  maxHail: number;
  reportCount: number;
}

export interface Storm extends StormSummary {
  region: string;
  /** Largest NWS warning hail tag on this event, 0 when no warning carried one. */
  maxHailTag: number;
  center: [number, number];
  source: string;
  reports: HailReport[];
  warnings: WarningPolygon[];
}

export interface Parcel {
  id: string;
  market: MarketId;
  cadAccount: string;
  cad: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  /** Appraisal field actually present. TAD does not publish a roof use code on this layer. */
  use: string;
  /** TAD living/building area, not a measured roof area. */
  sqft: number;
  yearBuilt: number;
  /** Set when year built came from a source other than the appraisal roll. */
  yearBasis?: string;
  /** Roof cover only when a record states it. */
  roofCover?: string;
  /** Set when a permit history was returned for this building. */
  permitSource?: "attom" | "engine";
  owner: string;
  ownerAddress: string;
  recordUrl: string;
  /** Filled for the selected storm before the payload leaves the server. */
  tier?: SwathTier;
  hailInches?: number;
  hailBasis?: string;
  hailProvenance?: Provenance;
}

export type PermitKind = "reroof" | "repair" | "new-commercial";

export type PermitContactRole = "applicant" | "owner_rep" | "contractor" | "architect" | "unknown";
export type EmailDeliverability = "verified" | "generic" | "unverified" | "undeliverable";

export interface PermitContact {
  id: string;
  permitId: string;
  role: PermitContactRole;
  name: string;
  company?: string;
  phone?: string;
  phoneFormatted?: string;
  email?: string;
  emailType?: "personal" | "generic";
  deliverability?: EmailDeliverability;
  source: string;
  verifiedAt?: string;
}

export interface Permit {
  id: string;
  market: MarketId;
  permitNo: string;
  parcelId: string | null;
  /** Every appraisal account that shares this permit's street address. */
  parcelIds: string[];
  address: string;
  city: string;
  lat: number;
  lng: number;
  contractorId: string | null;
  contractorName: string;
  /** Two-letter state parsed from the permit text, or UNKNOWN. */
  contractorState: string;
  issued: string;
  valuation: number;
  scope: string;
  kind: PermitKind;
  /** Membrane words copied from the permit text, when the city typed them. */
  membrane?: string;
  portal: string;
  recordUrl: string;
  contacts?: PermitContact[];
}

export interface Contractor {
  id: string;
  name: string;
  hq: string;
  homeState: string;
  color: string;
}

export interface ScoreWeights {
  severity: number;
  age: number;
  footprint: number;
  permitAbsence: number;
}

export interface FieldOutcome {
  id: string;
  parcelId: string;
  stormId: string;
  loggedAt: string;
  predictedScore: number;
  factors: Record<keyof ScoreWeights, number>;
  moistureVerified: boolean;
  scope: "none" | "repair" | "replacement";
  contractValue: number;
  notes: string;
}

export interface LivePayload {
  fetchedAt: string;
  coverage: string;
  permitFeeds: PermitFeeds;
  storms: StormSummary[];
  storm: Storm;
  parcels: Parcel[];
  permits: Permit[];
  developments: Permit[];
}
