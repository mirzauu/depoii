import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import { closePool } from "@/lib/pg";

const stateFile = path.join(process.cwd(), ".test-db.json");

beforeAll(() => {
  if (!process.env.DATABASE_URL && fs.existsSync(stateFile)) {
    try {
      const { url } = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (url) process.env.DATABASE_URL = url;
    } catch {}
  }
});

afterAll(async () => {
  await closePool();
});
