import { NextResponse } from "next/server"
import { z } from "zod"

import type { CompositionJobInput } from "@/lib/composition-types"
import { enqueueProcessCompositionQueue, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { ensureCompositionBaseSnapshot } from "@/lib/server/composition-base-snapshots"
import { createCompositionJob, getCompositionJobStats, listCompositionJobs } from "@/lib/server/composition-jobs-store"
import { normalizeDataImageUrlForUpload } from "@/lib/server/image-normalization"
import { canTenantCreateComposition } from "@/lib/server/token-ledger-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

const CompositionJobInputSchema = z.object({
  studioVersion: z.literal("v1").optional(),
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
  })).optional(),
  changeStrength: z.number().min(0).max(100).optional(),
  prompt: z.string().max(5000).optional(),
}).superRefine((input, context) => {
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
  const jobs = await listCompositionJobs(slug)

  return NextResponse.json({
    jobs,
    stats: getCompositionJobStats(jobs),
  })
}

export async function POST(request: Request, context: RouteContext) {
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

  try {
    const payload = await normalizeCompositionJobInputImages(parsed.data)
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
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o job de composicao.",
    }, { status: 400 })
  }
}
