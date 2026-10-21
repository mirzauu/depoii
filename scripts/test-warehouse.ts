/**
 * Warehouse parity harness: boots an embedded Postgres, applies the
 * Supabase migration (PostGIS stripped for local binaries), loads a
 * sample of the real SQLite data, and exercises the Next.js warehouse
 * repositories against it.
 *
 *   npx tsx scripts/test-warehouse.ts
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { DatabaseSync } from "node:sqlite";

const PORT = 55444;
const root = process.cwd();

async function main() {
  const dataDir = fs.mkdtempSync(path.join(root, ".tmp-pg-"));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "test",
    port: PORT,
    persistent: false,
  });
  console.log("initialising embedded postgres (first run downloads binaries)...");
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("depoii_test");
  const url = `postgresql://postgres:test@localhost:${PORT}/depoii_test`;
  const client = new Client({ connectionString: url });
  await client.connect();

  let sql = fs.readFileSync(path.join(root, "supabase/migrations/20261020000000_depoii_fullstack.sql"), "utf8");
  sql = sql
    .replace("create extension if not exists postgis;", "-- postgis stripped for local test")
    .replaceAll("geometry(Point, 4326)", "text")
    .replaceAll("geometry(MultiPolygon, 4326)", "text");
  await client.query(sql);
  console.log("migration applied");

  // Load samples from the real engine SQLite DB.
  const dbPath = path.join(root, "Roofx/depoii-data-engine/depoii_local.db");
  if (fs.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const load = async (table: string, pgTable: string, limit: number, where = "") => {
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
      const pgCols = (await client.query(
        `select column_name from information_schema.columns where table_schema=$1 and table_name=$2`,
        pgTable.split("."),
      )).rows.map((r) => r.column_name as string);
      const shared = cols.filter((c) => pgCols.includes(c) && c !== "geom_point");
      const rows = db.prepare(`SELECT ${shared.map((c) => `"${c}"`).join(",")} FROM ${table} ${where} LIMIT ${limit}`).all() as Record<string, unknown>[];
      for (const row of rows) {
        const vals = shared.map((c) => {
          const v = row[c];
          if (typeof v === "boolean") return v;
          if (c.startsWith("is_") || c === "bbb_accredited") return v === 1 || v === true;
          return v === "" ? null : v;
        });
        await client.query(
          `insert into ${pgTable} (${shared.join(",")}) values (${shared.map((_, i) => `$${i + 1}`).join(",")}) on conflict do nothing`,
          vals,
        ).catch((e) => console.warn(`  ${table} row skipped: ${e.message}`));
      }
      console.log(`loaded ${rows.length} ${table}`);
    };
    await load("normalized_permits", "warehouse.normalized_permits", 800, "WHERE lower(raw_description) like '%roof%'");
    await load("parcels", "warehouse.parcels", 400);
    await load("canonical_contractors", "warehouse.canonical_contractors", 300);
    await load("storm_swaths", "warehouse.storm_swaths", 100);
    await load("scored_parcel_leads", "warehouse.scored_parcel_leads", 300, "WHERE parcel_id in (select parcel_id from released_leads)");
    await load("released_leads", "warehouse.released_leads", 300);
    db.close();
  } else {
    console.warn("engine sqlite not found — repositories will run against empty tables");
  }

  process.env.DATABASE_URL = url;
  const wh = await import("../src/lib/warehouse");
  const intel = await import("../src/lib/warehouse-intelligence");
  const q = (s: string) => new URLSearchParams(s);

  const checks: [string, () => Promise<unknown>][] = [
    ["permits/search", () => wh.permitsSearch(q("limit=5"))],
    ["permits/stats", () => wh.permitsStats()],
    ["permits/cities", () => wh.permitsCities()],
    ["permits/active-jobsites", () => wh.activeJobsites(q("limit=5"))],
    ["permits/roof-aging-alarm", () => wh.roofAging(q("limit=5"))],
    ["permits/multiphase-projects", () => wh.multiphase(q("limit=5"))],
    ["contractors/leaderboard", () => wh.contractors(q("limit=5"))],
    ["locations/hierarchy", () => wh.locations("hierarchy")],
    ["locations/cities", () => wh.locations("cities")],
    ["parcels/browse", () => wh.parcelsBrowse(q("limit=5"))],
    ["parcels/dark-market/overdue", () => wh.darkMarket(q("limit=5"))],
    ["storms/active-swaths", () => intel.activeSwaths()],
    ["intelligence/unresolved-exposure", () => intel.unresolvedExposure(q("limit=5"))],
    ["intelligence/leads/ranked", () => intel.rankedLeads(q("limit=5"))],
    ["brief", () => intel.mondayBrief(q("jurisdiction=Dallas, TX&limit=5"))],
    ["verifications/stats", () => intel.verificationStats()],
  ];
  let failed = 0;
  for (const [name, fn] of checks) {
    try {
      const out = (await fn()) as Record<string, unknown>;
      const size = JSON.stringify(out).length;
      console.log(`[ok] ${name} (${size} bytes)`);
    } catch (e) {
      failed++;
      console.error(`[FAIL] ${name}:`, e instanceof Error ? e.message : e);
    }
  }
  const counts = await client.query(`select (select count(*) from warehouse.normalized_permits) as permits, (select count(*) from warehouse.parcels) as parcels`);
  console.log("pg counts:", counts.rows[0]);
  await (await import("../src/lib/pg")).closePool();
  await client.end();
  await pg.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
  if (failed) { console.error(`${failed} checks failed`); process.exit(1); }
  console.log("warehouse parity harness passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
