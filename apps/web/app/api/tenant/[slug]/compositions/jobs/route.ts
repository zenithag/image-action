import { NextResponse } from "next/server"

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

async function normalizeCompositionJobInputImages(input: CompositionJobInput): Promise<CompositionJobInput> {
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
  const jobs = await listCompositionJobs(slug)

  return NextResponse.json({
    jobs,
    stats: getCompositionJobStats(jobs),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await normalizeCompositionJobInputImages(await request.json() as CompositionJobInput)

  try {
    const tokenCheck = await canTenantCreateComposition(slug)

    if (!tokenCheck.allowed) {
      return NextResponse.json({
        error: "Este tenant ficou sem tokens para novas composições.",
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
