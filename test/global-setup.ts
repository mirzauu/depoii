import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

let pgInstance: EmbeddedPostgres | null = null;
let dataDir: string | null = null;
const stateFile = path.join(process.cwd(), ".test-db.json");

export async function setup() {
  if (process.env.DATABASE_URL) {
    fs.writeFileSync(stateFile, JSON.stringify({ url: process.env.DATABASE_URL }), "utf8");
    return;
  }

  const PORT = 55447;
  dataDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-vitest-pg-"));
  pgInstance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "test",
    port: PORT,
    persistent: false,
  });

  await pgInstance.initialise();
  await pgInstance.start();
  await pgInstance.createDatabase("depoii_test");

  const url = `postgresql://postgres:test@localhost:${PORT}/depoii_test`;
  fs.writeFileSync(stateFile, JSON.stringify({ url }), "utf8");

  const client = new Client({ connectionString: url });
  await client.connect();

  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    sql = sql
      .replace("create extension if not exists postgis;", "-- postgis stripped for local test")
      .replaceAll("geometry(Point, 4326)", "text")
      .replaceAll("geometry(MultiPolygon, 4326)", "text");
    await client.query(sql);
  }

  await client.end();

  return async () => {
    if (fs.existsSync(stateFile)) {
      try { fs.unlinkSync(stateFile); } catch {}
    }
    if (pgInstance) {
      await pgInstance.stop();
    }
    if (dataDir && fs.existsSync(dataDir)) {
      try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
    }
  };
}
