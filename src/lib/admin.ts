import { randomBytes } from "node:crypto";
import { recordActivity } from "@/lib/activity";
import { createUser, loginLinkStatus, setUserPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function adminResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : "Request failed.";
  if (status === 403) return Response.json({ error: "Super admin access required." }, { status: 403 });
  if (status === 401) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (status && status >= 400 && status < 500) return Response.json({ error: message }, { status });
  return Response.json({ error: "Request failed." }, { status: 500 });
}

type ActivityQuery = { orgId?: string; userId?: string; subjectId?: string; action?: string; limit?: number };

export type ActivityItem = {
  id: number;
  at: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string;
  orgId: string | null;
  orgName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
};

type ActivitySqlRow = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  org_id: string | null;
  org_name: string | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: string;
};

function mapActivity(row: ActivitySqlRow): ActivityItem {
  let detail: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.detail) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) detail = parsed as Record<string, unknown>;
  } catch {
    detail = {};
  }
  return {
    id: row.id,
    at: row.at,
    actorId: row.actor_id,
    actorName: row.actor_name || "",
    actorEmail: row.actor_email || "",
    orgId: row.org_id,
    orgName: row.org_name || "",
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail,
  };
}

export function listActivity(query: ActivityQuery = {}): ActivityItem[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.orgId) {
    where.push("a.org_id = ?");
    params.push(query.orgId);
  }
  if (query.subjectId) {
    where.push("(a.actor_id = ? OR (a.target_type = 'user' AND a.target_id = ?))");
    params.push(query.subjectId, query.subjectId);
  } else if (query.userId) {
    where.push("a.actor_id = ?");
    params.push(query.userId);
  }
  if (query.action) {
    where.push("a.action = ?");
    params.push(query.action);
  }
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  params.push(limit);
  const sql = `
    SELECT a.id, a.at, a.actor_id, u.name AS actor_name, u.email AS actor_email,
      a.org_id, o.name AS org_name, a.action, a.target_type, a.target_id, a.detail
    FROM activity a
    LEFT JOIN users u ON u.id = a.actor_id
    LEFT JOIN orgs o ON o.id = a.org_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY a.id DESC
    LIMIT ?
  `;
  return (getDb().prepare(sql).all(...params) as ActivitySqlRow[]).map(mapActivity);
}

export function overview() {
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    orgs: count(`SELECT COUNT(*) AS n FROM orgs`),
    users: count(`SELECT COUNT(*) AS n FROM users`),
    leads: count(`SELECT COUNT(*) AS n FROM leads`),
    outcomes: count(`SELECT COUNT(*) AS n FROM field_outcomes`),
    activity: listActivity({ limit: 12 }),
  };
}

type OrgSql = {
  id: string;
  name: string;
  disabled: number;
  created_at: string;
  members: number;
  leads: number;
  outcomes: number;
};

function mapOrg(row: OrgSql) {
  return {
    id: row.id,
    name: row.name,
    disabled: Boolean(row.disabled),
    createdAt: row.created_at,
    members: row.members,
    leads: row.leads,
    outcomes: row.outcomes,
  };
}

const ORG_LIST_SQL = `
  SELECT o.id, o.name, o.disabled, o.created_at,
    (SELECT COUNT(*) FROM memberships m WHERE m.org_id = o.id) AS members,
    (SELECT COUNT(*) FROM leads l WHERE l.org_id = o.id) AS leads,
    (SELECT COUNT(*) FROM field_outcomes f WHERE f.org_id = o.id) AS outcomes
  FROM orgs o
`;

export function listOrgs() {
  return (getDb().prepare(`${ORG_LIST_SQL} ORDER BY o.name COLLATE NOCASE`).all() as OrgSql[]).map(mapOrg);
}

type UserSql = {
  id: string;
  email: string;
  name: string;
  disabled: number;
  platform_role: string;
  last_seen_at: string;
  last_login_at: string;
  created_at: string;
  role: string;
  org_id: string;
  org_name: string;
  org_disabled: number;
};

function mapUser(row: UserSql) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    orgId: row.org_id,
    orgName: row.org_name,
    orgDisabled: Boolean(row.org_disabled),
    disabled: Boolean(row.disabled),
    platformRole: row.platform_role || "",
    lastSeenAt: row.last_seen_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

const USER_SQL = `
  SELECT u.id, u.email, u.name, u.disabled, u.platform_role, u.last_seen_at, u.last_login_at, u.created_at,
    m.role, m.org_id, o.name AS org_name, o.disabled AS org_disabled
  FROM users u
  JOIN memberships m ON m.user_id = u.id
  JOIN orgs o ON o.id = m.org_id
`;

