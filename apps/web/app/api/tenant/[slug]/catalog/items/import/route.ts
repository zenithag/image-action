import { NextResponse } from "next/server"

import { previewCatalogImport } from "@/lib/catalog-csv"
import { importCatalogItems, listCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type ImportPayload = {
  csvText?: unknown
  mode?: unknown
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null) as ImportPayload | null
  const csvText = typeof payload?.csvText === "string" ? payload.csvText : ""
  const mode = payload?.mode === "import" ? "import" : "preview"

  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV invalido." }, { status: 400 })
  }

  try {
    const existingItems = await listCatalogItems(slug)
    const preview = previewCatalogImport(csvText, existingItems)

    if (mode === "preview") {
      return NextResponse.json(preview)
    }

    const invalidRows = preview.rows.filter((row) => row.errors.length > 0)

    if (invalidRows.length > 0) {
      return NextResponse.json({
        error: "O CSV possui erros e nao pode ser importado.",
        preview,
      }, { status: 400 })
    }

    const importedItems = await importCatalogItems(
      slug,
      preview.rows.flatMap((row) => row.normalized ? [row.normalized] : []),
    )

    return NextResponse.json({
      preview,
      importedItems,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel importar o catalogo.",
    }, { status: 400 })
  }
}
