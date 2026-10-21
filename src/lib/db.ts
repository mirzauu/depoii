import { query, queryOne, withClient } from "@/lib/pg";
import { rankOpportunities } from "@/lib/engine/score";
import type { FieldOutcome, LivePayload, PermitContact, PermitContactRole, ScoreWeights } from "@/lib/types";

/**
 * Postgres replacement for the former better-sqlite3 store.
 * Live-cache tables live in the warehouse schema (live_*), tenant
 * outcomes in app.field_outcomes. All functions are async.
 */

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

export async function persistLive(payload: LivePayload): Promise<void> {
  const scoredOn = payload.fetchedAt.slice(0, 10);
  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const parcel of payload.parcels) {
        await client.query(
          `insert into warehouse.live_parcels (account, owner, address, city, year_built, sqft, lat, lng, owner_address, record_url, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (account) do update set owner=excluded.owner, address=excluded.address, city=excluded.city,
             year_built=excluded.year_built, sqft=excluded.sqft, lat=excluded.lat, lng=excluded.lng,
             owner_address=excluded.owner_address, record_url=excluded.record_url, updated_at=excluded.updated_at`,
          [parcel.id, parcel.owner, parcel.address, parcel.city, parcel.yearBuilt, parcel.sqft, parcel.lat, parcel.lng, parcel.ownerAddress, parcel.recordUrl, payload.fetchedAt],
        );
      }
      for (const permit of [...payload.permits, ...payload.developments]) {
        await client.query(
          `insert into warehouse.live_permits (permit_no, kind, address, city, contractor_name, contractor_state, issued, valuation, scope, membrane, lat, lng, parcel_ids, record_url, portal, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)
           on conflict (permit_no) do update set kind=excluded.kind, address=excluded.address, city=excluded.city,
             contractor_name=excluded.contractor_name, contractor_state=excluded.contractor_state, issued=excluded.issued,
             valuation=excluded.valuation, scope=excluded.scope, membrane=excluded.membrane, lat=excluded.lat, lng=excluded.lng,
             parcel_ids=excluded.parcel_ids, record_url=excluded.record_url, portal=excluded.portal, updated_at=excluded.updated_at`,
          [permit.id, permit.kind, permit.address, permit.city, permit.contractorName, permit.contractorState, permit.issued, permit.valuation, permit.scope, permit.membrane ?? null, permit.lat, permit.lng, JSON.stringify(permit.parcelIds), permit.recordUrl, permit.portal, payload.fetchedAt],
        );
        for (const contact of permit.contacts ?? []) {
          await client.query(
            `insert into warehouse.permit_contacts (id, permit_no, role, name, company, phone, phone_formatted, email, email_type, deliverability, source, created_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             on conflict (id) do update set role=excluded.role, name=excluded.name, company=excluded.company,
               phone=excluded.phone, phone_formatted=excluded.phone_formatted, email=excluded.email,
               email_type=excluded.email_type, deliverability=excluded.deliverability, source=excluded.source, created_at=excluded.created_at`,
            [contact.id, permit.id, contact.role, contact.name, contact.company ?? null, contact.phone ?? null, contact.phoneFormatted ?? null, contact.email ?? null, contact.emailType ?? null, contact.deliverability ?? null, contact.source, payload.fetchedAt],
          );
        }
      }
      for (const report of payload.storm.reports) {
        await client.query(
          `insert into warehouse.hail_reports (id, storm_date, valid, lat, lng, inches, qualifier, city, county, source, remark)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing`,
          [report.id, payload.storm.date, report.valid, report.lat, report.lng, report.inches, report.qualifier, report.city, report.county, report.source, report.remark],
        );
      }
      const existing = await client.query(`select count(*)::int as n from warehouse.warnings where storm_date = $1`, [payload.storm.date]);
      if (existing.rows[0].n === 0) {
        for (const warning of payload.storm.warnings) {
          await client.query(
            `insert into warehouse.warnings (storm_date, event_id, issue, hail_tag, wind_tag, tier, basis, href, expire, geometry)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) on conflict do nothing`,
            [payload.storm.date, warning.eventId, warning.issue, warning.hailTag, warning.windTag, warning.tier, warning.basis, warning.href, warning.expire, JSON.stringify(warning.geometry)],
          );
        }
      }
      const exposed = rankOpportunities(payload.parcels, payload.storm, payload.permits, undefined, undefined, payload.permitFeeds).filter((o) => o.tier !== "outside");
      for (const opportunity of exposed) {
        await client.query(
          `insert into warehouse.score_snapshots (storm_date, account, scored_on, scored_at, tier, hail_inches, hail_basis, score, factors, unresolved, pipeline_value, roof_age)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12) on conflict (storm_date, account, scored_on) do nothing`,
          [payload.storm.date, opportunity.parcel.id, scoredOn, payload.fetchedAt, opportunity.tier, opportunity.hailInches, opportunity.parcel.hailBasis ?? "", opportunity.score, JSON.stringify(opportunity.factors), opportunity.unresolved ? 1 : 0, opportunity.pipelineValue, opportunity.roofAge],
        );
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
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
    factors: (typeof row.factors === "string" ? JSON.parse(row.factors) : row.factors) as Record<keyof ScoreWeights, number>,
    moistureVerified: Boolean(row.moisture_verified),
    scope: row.scope,
    contractValue: row.contract_value,
    notes: row.notes,
  };
}

export async function listOutcomes(orgId?: string): Promise<FieldOutcome[]> {
  const rows = (orgId
    ? await query(`select * from app.field_outcomes where org_id = $1 order by logged_at desc, id desc`, [orgId])
    : await query(`select * from app.field_outcomes order by logged_at desc, id desc`)) as unknown as Parameters<typeof outcomeFrom>[0][];
  return rows.map(outcomeFrom);
}

