import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://depoii.com";
  const now = new Date();

  return [
    {
      url: `${baseUrl}/welcome`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
