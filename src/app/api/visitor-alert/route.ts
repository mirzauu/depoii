import { NextRequest, NextResponse } from "next/server";
import { sendMail, smtpConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

const TARGET_EMAIL = "mirzamailbox0@gmail.com";
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown per visitor/IP

// In-memory cache to prevent duplicate emails from rapid refreshes or multiple page visits
const recentAlerts = new Map<string, number>();

function isBot(userAgent: string): boolean {
  if (!userAgent) return false;
  const botRegex =
    /bot|crawler|spider|googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|curl|wget|python|headless|lighthouse|uptime|pingdom|facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|discordbot/i;
  return botRegex.test(userAgent);
}

function parseDevice(userAgent: string): string {
  if (!userAgent) return "Unknown Device";
  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);

  let os = "Unknown OS";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/linux/i.test(userAgent)) os = "Linux";

  let browser = "Browser";
  if (/edg\//i.test(userAgent)) browser = "Edge";
  else if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = "Safari";

  const formFactor = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";
  return `${formFactor} (${os} · ${browser})`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      path?: string;
      referrer?: string;
      screen?: string;
      visitorId?: string;
    };

    const userAgent = req.headers.get("user-agent") || "";

    // Ignore automated bots, spiders, and crawlers
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true, ignored: "bot" });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "Unknown IP";

    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-country") ||
      "";
    const region =
      req.headers.get("x-vercel-ip-country-region") ||
      req.headers.get("x-region") ||
      "";
    const city =
      req.headers.get("x-vercel-ip-city") ||
      req.headers.get("x-city") ||
      "";

    // Rate-limiting deduplication: check IP or visitorId
    const key = body.visitorId ? `${body.visitorId}_${ip}` : ip;
    const now = Date.now();
    const lastAlert = recentAlerts.get(key);

    if (lastAlert && now - lastAlert < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, ignored: "cooldown" });
    }

    // Save timestamp and prune old entries
    recentAlerts.set(key, now);
    if (recentAlerts.size > 2000) {
      for (const [k, timestamp] of recentAlerts.entries()) {
        if (now - timestamp > COOLDOWN_MS) recentAlerts.delete(k);
      }
    }

    if (!smtpConfigured()) {
      return NextResponse.json({ ok: true, warn: "smtp_not_configured" });
    }

    const device = parseDevice(userAgent);
    const locationParts = [city, region, country].filter(Boolean);
    const locationStr = locationParts.length > 0 ? locationParts.join(", ") : "Unknown Location";
    const pageVisited = body.path || "/";
    const referrer = body.referrer && body.referrer !== "" ? body.referrer : "Direct / None";
    const screenRes = body.screen || "Unknown";
    const visitDate = new Date();
    const formattedDate = visitDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "full",
      timeStyle: "medium",
    });

    const subject = `🔔 New Visitor on Depoii (${locationStr !== "Unknown Location" ? locationStr : device})`;

    const text = `
New visitor landed on Depoii!

• Page: ${pageVisited}
• Location: ${locationStr} (IP: ${ip})
• Device: ${device}
• Referrer: ${referrer}
• Screen: ${screenRes}
• Time (Central): ${formattedDate}
• User-Agent: ${userAgent}
    `.trim();

    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; color: #1e293b;">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          🔔 New Visitor on Depoii
        </h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
          A new user has just opened your website.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 6px; font-weight: 600; color: #475569; width: 130px;">Page Visited</td>
            <td style="padding: 10px 6px; color: #0f172a; font-weight: 600;">
              <code style="background-color: #f1f5f9; padding: 3px 7px; border-radius: 4px; font-size: 13px; color: #dc2626;">${pageVisited}</code>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 6px; font-weight: 600; color: #475569;">Location</td>
            <td style="padding: 10px 6px; color: #0f172a;">
              <strong>${locationStr}</strong> <span style="font-size: 12px; color: #94a3b8;">(${ip})</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 6px; font-weight: 600; color: #475569;">Device & Browser</td>
            <td style="padding: 10px 6px; color: #0f172a;">${device}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 6px; font-weight: 600; color: #475569;">Traffic Source</td>
            <td style="padding: 10px 6px; color: #0f172a;">${referrer}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 6px; font-weight: 600; color: #475569;">Screen Resolution</td>
            <td style="padding: 10px 6px; color: #0f172a;">${screenRes}</td>
          </tr>
          <tr>
            <td style="padding: 10px 6px; font-weight: 600; color: #475569;">Time</td>
            <td style="padding: 10px 6px; color: #0f172a;">${formattedDate}</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 16px;">
        <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.4;">
          <strong>User-Agent:</strong> ${userAgent}
        </p>
      </div>

      <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center;">
        <a href="https://depoii.com" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 6px;">
          Open Depoii
        </a>
      </div>
    </div>
    `.trim();

    await sendMail({
      to: TARGET_EMAIL,
      subject,
      text,
      html,
      fromName: "Depoii Visitor Alert",
    });

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error("Failed to send visitor alert email:", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

