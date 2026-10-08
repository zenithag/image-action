import { summarizeCompositionRequest } from "@/lib/generation-costs"
import { findCompositionJob, listCompositionJobs, updateCompositionGenerationUsage } from "@/lib/server/composition-jobs-store"
import { readAiProviders } from "@/lib/server/ai-providers-store"
import { getOpenRouterGeneration } from "@/lib/server/openrouter-client"
import { listTenants } from "@/lib/server/tenants-store"

export async function listCompositionLogs() {
  const tenants = await listTenants()
  const groups = await Promise.all(tenants.map(async tenant => (await listCompositionJobs(tenant.slug, { includeArchived: true })).map(job => ({
    id: job.id, tenantSlug: tenant.slug, tenantName: tenant.name,
    contactName: job.contactName, operatorName: job.operator?.name,
    createdAt: job.createdAt, status: job.status, presetIds: job.presetIds ?? [],
    errorMessage: job.errorMessage, calls: job.generationUsage ?? [],
    summary: summarizeCompositionRequest(job),
  }))))
  // ponytail: latest 200 requests; add server-side pagination when the operational history grows.
  return groups.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
}

export async function reconcileCompositionLog(tenantSlug: string, jobId: string) {
  const job = await findCompositionJob(tenantSlug, jobId)
  if (!job) return null
  const providers = (await readAiProviders()).filter(provider => provider.apiKey)
  const calls = (job.generationUsage ?? []).filter(call => call.requestId)
  if (calls.length > 25) throw new Error("Este pedido excede o limite de 25 chamadas para conferência.")
  let verified = 0
  await Promise.all(calls.map(async call => {
    // New calls retain their credential source; legacy calls try the configured accounts.
    const candidates = call.providerId ? providers.filter(provider => provider.id === call.providerId) : providers
    for (const provider of candidates) {
      let metadata
      try { metadata = await getOpenRouterGeneration(provider, call.requestId!) } catch { continue }
      await updateCompositionGenerationUsage(tenantSlug, jobId, call.requestId!, metadata)
      verified++
      break
    }
  }))
  return { verified, notVerified: (job.generationUsage ?? []).length - verified }
}
