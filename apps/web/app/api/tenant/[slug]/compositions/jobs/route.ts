import { getTenantCatalogAccess } from "@/lib/server/tenant-catalog-access"
import { listCatalogItems } from "@/lib/server/catalog-store"
import { matchesStudioMaterial } from "@/lib/studio-v1"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { NextRequest, NextResponse } from "next/server"
import { getCurrentTenantToken as getToken } from "@/lib/server/current-tenant-token"
import { findTenant } from "@/lib/server/tenants-store"
import { checkStudioSurfaceAccess, checkStudioRequestOrigin } from "@/lib/server/studio-surface-access"
import { z } from "zod"

import type { CompositionJobInput } from "@/lib/composition-types"
import { enqueueProcessCompositionQueue, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { ensureCompositionBaseSnapshot } from "@/lib/server/composition-base-snapshots"
import { createCompositionJob, OperatorQuotaExceededError, getCompositionJobStats, listCompositionJobs } from "@/lib/server/composition-jobs-store"
import { normalizeDataImageUrlForUpload } from "@/lib/server/image-normalization"
import { canTenantCreateComposition } from "@/lib/server/token-ledger-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

const CompositionJobInputSchema = z.object({
  presetIds: z.array(z.enum(["remove-furniture", "renovate", "fresh-paint", "wall-covering", "flooring", "ceiling", "furnish"])).min(1).max(7).refine(ids => new Set(ids).size === ids.length, "Presets repetidos.").optional(),
  studioVersion: z.literal("v1").optional(),
  purpose: z.enum(["composition", "studio-preset"]).optional(),
  conversationId: z.string().min(1).max(255),
  channelInstanceId: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  contactPhone: z.string().max(50).optional(),
  mode: z.enum(["interior", "product", "print", "fashion"]).optional(),
  source: z.enum(["ai", "operator"]).optional(),
  sourceMessageId: z.string().optional(),
  baseMessageId: z.string().optional(),
  baseImageUrl: z.string().min(1).optional(),
  referenceMessageId: z.string().optional(),
  referenceImageUrl: z.string().min(1).optional(),
  catalogItemId: z.string().optional(),
  catalogItemName: z.string().optional(),
  catalogColorReference: z.string().optional(),
  references: z.array(z.object({
    source: z.enum(["inbox", "catalog", "url"]),
    messageId: z.string().optional(),
    imageUrl: z.string().min(1).optional(),
    catalogItemId: z.string().optional(),
    catalogItemName: z.string().optional(),
    catalogSku: z.string().optional(),
    catalogCategory: z.string().optional(),
    catalogDescription: z.string().optional(),
    materialPreset: z.enum(["fresh-paint", "wall-covering", "flooring", "ceiling"]).optional(),
    materialSurface: z.enum(["floor", "walls", "both"]).optional(),
  })).optional(),
  changeStrength: z.number().min(0).max(100).optional(),
  prompt: z.string().max(5000).optional(),
}).superRefine((input, context) => {
  if (input.prompt?.includes("PLANOS_ALVO_ESTUDIO:")) context.addIssue({ code: z.ZodIssueCode.custom, path: ["prompt"], message: "A seleção automática de superfícies foi desativada. Atualize o Estúdio e indique o local em texto." })
  if (input.purpose === "studio-preset" && input.studioVersion !== "v1") context.addIssue({ code: z.ZodIssueCode.custom, path: ["studioVersion"], message: "Preset requer o fluxo do Estúdio." })
  if (input.studioVersion !== "v1") return
  if (!input.baseImageUrl?.trim() && !input.baseMessageId?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["baseImageUrl"], message: "Adicione uma foto do ambiente." })
  }
  if (!input.prompt?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["prompt"], message: "Descreva a transformação." })
  }
  if ((input.references?.length ?? 0) > 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["references"], message: "Use no máximo 5 referências." })
  }
})

const MAX_BODY_SIZE = 10_000_000

