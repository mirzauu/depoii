import { randomBytes } from "node:crypto";
import { recordActivity } from "@/lib/activity";
import { createUser, loginLinkStatus, setUserPassword } from "@/lib/auth";
import { query, queryOne } from "@/lib/pg";

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
    const parsed = typeof row.detail === "string" ? JSON.parse(row.detail) : row.detail;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) detail = parsed as Record<string, unknown>;
  } catch {
    detail = {};
  }
  return {
    id: Number(row.id),
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

export async function listActivity(q: ActivityQuery = {}): Promise<ActivityItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.orgId) { params.push(q.orgId); where.push(`a.org_id = $${params.length}`); }
  if (q.subjectId) {
    params.push(q.subjectId, q.subjectId);
    where.push(`(a.actor_id = $${params.length - 1} or (a.target_type = 'user' and a.target_id = $${params.length}))`);
  } else if (q.userId) {
    params.push(q.userId);
    where.push(`a.actor_id = $${params.length}`);
  }
  if (q.action) { params.push(q.action); where.push(`a.action = $${params.length}`); }
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
  params.push(limit);
  const rows = await query<ActivitySqlRow>(
    `select a.id, a.at, a.actor_id, u.name as actor_name, u.email as actor_email,
       a.org_id, o.name as org_name, a.action, a.target_type, a.target_id, a.detail
     from app.activity a
     left join app.users u on u.id = a.actor_id
     left join app.orgs o on o.id = a.org_id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by a.id desc limit $${params.length}`,
    params,
  );
  return rows.map(mapActivity);
}

export async function overview() {
  const count = async (table: string) => Number((await queryOne<{ n: string }>(`select count(*)::text as n from ${table}`))?.n || 0);
  return {
    orgs: await count("app.orgs"),
    users: await count("app.users"),
    leads: await count("app.leads"),
    outcomes: await count("app.field_outcomes"),
    activity: await listActivity({ limit: 12 }),
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
    members: Number(row.members),
    leads: Number(row.leads),
    outcomes: Number(row.outcomes),
  };
}

const ORG_LIST_SQL = `
  SELECT o.id, o.name, o.disabled, o.created_at,
    (SELECT COUNT(*) FROM app.memberships m WHERE m.org_id = o.id) AS members,
    (SELECT COUNT(*) FROM app.leads l WHERE l.org_id = o.id) AS leads,
    (SELECT COUNT(*) FROM app.field_outcomes f WHERE f.org_id = o.id) AS outcomes
  FROM app.orgs o
`;

