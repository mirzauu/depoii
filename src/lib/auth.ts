import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { recordActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { sendMail, smtpConfigured } from "@/lib/mail";

const COOKIE = "depoii_session";
const WEEK = 60 * 60 * 24 * 7;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const TEAM_INVITE_DAYS = 14;

export type TeamRole = "owner" | "rep";

export type TeamInvite = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: string;
  platformRole: string;
};

export type SignInResult = { user: SessionUser } | { error: string };

type AccountRow = {
  id: string;
  email: string;
  name: string;
  password_hash?: string;
  org_id: string;
  org_name: string;
  role: string;
  platform_role: string;
  disabled: number;
  org_disabled: number;
  last_seen_at: string;
};

const ACCOUNT_SQL = `
  SELECT u.id, u.email, u.name, u.password_hash, u.platform_role, u.disabled, u.last_seen_at,
    m.org_id, m.role, o.name AS org_name, o.disabled AS org_disabled
  FROM users u
  JOIN memberships m ON m.user_id = u.id
  JOIN orgs o ON o.id = m.org_id
`;

function secret() {
  return process.env.DEPOII_SESSION_SECRET || "depoii-dev-session";
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  return next.length === prev.length && timingSafeEqual(next, prev);
}

function sessionFrom(row: AccountRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    orgId: row.org_id,
    orgName: row.org_name,
    role: row.role,
    platformRole: row.platform_role || "",
  };
}

function blockedReason(row: AccountRow) {
  if (row.disabled) return "This account is disabled.";
  if (row.org_disabled && row.platform_role !== "superadmin") return "This organization is suspended.";
  return "";
}

function ensureSuperAdmin() {
  const email = process.env.DEPOII_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEPOII_SUPERADMIN_PASSWORD;
  if (!email || !password) return;
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email) as { id: string } | undefined;
  if (existing) {
    db.prepare(`UPDATE users SET platform_role = 'superadmin' WHERE id = ?`).run(existing.id);
    return;
  }
  const orgId = randomBytes(8).toString("hex");
  const userId = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO orgs (id, name, disabled, created_at) VALUES (?, ?, 0, ?)`).run(orgId, "Depoii", now);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, platform_role, disabled, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, 'superadmin', 0, ?, '')
  `).run(userId, email, hashPassword(password), "Super admin", now);
  db.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, ?)`).run(orgId, userId, "owner");
}

export function ensurePilotOrg() {
  const db = getDb();
  const existing = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number };
  if (existing.n === 0) {
    const orgId = randomBytes(8).toString("hex");
    const userId = randomBytes(8).toString("hex");
    const email = (process.env.DEPOII_PILOT_EMAIL || "pilot@depoii.local").toLowerCase();
    const password = process.env.DEPOII_PILOT_PASSWORD || "depoii-pilot";
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO orgs (id, name, disabled, created_at) VALUES (?, ?, 0, ?)`).run(orgId, "Pilot", now);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, platform_role, disabled, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, '', 0, ?, '')
    `).run(userId, email, hashPassword(password), "Pilot rep", now);
    db.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, ?)`).run(orgId, userId, "owner");
  }
  ensureSuperAdmin();
}

export function signIn(email: string, password: string): SignInResult {
  ensurePilotOrg();
  const row = getDb().prepare(`${ACCOUNT_SQL} WHERE lower(u.email) = lower(?)`).get(email.trim()) as AccountRow | undefined;
  if (!row || !row.password_hash || !passwordMatches(password, row.password_hash)) {
    return { error: "That email or password did not match." };
  }
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  return completeSignIn(row, "auth.sign_in");
}

function hashOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function completeSignIn(row: AccountRow, action: string): SignInResult {
  rememberVisit(row.id, true);
  const user = sessionFrom(row);
  recordActivity({
    actorId: user.id,
    orgId: user.orgId,
    action,
    targetType: "user",
    targetId: user.id,
    detail: { email: user.email },
  });
  return { user };
}

