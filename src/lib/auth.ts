import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { recordActivity } from "@/lib/activity";
import { pgConfigured, query, queryOne, withClient } from "@/lib/pg";
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
  FROM app.users u
  JOIN app.memberships m ON m.user_id = u.id
  JOIN app.orgs o ON o.id = m.org_id
`;

function secret() {
  const s = process.env.DEPOII_SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    console.warn("[auth] WARNING: DEPOII_SESSION_SECRET is not set in production. Set a random 32+ character secret.");
  }
  return s || "depoii-dev-session";
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

async function ensureSuperAdmin(): Promise<void> {
  const email = process.env.DEPOII_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEPOII_SUPERADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await queryOne<{ id: string }>(`select id from app.users where lower(email) = $1`, [email]);
  if (existing) {
    await query(`update app.users set platform_role = 'superadmin' where id = $1`, [existing.id]);
    return;
  }
  const orgId = randomBytes(8).toString("hex");
  const userId = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  await query(`insert into app.orgs (id, name, disabled, created_at) values ($1, $2, 0, $3) on conflict (id) do nothing`, [orgId, "Depoii", now]);
  await query(
    `insert into app.users (id, email, password_hash, name, platform_role, disabled, created_at, last_seen_at) values ($1,$2,$3,$4,'superadmin',0,$5,'')`,
    [userId, email, hashPassword(password), "Super admin", now],
  );
  await query(`insert into app.memberships (org_id, user_id, role) values ($1,$2,$3) on conflict do nothing`, [orgId, userId, "owner"]);
}

export async function ensurePilotOrg(): Promise<void> {
  if (!pgConfigured()) return;
  const existing = await queryOne<{ n: string }>(`select count(*)::text as n from app.users`);
  if (Number(existing?.n || 0) === 0) {
    const orgId = randomBytes(8).toString("hex");
    const userId = randomBytes(8).toString("hex");
    const email = (process.env.DEPOII_PILOT_EMAIL || "pilot@depoii.local").toLowerCase();
    const password = process.env.DEPOII_PILOT_PASSWORD || "depoii-pilot";
    const now = new Date().toISOString();
    await query(`insert into app.orgs (id, name, disabled, created_at) values ($1,$2,0,$3)`, [orgId, "Pilot", now]);
    await query(
      `insert into app.users (id, email, password_hash, name, platform_role, disabled, created_at, last_seen_at) values ($1,$2,$3,$4,'',0,$5,'')`,
      [userId, email, hashPassword(password), "Pilot rep", now],
    );
    await query(`insert into app.memberships (org_id, user_id, role) values ($1,$2,$3)`, [orgId, userId, "owner"]);
  }
  await ensureSuperAdmin();
}

async function accountBy(sql: string, param: string): Promise<AccountRow | undefined> {
  return queryOne<AccountRow>(`${ACCOUNT_SQL} WHERE ${sql}`, [param]);
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!pgConfigured()) return { error: "Database not configured yet. Set DATABASE_URL in .env." };
  await ensurePilotOrg();
  const row = await accountBy(`lower(u.email) = lower($1)`, email.trim());
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

async function completeSignIn(row: AccountRow, action: string): Promise<SignInResult> {
  await rememberVisit(row.id, true);
  const user = sessionFrom(row);
  await recordActivity({
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
  if (!pgConfigured()) return { error: "Database not configured yet. Set DATABASE_URL in .env." };
  await ensurePilotOrg();
  const email = emailInput.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!smtpConfigured()) return { error: "Email sign-in is not configured." };

  const row = await accountBy(`lower(u.email) = $1`, email);
  if (!row) return { error: "No account found for that email." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };

  const existing = await queryOne<{ created_at: string }>(`select created_at from app.login_otps where email = $1`, [email]);
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
  await query(
    `insert into app.login_otps (email, code_hash, created_at, expires_at, attempts) values ($1,$2,$3,$4,0)
     on conflict (email) do update set code_hash = excluded.code_hash, created_at = excluded.created_at, expires_at = excluded.expires_at, attempts = 0`,
    [email, hashOtp(code), now.toISOString(), expiresAt],
  );

  try {
    await sendMail({
      to: email,
      fromName: "Depoii",
      subject: `${code} is your Depoii sign-in code`,
      text: ["Your Depoii sign-in code:", "", code, "", "This code expires in 10 minutes. If you did not request it, you can ignore this email."].join("\n"),
      html: `
        <p style="font-family:system-ui,sans-serif;font-size:16px;color:#111">Your Depoii sign-in code:</p>
        <p style="font-family:ui-monospace,monospace;font-size:32px;letter-spacing:0.2em;font-weight:700;color:#111">${code}</p>
        <p style="font-family:system-ui,sans-serif;font-size:14px;color:#555">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error("[auth] OTP email send failed", err);
    await query(`delete from app.login_otps where email = $1`, [email]);
    return { error: "Could not send the verification email. Try again shortly." };
  }

  return { ok: true };
}

