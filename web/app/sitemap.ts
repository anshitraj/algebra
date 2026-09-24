import type { MetadataRoute } from "next";

const SITE = process.env.PUBLIC_WEB_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/pricing", "/signup", "/login", "/terms", "/privacy", "/refunds", "/contact"];
  return pages.map((p) => ({ url: `${SITE}${p}`, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : 0.5 }));
}
