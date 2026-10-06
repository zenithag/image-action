import { requireTenantCatalogAccess } from "@/lib/server/tenant-catalog-access"
import { NextResponse, type NextRequest } from "next/server"

import { exportCatalogItemsToCsv } from "@/lib/catalog-csv"
import { listCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const denied = await requireTenantCatalogAccess(request, slug, false)
  if (denied) return denied
  const items = await listCatalogItems(slug)
  const csv = exportCatalogItemsToCsv(items)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-catalogo.csv"`,
    },
  })
}
