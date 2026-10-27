import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site-url";

const siteUrl = SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/dashboard", "/dashboard/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
