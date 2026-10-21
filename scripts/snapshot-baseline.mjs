/**
 * Phase 0 baseline: snapshot FastAPI engine responses + SQLite row counts.
 * Usage:
 *   DEPOII_ENGINE_URL=http://localhost:8000 node scripts/snapshot-baseline.mjs
 * Writes fixtures to scripts/fixtures/engine/<route>.json and scripts/fixtures/row-counts.json
 * Row counts are read via python (py) from the two SQLite DBs if present.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "scripts", "fixtures", "engine");
fs.mkdirSync(outDir, { recursive: true });

const READ_ROUTES = [
  "health",
  "permits/search?limit=5",
  "permits/stats",
  "permits/cities",
  "permits/active-jobsites?limit=5",
  "permits/roof-aging-alarm?limit=5",
  "permits/multiphase-projects?limit=5",
  "contractors/leaderboard?limit=5",
  "contractors/directory?limit=5",
  "locations/hierarchy",
  "locations/states",
  "locations/cities",
  "parcels/search?limit=5",
  "parcels/browse?limit=5",
  "parcels/dark-market/overdue?limit=5",
  "storms/active-swaths",
  "storms/hail-events",
  "intelligence/unresolved-exposure?limit=5",
  "intelligence/leads/ranked?limit=5",
  "brief",
  "verifications/stats",
];

const base = (process.env.DEPOII_ENGINE_URL || "").replace(/\/$/, "");
const manifest = { generatedAt: new Date().toISOString(), base: base || null, routes: {} };

if (!base) {
  console.warn("DEPOII_ENGINE_URL not set — skipping HTTP snapshots (row counts only).");
} else {
  for (const route of READ_ROUTES) {
    const name = route.replace(/[/?=&]/g, "_");
    try {
      const res = await fetch(`${base}/api/v1/${route}`, {
        headers: { Accept: "application/json", "x-depoii-key": process.env.DEPOII_ENGINE_KEY || "" },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await res.json().catch(() => null);
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(body, null, 2));
      manifest.routes[route] = { status: res.status, bytes: JSON.stringify(body ?? "").length };
      console.log(`[ok] ${route} -> ${res.status}`);
    } catch (err) {
      manifest.routes[route] = { error: String(err?.message || err) };
      console.warn(`[fail] ${route}: ${manifest.routes[route].error}`);
    }
  }
}

const COUNT_PY = `
import json, os, sqlite3, sys
out = {}
for label, p in [("next", os.environ.get("DEPOII_DB", "data/depoii.sqlite")),
                 ("engine", "Roofx/depoii-data-engine/depoii_local.db"),
                 ("engine_root", "depoii_local.db")]:
    if not os.path.exists(p):
        out[label] = {"path": p, "missing": True}; continue
    conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    out[label] = {"path": p, "tables": {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in tables}}
    conn.close()
print(json.dumps(out, indent=2))
`;
try {
  const counts = execFileSync("py", ["-c", COUNT_PY], { cwd: root, encoding: "utf8" });
  fs.writeFileSync(path.join(root, "scripts", "fixtures", "row-counts.json"), counts);
  manifest.rowCounts = JSON.parse(counts);
  console.log("[ok] row counts written");
} catch (err) {
  manifest.rowCounts = { error: String(err?.message || err) };
  console.warn("[fail] row counts:", manifest.rowCounts.error);
}

fs.writeFileSync(path.join(root, "scripts", "fixtures", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Baseline snapshot complete.");
