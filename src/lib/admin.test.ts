import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { HttpError, createOrganization, updateMember, updateOrganization } from "@/lib/admin";
import { createLoginLink, redeemLoginLink, revokeLoginLink, signIn } from "@/lib/auth";
import { closeDb, getDb } from "@/lib/db";

const previousDb = process.env.DEPOII_DB;
const previousEmail = process.env.DEPOII_SUPERADMIN_EMAIL;
const previousPassword = process.env.DEPOII_SUPERADMIN_PASSWORD;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "depoii-admin-"));

beforeAll(() => {
  process.env.DEPOII_DB = path.join(dir, "depoii.sqlite");
  delete process.env.DEPOII_SUPERADMIN_EMAIL;
  delete process.env.DEPOII_SUPERADMIN_PASSWORD;
  closeDb();
});

afterAll(() => {
  closeDb();
  if (previousDb === undefined) delete process.env.DEPOII_DB;
  else process.env.DEPOII_DB = previousDb;
  if (previousEmail === undefined) delete process.env.DEPOII_SUPERADMIN_EMAIL;
  else process.env.DEPOII_SUPERADMIN_EMAIL = previousEmail;
  if (previousPassword === undefined) delete process.env.DEPOII_SUPERADMIN_PASSWORD;
  else process.env.DEPOII_SUPERADMIN_PASSWORD = previousPassword;
  fs.rmSync(dir, { recursive: true, force: true });
});

test("super admin can manage orgs and users without deleting them", () => {
  const org = createOrganization("actor", {
    name: "North Roofing",
    ownerName: "Ada Owner",
    ownerEmail: "ada@north.test",
    ownerPassword: "correct-horse",
  });
  expect(org.name).toBe("North Roofing");
  expect(org.members).toBe(1);

  const signedIn = signIn("ada@north.test", "correct-horse");
  expect(signedIn).toMatchObject({ user: { email: "ada@north.test", role: "owner", platformRole: "" } });
  if (!("user" in signedIn)) throw new Error("expected a session");

  updateOrganization(signedIn.user.id, org.id, { name: "North Roofing Co", disabled: true });
  expect(signIn("ada@north.test", "correct-horse")).toEqual({ error: "This organization is suspended." });

  const promoted = updateMember(signedIn.user.id, signedIn.user.id, { platformRole: "superadmin" });
  expect(promoted.platformRole).toBe("superadmin");
  const asAdmin = signIn("ada@north.test", "correct-horse");
  expect(asAdmin).toMatchObject({ user: { platformRole: "superadmin", orgName: "North Roofing Co" } });

  expect(() => updateMember(signedIn.user.id, signedIn.user.id, { disabled: true })).toThrow(HttpError);
  expect(() => updateMember(signedIn.user.id, signedIn.user.id, { platformRole: "" })).toThrow(HttpError);

  const other = createOrganization(signedIn.user.id, {
    name: "South Roofing",
    ownerName: "Bea",
    ownerEmail: "bea@south.test",
    ownerPassword: "another-pass",
  });
  const moved = updateMember(signedIn.user.id, promoted.id, { orgId: other.id, role: "rep", password: "fresh-password" });
  expect(moved.orgId).toBe(other.id);
  expect(moved.role).toBe("rep");
  expect(signIn("ada@north.test", "fresh-password")).toMatchObject({ user: { orgName: "South Roofing", role: "rep" } });

  const details = getDb().prepare(`SELECT detail FROM activity`).all() as { detail: string }[];
  expect(details.length).toBeGreaterThan(0);
  for (const row of details) {
    expect(row.detail).not.toContain("correct-horse");
    expect(row.detail).not.toContain("fresh-password");
    expect(row.detail).not.toContain("another-pass");
  }
  expect(getDb().prepare(`SELECT COUNT(*) AS n FROM orgs`).get()).toEqual({ n: 2 });
  expect(getDb().prepare(`SELECT COUNT(*) AS n FROM users`).get()).toEqual({ n: 2 });
});

test("a shared sign-in link opens the account without a password", () => {
  createOrganization("actor", {
    name: "Link Roofing",
    ownerName: "Lia",
    ownerEmail: "lia@link.test",
    ownerPassword: "link-password",
  });
  const signedIn = signIn("lia@link.test", "link-password");
  if (!("user" in signedIn)) throw new Error("expected a session");
  const created = createLoginLink(signedIn.user.id);
  if ("error" in created) throw new Error(created.error);
  const opened = redeemLoginLink(created.token);
  expect(opened).toMatchObject({ user: { email: "lia@link.test" } });
  expect(redeemLoginLink(created.token)).toMatchObject({ user: { email: "lia@link.test" } });
  const login = getDb().prepare(`SELECT last_login_at, last_seen_at FROM users WHERE id = ?`).get(signedIn.user.id) as { last_login_at: string; last_seen_at: string };
  expect(login.last_login_at).not.toBe("");
  expect(login.last_seen_at).not.toBe("");
  const details = getDb().prepare(`SELECT detail FROM activity WHERE actor_id = ?`).all(signedIn.user.id) as { detail: string }[];
  for (const row of details) expect(row.detail).not.toContain(created.token);
  revokeLoginLink(signedIn.user.id);
  expect(redeemLoginLink(created.token)).toEqual({ error: "This sign-in link is not valid." });
  updateMember(signedIn.user.id, signedIn.user.id, { disabled: true });
  expect(createLoginLink(signedIn.user.id)).toEqual({ error: "This account is disabled." });
});
