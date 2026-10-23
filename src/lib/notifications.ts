import { query, queryOne } from "@/lib/pg";
import { sendMail, smtpConfigured } from "@/lib/mail";

export interface UserNotificationSettings {
  userId: string;
  orgId: string;
  emailEnabled: boolean;
  frequency: "instant" | "hourly_digest" | "daily_digest" | "weekly_summary";
  alertHailReports: boolean;
  minHailSize: number;
  alertNewLeads: boolean;
  minLeadScore: number;
  alertRoofAging: boolean;
  alertClaimDeadlines: boolean;
  alertContractorActivity: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt?: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: Omit<UserNotificationSettings, "userId" | "orgId"> = {
  emailEnabled: true,
  frequency: "daily_digest",
  alertHailReports: true,
  minHailSize: 1.5,
  alertNewLeads: true,
  minLeadScore: 80,
  alertRoofAging: true,
  alertClaimDeadlines: true,
  alertContractorActivity: false,
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "07:00",
};

export async function ensureNotificationSchema(): Promise<void> {
  await query(`
    create table if not exists app.user_notification_settings (
      user_id text primary key references app.users(id) on delete cascade,
      org_id text not null references app.orgs(id) on delete cascade,
      email_enabled boolean not null default true,
      frequency text not null default 'daily_digest',
      alert_hail_reports boolean not null default true,
      min_hail_size numeric(4,2) not null default 1.50,
      alert_new_leads boolean not null default true,
      min_lead_score integer not null default 80,
      alert_roof_aging boolean not null default true,
      alert_claim_deadlines boolean not null default true,
      alert_contractor_activity boolean not null default false,
      quiet_hours_enabled boolean not null default false,
      quiet_hours_start text not null default '21:00',
      quiet_hours_end text not null default '07:00',
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_user_notif_org on app.user_notification_settings (org_id);
  `).catch((err) => {
    console.error("[notifications] Error ensuring schema:", err);
  });
}

export async function getUserNotificationSettings(userId: string, orgId: string): Promise<UserNotificationSettings> {
  await ensureNotificationSchema();
  const row = await queryOne<{
    user_id: string;
    org_id: string;
    email_enabled: boolean;
    frequency: string;
    alert_hail_reports: boolean;
    min_hail_size: number | string;
    alert_new_leads: boolean;
    min_lead_score: number;
    alert_roof_aging: boolean;
    alert_claim_deadlines: boolean;
    alert_contractor_activity: boolean;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    updated_at: string;
  }>(
    `select * from app.user_notification_settings where user_id = $1 and org_id = $2`,
    [userId, orgId],
  );

  if (!row) {
    // Return defaults
    return {
      userId,
      orgId,
      ...DEFAULT_NOTIFICATION_SETTINGS,
    };
  }

  return {
    userId: row.user_id,
    orgId: row.org_id,
    emailEnabled: Boolean(row.email_enabled),
    frequency: (row.frequency as UserNotificationSettings["frequency"]) || "daily_digest",
    alertHailReports: Boolean(row.alert_hail_reports),
    minHailSize: Number(row.min_hail_size) || 1.5,
    alertNewLeads: Boolean(row.alert_new_leads),
    minLeadScore: Number(row.min_lead_score) || 80,
    alertRoofAging: Boolean(row.alert_roof_aging),
    alertClaimDeadlines: Boolean(row.alert_claim_deadlines),
    alertContractorActivity: Boolean(row.alert_contractor_activity),
    quietHoursEnabled: Boolean(row.quiet_hours_enabled),
    quietHoursStart: row.quiet_hours_start || "21:00",
    quietHoursEnd: row.quiet_hours_end || "07:00",
    updatedAt: row.updated_at,
  };
}

export async function updateUserNotificationSettings(
  userId: string,
  orgId: string,
  patch: Partial<UserNotificationSettings>,
): Promise<UserNotificationSettings> {
  await ensureNotificationSchema();
  const current = await getUserNotificationSettings(userId, orgId);
  const next: UserNotificationSettings = {
    ...current,
    ...patch,
    userId,
    orgId,
  };

  await query(
    `insert into app.user_notification_settings (
      user_id, org_id, email_enabled, frequency, alert_hail_reports, min_hail_size,
      alert_new_leads, min_lead_score, alert_roof_aging, alert_claim_deadlines,
      alert_contractor_activity, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, updated_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
    on conflict (user_id) do update set
      email_enabled = excluded.email_enabled,
      frequency = excluded.frequency,
      alert_hail_reports = excluded.alert_hail_reports,
      min_hail_size = excluded.min_hail_size,
      alert_new_leads = excluded.alert_new_leads,
      min_lead_score = excluded.min_lead_score,
      alert_roof_aging = excluded.alert_roof_aging,
      alert_claim_deadlines = excluded.alert_claim_deadlines,
      alert_contractor_activity = excluded.alert_contractor_activity,
      quiet_hours_enabled = excluded.quiet_hours_enabled,
      quiet_hours_start = excluded.quiet_hours_start,
      quiet_hours_end = excluded.quiet_hours_end,
      updated_at = now()`,
    [
      next.userId,
      next.orgId,
      next.emailEnabled,
      next.frequency,
      next.alertHailReports,
      next.minHailSize,
      next.alertNewLeads,
      next.minLeadScore,
      next.alertRoofAging,
      next.alertClaimDeadlines,
      next.alertContractorActivity,
      next.quietHoursEnabled,
      next.quietHoursStart,
      next.quietHoursEnd,
    ],
  );

  return next;
}

export async function sendTestNotificationEmail(user: { email: string; name: string }): Promise<{ ok: true } | { error: string }> {
  if (!smtpConfigured()) {
    return { error: "SMTP is not configured on this server. Check SMTP_USER and SMTP_PASS." };
  }

  try {
    await sendMail({
      to: user.email,
      fromName: "Depoii Alerts",
      subject: "⚡ Depoii Notification Test: Alert delivery configured",
      text: `Hi ${user.name},\n\nThis is a test notification confirming your email alert settings in Depoii are working properly.\n\nYou will receive timely updates according to your configured cadence and filters (hail reports, high-scoring commercial leads, and claim deadlines).\n\nBest,\nThe Depoii Intelligence Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #0f172a; color: #f8fafc;">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <div style="background: linear-gradient(135deg, #0284c7, #38bdf8); width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; margin-right: 12px; font-size: 18px; line-height: 36px; text-align: center;">D</div>
            <h2 style="margin: 0; color: #f8fafc; font-size: 18px;">Depoii Alert Delivery Test</h2>
          </div>
          <p style="font-size: 15px; color: #94a3b8; line-height: 1.6;">
            Hi <strong style="color: #f1f5f9;">${user.name}</strong>,
          </p>
          <p style="font-size: 15px; color: #94a3b8; line-height: 1.6;">
            This test email confirms your Depoii notification preferences are successfully connected and verified.
          </p>
          <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">Status: Active</p>
            <p style="margin: 0; font-size: 14px; color: #cbd5e1;">Target: <strong>${user.email}</strong></p>
          </div>
          <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; pt: 16px;">
            You can modify your frequency, hail diameter triggers, or quiet hours anytime in Settings → Notifications.
          </p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to deliver test email." };
  }
}
