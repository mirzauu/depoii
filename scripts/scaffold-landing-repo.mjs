import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "..");
const dest = path.resolve(srcRoot, "..", "depoii-landing");

function copyFile(fromRel, toRel = fromRel) {
  const from = path.join(srcRoot, fromRel);
  const to = path.join(dest, toRel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function write(rel, content) {
  const to = path.join(dest, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, content);
}

function copyDir(fromRel, toRel = fromRel) {
  const from = path.join(srcRoot, fromRel);
  const to = path.join(dest, toRel);
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, entry.name);
    const t = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(path.join(fromRel, entry.name), path.join(toRel, entry.name));
    } else {
      fs.copyFileSync(f, t);
    }
  }
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.mkdirSync(dest, { recursive: true });

const files = [
  "src/components/landing-page.tsx",
  "src/components/landing-hero.tsx",
  "src/components/landing-tour.tsx",
  "src/components/landing-mock.tsx",
  "src/components/landing-mock-data.ts",
  "src/components/landing-engine.tsx",
  "src/components/depoii-logo.tsx",
  "src/components/depoii-map.tsx",
  "src/components/badges.tsx",
  "src/components/sidebar.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/lib/format.ts",
  "src/lib/types.ts",
  "src/lib/us-areas.ts",
  "src/lib/us-counties.json",
  "src/app/globals.css",
  "src/app/vendor/maplibre/[file]/route.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
  "eslint.config.mjs",
];

for (const f of files) copyFile(f);

// public landing assets only
copyDir("public/landing", "public/landing");
if (fs.existsSync(path.join(srcRoot, "public/icon.svg"))) {
  copyFile("public/icon.svg");
}

// Patch landing-mock to use slim page-header
{
  const p = path.join(dest, "src/components/landing-mock.tsx");
  let text = fs.readFileSync(p, "utf8");
  text = text.replace(
    'import { PageHeader } from "@/components/app-shell";',
    'import { PageHeader } from "@/components/page-header";',
  );
  text = text.replace(
    'import { RiskBadge } from "@/components/engine-layout";',
    'import { RiskBadge } from "@/components/risk-badge";',
  );
  fs.writeFileSync(p, text);
}

// Patch depoii-map SwathFeature import
{
  const p = path.join(dest, "src/components/depoii-map.tsx");
  let text = fs.readFileSync(p, "utf8");
  text = text.replace(
    'import type { SwathFeature } from "@/lib/engine-api";',
    'import type { SwathFeature } from "@/lib/swath";',
  );
  fs.writeFileSync(p, text);
}

// Slim helpers
write(
  "src/components/page-header.tsx",
  `export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between lg:px-8">
      <div className="space-y-1">
        {eyebrow && <p className="text-xs font-medium tracking-widest text-red-400 uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
`,
);

write(
  "src/components/risk-badge.tsx",
  `import { cn } from "cn";

export function RiskBadge({ value }: { value: string }) {
  const tone =
    value === "critical"
      ? "bg-red-500/15 text-red-700 dark:text-red-300"
      : value === "high"
        ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
        : value === "moderate"
          ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase", tone)}>
      {value}
    </span>
  );
}
`,
);

write(
  "src/lib/swath.ts",
  `export interface SwathFeature {
  type: "Feature";
  properties: { fill: string; stroke: string; [key: string]: unknown };
  geometry: GeoJSON.Geometry;
}
`,
);

write(
  "src/components/use-me.ts",
  `"use client";

export type Me = {
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  role: string;
  platformRole: string;
};

/** Landing mock only — no auth. */
export function useMe(): Me | null {
  return null;
}
`,
);

write(
  "src/app/layout.tsx",
  `import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Depoii · Commercial Roofing Opportunity Engine",
  description:
    "Hail reports, county appraisal records, and city permit searches for DFW commercial roofers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={\`\${geistSans.variable} \${geistMono.variable} h-full antialiased\`} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-foreground" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
`,
);

write(
  "src/app/page.tsx",
  `"use client";

import { LandingPage } from "@/components/landing-page";

export default function Page() {
  return <LandingPage formMode="api" />;
}
`,
);

write(
  "src/app/api/pilot/route.ts",
  `import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const name = (body.name || "").trim();
  const company = (body.company || "").trim();
  const email = (body.email || "").trim();
  const territory = (body.territory || "").trim();
  const sizeRange = (body.sizeRange || "").trim();
  if (!name || !company || !email.includes("@") || !territory || !sizeRange) {
    return Response.json(
      { error: "Name, company, email, territory, and size range are required." },
      { status: 400 },
    );
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const notifyTo = process.env.PILOT_NOTIFY_EMAIL || smtpUser;

  if (!smtpUser || !smtpPass || !notifyTo) {
    console.error("[pilot] SMTP not configured");
    return Response.json({ error: "Email is not configured." }, { status: 503 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: \`"Depoii Pilot" <\${smtpUser}>\`,
      to: notifyTo,
      replyTo: email,
      subject: \`Pilot request: \${name} (\${company})\`,
      text: [
        "New Depoii pilot request",
        "",
        \`Name: \${name}\`,
        \`Company: \${company}\`,
        \`Email: \${email}\`,
        \`Territory: \${territory}\`,
        \`Roof sizes: \${sizeRange}\`,
      ].join("\\n"),
    });
  } catch (err) {
    console.error("[pilot] email send failed", err);
    return Response.json({ error: "Could not send email. Try again." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
`,
);

write(
  "next.config.ts",
  `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
`,
);

write(
  "netlify.toml",
  `[build]
  command = "npm run build"
  publish = "."

[build.environment]
  NODE_VERSION = "22"

[[plugins]]
  package = "@netlify/plugin-nextjs"
`,
);

write(
  ".env.example",
  `SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=hello@alimirsa.com
SMTP_PASS=
PILOT_NOTIFY_EMAIL=hello@alimirsa.com
`,
);

write(
  ".gitignore",
  `node_modules
.next
out
.env
.env*.local
*.db
.DS_Store
`,
);

write(
  "README.md",
  `# Depoii Landing

Public marketing site for Depoii (landing + pilot form). No product dashboard.

## Local

\`\`\`bash
npm install
cp .env.example .env   # add SMTP_PASS
npm run dev
\`\`\`

Open http://localhost:3000

## Netlify

1. Connect this GitHub repo in Netlify
2. Build command: \`npm run build\` (from netlify.toml)
3. Add env vars from \`.env.example\` (especially \`SMTP_PASS\`)
4. Deploy — site root is the landing page; pilot form emails via Hostinger SMTP
`,
);

write(
  "package.json",
  `{
  "name": "depoii-landing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint"
  },
  "dependencies": {
    "@base-ui/react": "^1.8.0",
    "@turf/turf": "^7.4.0",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.4.0",
    "lucide-react": "^1.52.0",
    "maplibre-gl": "^6.12.0",
    "next": "16.3.8",
    "nodemailer": "^10.1.2",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^22",
    "@types/nodemailer": "^8.0.2",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.8",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
`,
);

// Fix landing-page: only api mode needed but keep netlify mode optional
console.log("Scaffolded", dest);
