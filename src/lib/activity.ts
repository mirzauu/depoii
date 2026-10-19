import { getDb } from "@/lib/db";

export type ActivityEntry = {
  actorId?: string | null;
  orgId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
};

export function recordActivity(entry: ActivityEntry) {
  getDb().prepare(`
    INSERT INTO activity (at, actor_id, org_id, action, target_type, target_id, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    new Date().toISOString(),
    entry.actorId ?? null,
    entry.orgId ?? null,
    entry.action,
    entry.targetType,
    entry.targetId,
    JSON.stringify(entry.detail ?? {}),
  );
}
