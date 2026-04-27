export type AiTraceStage = "classification" | "automation" | "composition"
export type AiTraceStatus = "success" | "warning" | "error"

export type AiTraceEntry = {
  id: string
  tenantSlug: string
  conversationId?: string
  messageId?: string
  jobId?: string
  stage: AiTraceStage
  status: AiTraceStatus
  event: string
  details?: Record<string, unknown>
  errorMessage?: string
  createdAt: string
}
