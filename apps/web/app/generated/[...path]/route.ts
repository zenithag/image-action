import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

import { getRuntimeGeneratedDir } from "@/lib/server/runtime-paths"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ path?: string[] }>
}

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

function getContentType(filePath: string) {
  return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

export async function GET(_request: Request, context: RouteContext) {
  const { path: requestedPath = [] } = await context.params
  const generatedRoot = getRuntimeGeneratedDir()
  const filePath = path.resolve(generatedRoot, ...requestedPath)
  const rootPath = path.resolve(generatedRoot)

  if (!filePath.startsWith(`${rootPath}${path.sep}`)) {
    return NextResponse.json({ error: "Arquivo invalido." }, { status: 400 })
  }

  try {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 })
    }

    const bytes = await readFile(filePath)

    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": getContentType(filePath),
      },
    })
  } catch {
    return NextResponse.json({ error: "Arquivo nao encontrado." }, { status: 404 })
  }
}
