import type { MetadataRoute } from "next";

const siteUrl = "https://hoopcheck.online";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/teams`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/leagues`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/coaches`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/search`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/membership`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/community-guidelines`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];
}
