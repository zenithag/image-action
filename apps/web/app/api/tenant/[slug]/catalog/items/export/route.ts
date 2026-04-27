import { NextResponse } from "next/server"

import { exportCatalogItemsToCsv } from "@/lib/catalog-csv"
import { listCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
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
