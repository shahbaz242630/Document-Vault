import type { MetadataRoute } from "next";

import { publicRoutes, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route === "/" ? "" : route}`,
    lastModified: "2026-07-19",
    changeFrequency: route === "/" ? "monthly" : "yearly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
