import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/site-config"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/tenant/", "/superadmin/", "/api/", "/home-2", "/compare/", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