export async function saveOutcomes(outcomes: FieldOutcome[], orgId = ""): Promise<void> {
  await withClient(async (client) => {
    await client.query("begin");
    try {
      for (const outcome of outcomes) {
        await client.query(
          `insert into app.field_outcomes (id, parcel_id, storm_id, logged_at, predicted_score, factors, moisture_verified, scope, contract_value, notes, org_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (parcel_id, storm_id) do update set id=excluded.id, logged_at=excluded.logged_at,
             predicted_score=excluded.predicted_score, factors=excluded.factors, moisture_verified=excluded.moisture_verified,
             scope=excluded.scope, contract_value=excluded.contract_value, notes=excluded.notes, org_id=excluded.org_id`,
          [outcome.id, outcome.parcelId, outcome.stormId, outcome.loggedAt, outcome.predictedScore, JSON.stringify(outcome.factors), outcome.moistureVerified ? 1 : 0, outcome.scope, outcome.contractValue, outcome.notes, orgId],
        );
      }
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
}

export async function clearOutcomes(orgId?: string): Promise<void> {
  if (orgId) await query(`delete from app.field_outcomes where org_id = $1`, [orgId]);
  else await query(`delete from app.field_outcomes`);
}

export async function parcelByAccount(account: string): Promise<ParcelRow | undefined> {
  return queryOne<ParcelRow>(`select * from warehouse.live_parcels where account = $1`, [account]);
}

export async function permitsForAccount(account: string): Promise<PermitRow[]> {
  const rows = await query<Record<string, unknown>>(`select * from warehouse.live_permits where parcel_ids @> $1::jsonb`, [JSON.stringify([account])]);
  return rows.map((r) => ({ ...(r as unknown as PermitRow), parcel_ids: JSON.stringify(r.parcel_ids ?? []) }));
}

export async function latestSnapshot(account: string, stormDate?: string): Promise<SnapshotRow | undefined> {
  const row = stormDate
    ? await queryOne<Record<string, unknown>>(`select * from warehouse.score_snapshots where account = $1 and storm_date = $2 order by scored_on desc, id desc limit 1`, [account, stormDate])
    : await queryOne<Record<string, unknown>>(`select * from warehouse.score_snapshots where account = $1 order by scored_on desc, id desc limit 1`, [account]);
  return row ? ({ ...row, factors: typeof row.factors === "string" ? row.factors : JSON.stringify(row.factors ?? {}) } as unknown as SnapshotRow) : undefined;
}

export async function outcomeFor(account: string, stormDate?: string): Promise<FieldOutcome | undefined> {
  const row = stormDate
    ? await queryOne(`select * from app.field_outcomes where parcel_id = $1 and storm_id = $2`, [account, stormDate])
    : await queryOne(`select * from app.field_outcomes where parcel_id = $1 order by logged_at desc limit 1`, [account]);
  return row ? outcomeFrom(row as unknown as Parameters<typeof outcomeFrom>[0]) : undefined;
}

export async function reportsForStorm(stormDate: string): Promise<HailRow[]> {
  return query<HailRow>(`select * from warehouse.hail_reports where storm_date = $1 order by inches desc`, [stormDate]);
}

export async function warningCount(stormDate: string): Promise<number> {
  const row = await queryOne<{ n: string }>(`select count(*)::text as n from warehouse.warnings where storm_date = $1`, [stormDate]);
  return Number(row?.n || 0);
}

export async function latestSnapshots(stormDate: string, limit = 10) {
  const day = await queryOne<{ day: string | null }>(`select max(scored_on) as day from warehouse.score_snapshots where storm_date = $1`, [stormDate]);
  if (!day?.day) return { scoredOn: null as string | null, rows: [] as SnapshotRow[], exposed: 0, unresolved: 0 };
  const rows = (await query(`select * from warehouse.score_snapshots where storm_date = $1 and scored_on = $2 order by score desc limit $3`, [stormDate, day.day, limit])) as unknown as SnapshotRow[];
  const totals = await queryOne<{ exposed: string; unresolved: string | null }>(`select count(*)::text as exposed, sum(unresolved)::text as unresolved from warehouse.score_snapshots where storm_date = $1 and scored_on = $2`, [stormDate, day.day]);
  return { scoredOn: day.day as string | null, rows, exposed: Number(totals?.exposed || 0), unresolved: Number(totals?.unresolved || 0) };
}

export async function readPermitContacts(permitNo: string): Promise<PermitContact[]> {
  const rows = await query<Record<string, unknown>>(`select * from warehouse.permit_contacts where permit_no = $1 order by role, name`, [permitNo]);
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

export async function upsertPermitContacts(contacts: PermitContact[], createdAt: string): Promise<void> {
  for (const contact of contacts) {
    await query(
      `insert into warehouse.permit_contacts (id, permit_no, role, name, company, phone, phone_formatted, email, email_type, deliverability, source, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set role=excluded.role, name=excluded.name, company=excluded.company,
         phone=excluded.phone, phone_formatted=excluded.phone_formatted, email=excluded.email,
         email_type=excluded.email_type, deliverability=excluded.deliverability, source=excluded.source, created_at=excluded.created_at`,
      [contact.id, contact.permitId, contact.role, contact.name, contact.company ?? null, contact.phone ?? null, contact.phoneFormatted ?? null, contact.email ?? null, contact.emailType ?? null, contact.deliverability ?? null, contact.source, createdAt],
    );
  }
}

export async function closeDb(): Promise<void> {
  const { closePool } = await import("@/lib/pg");
  await closePool();
}
