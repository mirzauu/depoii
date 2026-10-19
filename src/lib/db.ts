import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { rankOpportunities } from "@/lib/engine/score";
import type { FieldOutcome, LivePayload, PermitContact, PermitContactRole, ScoreWeights } from "@/lib/types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS parcels (
  account TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  year_built INTEGER NOT NULL,
  sqft INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  owner_address TEXT NOT NULL,
  record_url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permits (
  permit_no TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  contractor_name TEXT NOT NULL,
  contractor_state TEXT NOT NULL,
  issued TEXT NOT NULL,
  valuation INTEGER NOT NULL,
  scope TEXT NOT NULL,
  membrane TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  parcel_ids TEXT NOT NULL,
  record_url TEXT NOT NULL,
  portal TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permit_contacts (
  id TEXT PRIMARY KEY,
  permit_no TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  phone_formatted TEXT,
  email TEXT,
  email_type TEXT,
  deliverability TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_permit_contacts_permit ON permit_contacts(permit_no);
CREATE TABLE IF NOT EXISTS hail_reports (
  id TEXT PRIMARY KEY,
  storm_date TEXT NOT NULL,
  valid TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  inches REAL NOT NULL,
  qualifier TEXT NOT NULL,
  city TEXT NOT NULL,
  county TEXT NOT NULL,
  source TEXT NOT NULL,
  remark TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS warnings (
  storm_date TEXT NOT NULL,
  event_id INTEGER NOT NULL,
  issue TEXT NOT NULL,
  hail_tag REAL NOT NULL,
  wind_tag REAL NOT NULL,
  tier TEXT NOT NULL,
  basis TEXT NOT NULL,
  href TEXT NOT NULL,
  expire TEXT NOT NULL,
  geometry TEXT NOT NULL,
  PRIMARY KEY (storm_date, event_id, issue)
);
CREATE TABLE IF NOT EXISTS score_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  storm_date TEXT NOT NULL,
  account TEXT NOT NULL,
  scored_on TEXT NOT NULL,
  scored_at TEXT NOT NULL,
  tier TEXT NOT NULL,
  hail_inches REAL NOT NULL,
  hail_basis TEXT NOT NULL,
  score INTEGER NOT NULL,
  factors TEXT NOT NULL,
  unresolved INTEGER NOT NULL,
  pipeline_value INTEGER NOT NULL,
  roof_age INTEGER NOT NULL,
  UNIQUE (storm_date, account, scored_on)
);
CREATE TABLE IF NOT EXISTS field_outcomes (
  id TEXT PRIMARY KEY,
  parcel_id TEXT NOT NULL,
  storm_id TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  predicted_score INTEGER NOT NULL,
  factors TEXT NOT NULL,
  moisture_verified INTEGER NOT NULL,
  scope TEXT NOT NULL,
  contract_value REAL NOT NULL,
  notes TEXT NOT NULL,
  org_id TEXT NOT NULL DEFAULT '',
  UNIQUE (parcel_id, storm_id)
);
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  platform_role TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  last_login_at TEXT NOT NULL DEFAULT '',
  last_seen_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS login_links (
  user_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_otps (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS team_invites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(org_id, status);
CREATE TABLE IF NOT EXISTS memberships (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_id TEXT,
  org_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  parcel_id TEXT NOT NULL,
  storm_id TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  stage TEXT NOT NULL,
  assignee TEXT NOT NULL,
  notes TEXT NOT NULL,
  score INTEGER NOT NULL,
  hail REAL NOT NULL,
  price REAL NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, parcel_id, storm_id)
);
`;

export interface ParcelRow {
  account: string;
  owner: string;
  address: string;
  city: string;
  year_built: number;
  sqft: number;
  lat: number;
  lng: number;
  owner_address: string;
  record_url: string;
  updated_at: string;
}

export interface PermitRow {
  permit_no: string;
  kind: string;
  address: string;
  city: string;
  contractor_name: string;
  contractor_state: string;
  issued: string;
  valuation: number;
  scope: string;
  membrane: string | null;
  lat: number;
  lng: number;
  parcel_ids: string;
  record_url: string;
  portal: string;
  updated_at: string;
}

export interface HailRow {
  id: string;
  storm_date: string;
  valid: string;
  lat: number;
  lng: number;
  inches: number;
  qualifier: string;
  city: string;
  county: string;
  source: string;
  remark: string;
}

export interface SnapshotRow {
  id: number;
  storm_date: string;
  account: string;
  scored_on: string;
  scored_at: string;
  tier: string;
  hail_inches: number;
  hail_basis: string;
  score: number;
  factors: string;
  unresolved: number;
  pipeline_value: number;
  roof_age: number;
}

let current: { file: string; db: Database.Database } | null = null;

export function databasePath() {
  return process.env.DEPOII_DB || path.join(process.cwd(), "data", "depoii.sqlite");
}

export function getDb() {
  const file = databasePath();
  if (current?.file === file) return current.db;
  current?.db.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  const outcomeCols = db.prepare(`PRAGMA table_info(field_outcomes)`).all() as { name: string }[];
  if (!outcomeCols.some((col) => col.name === "org_id")) {
    db.exec(`ALTER TABLE field_outcomes ADD COLUMN org_id TEXT NOT NULL DEFAULT ''`);
  }
  const addColumn = (table: string, name: string, definition: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((col) => col.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  };
  addColumn("users", "platform_role", "platform_role TEXT NOT NULL DEFAULT ''");
  addColumn("users", "disabled", "disabled INTEGER NOT NULL DEFAULT 0");
  addColumn("users", "created_at", "created_at TEXT NOT NULL DEFAULT ''");
  addColumn("users", "last_login_at", "last_login_at TEXT NOT NULL DEFAULT ''");
  addColumn("users", "last_seen_at", "last_seen_at TEXT NOT NULL DEFAULT ''");
  db.exec(`UPDATE users SET last_login_at = last_seen_at WHERE last_login_at = '' AND last_seen_at != ''`);
  addColumn("orgs", "disabled", "disabled INTEGER NOT NULL DEFAULT 0");
  addColumn("orgs", "created_at", "created_at TEXT NOT NULL DEFAULT ''");
  current = { file, db };
  return db;
}

export function closeDb() {
  current?.db.close();
  current = null;
}

export function persistLive(payload: LivePayload) {
  const db = getDb();
  const scoredOn = payload.fetchedAt.slice(0, 10);
  const upsertParcel = db.prepare(`
    INSERT INTO parcels (account, owner, address, city, year_built, sqft, lat, lng, owner_address, record_url, updated_at)
    VALUES (@account, @owner, @address, @city, @year_built, @sqft, @lat, @lng, @owner_address, @record_url, @updated_at)
    ON CONFLICT(account) DO UPDATE SET
      owner = excluded.owner, address = excluded.address, city = excluded.city,
      year_built = excluded.year_built, sqft = excluded.sqft, lat = excluded.lat, lng = excluded.lng,
      owner_address = excluded.owner_address, record_url = excluded.record_url, updated_at = excluded.updated_at
  `);
  const upsertPermit = db.prepare(`
    INSERT INTO permits (permit_no, kind, address, city, contractor_name, contractor_state, issued, valuation, scope, membrane, lat, lng, parcel_ids, record_url, portal, updated_at)
    VALUES (@permit_no, @kind, @address, @city, @contractor_name, @contractor_state, @issued, @valuation, @scope, @membrane, @lat, @lng, @parcel_ids, @record_url, @portal, @updated_at)
    ON CONFLICT(permit_no) DO UPDATE SET
      kind = excluded.kind, address = excluded.address, city = excluded.city,
      contractor_name = excluded.contractor_name, contractor_state = excluded.contractor_state,
      issued = excluded.issued, valuation = excluded.valuation, scope = excluded.scope, membrane = excluded.membrane,
      lat = excluded.lat, lng = excluded.lng, parcel_ids = excluded.parcel_ids,
      record_url = excluded.record_url, portal = excluded.portal, updated_at = excluded.updated_at
  `);
  const upsertContact = db.prepare(`
    INSERT INTO permit_contacts (id, permit_no, role, name, company, phone, phone_formatted, email, email_type, deliverability, source, created_at)
    VALUES (@id, @permit_no, @role, @name, @company, @phone, @phone_formatted, @email, @email_type, @deliverability, @source, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      role = excluded.role, name = excluded.name, company = excluded.company,
      phone = excluded.phone, phone_formatted = excluded.phone_formatted,
      email = excluded.email, email_type = excluded.email_type,
      deliverability = excluded.deliverability, source = excluded.source,
      created_at = excluded.created_at
  `);
  const insertReport = db.prepare(`
    INSERT OR IGNORE INTO hail_reports (id, storm_date, valid, lat, lng, inches, qualifier, city, county, source, remark)
    VALUES (@id, @storm_date, @valid, @lat, @lng, @inches, @qualifier, @city, @county, @source, @remark)
  `);
  const warningCount = db.prepare(`SELECT COUNT(*) AS n FROM warnings WHERE storm_date = ?`);
  const insertWarning = db.prepare(`
    INSERT OR IGNORE INTO warnings (storm_date, event_id, issue, hail_tag, wind_tag, tier, basis, href, expire, geometry)
    VALUES (@storm_date, @event_id, @issue, @hail_tag, @wind_tag, @tier, @basis, @href, @expire, @geometry)
  `);
  const insertSnapshot = db.prepare(`
    INSERT OR IGNORE INTO score_snapshots
      (storm_date, account, scored_on, scored_at, tier, hail_inches, hail_basis, score, factors, unresolved, pipeline_value, roof_age)
    VALUES
      (@storm_date, @account, @scored_on, @scored_at, @tier, @hail_inches, @hail_basis, @score, @factors, @unresolved, @pipeline_value, @roof_age)
  `);

  const write = db.transaction(() => {
    for (const parcel of payload.parcels) {
      upsertParcel.run({
        account: parcel.id,
        owner: parcel.owner,
        address: parcel.address,
        city: parcel.city,
        year_built: parcel.yearBuilt,
        sqft: parcel.sqft,
        lat: parcel.lat,
        lng: parcel.lng,
        owner_address: parcel.ownerAddress,
        record_url: parcel.recordUrl,
        updated_at: payload.fetchedAt,
      });
    }
    for (const permit of [...payload.permits, ...payload.developments]) {
      upsertPermit.run({
        permit_no: permit.id,
        kind: permit.kind,
        address: permit.address,
        city: permit.city,
        contractor_name: permit.contractorName,
        contractor_state: permit.contractorState,
        issued: permit.issued,
        valuation: permit.valuation,
        scope: permit.scope,
        membrane: permit.membrane ?? null,
        lat: permit.lat,
        lng: permit.lng,
        parcel_ids: JSON.stringify(permit.parcelIds),
        record_url: permit.recordUrl,
        portal: permit.portal,
        updated_at: payload.fetchedAt,
      });
      if (permit.contacts) {
        for (const contact of permit.contacts) {
          upsertContact.run({
            id: contact.id,
            permit_no: permit.id,
            role: contact.role,
            name: contact.name,
            company: contact.company ?? null,
            phone: contact.phone ?? null,
            phone_formatted: contact.phoneFormatted ?? null,
            email: contact.email ?? null,
            email_type: contact.emailType ?? null,
            deliverability: contact.deliverability ?? null,
            source: contact.source,
            created_at: payload.fetchedAt,
          });
        }
      }
    }
    for (const report of payload.storm.reports) {
      insertReport.run({
        id: report.id,
        storm_date: payload.storm.date,
        valid: report.valid,
        lat: report.lat,
        lng: report.lng,
        inches: report.inches,
        qualifier: report.qualifier,
        city: report.city,
        county: report.county,
        source: report.source,
        remark: report.remark,
      });
    }
    const stored = warningCount.get(payload.storm.date) as { n: number };
    if (stored.n === 0) {
      for (const warning of payload.storm.warnings) {
        insertWarning.run({
          storm_date: payload.storm.date,
          event_id: warning.eventId,
          issue: warning.issue,
          hail_tag: warning.hailTag,
          wind_tag: warning.windTag,
          tier: warning.tier,
          basis: warning.basis,
          href: warning.href,
          expire: warning.expire,
          geometry: JSON.stringify(warning.geometry),
        });
      }
    }
    const exposed = rankOpportunities(payload.parcels, payload.storm, payload.permits, undefined, undefined, payload.permitFeeds).filter((o) => o.tier !== "outside");
    for (const opportunity of exposed) {
      insertSnapshot.run({
        storm_date: payload.storm.date,
        account: opportunity.parcel.id,
        scored_on: scoredOn,
        scored_at: payload.fetchedAt,
        tier: opportunity.tier,
        hail_inches: opportunity.hailInches,
        hail_basis: opportunity.parcel.hailBasis ?? "",
        score: opportunity.score,
        factors: JSON.stringify(opportunity.factors),
        unresolved: opportunity.unresolved ? 1 : 0,
        pipeline_value: opportunity.pipelineValue,
        roof_age: opportunity.roofAge,
      });
    }
  });
  write();
}

function outcomeFrom(row: {
  id: string;
  parcel_id: string;
  storm_id: string;
  logged_at: string;
  predicted_score: number;
  factors: string;
  moisture_verified: number;
  scope: FieldOutcome["scope"];
  contract_value: number;
  notes: string;
}): FieldOutcome {
  return {
    id: row.id,
    parcelId: row.parcel_id,
    stormId: row.storm_id,
    loggedAt: row.logged_at,
    predictedScore: row.predicted_score,
    factors: JSON.parse(row.factors) as Record<keyof ScoreWeights, number>,
    moistureVerified: Boolean(row.moisture_verified),
    scope: row.scope,
    contractValue: row.contract_value,
    notes: row.notes,
  };
}

export function listOutcomes(orgId?: string): FieldOutcome[] {
  const rows = (orgId
    ? getDb().prepare(`SELECT * FROM field_outcomes WHERE org_id = ? ORDER BY logged_at DESC, id DESC`).all(orgId)
    : getDb().prepare(`SELECT * FROM field_outcomes ORDER BY logged_at DESC, id DESC`).all()) as Parameters<typeof outcomeFrom>[0][];
  return rows.map(outcomeFrom);
}

export function saveOutcomes(outcomes: FieldOutcome[], orgId = "") {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO field_outcomes (id, parcel_id, storm_id, logged_at, predicted_score, factors, moisture_verified, scope, contract_value, notes, org_id)
    VALUES (@id, @parcel_id, @storm_id, @logged_at, @predicted_score, @factors, @moisture_verified, @scope, @contract_value, @notes, @org_id)
    ON CONFLICT(parcel_id, storm_id) DO UPDATE SET
      id = excluded.id, logged_at = excluded.logged_at, predicted_score = excluded.predicted_score,
      factors = excluded.factors, moisture_verified = excluded.moisture_verified, scope = excluded.scope,
      contract_value = excluded.contract_value, notes = excluded.notes, org_id = excluded.org_id
  `);
  const write = db.transaction((rows: FieldOutcome[]) => {
    for (const outcome of rows) {
      stmt.run({
        id: outcome.id,
        parcel_id: outcome.parcelId,
        storm_id: outcome.stormId,
        logged_at: outcome.loggedAt,
        predicted_score: outcome.predictedScore,
        factors: JSON.stringify(outcome.factors),
        moisture_verified: outcome.moistureVerified ? 1 : 0,
        scope: outcome.scope,
        contract_value: outcome.contractValue,
        notes: outcome.notes,
        org_id: orgId,
      });
    }
  });
  write(outcomes);
}

export function clearOutcomes(orgId?: string) {
  if (orgId) getDb().prepare(`DELETE FROM field_outcomes WHERE org_id = ?`).run(orgId);
  else getDb().prepare(`DELETE FROM field_outcomes`).run();
}

export function parcelByAccount(account: string) {
  return getDb().prepare(`SELECT * FROM parcels WHERE account = ?`).get(account) as ParcelRow | undefined;
}

export function permitsForAccount(account: string) {
  const rows = getDb().prepare(`SELECT * FROM permits`).all() as PermitRow[];
  return rows.filter((row) => {
    try {
      return (JSON.parse(row.parcel_ids) as string[]).includes(account);
    } catch {
      return false;
    }
  });
}

export function latestSnapshot(account: string, stormDate?: string) {
  if (stormDate) {
    return getDb().prepare(`SELECT * FROM score_snapshots WHERE account = ? AND storm_date = ? ORDER BY scored_on DESC, id DESC LIMIT 1`).get(account, stormDate) as SnapshotRow | undefined;
  }
  return getDb().prepare(`SELECT * FROM score_snapshots WHERE account = ? ORDER BY scored_on DESC, id DESC LIMIT 1`).get(account) as SnapshotRow | undefined;
}

export function outcomeFor(account: string, stormDate?: string) {
  const row = stormDate
    ? getDb().prepare(`SELECT * FROM field_outcomes WHERE parcel_id = ? AND storm_id = ?`).get(account, stormDate)
    : getDb().prepare(`SELECT * FROM field_outcomes WHERE parcel_id = ? ORDER BY logged_at DESC LIMIT 1`).get(account);
  return row ? outcomeFrom(row as Parameters<typeof outcomeFrom>[0]) : undefined;
}

export function reportsForStorm(stormDate: string) {
  return getDb().prepare(`SELECT * FROM hail_reports WHERE storm_date = ? ORDER BY inches DESC`).all(stormDate) as HailRow[];
}

export function warningCount(stormDate: string) {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM warnings WHERE storm_date = ?`).get(stormDate) as { n: number }).n;
}

export function latestSnapshots(stormDate: string, limit = 10) {
  const day = getDb().prepare(`SELECT MAX(scored_on) AS day FROM score_snapshots WHERE storm_date = ?`).get(stormDate) as { day: string | null };
  if (!day.day) return { scoredOn: null as string | null, rows: [] as SnapshotRow[], exposed: 0, unresolved: 0 };
  const rows = getDb().prepare(`SELECT * FROM score_snapshots WHERE storm_date = ? AND scored_on = ? ORDER BY score DESC LIMIT ?`).all(stormDate, day.day, limit) as SnapshotRow[];
  const totals = getDb().prepare(`SELECT COUNT(*) AS exposed, SUM(unresolved) AS unresolved FROM score_snapshots WHERE storm_date = ? AND scored_on = ?`).get(stormDate, day.day) as { exposed: number; unresolved: number | null };
  return { scoredOn: day.day, rows, exposed: totals.exposed, unresolved: totals.unresolved ?? 0 };
}

export function readPermitContacts(permitNo: string, customDb?: Database.Database): PermitContact[] {
  const db = customDb ?? getDb();
  const rows = db.prepare(`SELECT * FROM permit_contacts WHERE permit_no = ? ORDER BY role, name`).all(permitNo) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    permitId: String(r.permit_no),
    role: r.role as PermitContactRole,
    name: String(r.name),
    company: r.company ? String(r.company) : undefined,
    phone: r.phone ? String(r.phone) : undefined,
    phoneFormatted: r.phone_formatted ? String(r.phone_formatted) : undefined,
    email: r.email ? String(r.email) : undefined,
    emailType: r.email_type as PermitContact["emailType"],
    deliverability: r.deliverability as PermitContact["deliverability"],
    source: String(r.source),
    verifiedAt: r.created_at ? String(r.created_at) : undefined,
  }));
}