export async function requestLoginOtp(emailInput: string): Promise<{ ok: true } | { error: string }> {
  ensurePilotOrg();
  const email = emailInput.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!smtpConfigured()) return { error: "Email sign-in is not configured." };

  const row = getDb().prepare(`${ACCOUNT_SQL} WHERE lower(u.email) = ?`).get(email) as AccountRow | undefined;
  if (!row) return { error: "No account found for that email." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };

  const existing = getDb()
    .prepare(`SELECT created_at FROM login_otps WHERE email = ?`)
    .get(email) as { created_at: string } | undefined;
  if (existing) {
    const age = Date.now() - Date.parse(existing.created_at);
    if (Number.isFinite(age) && age < OTP_RESEND_MS) {
      const wait = Math.ceil((OTP_RESEND_MS - age) / 1000);
      return { error: `Wait ${wait}s before requesting another code.` };
    }
  }

  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  getDb()
    .prepare(
      `
    INSERT INTO login_otps (email, code_hash, created_at, expires_at, attempts)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET
      code_hash = excluded.code_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      attempts = 0
  `,
    )
    .run(email, hashOtp(code), now.toISOString(), expiresAt);

  try {
    await sendMail({
      to: email,
      fromName: "Depoii",
      subject: `${code} is your Depoii sign-in code`,
      text: [
        "Your Depoii sign-in code:",
        "",
        code,
        "",
        "This code expires in 10 minutes. If you did not request it, you can ignore this email.",
      ].join("\n"),
      html: `
        <p style="font-family:system-ui,sans-serif;font-size:16px;color:#111">Your Depoii sign-in code:</p>
        <p style="font-family:ui-monospace,monospace;font-size:32px;letter-spacing:0.2em;font-weight:700;color:#111">${code}</p>
        <p style="font-family:system-ui,sans-serif;font-size:14px;color:#555">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error("[auth] OTP email send failed", err);
    getDb().prepare(`DELETE FROM login_otps WHERE email = ?`).run(email);
    return { error: "Could not send the verification email. Try again shortly." };
  }

  return { ok: true };
}

export function verifyLoginOtp(emailInput: string, codeInput: string): SignInResult {
  ensurePilotOrg();
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim().replace(/\s+/g, "");
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your email." };

  const otp = getDb()
    .prepare(`SELECT code_hash, expires_at, attempts FROM login_otps WHERE email = ?`)
    .get(email) as { code_hash: string; expires_at: string; attempts: number } | undefined;
  if (!otp) return { error: "Request a new verification code." };
  if (otp.expires_at <= new Date().toISOString()) {
    getDb().prepare(`DELETE FROM login_otps WHERE email = ?`).run(email);
    return { error: "That code expired. Request a new one." };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    getDb().prepare(`DELETE FROM login_otps WHERE email = ?`).run(email);
    return { error: "Too many attempts. Request a new code." };
  }

  const nextHash = hashOtp(code);
  const a = Buffer.from(otp.code_hash);
  const b = Buffer.from(nextHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    getDb().prepare(`UPDATE login_otps SET attempts = attempts + 1 WHERE email = ?`).run(email);
    return { error: "That code is incorrect." };
  }

  getDb().prepare(`DELETE FROM login_otps WHERE email = ?`).run(email);
  const row = getDb().prepare(`${ACCOUNT_SQL} WHERE lower(u.email) = ?`).get(email) as AccountRow | undefined;
  if (!row) return { error: "No account found for that email." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  return completeSignIn(row, "auth.otp_sign_in");
}

const LINK_DAYS = 14;

function rememberVisit(userId: string, login: boolean) {
  const now = new Date().toISOString();
  if (login) getDb().prepare(`UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?`).run(now, now, userId);
  else getDb().prepare(`UPDATE users SET last_seen_at = ? WHERE id = ?`).run(now, userId);
}

export function createLoginLink(userId: string): { token: string; expiresAt: string } | { error: string } {
  const row = getDb().prepare(`${ACCOUNT_SQL} WHERE u.id = ?`).get(userId) as AccountRow | undefined;
  if (!row) return { error: "User not found." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  getDb().prepare(`
    INSERT INTO login_links (user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      token_hash = excluded.token_hash, created_at = excluded.created_at, expires_at = excluded.expires_at
  `).run(userId, tokenHash, now.toISOString(), expiresAt);
  return { token, expiresAt };
}

export function revokeLoginLink(userId: string) {
  getDb().prepare(`DELETE FROM login_links WHERE user_id = ?`).run(userId);
}

export function loginLinkStatus(userId: string) {
  const row = getDb().prepare(`SELECT created_at, expires_at FROM login_links WHERE user_id = ?`).get(userId) as { created_at: string; expires_at: string } | undefined;
  if (!row) return null;
  return { createdAt: row.created_at, expiresAt: row.expires_at, active: row.expires_at > new Date().toISOString() };
}

export function redeemLoginLink(token: string): SignInResult {
  if (!token) return { error: "This sign-in link is not valid." };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const link = getDb().prepare(`SELECT user_id, expires_at FROM login_links WHERE token_hash = ?`).get(tokenHash) as { user_id: string; expires_at: string } | undefined;
  if (!link || link.expires_at <= new Date().toISOString()) return { error: "This sign-in link is not valid." };
  const row = getDb().prepare(`${ACCOUNT_SQL} WHERE u.id = ?`).get(link.user_id) as AccountRow | undefined;
  if (!row) return { error: "This sign-in link is not valid." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  return completeSignIn(row, "auth.link_sign_in");
}

export function listOrgMembers(orgId: string) {
  return getDb().prepare(`
    SELECT u.id, u.name, u.email, m.role
    FROM users u
    JOIN memberships m ON m.user_id = u.id
    WHERE m.org_id = ?
    ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, lower(u.name)
  `).all(orgId) as { id: string; name: string; email: string; role: string }[];
}

function parseTeamRole(role: string | undefined): TeamRole | "" {
  if (role === "owner" || role === "rep") return role;
  return "";
}

export function listPendingInvites(orgId: string): TeamInvite[] {
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE team_invites SET status = 'expired' WHERE org_id = ? AND status = 'pending' AND expires_at <= ?`)
    .run(orgId, now);
  return (
    getDb()
      .prepare(
        `
    SELECT id, name, email, role, status, created_at, expires_at
    FROM team_invites
    WHERE org_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `,
      )
      .all(orgId) as { id: string; name: string; email: string; role: string; status: string; created_at: string; expires_at: string }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

async function sendTeamInviteEmail(input: {
  to: string;
  name: string;
  orgName: string;
  role: string;
  acceptUrl: string;
  inviterName: string;
}) {
  const roleLabel = input.role === "owner" ? "Owner" : "Rep";
  await sendMail({
    to: input.to,
    fromName: "Depoii",
    subject: `You're invited to ${input.orgName} on Depoii`,
    text: [
      `Hi ${input.name},`,
      "",
      `${input.inviterName} invited you to join ${input.orgName} on Depoii as ${roleLabel}.`,
      "",
      "Accept your invite:",
      input.acceptUrl,
      "",
      "This invite expires in 14 days. If you were not expecting this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p style="font-family:system-ui,sans-serif;font-size:16px;color:#111">Hi ${input.name},</p>
      <p style="font-family:system-ui,sans-serif;font-size:16px;color:#111">${input.inviterName} invited you to join <strong>${input.orgName}</strong> on Depoii as <strong>${roleLabel}</strong>.</p>
      <p style="font-family:system-ui,sans-serif;margin:24px 0">
        <a href="${input.acceptUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Accept invite</a>
      </p>
      <p style="font-family:system-ui,sans-serif;font-size:14px;color:#555">Or open this link:<br/><a href="${input.acceptUrl}">${input.acceptUrl}</a></p>
      <p style="font-family:system-ui,sans-serif;font-size:14px;color:#555">This invite expires in 14 days. If you were not expecting this, you can ignore this email.</p>
    `,
  });
}

function inviteAcceptUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/api/auth/invite?token=${encodeURIComponent(token)}`;
}

export async function createTeamInvite(input: {
  orgId: string;
  orgName: string;
  invitedBy: SessionUser;
  name?: string;
  email?: string;
  role?: string;
  origin: string;
}): Promise<{ invite: TeamInvite } | { error: string }> {
  if (!smtpConfigured()) return { error: "Email invites are not configured." };
  const name = input.name?.trim() || "";
  const email = input.email?.trim().toLowerCase() || "";
  const role = parseTeamRole(input.role);
  if (!name) return { error: "Name is required." };
  if (!email.includes("@")) return { error: "Email is required." };
  if (!role) return { error: "Role must be owner or rep." };

  const db = getDb();
  const existingUser = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email) as { id: string } | undefined;
  if (existingUser) {
    const member = db
      .prepare(`SELECT role FROM memberships WHERE org_id = ? AND user_id = ?`)
      .get(input.orgId, existingUser.id);
    if (member) return { error: "That person is already on this team." };
    return { error: "A user with that email already exists." };
  }

  const pending = db
    .prepare(`SELECT id FROM team_invites WHERE org_id = ? AND lower(email) = ? AND status = 'pending'`)
    .get(input.orgId, email);
  if (pending) return { error: "An invite is already pending for that email." };

  const id = randomBytes(8).toString("hex");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEAM_INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `
    INSERT INTO team_invites (id, org_id, email, name, role, token_hash, status, invited_by, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `,
  ).run(id, input.orgId, email, name, role, tokenHash, input.invitedBy.id, now.toISOString(), expiresAt);

  try {
    await sendTeamInviteEmail({
      to: email,
      name,
      orgName: input.orgName,
      role,
      acceptUrl: inviteAcceptUrl(input.origin, token),
      inviterName: input.invitedBy.name || input.invitedBy.email,
    });
  } catch (err) {
    console.error("[auth] team invite email failed", err);
    db.prepare(`DELETE FROM team_invites WHERE id = ?`).run(id);
    return { error: "Could not send the invite email. Try again shortly." };
  }

  recordActivity({
    actorId: input.invitedBy.id,
    orgId: input.orgId,
    action: "invite.create",
    targetType: "invite",
    targetId: id,
    detail: { email, role, name },
  });

  return {
    invite: { id, name, email, role, status: "pending", createdAt: now.toISOString(), expiresAt },
  };
}

export async function resendTeamInvite(
  orgId: string,
  inviteId: string,
  actor: SessionUser,
  origin: string,
): Promise<{ ok: true } | { error: string }> {
  if (!smtpConfigured()) return { error: "Email invites are not configured." };
  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT id, email, name, role, status, expires_at
    FROM team_invites
    WHERE id = ? AND org_id = ?
  `,
    )
    .get(inviteId, orgId) as
    | { id: string; email: string; name: string; role: string; status: string; expires_at: string }
    | undefined;
  if (!row || row.status !== "pending") return { error: "That invite is not pending." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEAM_INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `
    UPDATE team_invites
    SET token_hash = ?, created_at = ?, expires_at = ?
    WHERE id = ?
  `,
  ).run(tokenHash, now.toISOString(), expiresAt, inviteId);

  try {
    await sendTeamInviteEmail({
      to: row.email,
      name: row.name,
      orgName: actor.orgName,
      role: row.role,
      acceptUrl: inviteAcceptUrl(origin, token),
      inviterName: actor.name || actor.email,
    });
  } catch (err) {
    console.error("[auth] team invite resend failed", err);
    return { error: "Could not resend the invite email. Try again shortly." };
  }

  recordActivity({
    actorId: actor.id,
    orgId,
    action: "invite.resend",
    targetType: "invite",
    targetId: inviteId,
    detail: { email: row.email },
  });
  return { ok: true };
}

export function cancelTeamInvite(orgId: string, inviteId: string, actorId: string): { ok: true } | { error: string } {
  const db = getDb();
  const row = db
    .prepare(`SELECT id, email, status FROM team_invites WHERE id = ? AND org_id = ?`)
    .get(inviteId, orgId) as { id: string; email: string; status: string } | undefined;
  if (!row || row.status !== "pending") return { error: "That invite is not pending." };
  db.prepare(`UPDATE team_invites SET status = 'cancelled' WHERE id = ?`).run(inviteId);
  recordActivity({
    actorId,
    orgId,
    action: "invite.cancel",
    targetType: "invite",
    targetId: inviteId,
    detail: { email: row.email },
  });
  return { ok: true };
}

export function acceptTeamInvite(token: string): SignInResult {
  if (!token) return { error: "This invite is not valid." };
  ensurePilotOrg();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = getDb();
  const invite = db
    .prepare(
      `
    SELECT id, org_id, email, name, role, status, expires_at
    FROM team_invites
    WHERE token_hash = ?
  `,
    )
    .get(tokenHash) as
    | { id: string; org_id: string; email: string; name: string; role: string; status: string; expires_at: string }
    | undefined;
  if (!invite || invite.status !== "pending") return { error: "This invite is not valid." };
  if (invite.expires_at <= new Date().toISOString()) {
    db.prepare(`UPDATE team_invites SET status = 'expired' WHERE id = ?`).run(invite.id);
    return { error: "This invite has expired." };
  }

  const role = parseTeamRole(invite.role) || "rep";
  const existing = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(invite.email) as { id: string } | undefined;
  if (existing) return { error: "An account with this email already exists. Sign in instead." };

  const write = db.transaction(() => {
    const userId = createUser(invite.org_id, invite.email, randomBytes(24).toString("base64url"), invite.name, role);
    db.prepare(`UPDATE team_invites SET status = 'accepted' WHERE id = ?`).run(invite.id);
    return userId;
  });
  const userId = write();
  const row = db.prepare(`${ACCOUNT_SQL} WHERE u.id = ?`).get(userId) as AccountRow;
  return completeSignIn(row, "auth.invite_accept");
}

export function signUp(input: { name?: string; organization?: string; email?: string; password?: string; invite?: string }): SignInResult {
  const invite = process.env.DEPOII_INVITE_CODE || "";
  if (!invite || input.invite !== invite) {
    return { error: "Signup is closed. Ask for a pilot invite." };
  }
  ensurePilotOrg();
  const name = input.name?.trim() || "";
  const organization = input.organization?.trim() || "";
  const email = input.email?.trim().toLowerCase() || "";
  const password = input.password || "";
  if (!name) return { error: "Name is required." };
  if (!organization) return { error: "Organization name is required." };
  if (!email.includes("@")) return { error: "Email is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const db = getDb();
  const taken = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email);
  if (taken) return { error: "A user with that email already exists." };
  const orgId = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  const write = db.transaction(() => {
    db.prepare(`INSERT INTO orgs (id, name, disabled, created_at) VALUES (?, ?, 0, ?)`).run(orgId, organization, now);
    return createUser(orgId, email, password, name, "owner");
  });
  const userId = write();
  const row = db.prepare(`${ACCOUNT_SQL} WHERE u.id = ?`).get(userId) as AccountRow;
  rememberVisit(userId, true);
  const user = sessionFrom(row);
  recordActivity({
    actorId: user.id,
    orgId: user.orgId,
    action: "auth.sign_up",
    targetType: "user",
    targetId: user.id,
    detail: { email: user.email, organization },
  });
  return { user };
}

export function createUser(orgId: string, email: string, password: string, name: string, role: "owner" | "rep" = "rep") {
  const id = randomBytes(8).toString("hex");
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const taken = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(normalized);
  if (taken) {
    const error = new Error("A user with that email already exists.");
    (error as Error & { status: number }).status = 409;
    throw error;
  }
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, platform_role, disabled, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, '', 0, ?, '')
  `).run(id, normalized, hashPassword(password), name.trim() || normalized, now);
  db.prepare(`INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, ?)`).run(orgId, id, role);
  return id;
}

export function setUserPassword(userId: string, password: string) {
  getDb().prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(password), userId);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function sessionToken(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + WEEK * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [payload, mac] = token.split(".");
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let body: { id?: string; exp?: number };
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!body.id || !body.exp || body.exp < Date.now()) return null;
  const row = getDb().prepare(`${ACCOUNT_SQL} WHERE u.id = ?`).get(body.id) as AccountRow | undefined;
  if (!row || blockedReason(row)) return null;
  const seen = row.last_seen_at ? Date.parse(row.last_seen_at) : 0;
  if (!seen || Date.now() - seen > 60_000) rememberVisit(row.id, false);
  return sessionFrom(row);
}

export async function requireUser(): Promise<SessionUser> {
  const jar = await cookies();
  const user = readSessionToken(jar.get(COOKIE)?.value);
  if (!user) {
    const error = new Error("Sign in required.");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.platformRole !== "superadmin") {
    const error = new Error("Super admin access required.");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
  return user;
}

export function cookieName() {
  return COOKIE;
}

export function cookieMaxAge() {
  return WEEK;
}
