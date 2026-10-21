const nodemailer = require('nodemailer');
const path = require('path');

async function main() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'hello@alimirsa.com',
      pass: process.env.SMTP_PASS || ''
    }
  });

  const imagePath = path.join(__dirname, 'depoii_hero_exact.png');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Depoii — Know which commercial roofs are worth the drive</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">

  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0b0f19; padding: 32px 12px 48px 12px;">
    <tr>
      <td align="center">

        <!-- Outer Card Container -->
        <table width="740" border="0" cellpadding="0" cellspacing="0" style="width: 740px; max-width: 740px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);">

          <!-- EXACT LIVE CAPTURE HERO SECTION WITH DASHBOARD UI -->
          <tr>
            <td style="padding: 0; line-height: 0; background-color: #000000;">
              <a href="https://depoii.com/#pilot" target="_blank" style="display: block; text-decoration: none;">
                <img src="cid:depoii_hero_render" alt="Depoii Landing Page Hero Section & Dashboard" style="width: 100%; height: auto; display: block; border-bottom: 1px solid #1e293b;" />
              </a>
            </td>
          </tr>

          <!-- ACTION BAR & TRUST FOOTER -->
          <tr>
            <td style="padding: 32px 28px; text-align: center; background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);">
              <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                Know which commercial roofs are <span style="color: #c8f000;">worth the drive</span>
              </h2>
              <p style="margin: 0 auto 24px auto; max-width: 520px; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Hail reports, county appraisal records, and city permit searches for DFW — each fact with its source — so your crew checks the short list before you roll a truck.
              </p>

              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
                <tr>
                  <td align="center" style="border-radius: 9999px; background-color: #c8f000;">
                    <a href="https://depoii.com/#pilot" target="_blank" style="display: inline-block; padding: 13px 30px; font-size: 14px; font-weight: 700; color: #0f172a; text-decoration: none; border-radius: 9999px;">
                      Join the free pilot &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="padding-top: 20px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
                <strong>Depoii</strong> &bull; Dallas–Fort Worth Commercial Roofing Intelligence &bull; <a href="mailto:hello@depoii.com" style="color: #38bdf8; text-decoration: none;">hello@depoii.com</a>
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: '"Depoii" <hello@alimirsa.com>',
    to: 'mirzamailbox0@gmail.com',
    subject: 'Depoii — Know which commercial roofs are worth the drive',
    text: 'Know which commercial roofs are worth the drive. Hail reports, county appraisal records, and city permit searches for DFW. Join the free pilot at https://depoii.com/#pilot',
    html: html,
    attachments: [
      {
        filename: 'depoii-hero.png',
        path: imagePath,
        cid: 'depoii_hero_render'
      }
    ]
  });

  console.log('Message sent successfully! MessageId:', info.messageId);
}

main().catch(err => {
  console.error('Failed to send:', err);
  process.exit(1);
});