export async function verifyLoginOtp(emailInput: string, codeInput: string): Promise<SignInResult> {
  if (!pgConfigured()) return { error: "Database not configured yet. Set DATABASE_URL in .env." };
  await ensurePilotOrg();
  const email = emailInput.trim().toLowerCase();
  const code = codeInput.trim().replace(/\s+/g, "");
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your email." };

  const otp = await queryOne<{ code_hash: string; expires_at: string; attempts: number }>(`select code_hash, expires_at, attempts from app.login_otps where email = $1`, [email]);
  if (!otp) return { error: "Request a new verification code." };
  if (otp.expires_at <= new Date().toISOString()) {
    await query(`delete from app.login_otps where email = $1`, [email]);
    return { error: "That code expired. Request a new one." };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await query(`delete from app.login_otps where email = $1`, [email]);
    return { error: "Too many attempts. Request a new code." };
  }

  const nextHash = hashOtp(code);
  const a = Buffer.from(otp.code_hash);
  const b = Buffer.from(nextHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await query(`update app.login_otps set attempts = attempts + 1 where email = $1`, [email]);
    return { error: "That code is incorrect." };
  }

  await query(`delete from app.login_otps where email = $1`, [email]);
  const row = await accountBy(`lower(u.email) = $1`, email);
  if (!row) return { error: "No account found for that email." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  return completeSignIn(row, "auth.otp_sign_in");
}

export function isOtpBypassEmail(emailInput: string): boolean {
  const email = emailInput.trim().toLowerCase();
  const superadminEmail = process.env.DEPOII_SUPERADMIN_EMAIL?.trim().toLowerCase();
  return email === "admin@depoii.local" || (Boolean(superadminEmail) && email === superadminEmail);
}

export async function loginWithoutOtp(emailInput: string): Promise<SignInResult> {
  if (!pgConfigured()) return { error: "Database not configured yet. Set DATABASE_URL in .env." };
  await ensurePilotOrg();
  await ensureSuperAdmin();
  const email = emailInput.trim().toLowerCase();
  const row = await accountBy(`lower(u.email) = $1`, email);
  if (!row) return { error: "No account found for that email." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  return completeSignIn(row, "auth.bypass_sign_in");
}

const LINK_DAYS = 14;

async function rememberVisit(userId: string, login: boolean): Promise<void> {
  const now = new Date().toISOString();
  if (login) await query(`update app.users set last_login_at = $1, last_seen_at = $2 where id = $3`, [now, now, userId]);
  else await query(`update app.users set last_seen_at = $1 where id = $2`, [now, userId]);
}

let loginLinkSchemaEnsured = false;
export async function ensureLoginLinkSchema(): Promise<void> {
  if (loginLinkSchemaEnsured || !pgConfigured()) return;
  try {
    for (const col of [
      "is_active boolean not null default true",
      "max_uses integer null",
      "use_count integer not null default 0",
      "last_used_at text null",
      "created_by text null",
    ]) {
      await query(`alter table app.login_links add column if not exists ${col}`);
    }
    loginLinkSchemaEnsured = true;
  } catch {
    loginLinkSchemaEnsured = true;
  }
}

export type CreateLoginLinkOptions = {
  expiresInDays?: number;
  maxUses?: number | null;
  createdBy?: string;
};

export type LoginLinkStatus = {
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  maxUses: number | null;
  useCount: number;
  lastUsedAt: string | null;
  expired: boolean;
  exhausted: boolean;
  active: boolean;
  reason: "active" | "deactivated" | "expired" | "exhausted";
};

export type UpdateLoginLinkInput = {
  isActive?: boolean;
  expiresInDays?: number;
  expiresAt?: string;
  maxUses?: number | null;
  resetUses?: boolean;
};

export async function createLoginLink(
  userId: string,
  options: CreateLoginLinkOptions = {},
): Promise<{ token: string; expiresAt: string; maxUses: number | null; useCount: number; isActive: boolean } | { error: string }> {
  await ensureLoginLinkSchema();
  const row = await accountBy(`u.id = $1`, userId);
  if (!row) return { error: "User not found." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const days = options.expiresInDays && options.expiresInDays > 0 ? options.expiresInDays : LINK_DAYS;
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const maxUses = typeof options.maxUses === "number" && options.maxUses > 0 ? options.maxUses : null;
  const createdBy = options.createdBy || null;

  await query(
    `insert into app.login_links (user_id, token_hash, created_at, expires_at, is_active, max_uses, use_count, last_used_at, created_by)
     values ($1,$2,$3,$4,true,$5,0,null,$6)
     on conflict (user_id) do update set
       token_hash = excluded.token_hash,
       created_at = excluded.created_at,
       expires_at = excluded.expires_at,
       is_active = true,
       max_uses = excluded.max_uses,
       use_count = 0,
       last_used_at = null,
       created_by = excluded.created_by`,
    [userId, tokenHash, now.toISOString(), expiresAt, maxUses, createdBy],
  );
  return { token, expiresAt, maxUses, useCount: 0, isActive: true };
}

export async function updateLoginLink(
  userId: string,
  input: UpdateLoginLinkInput,
): Promise<{ ok: true; status: LoginLinkStatus } | { error: string }> {
  await ensureLoginLinkSchema();
  const existing = await loginLinkStatus(userId);
  if (!existing) return { error: "No sign-in link found for this user." };

  const updates: string[] = [];
  const params: unknown[] = [userId];

  if (typeof input.isActive === "boolean") {
    params.push(input.isActive);
    updates.push(`is_active = $${params.length}`);
  }

  if (typeof input.expiresInDays === "number" && input.expiresInDays > 0) {
    const newExpires = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    params.push(newExpires);
    updates.push(`expires_at = $${params.length}`);
  } else if (typeof input.expiresAt === "string" && !Number.isNaN(Date.parse(input.expiresAt))) {
    params.push(input.expiresAt);
    updates.push(`expires_at = $${params.length}`);
  }

  if (input.maxUses !== undefined) {
    const maxUses = typeof input.maxUses === "number" && input.maxUses > 0 ? input.maxUses : null;
    params.push(maxUses);
    updates.push(`max_uses = $${params.length}`);
  }

  if (input.resetUses) {
    updates.push(`use_count = 0`);
  }

  if (updates.length > 0) {
    await query(`update app.login_links set ${updates.join(", ")} where user_id = $1`, params);
  }

  const updatedStatus = await loginLinkStatus(userId);
  return { ok: true, status: updatedStatus! };
}

export async function revokeLoginLink(userId: string): Promise<void> {
  await query(`delete from app.login_links where user_id = $1`, [userId]);
}

export async function loginLinkStatus(userId: string): Promise<LoginLinkStatus | null> {
  await ensureLoginLinkSchema();
  const row = await queryOne<{
    created_at: string;
    expires_at: string;
    is_active?: boolean;
    max_uses?: number | null;
    use_count?: number;
    last_used_at?: string | null;
  }>(
    `select created_at, expires_at, is_active, max_uses, use_count, last_used_at from app.login_links where user_id = $1`,
    [userId],
  );
  if (!row) return null;

  const now = new Date().toISOString();
  const isActive = row.is_active !== false;
  const expired = row.expires_at <= now;
  const maxUses = row.max_uses != null ? Number(row.max_uses) : null;
  const useCount = Number(row.use_count || 0);
  const exhausted = maxUses !== null && useCount >= maxUses;

  let reason: "active" | "deactivated" | "expired" | "exhausted" = "active";
  if (!isActive) reason = "deactivated";
  else if (expired) reason = "expired";
  else if (exhausted) reason = "exhausted";

  const active = isActive && !expired && !exhausted;

  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive,
    maxUses,
    useCount,
    lastUsedAt: row.last_used_at || null,
    expired,
    exhausted,
    active,
    reason,
  };
}

export async function redeemLoginLink(token: string): Promise<SignInResult> {
  if (!token) return { error: "This sign-in link is not valid." };
  await ensureLoginLinkSchema();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const link = await queryOne<{
    user_id: string;
    expires_at: string;
    is_active?: boolean;
    max_uses?: number | null;
    use_count?: number;
  }>(
    `select user_id, expires_at, is_active, max_uses, use_count from app.login_links where token_hash = $1`,
    [tokenHash],
  );
  if (!link) return { error: "This sign-in link is not valid." };

  if (link.is_active === false) {
    return { error: "This sign-in link has been deactivated." };
  }

  if (link.expires_at <= new Date().toISOString()) {
    return { error: "This sign-in link has expired." };
  }

  const maxUses = link.max_uses != null ? Number(link.max_uses) : null;
  const currentUses = Number(link.use_count || 0);
  if (maxUses !== null && currentUses >= maxUses) {
    return { error: "This sign-in link has reached its maximum number of uses." };
  }

  const row = await accountBy(`u.id = $1`, link.user_id);
  if (!row) return { error: "This sign-in link is not valid." };
  const blocked = blockedReason(row);
  if (blocked) return { error: blocked };

  const now = new Date().toISOString();
  await query(
    `update app.login_links set use_count = use_count + 1, last_used_at = $1 where token_hash = $2`,
    [now, tokenHash],
  );

  return completeSignIn(row, "auth.link_sign_in");
}

export async function listOrgMembers(orgId: string) {
  return query<{ id: string; name: string; email: string; role: string }>(
    `select u.id, u.name, u.email, m.role
     from app.users u join app.memberships m on m.user_id = u.id
     where m.org_id = $1
     order by case m.role when 'owner' then 0 else 1 end, lower(u.name)`,
    [orgId],
  );
}

function parseTeamRole(role: string | undefined): TeamRole | "" {
  if (role === "owner" || role === "rep") return role;
  return "";
}

export async function listPendingInvites(orgId: string): Promise<TeamInvite[]> {
  const now = new Date().toISOString();
  await query(`update app.team_invites set status = 'expired' where org_id = $1 and status = 'pending' and expires_at <= $2`, [orgId, now]);
  const rows = await query<{ id: string; name: string; email: string; role: string; status: string; created_at: string; expires_at: string }>(
    `select id, name, email, role, status, created_at, expires_at from app.team_invites
     where org_id = $1 and status = 'pending' order by created_at desc`,
    [orgId],
  );
  return rows.map((row) => ({
    id: row.id, name: row.name, email: row.email, role: row.role, status: row.status,
    createdAt: row.created_at, expiresAt: row.expires_at,
  }));
}

async function sendTeamInviteEmail(input: { to: string; name: string; orgName: string; role: string; acceptUrl: string; inviterName: string }) {
  const roleLabel = input.role === "owner" ? "Owner" : "Rep";
  await sendMail({
    to: input.to,
    fromName: "Depoii",
    subject: `You're invited to ${input.orgName} on Depoii`,
    text: [
      `Hi ${input.name},`, "",
      `${input.inviterName} invited you to join ${input.orgName} on Depoii as ${roleLabel}.`, "",
      "Accept your invite:", input.acceptUrl, "",
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

  const existingUser = await queryOne<{ id: string }>(`select id from app.users where lower(email) = $1`, [email]);
  if (existingUser) {
    const member = await queryOne(`select role from app.memberships where org_id = $1 and user_id = $2`, [input.orgId, existingUser.id]);
    if (member) return { error: "That person is already on this team." };
    return { error: "A user with that email already exists." };
  }

  const pending = await queryOne(`select id from app.team_invites where org_id = $1 and lower(email) = $2 and status = 'pending'`, [input.orgId, email]);
  if (pending) return { error: "An invite is already pending for that email." };

  const id = randomBytes(8).toString("hex");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEAM_INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `insert into app.team_invites (id, org_id, email, name, role, token_hash, status, invited_by, created_at, expires_at)
     values ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)`,
    [id, input.orgId, email, name, role, tokenHash, input.invitedBy.id, now.toISOString(), expiresAt],
  );

  try {
    await sendTeamInviteEmail({
      to: email, name, orgName: input.orgName, role,
      acceptUrl: inviteAcceptUrl(input.origin, token),
      inviterName: input.invitedBy.name || input.invitedBy.email,
    });
  } catch (err) {
    console.error("[auth] team invite email failed", err);
    await query(`delete from app.team_invites where id = $1`, [id]);
    return { error: "Could not send the invite email. Try again shortly." };
  }

  await recordActivity({
    actorId: input.invitedBy.id, orgId: input.orgId, action: "invite.create",
    targetType: "invite", targetId: id, detail: { email, role, name },
  });

  return { invite: { id, name, email, role, status: "pending", createdAt: now.toISOString(), expiresAt } };
}

export async function resendTeamInvite(
  orgId: string,
  inviteId: string,
  actor: SessionUser,
  origin: string,
): Promise<{ ok: true } | { error: string }> {
  if (!smtpConfigured()) return { error: "Email invites are not configured." };
  const row = await queryOne<{ id: string; email: string; name: string; role: string; status: string; expires_at: string }>(
    `select id, email, name, role, status, expires_at from app.team_invites where id = $1 and org_id = $2`,
    [inviteId, orgId],
  );
  if (!row || row.status !== "pending") return { error: "That invite is not pending." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEAM_INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await query(`update app.team_invites set token_hash = $1, created_at = $2, expires_at = $3 where id = $4`, [tokenHash, now.toISOString(), expiresAt, inviteId]);

  try {
    await sendTeamInviteEmail({
      to: row.email, name: row.name, orgName: actor.orgName, role: row.role,
      acceptUrl: inviteAcceptUrl(origin, token),
      inviterName: actor.name || actor.email,
    });
  } catch (err) {
    console.error("[auth] team invite resend failed", err);
    return { error: "Could not resend the invite email. Try again shortly." };
  }

  await recordActivity({ actorId: actor.id, orgId, action: "invite.resend", targetType: "invite", targetId: inviteId, detail: { email: row.email } });
  return { ok: true };
}

export async function cancelTeamInvite(orgId: string, inviteId: string, actorId: string): Promise<{ ok: true } | { error: string }> {
  const row = await queryOne<{ id: string; email: string; status: string }>(`select id, email, status from app.team_invites where id = $1 and org_id = $2`, [inviteId, orgId]);
  if (!row || row.status !== "pending") return { error: "That invite is not pending." };
  await query(`update app.team_invites set status = 'cancelled' where id = $1`, [inviteId]);
  await recordActivity({ actorId, orgId, action: "invite.cancel", targetType: "invite", targetId: inviteId, detail: { email: row.email } });
  return { ok: true };
}

export async function acceptTeamInvite(token: string): Promise<SignInResult> {
  if (!token) return { error: "This invite is not valid." };
  await ensurePilotOrg();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await queryOne<{ id: string; org_id: string; email: string; name: string; role: string; status: string; expires_at: string }>(
    `select id, org_id, email, name, role, status, expires_at from app.team_invites where token_hash = $1`,
    [tokenHash],
  );
  if (!invite || invite.status !== "pending") return { error: "This invite is not valid." };
  if (invite.expires_at <= new Date().toISOString()) {
    await query(`update app.team_invites set status = 'expired' where id = $1`, [invite.id]);
    return { error: "This invite has expired." };
  }

  const role = parseTeamRole(invite.role) || "rep";
  const existing = await queryOne<{ id: string }>(`select id from app.users where lower(email) = $1`, [invite.email]);
  if (existing) return { error: "An account with this email already exists. Sign in instead." };

  const userId = await withClient(async (client) => {
    await client.query("begin");
    try {
      const newId = await createUser(invite.org_id, invite.email, randomBytes(24).toString("base64url"), invite.name, role);
      await client.query(`update app.team_invites set status = 'accepted' where id = $1`, [invite.id]);
      await client.query("commit");
      return newId;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
  const row = await accountBy(`u.id = $1`, userId);
  return completeSignIn(row as AccountRow, "auth.invite_accept");
}

export async function signUp(input: { name?: string; organization?: string; email?: string; password?: string; invite?: string }): Promise<SignInResult> {
  const invite = process.env.DEPOII_INVITE_CODE || "";
  if (!invite || input.invite !== invite) {
    return { error: "Signup is closed. Ask for a pilot invite." };
  }
  await ensurePilotOrg();
  const name = input.name?.trim() || "";
  const organization = input.organization?.trim() || "";
  const email = input.email?.trim().toLowerCase() || "";
  const password = input.password || "";
  if (!name) return { error: "Name is required." };
  if (!organization) return { error: "Organization name is required." };
  if (!email.includes("@")) return { error: "Email is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const taken = await queryOne(`select id from app.users where lower(email) = $1`, [email]);
  if (taken) return { error: "A user with that email already exists." };
  const orgId = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  const userId = await withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(`insert into app.orgs (id, name, disabled, created_at) values ($1,$2,0,$3)`, [orgId, organization, now]);
      const id = await createUser(orgId, email, password, name, "owner");
      await client.query("commit");
      return id;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  });
  const row = await accountBy(`u.id = $1`, userId);
  await rememberVisit(userId, true);
  const user = sessionFrom(row as AccountRow);
  await recordActivity({
    actorId: user.id, orgId: user.orgId, action: "auth.sign_up",
    targetType: "user", targetId: user.id, detail: { email: user.email, organization },
  });
  return { user };
}

export async function createUser(orgId: string, email: string, password: string, name: string, role: "owner" | "rep" = "rep"): Promise<string> {
  const id = randomBytes(8).toString("hex");
  const normalized = email.trim().toLowerCase();
  const taken = await queryOne(`select id from app.users where lower(email) = $1`, [normalized]);
  if (taken) {
    const error = new Error("A user with that email already exists.");
    (error as Error & { status: number }).status = 409;
    throw error;
  }
  const now = new Date().toISOString();
  await query(
    `insert into app.users (id, email, password_hash, name, platform_role, disabled, created_at, last_seen_at) values ($1,$2,$3,$4,'',0,$5,'')`,
    [id, normalized, hashPassword(password), name.trim() || normalized, now],
  );
  await query(`insert into app.memberships (org_id, user_id, role) values ($1,$2,$3)`, [orgId, id, role]);
  return id;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await query(`update app.users set password_hash = $1 where id = $2`, [hashPassword(password), userId]);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function sessionToken(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + WEEK * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || !token.includes(".")) return null;
  if (!pgConfigured()) return null;
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
  try {
    const row = await accountBy(`u.id = $1`, body.id);
    if (!row || blockedReason(row)) return null;
    const seen = row.last_seen_at ? Date.parse(row.last_seen_at) : 0;
    if (!seen || Date.now() - seen > 60_000) await rememberVisit(row.id, false);
    return sessionFrom(row);
  } catch (err) {
    console.warn("[auth] readSessionToken lookup failed:", (err as Error)?.message || err);
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const jar = await cookies();
  const user = await readSessionToken(jar.get(COOKIE)?.value);
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
