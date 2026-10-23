import { query, queryOne, withClient } from "@/lib/pg";
import { randomBytes } from "node:crypto";

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  category: "navigation" | "leads" | "management";
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Sidebar Navigation Permissions
  { id: "nav:overview", label: "Overview", description: "Access the overview metrics and quick launchpad", category: "navigation" },
  { id: "nav:pipeline", label: "Opportunity Pipeline", description: "View commercial roofing lead pipeline and building dossiers", category: "navigation" },
  { id: "nav:roof_aging", label: "Roof Aging Alarm", description: "Monitor 20+ year aging roofs approaching reroof windows", category: "navigation" },
  { id: "nav:map", label: "Hail Map", description: "View NWS severe hail events, swaths, and impacted ZIP codes", category: "navigation" },
  { id: "nav:territory", label: "Territory Explorer", description: "Explore territory zones, boundaries, and assigned reps", category: "navigation" },
  { id: "nav:claims", label: "My Claims", description: "Track active and expiring exclusive property territory locks", category: "navigation" },
  { id: "nav:permits", label: "Permit Explorer", description: "Access live and historical commercial reroof permit records", category: "navigation" },
  { id: "nav:buildings", label: "Building Explorer", description: "Search CAD commercial building inventory and footprint details", category: "navigation" },
  { id: "nav:contractors", label: "Contractors", description: "Inspect regional roofing contractors, certifications, and volume", category: "navigation" },
  { id: "nav:competitors", label: "Leaderboard", description: "Analyze competitor rankings, valuations, and market velocity", category: "navigation" },
  { id: "nav:outcomes", label: "Field Outcomes", description: "Review field moisture verification logs and closed contract outcomes", category: "navigation" },
  { id: "nav:team", label: "Team Directory", description: "View organization members and manage invites", category: "navigation" },
  { id: "nav:crm", label: "CRM", description: "Access integrated CRM pipelines and customer contact touchpoints", category: "navigation" },

  // Lead & Field Actions
  { id: "leads:claim", label: "Claim Leads", description: "Lock properties exclusively to the rep for 7 days", category: "leads" },
  { id: "leads:export", label: "Export Leads", description: "Download CSVs and export building dossier packets", category: "leads" },
  { id: "leads:assign", label: "Assign Leads", description: "Reassign pipeline leads to other team members", category: "leads" },
  { id: "outcomes:log", label: "Log Field Outcomes", description: "Submit moisture verification reports and contract values", category: "leads" },

  // Management & Administration
  { id: "team:invite", label: "Invite Members", description: "Send and cancel team invites for the organization", category: "management" },
  { id: "roles:manage", label: "Manage Roles & Permissions", description: "Create, edit, and assign custom organization roles", category: "management" },
  { id: "territory:manage", label: "Manage Territories", description: "Define territory boundaries, zip codes, and claim limits", category: "management" },
];

