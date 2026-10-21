import { afterAll, beforeEach, expect, test } from "vitest";
import { HttpError, createOrganization, updateMember, updateOrganization } from "@/lib/admin";
import { createLoginLink, redeemLoginLink, revokeLoginLink, signIn } from "@/lib/auth";
import { closePool, query, queryOne } from "@/lib/pg";

const previousEmail = process.env.DEPOII_SUPERADMIN_EMAIL;
const previousPassword = process.env.DEPOII_SUPERADMIN_PASSWORD;

beforeEach(async () => {
  delete process.env.DEPOII_SUPERADMIN_EMAIL;
  delete process.env.DEPOII_SUPERADMIN_PASSWORD;
  // Clean tenant tables for test isolation
  if (process.env.DATABASE_URL) {
    await query(`delete from app.login_links`);
    await query(`delete from app.memberships`);
    await query(`delete from app.activity`);
    await query(`delete from app.users`);
    await query(`delete from app.orgs`);
  }
});

afterAll(async () => {
  if (previousEmail === undefined) delete process.env.DEPOII_SUPERADMIN_EMAIL;
  else process.env.DEPOII_SUPERADMIN_EMAIL = previousEmail;
  if (previousPassword === undefined) delete process.env.DEPOII_SUPERADMIN_PASSWORD;
  else process.env.DEPOII_SUPERADMIN_PASSWORD = previousPassword;
  await closePool();
});

test("super admin can manage orgs and users without deleting them", async () => {
  const org = await createOrganization("actor", {
    name: "North Roofing",
    ownerName: "Ada Owner",
    ownerEmail: "ada@north.test",
    ownerPassword: "correct-horse",
  });
  expect(org.name).toBe("North Roofing");
  expect(org.members).toBe(1);

  const signedIn = await signIn("ada@north.test", "correct-horse");
  expect(signedIn).toMatchObject({ user: { email: "ada@north.test", role: "owner", platformRole: "" } });
  if (!("user" in signedIn)) throw new Error("expected a session");

  await updateOrganization(signedIn.user.id, org.id, { name: "North Roofing Co", disabled: true });
  expect(await signIn("ada@north.test", "correct-horse")).toEqual({ error: "This organization is suspended." });

  const promoted = await updateMember(signedIn.user.id, signedIn.user.id, { platformRole: "superadmin" });
  expect(promoted.platformRole).toBe("superadmin");
  const asAdmin = await signIn("ada@north.test", "correct-horse");
  expect(asAdmin).toMatchObject({ user: { platformRole: "superadmin", orgName: "North Roofing Co" } });

  await expect(updateMember(signedIn.user.id, signedIn.user.id, { disabled: true })).rejects.toThrow(HttpError);
  await expect(updateMember(signedIn.user.id, signedIn.user.id, { platformRole: "" })).rejects.toThrow(HttpError);

  const other = await createOrganization(signedIn.user.id, {
    name: "South Roofing",
    ownerName: "Bea",
    ownerEmail: "bea@south.test",
    ownerPassword: "another-pass",
  });
  const moved = await updateMember(signedIn.user.id, promoted.id, { orgId: other.id, role: "rep", password: "fresh-password" });
  expect(moved.orgId).toBe(other.id);
  expect(moved.role).toBe("rep");
  expect(await signIn("ada@north.test", "fresh-password")).toMatchObject({ user: { orgName: "South Roofing", role: "rep" } });

  const details = await query<{ detail: string }>(`SELECT detail FROM app.activity`);
  expect(details.length).toBeGreaterThan(0);
  for (const row of details) {
    const d = typeof row.detail === "string" ? row.detail : JSON.stringify(row.detail);
    expect(d).not.toContain("correct-horse");
    expect(d).not.toContain("fresh-password");
    expect(d).not.toContain("another-pass");
  }
  const orgCount = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM app.orgs`);
  const userCount = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM app.users`);
  expect(Number(orgCount?.n)).toBe(2);
  expect(Number(userCount?.n)).toBe(2);
});

test("a shared sign-in link opens the account without a password", async () => {
  await createOrganization("actor", {
    name: "Link Roofing",
    ownerName: "Lia",
    ownerEmail: "lia@link.test",
    ownerPassword: "link-password",
  });
  const signedIn = await signIn("lia@link.test", "link-password");
  if (!("user" in signedIn)) throw new Error("expected a session");
  const created = await createLoginLink(signedIn.user.id);
  if ("error" in created) throw new Error(created.error);
  const opened = await redeemLoginLink(created.token);
  expect(opened).toMatchObject({ user: { email: "lia@link.test" } });
  expect(await redeemLoginLink(created.token)).toMatchObject({ user: { email: "lia@link.test" } });
  const login = await queryOne<{ last_login_at: string; last_seen_at: string }>(
    `SELECT last_login_at, last_seen_at FROM app.users WHERE id = $1`,
    [signedIn.user.id],
  );
  expect(login?.last_login_at).toBeTruthy();
  expect(login?.last_seen_at).toBeTruthy();
  const details = await query<{ detail: string }>(
    `SELECT detail FROM app.activity WHERE actor_id = $1`,
    [signedIn.user.id],
  );
  for (const row of details) {
    const d = typeof row.detail === "string" ? row.detail : JSON.stringify(row.detail);
    expect(d).not.toContain(created.token);
  }
  await revokeLoginLink(signedIn.user.id);
  expect(await redeemLoginLink(created.token)).toEqual({ error: "This sign-in link is not valid." });
  await updateMember(signedIn.user.id, signedIn.user.id, { disabled: true });
  expect(await createLoginLink(signedIn.user.id)).toEqual({ error: "This account is disabled." });
});