async function normalizeCompositionJobInputImages(input: z.infer<typeof CompositionJobInputSchema>): Promise<CompositionJobInput> {
  const references = input.references
    ? await Promise.all(input.references.map(async (reference) => ({
      ...reference,
      imageUrl: reference.imageUrl ? await normalizeDataImageUrlForUpload(reference.imageUrl) : reference.imageUrl,
    })))
    : input.references

  return {
    ...input,
    baseImageUrl: input.baseImageUrl ? await normalizeDataImageUrlForUpload(input.baseImageUrl) : input.baseImageUrl,
    referenceImageUrl: input.referenceImageUrl ? await normalizeDataImageUrlForUpload(input.referenceImageUrl) : input.referenceImageUrl,
    references,
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  if (!slug || typeof slug !== "string" || slug.length > 100) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
  }
  const jobs = (await listCompositionJobs(slug)).filter(job => job.purpose !== "studio-preset")

  return NextResponse.json({
    jobs,
    stats: getCompositionJobStats(jobs),
  })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  if (!slug || typeof slug !== "string" || slug.length > 100) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
  }

  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  let rawPayload: unknown
  try {
    rawPayload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const parsed = CompositionJobInputSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return NextResponse.json({
      error: parsed.error.issues.map((issue) => issue.message).join(" "),
      details: parsed.error.flatten().fieldErrors,
    }, { status: 400 })
  }

  const secureCookie = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" || process.env.NEXTAUTH_URL?.startsWith("https://") === true
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, secureCookie })
  const access = checkStudioSurfaceAccess(token, slug, token ? await findTenant(slug) : null)
  if (access) return NextResponse.json({ error: access === 401 ? "Entre novamente para gerar a composição." : "Você não tem acesso a este tenant." }, { status: access })
  if (!checkStudioRequestOrigin(request.headers.get("origin"), request.headers.get("host"), request.url)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 })


  try {
    const catalogRefs = parsed.data.references?.filter(ref => ref.source === "catalog" || ref.catalogItemId) || []
    if (parsed.data.catalogItemId || catalogRefs.length) {
      if (!(await getTenantCatalogAccess(slug)).enabled) return NextResponse.json({ error: "O catálogo está desativado ou não está incluído no plano." }, { status: 403 })
      if (parsed.data.purpose === "studio-preset" && parsed.data.catalogItemId && !catalogRefs.some(ref => ref.catalogItemId === parsed.data.catalogItemId && ref.materialPreset)) return NextResponse.json({ error: "Associe o material ao preset e à superfície." }, { status: 400 })
      const items = await listCatalogItems(slug)
      for (const ref of [...catalogRefs, ...(parsed.data.catalogItemId ? [{ catalogItemId: parsed.data.catalogItemId }] : [])]) {
        const item = items.find(item => item.id === ref.catalogItemId && item.tenantSlug === slug && item.status === "active")
        if (!item) return NextResponse.json({ error: "Produto indisponível neste catálogo." }, { status: 400 })
        if (parsed.data.purpose === "studio-preset" && catalogRefs.includes(ref as typeof catalogRefs[number]) && (["tinta", "revestimento"].includes(item.tags.product_type || "") || (parsed.data.presetIds?.includes("ceiling") && item.tags.product_type === "outro")) && (!("materialPreset" in ref) || !ref.materialPreset)) return NextResponse.json({ error: "Informe o preset e o alvo do material selecionado." }, { status: 400 })
        if ("materialPreset" in ref && ref.materialPreset && (!parsed.data.presetIds?.includes(ref.materialPreset) || (ref.materialPreset === "flooring" && !ref.materialSurface))) return NextResponse.json({ error: "Informe o preset e a superfície de aplicação." }, { status: 400 })
        if ("materialPreset" in ref && ref.materialPreset && !matchesStudioMaterial(ref.materialPreset, item.tags.product_type || "", item.category, ref.materialSurface)) return NextResponse.json({ error: "Material incompatível com a superfície escolhida." }, { status: 400 })
      }
      for (const ref of catalogRefs) {
        const item = items.find(item => item.id === ref.catalogItemId)!
        ref.source = "catalog"
        ref.imageUrl = undefined
        ref.messageId = undefined
        ref.catalogItemName = item.name
        ref.catalogSku = item.sku
        ref.catalogCategory = item.category
        ref.catalogDescription = item.description
      }
      if (parsed.data.catalogItemId) {
        const item = items.find(item => item.id === parsed.data.catalogItemId)!
        parsed.data.catalogItemName = item.name
        parsed.data.catalogColorReference = undefined
      }
    }
    const payload = await normalizeCompositionJobInputImages(parsed.data)
    payload.source = "operator"
    payload.operator = { id: token!.sub!, name: (typeof token!.name === "string" && token!.name.trim() ? token!.name : typeof token!.email === "string" ? token!.email : "Operador").trim().slice(0, 255) }
    const tokenCheck = await canTenantCreateComposition(slug)

    if (!tokenCheck.allowed) {
      return NextResponse.json({
        error: "Este tenant ficou sem tokens para novas composicoes.",
        code: "TOKEN_BALANCE_EXHAUSTED",
        tokenSnapshot: tokenCheck.snapshot,
      }, { status: 402 })
    }

    const result = await createCompositionJob(slug, payload)
    const job = result.created
      ? await ensureCompositionBaseSnapshot(result.job).catch(() => result.job)
      : result.job

    if (job.status === "queued") {
      await enqueueProcessCompositionQueue(slug)
      scheduleAppJobProcessing()
    }

    return NextResponse.json({ ...result, job }, { status: result.created ? 201 : 200 })
  } catch (error) {
    if (error instanceof OperatorQuotaExceededError) return NextResponse.json({ error: error.message, code: "OPERATOR_QUOTA_EXHAUSTED", limit: error.limit, used: error.used }, { status: 429 })
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o job de composicao.",
    }, { status: 400 })
  }
}