export interface OrgRole {
  id: string;
  orgId: string;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  permissions: string[];
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function ensureRolesSchema(): Promise<void> {
  await query(`
    create table if not exists app.org_roles (
      id text primary key,
      org_id text not null references app.orgs(id) on delete cascade,
      name text not null,
      description text not null default '',
      color text not null default '#38bdf8',
      is_system boolean not null default false,
      permissions jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint uq_org_roles_org_name unique (org_id, name)
    );
    create index if not exists idx_org_roles_org on app.org_roles (org_id);
    alter table app.memberships add column if not exists role_id text references app.org_roles(id) on delete set null;
  `).catch((err) => {
    console.error("[roles] Error ensuring schema:", err);
  });
}

const DEFAULT_SYSTEM_ROLES = [
  {
    name: "Owner",
    description: "Full administrative access to all features, settings, and team controls.",
    color: "#a855f7", // purple
    isSystem: true,
    permissions: ["*"],
  },
  {
    name: "Manager",
    description: "Team oversight, territory administration, pipeline review, and rep support.",
    color: "#3b82f6", // blue
    isSystem: true,
    permissions: [
      "nav:overview", "nav:pipeline", "nav:roof_aging", "nav:map", "nav:territory", "nav:claims",
      "nav:permits", "nav:buildings", "nav:contractors", "nav:competitors", "nav:outcomes", "nav:team", "nav:crm",
      "leads:claim", "leads:export", "leads:assign", "outcomes:log", "team:invite", "territory:manage",
    ],
  },
  {
    name: "Estimator",
    description: "Roof technical specifications, permit history analysis, and building valuation.",
    color: "#eab308", // amber
    isSystem: true,
    permissions: [
      "nav:overview", "nav:pipeline", "nav:roof_aging", "nav:map", "nav:permits", "nav:buildings",
      "nav:contractors", "nav:outcomes", "leads:export",
    ],
  },
  {
    name: "Rep",
    description: "Field prospecting, exclusive claims, hail map routing, and outcome logging.",
    color: "#10b981", // emerald
    isSystem: true,
    permissions: [
      "nav:overview", "nav:pipeline", "nav:roof_aging", "nav:map", "nav:claims", "nav:permits",
      "nav:buildings", "nav:outcomes", "leads:claim", "outcomes:log",
    ],
  },
];

export async function ensureOrgSystemRoles(orgId: string): Promise<void> {
  await ensureRolesSchema();
  for (const def of DEFAULT_SYSTEM_ROLES) {
    const roleId = `role_${orgId.slice(0, 8)}_${def.name.toLowerCase()}`;
    await query(
      `insert into app.org_roles (id, org_id, name, description, color, is_system, permissions)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       on conflict (org_id, name) do nothing`,
      [roleId, orgId, def.name, def.description, def.color, def.isSystem, JSON.stringify(def.permissions)],
    );
  }
}

export async function getOrgRoles(orgId: string): Promise<OrgRole[]> {
  await ensureOrgSystemRoles(orgId);
  const rows = await query<{
    id: string;
    org_id: string;
    name: string;
    description: string;
    color: string;
    is_system: boolean;
    permissions: unknown;
    member_count: string;
    created_at: string;
    updated_at: string;
  }>(
    `select r.*, count(m.user_id)::text as member_count
     from app.org_roles r
     left join app.memberships m on m.role_id = r.id or (m.role_id is null and lower(m.role) = lower(r.name) and m.org_id = r.org_id)
     where r.org_id = $1
     group by r.id
     order by r.is_system desc, r.name asc`,
    [orgId],
  );

  return rows.map((r) => {
    let perms: string[] = [];
    if (Array.isArray(r.permissions)) perms = r.permissions.map(String);
    else if (typeof r.permissions === "string") {
      try {
        perms = JSON.parse(r.permissions);
      } catch {
        perms = [];
      }
    }
    return {
      id: r.id,
      orgId: r.org_id,
      name: r.name,
      description: r.description || "",
      color: r.color || "#38bdf8",
      isSystem: Boolean(r.is_system),
      permissions: perms,
      memberCount: Number(r.member_count) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function createOrgRole(
  orgId: string,
  input: { name: string; description?: string; color?: string; permissions: string[] },
): Promise<{ role: OrgRole } | { error: string }> {
  await ensureRolesSchema();
  const name = input.name.trim();
  if (!name) return { error: "Role name is required." };
  if (name.length > 50) return { error: "Role name cannot exceed 50 characters." };

  const existing = await queryOne<{ id: string }>(
    `select id from app.org_roles where org_id = $1 and lower(name) = lower($2)`,
    [orgId, name],
  );
  if (existing) return { error: `A role named "${name}" already exists in this organization.` };

  const id = `role_${randomBytes(8).toString("hex")}`;
  const color = input.color?.trim() || "#38bdf8";
  const desc = input.description?.trim() || "";
  const perms = Array.from(new Set(input.permissions || []));

  await query(
    `insert into app.org_roles (id, org_id, name, description, color, is_system, permissions)
     values ($1, $2, $3, $4, $5, false, $6::jsonb)`,
    [id, orgId, name, desc, color, JSON.stringify(perms)],
  );

  return {
    role: {
      id,
      orgId,
      name,
      description: desc,
      color,
      isSystem: false,
      permissions: perms,
      memberCount: 0,
    },
  };
}

export async function updateOrgRole(
  orgId: string,
  roleId: string,
  input: { name?: string; description?: string; color?: string; permissions?: string[] },
): Promise<{ ok: true } | { error: string }> {
  await ensureRolesSchema();
  const role = await queryOne<{ id: string; is_system: boolean; name: string }>(
    `select id, is_system, name from app.org_roles where id = $1 and org_id = $2`,
    [roleId, orgId],
  );
  if (!role) return { error: "Role not found." };

  let nextName = role.name;
  if (input.name) {
    const trimmed = input.name.trim();
    if (!trimmed) return { error: "Role name cannot be empty." };
    if (trimmed !== role.name) {
      if (role.is_system) return { error: "System role names cannot be renamed." };
      const dup = await queryOne<{ id: string }>(
        `select id from app.org_roles where org_id = $1 and lower(name) = lower($2) and id != $3`,
        [orgId, trimmed, roleId],
      );
      if (dup) return { error: `A role named "${trimmed}" already exists.` };
      nextName = trimmed;
    }
  }

  const updates: string[] = ["updated_at = now()"];
  const params: unknown[] = [roleId, orgId];
  let pIdx = 3;

  if (input.name && !role.is_system) {
    updates.push(`name = $${pIdx++}`);
    params.push(nextName);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${pIdx++}`);
    params.push(input.description.trim());
  }
  if (input.color) {
    updates.push(`color = $${pIdx++}`);
    params.push(input.color.trim());
  }
  if (input.permissions) {
    // If owner role, always keep wildcard
    const perms = role.name.toLowerCase() === "owner" ? ["*"] : Array.from(new Set(input.permissions));
    updates.push(`permissions = $${pIdx++}::jsonb`);
    params.push(JSON.stringify(perms));
  }

  await query(`update app.org_roles set ${updates.join(", ")} where id = $1 and org_id = $2`, params);
  return { ok: true };
}

export async function deleteOrgRole(orgId: string, roleId: string): Promise<{ ok: true } | { error: string }> {
  await ensureRolesSchema();
  const role = await queryOne<{ id: string; is_system: boolean; name: string }>(
    `select id, is_system, name from app.org_roles where id = $1 and org_id = $2`,
    [roleId, orgId],
  );
  if (!role) return { error: "Role not found." };
  if (role.is_system) return { error: "System default roles cannot be deleted." };

  // Fallback existing members to Rep role
  const defaultRep = await queryOne<{ id: string }>(
    `select id from app.org_roles where org_id = $1 and lower(name) = 'rep'`,
    [orgId],
  );

  await withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(
        `update app.memberships set role_id = $1, role = 'rep' where org_id = $2 and role_id = $3`,
        [defaultRep?.id || null, orgId, roleId],
      );
      await client.query(`delete from app.org_roles where id = $1 and org_id = $2`, [roleId, orgId]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  });

  return { ok: true };
}

export async function getUserEffectivePermissions(userId: string, orgId: string): Promise<string[]> {
  await ensureRolesSchema();
  // Check if superadmin
  const user = await queryOne<{ platform_role: string }>(`select platform_role from app.users where id = $1`, [userId]);
  if (user?.platform_role === "superadmin") return ["*"];

  const member = await queryOne<{ role: string; role_id: string | null }>(
    `select role, role_id from app.memberships where user_id = $1 and org_id = $2`,
    [userId, orgId],
  );
  if (!member) return [];

  if (member.role === "owner") return ["*"];

  let roleRow: { permissions: unknown } | undefined;
  if (member.role_id) {
    roleRow = await queryOne<{ permissions: unknown }>(
      `select permissions from app.org_roles where id = $1 and org_id = $2`,
      [member.role_id, orgId],
    );
  } else {
    roleRow = await queryOne<{ permissions: unknown }>(
      `select permissions from app.org_roles where org_id = $1 and lower(name) = lower($2)`,
      [orgId, member.role],
    );
  }

  if (!roleRow?.permissions) {
    // Default fallback to rep permissions
    return DEFAULT_SYSTEM_ROLES.find((r) => r.name === "Rep")?.permissions || [];
  }

  if (Array.isArray(roleRow.permissions)) return roleRow.permissions.map(String);
  if (typeof roleRow.permissions === "string") {
    try {
      return JSON.parse(roleRow.permissions);
    } catch {
      return [];
    }
  }
  return [];
}

export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}