export function listUsers() {
  return (getDb().prepare(`${USER_SQL} ORDER BY u.email COLLATE NOCASE`).all() as UserSql[]).map(mapUser);
}

export function userDetail(id: string) {
  const user = mapUser(requireAccount(id));
  return {
    user,
    link: loginLinkStatus(id),
    activity: listActivity({ subjectId: id, limit: 100 }),
  };
}

function requireOrg(id: string) {
  const row = getDb().prepare(`${ORG_LIST_SQL} WHERE o.id = ?`).get(id) as OrgSql | undefined;
  if (!row) throw new HttpError(404, "Organization not found.");
  return row;
}

function requireAccount(id: string) {
  const row = getDb().prepare(`${USER_SQL} WHERE u.id = ?`).get(id) as UserSql | undefined;
  if (!row) throw new HttpError(404, "User not found.");
  return row;
}

function superAdminCount() {
  return (getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE platform_role = 'superadmin'`).get() as { n: number }).n;
}

function assertNotLastSuperAdmin(userId: string, message: string) {
  const row = getDb().prepare(`SELECT platform_role FROM users WHERE id = ?`).get(userId) as { platform_role: string } | undefined;
  if (row?.platform_role === "superadmin" && superAdminCount() <= 1) throw new HttpError(400, message);
}

export function createOrganization(actorId: string, input: { name?: string; ownerName?: string; ownerEmail?: string; ownerPassword?: string }) {
  const name = input.name?.trim() || "";
  const email = input.ownerEmail?.trim().toLowerCase() || "";
  const ownerName = input.ownerName?.trim() || email;
  const password = input.ownerPassword || "";
  if (!name) throw new HttpError(400, "Organization name is required.");
  if (!email.includes("@")) throw new HttpError(400, "Owner email is required.");
  if (password.length < 8) throw new HttpError(400, "Owner password must be at least 8 characters.");
  const db = getDb();
  const taken = db.prepare(`SELECT id FROM users WHERE lower(email) = ?`).get(email);
  if (taken) throw new HttpError(409, "A user with that email already exists.");
  const orgId = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  let ownerId = "";
  const write = db.transaction(() => {
    db.prepare(`INSERT INTO orgs (id, name, disabled, created_at) VALUES (?, ?, 0, ?)`).run(orgId, name, now);
    ownerId = createUser(orgId, email, password, ownerName, "owner");
    recordActivity({ actorId, orgId, action: "org.create", targetType: "org", targetId: orgId, detail: { name } });
    recordActivity({ actorId, orgId, action: "user.create", targetType: "user", targetId: ownerId, detail: { email, role: "owner" } });
  });
  write();
  return mapOrg(requireOrg(orgId));
}

export function updateOrganization(actorId: string, id: string, input: { name?: string; disabled?: boolean }) {
  const current = requireOrg(id);
  const db = getDb();
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, "Organization name is required.");
    if (name !== current.name) {
      db.prepare(`UPDATE orgs SET name = ? WHERE id = ?`).run(name, id);
      recordActivity({ actorId, orgId: id, action: "org.rename", targetType: "org", targetId: id, detail: { from: current.name, to: name } });
    }
  }
  if (typeof input.disabled === "boolean" && input.disabled !== Boolean(current.disabled)) {
    db.prepare(`UPDATE orgs SET disabled = ? WHERE id = ?`).run(input.disabled ? 1 : 0, id);
    recordActivity({
      actorId,
      orgId: id,
      action: input.disabled ? "org.suspend" : "org.reactivate",
      targetType: "org",
      targetId: id,
      detail: { name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : current.name },
    });
  }
  return mapOrg(requireOrg(id));
}

type LeadSql = {
  id: string;
  parcel_id: string;
  storm_id: string;
  address: string;
  city: string;
  stage: string;
  assignee: string;
  score: number;
  price: number;
  updated_at: string;
};

type OutcomeSql = {
  id: string;
  parcel_id: string;
  storm_id: string;
  logged_at: string;
  predicted_score: number;
  scope: string;
  contract_value: number;
};

export function organizationDetail(id: string) {
  const org = mapOrg(requireOrg(id));
  const db = getDb();
  const members = (db.prepare(`${USER_SQL} WHERE m.org_id = ? ORDER BY u.email COLLATE NOCASE`).all(id) as UserSql[]).map(mapUser);
  const leads = (db.prepare(`
    SELECT id, parcel_id, storm_id, address, city, stage, assignee, score, price, updated_at
    FROM leads WHERE org_id = ? ORDER BY updated_at DESC LIMIT 25
  `).all(id) as LeadSql[]).map((row) => ({
    id: row.id,
    parcelId: row.parcel_id,
    stormId: row.storm_id,
    address: row.address,
    city: row.city,
    stage: row.stage,
    assignee: row.assignee,
    score: row.score,
    price: row.price,
    updatedAt: row.updated_at,
  }));
  const outcomes = (db.prepare(`
    SELECT id, parcel_id, storm_id, logged_at, predicted_score, scope, contract_value
    FROM field_outcomes WHERE org_id = ? ORDER BY logged_at DESC LIMIT 25
  `).all(id) as OutcomeSql[]).map((row) => ({
    id: row.id,
    parcelId: row.parcel_id,
    stormId: row.storm_id,
    loggedAt: row.logged_at,
    predictedScore: row.predicted_score,
    scope: row.scope,
    contractValue: row.contract_value,
  }));
  return { org, members, leads, outcomes, activity: listActivity({ orgId: id, limit: 50 }) };
}

export function createMember(actorId: string, input: { email?: string; password?: string; name?: string; orgId?: string; role?: string }) {
  const email = input.email?.trim().toLowerCase() || "";
  const password = input.password || "";
  const orgId = input.orgId || "";
  const role = input.role === "owner" ? "owner" : input.role === "rep" ? "rep" : "";
  if (!email.includes("@")) throw new HttpError(400, "Email is required.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (!role) throw new HttpError(400, "Role must be owner or rep.");
  requireOrg(orgId);
  const id = createUser(orgId, email, password, input.name?.trim() || email, role);
  recordActivity({ actorId, orgId, action: "user.create", targetType: "user", targetId: id, detail: { email, role } });
  return mapUser(requireAccount(id));
}

export function updateMember(actorId: string, id: string, input: { role?: string; orgId?: string; password?: string; disabled?: boolean; platformRole?: string }) {
  const current = requireAccount(id);
  if (typeof input.role === "string" && input.role !== "owner" && input.role !== "rep") throw new HttpError(400, "Role must be owner or rep.");
  if (typeof input.orgId === "string" && input.orgId !== current.org_id) requireOrg(input.orgId);
  if (typeof input.password === "string" && input.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (input.disabled === true && !current.disabled) assertNotLastSuperAdmin(id, "The last super admin cannot be disabled.");
  if (typeof input.platformRole === "string" && input.platformRole !== "superadmin" && current.platform_role === "superadmin") {
    assertNotLastSuperAdmin(id, "The last super admin cannot be demoted.");
  }
  const db = getDb();
  const orgForLog = typeof input.orgId === "string" && input.orgId !== current.org_id ? input.orgId : current.org_id;
  const write = db.transaction(() => {
    if (typeof input.role === "string" && input.role !== current.role) {
      db.prepare(`UPDATE memberships SET role = ? WHERE user_id = ? AND org_id = ?`).run(input.role, id, current.org_id);
      recordActivity({
        actorId,
        orgId: current.org_id,
        action: "user.role",
        targetType: "user",
        targetId: id,
        detail: { email: current.email, from: current.role, to: input.role },
      });
    }
    if (typeof input.orgId === "string" && input.orgId !== current.org_id) {
      db.prepare(`UPDATE memberships SET org_id = ? WHERE user_id = ? AND org_id = ?`).run(input.orgId, id, current.org_id);
      recordActivity({
        actorId,
        orgId: input.orgId,
        action: "user.move",
        targetType: "user",
        targetId: id,
        detail: { email: current.email, from: current.org_id, to: input.orgId },
      });
    }
    if (typeof input.password === "string") {
      setUserPassword(id, input.password);
      recordActivity({
        actorId,
        orgId: orgForLog,
        action: "user.password_reset",
        targetType: "user",
        targetId: id,
        detail: { email: current.email },
      });
    }
    if (typeof input.disabled === "boolean" && input.disabled !== Boolean(current.disabled)) {
      db.prepare(`UPDATE users SET disabled = ? WHERE id = ?`).run(input.disabled ? 1 : 0, id);
      recordActivity({
        actorId,
        orgId: orgForLog,
        action: input.disabled ? "user.disable" : "user.enable",
        targetType: "user",
        targetId: id,
        detail: { email: current.email },
      });
    }
    if (typeof input.platformRole === "string") {
      const next = input.platformRole === "superadmin" ? "superadmin" : "";
      if (next !== (current.platform_role || "")) {
        db.prepare(`UPDATE users SET platform_role = ? WHERE id = ?`).run(next, id);
        recordActivity({
          actorId,
          orgId: orgForLog,
          action: next ? "user.superadmin_grant" : "user.superadmin_revoke",
          targetType: "user",
          targetId: id,
          detail: { email: current.email },
        });
      }
    }
  });
  write();
  return mapUser(requireAccount(id));
}
