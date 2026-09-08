import type { MetadataRoute } from "next"

import { LIVE_ROUTES, SITE_URL } from "@/lib/site-config"

export default function sitemap(): MetadataRoute.Sitemap {
  return LIVE_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
