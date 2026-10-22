import { expireStaleClaims, getClaimsNearingDeadline } from "@/lib/claims";
import { sendClaimDeadlineWarningMail } from "@/lib/mail";
import { query } from "@/lib/pg";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/expire-claims — sweeps and releases claims exceeding 7-day inactivity or 21-day TTL,
 * and sends 48h reminder notices to contractors.
 */
async function handleExpire(req: Request) {
  // Check authorization header if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 1. Expire stale claims
    const expiredResults = await expireStaleClaims();

    // 2. Find claims nearing their 7-day activity deadline within 48h
    const urgentClaims = await getClaimsNearingDeadline(48);
    let warningsSent = 0;

    for (const claim of urgentClaims) {
      try {
        // Find parcel address and org member emails
        const [parcelRow] = await query<{ address: string }>(
          `SELECT address FROM warehouse.scored_parcel_leads WHERE parcel_id = $1 LIMIT 1`,
          [claim.parcel_id]
        );
        const members = await query<{ email: string }>(
          `SELECT u.email FROM app.users u
           JOIN app.memberships m ON m.user_id = u.id
           WHERE m.org_id = $1 AND u.email IS NOT NULL`,
          [claim.claimed_by_org_id]
        );

        const hoursLeft = Math.max(
          1,
          Math.round((new Date(claim.activity_deadline).getTime() - Date.now()) / (60 * 60 * 1000))
        );

        for (const member of members) {
          await sendClaimDeadlineWarningMail({
            to: member.email,
            propertyAddress: parcelRow?.address || "Commercial Parcel " + claim.parcel_id,
            hoursRemaining: hoursLeft,
          }).catch(() => {});
          warningsSent++;
        }
      } catch {
        // Non-blocking for notification delivery
      }
    }

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      expired: expiredResults,
      warningsSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sweep failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleExpire(req);
}

export async function POST(req: Request) {
  return handleExpire(req);
}
