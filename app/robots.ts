import type { MetadataRoute } from "next";

const siteUrl = "https://hoopcheck.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/account", "/privacy-center", "/api/", "/onboarding", "/notifications", "/fan-live"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