export async function listOrgs() {
  const rows = await query<OrgSql>(`${ORG_LIST_SQL} ORDER BY lower(o.name)`);
  return rows.map(mapOrg);
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
  FROM app.users u
  JOIN app.memberships m ON m.user_id = u.id
  JOIN app.orgs o ON o.id = m.org_id
`;

export async function listUsers() {
  const rows = await query<UserSql>(`${USER_SQL} ORDER BY lower(u.email)`);
  return rows.map(mapUser);
}

export async function userDetail(id: string) {
  const user = mapUser(await requireAccount(id));
  return {
    user,
    link: await loginLinkStatus(id),
    activity: await listActivity({ subjectId: id, limit: 100 }),
  };
}

async function requireOrg(id: string): Promise<OrgSql> {
  const row = await queryOne<OrgSql>(`${ORG_LIST_SQL} WHERE o.id = $1`, [id]);
  if (!row) throw new HttpError(404, "Organization not found.");
  return row;
}

async function requireAccount(id: string): Promise<UserSql> {
  const row = await queryOne<UserSql>(`${USER_SQL} WHERE u.id = $1`, [id]);
  if (!row) throw new HttpError(404, "User not found.");
  return row;
}

async function superAdminCount(): Promise<number> {
  const row = await queryOne<{ n: string }>(`select count(*)::text as n from app.users where platform_role = 'superadmin'`);
  return Number(row?.n || 0);
}

async function assertNotLastSuperAdmin(userId: string, message: string): Promise<void> {
  const row = await queryOne<{ platform_role: string }>(`select platform_role from app.users where id = $1`, [userId]);
  if (row?.platform_role === "superadmin" && (await superAdminCount()) <= 1) throw new HttpError(400, message);
}

export async function createOrganization(actorId: string, input: { name?: string; ownerName?: string; ownerEmail?: string; ownerPassword?: string }) {
  const name = input.name?.trim() || "";
  const email = input.ownerEmail?.trim().toLowerCase() || "";
  const ownerName = input.ownerName?.trim() || email;
  const password = input.ownerPassword || "";
  if (!name) throw new HttpError(400, "Organization name is required.");
  if (!email.includes("@")) throw new HttpError(400, "Owner email is required.");
  if (password.length < 8) throw new HttpError(400, "Owner password must be at least 8 characters.");
  const taken = await queryOne(`select id from app.users where lower(email) = $1`, [email]);
  if (taken) throw new HttpError(409, "A user with that email already exists.");
  const orgId = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  await query(`insert into app.orgs (id, name, disabled, created_at) values ($1,$2,0,$3)`, [orgId, name, now]);
  const ownerId = await createUser(orgId, email, password, ownerName, "owner");
  await recordActivity({ actorId, orgId, action: "org.create", targetType: "org", targetId: orgId, detail: { name } });
  await recordActivity({ actorId, orgId, action: "user.create", targetType: "user", targetId: ownerId, detail: { email, role: "owner" } });
  return mapOrg(await requireOrg(orgId));
}

export async function updateOrganization(actorId: string, id: string, input: { name?: string; disabled?: boolean }) {
  const current = await requireOrg(id);
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, "Organization name is required.");
    if (name !== current.name) {
      await query(`update app.orgs set name = $1 where id = $2`, [name, id]);
      await recordActivity({ actorId, orgId: id, action: "org.rename", targetType: "org", targetId: id, detail: { from: current.name, to: name } });
    }
  }
  if (typeof input.disabled === "boolean" && input.disabled !== Boolean(current.disabled)) {
    await query(`update app.orgs set disabled = $1 where id = $2`, [input.disabled ? 1 : 0, id]);
    await recordActivity({
      actorId, orgId: id,
      action: input.disabled ? "org.suspend" : "org.reactivate",
      targetType: "org", targetId: id,
      detail: { name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : current.name },
    });
  }
  return mapOrg(await requireOrg(id));
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

export async function organizationDetail(id: string) {
  const org = mapOrg(await requireOrg(id));
  const members = (await query<UserSql>(`${USER_SQL} WHERE m.org_id = $1 ORDER BY lower(u.email)`, [id])).map(mapUser);
  const leads = (await query<LeadSql>(
    `select id, parcel_id, storm_id, address, city, stage, assignee, score, price, updated_at
     from app.leads where org_id = $1 order by updated_at desc limit 25`, [id],
  )).map((row) => ({
    id: row.id, parcelId: row.parcel_id, stormId: row.storm_id, address: row.address, city: row.city,
    stage: row.stage, assignee: row.assignee, score: Number(row.score), price: Number(row.price), updatedAt: row.updated_at,
  }));
  const outcomes = (await query<OutcomeSql>(
    `select id, parcel_id, storm_id, logged_at, predicted_score, scope, contract_value
     from app.field_outcomes where org_id = $1 order by logged_at desc limit 25`, [id],
  )).map((row) => ({
    id: row.id, parcelId: row.parcel_id, stormId: row.storm_id, loggedAt: row.logged_at,
    predictedScore: Number(row.predicted_score), scope: row.scope, contractValue: Number(row.contract_value),
  }));
  return { org, members, leads, outcomes, activity: await listActivity({ orgId: id, limit: 50 }) };
}

export async function createMember(actorId: string, input: { email?: string; password?: string; name?: string; orgId?: string; role?: string }) {
  const email = input.email?.trim().toLowerCase() || "";
  const password = input.password || "";
  const orgId = input.orgId || "";
  const role = input.role === "owner" ? "owner" : input.role === "rep" ? "rep" : "";
  if (!email.includes("@")) throw new HttpError(400, "Email is required.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (!role) throw new HttpError(400, "Role must be owner or rep.");
  await requireOrg(orgId);
  const id = await createUser(orgId, email, password, input.name?.trim() || email, role);
  await recordActivity({ actorId, orgId, action: "user.create", targetType: "user", targetId: id, detail: { email, role } });
  return mapUser(await requireAccount(id));
}

export async function updateMember(actorId: string, id: string, input: { role?: string; orgId?: string; password?: string; disabled?: boolean; platformRole?: string }) {
  const current = await requireAccount(id);
  if (typeof input.role === "string" && input.role !== "owner" && input.role !== "rep") throw new HttpError(400, "Role must be owner or rep.");
  if (typeof input.orgId === "string" && input.orgId !== current.org_id) await requireOrg(input.orgId);
  if (typeof input.password === "string" && input.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
  if (input.disabled === true && !current.disabled) await assertNotLastSuperAdmin(id, "The last super admin cannot be disabled.");
  if (typeof input.platformRole === "string" && input.platformRole !== "superadmin" && current.platform_role === "superadmin") {
    await assertNotLastSuperAdmin(id, "The last super admin cannot be demoted.");
  }
  const orgForLog = typeof input.orgId === "string" && input.orgId !== current.org_id ? input.orgId : current.org_id;
  if (typeof input.role === "string" && input.role !== current.role) {
    await query(`update app.memberships set role = $1 where user_id = $2 and org_id = $3`, [input.role, id, current.org_id]);
    await recordActivity({ actorId, orgId: current.org_id, action: "user.role", targetType: "user", targetId: id, detail: { email: current.email, from: current.role, to: input.role } });
  }
  if (typeof input.orgId === "string" && input.orgId !== current.org_id) {
    await query(`update app.memberships set org_id = $1 where user_id = $2 and org_id = $3`, [input.orgId, id, current.org_id]);
    await recordActivity({ actorId, orgId: input.orgId, action: "user.move", targetType: "user", targetId: id, detail: { email: current.email, from: current.org_id, to: input.orgId } });
  }
  if (typeof input.password === "string") {
    await setUserPassword(id, input.password);
    await recordActivity({ actorId, orgId: orgForLog, action: "user.password_reset", targetType: "user", targetId: id, detail: { email: current.email } });
  }
  if (typeof input.disabled === "boolean" && input.disabled !== Boolean(current.disabled)) {
    await query(`update app.users set disabled = $1 where id = $2`, [input.disabled ? 1 : 0, id]);
    await recordActivity({ actorId, orgId: orgForLog, action: input.disabled ? "user.disable" : "user.enable", targetType: "user", targetId: id, detail: { email: current.email } });
  }
  if (typeof input.platformRole === "string") {
    const next = input.platformRole === "superadmin" ? "superadmin" : "";
    if (next !== (current.platform_role || "")) {
      await query(`update app.users set platform_role = $1 where id = $2`, [next, id]);
      await recordActivity({ actorId, orgId: orgForLog, action: next ? "user.superadmin_grant" : "user.superadmin_revoke", targetType: "user", targetId: id, detail: { email: current.email } });
    }
  }
  return mapUser(await requireAccount(id));
}
