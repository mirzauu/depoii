import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/welcome", "/login", "/icon.svg", "/landing/*"],
        disallow: [
          "/admin",
          "/admin/*",
          "/api/*",
          "/claims",
          "/pipeline",
          "/settings",
          "/parcels",
          "/permits",
          "/property",
        ],
      },
    ],
    sitemap: "https://depoii.com/sitemap.xml",
  };
}
