import { query } from "@/lib/pg";

export type ActivityEntry = {
  actorId?: string | null;
  orgId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
};

export async function recordActivity(entry: ActivityEntry): Promise<void> {
  await query(
    `insert into app.activity (at, actor_id, org_id, action, target_type, target_id, detail)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      new Date().toISOString(),
      entry.actorId ?? null,
      entry.orgId ?? null,
      entry.action,
      entry.targetType,
      entry.targetId,
      JSON.stringify(entry.detail ?? {}),
    ],
  );
}
