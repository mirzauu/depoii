import type { NextConfig } from "next";

// Netlify's Next runtime is incompatible with `output: "standalone"`.
// Keep standalone for local/zip Node deploys only.
const nextConfig: NextConfig = {
  ...(process.env.NETLIFY ? {} : { output: "standalone" as const }),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["nodemailer"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
