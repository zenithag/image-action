import { NextResponse } from "next/server"

import {
  runInboxSync,
  type InboxSyncPayload,
  type InboxSyncRunResult,
} from "@/lib/server/whatsapp-inbox-sync"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type InboxSyncState = {
  inFlight?: Promise<InboxSyncRunResult>
  lastCompletedAt?: number
  lastResult?: InboxSyncRunResult
}

const MIN_SYNC_INTERVAL_MS = 15_000
const MIN_FAST_SYNC_INTERVAL_MS = 3_000
const syncStateByTenant = new Map<string, InboxSyncState>()

function getEmptySyncPayload(reason: string): InboxSyncPayload {
  return {
    ok: true,
    instances: 0,
    scannedChats: 0,
    scannedMessages: 0,
    skippedMessagesBeforeConnection: 0,
    skippedMessagesWithoutTimestamp: 0,
    prunedMessagesBeforeConnection: 0,
    createdMessages: 0,
    aiProcessedMessages: 0,
    aiSkippedMessages: 0,
    aiFailedMessages: 0,
    errors: [],
    syncedAt: new Date().toISOString(),
    skipped: true,
    reason,
  }
}

function cacheSyncResult(slug: string, result: InboxSyncRunResult) {
  syncStateByTenant.set(slug, {
    lastCompletedAt: Date.now(),
    lastResult: result,
  })
}

function cacheSyncError(slug: string, error: unknown) {
  const result: InboxSyncRunResult = {
    status: 500,
    body: {
      ok: false,
      instances: 0,
      scannedChats: 0,
      scannedMessages: 0,
      skippedMessagesBeforeConnection: 0,
      skippedMessagesWithoutTimestamp: 0,
      prunedMessagesBeforeConnection: 0,
      createdMessages: 0,
      aiProcessedMessages: 0,
      aiSkippedMessages: 0,
      aiFailedMessages: 0,
      syncedAt: new Date().toISOString(),
      errors: [{
        instanceId: "sync",
        message: error instanceof Error ? error.message : "Erro ao sincronizar inbox.",
      }],
    },
  }

  cacheSyncResult(slug, result)
  return result
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const searchParams = new URL(request.url).searchParams
  const waitForCompletion = searchParams.get("wait") === "1"
  const fastSync = searchParams.get("fast") === "1"
  const minSyncInterval = fastSync ? MIN_FAST_SYNC_INTERVAL_MS : MIN_SYNC_INTERVAL_MS
  const now = Date.now()
  const state = syncStateByTenant.get(slug)

  if (state?.inFlight) {
    if (!waitForCompletion) {
      return NextResponse.json({
        ...(state.lastResult?.body ?? getEmptySyncPayload("Sincronizacao ja esta em andamento.")),
        coalesced: true,
        skipped: true,
        reason: "Sincronizacao ja esta em andamento.",
      })
    }

    const result = await state.inFlight

    return NextResponse.json({
      ...result.body,
      coalesced: true,
      reason: "Sincronizacao em andamento reutilizada.",
    }, { status: result.status })
  }

  if (
    state?.lastCompletedAt &&
    state.lastResult &&
    now - state.lastCompletedAt < minSyncInterval
  ) {
    return NextResponse.json({
      ...state.lastResult.body,
      skipped: true,
      reason: "Sincronizacao recente reutilizada.",
    }, { status: state.lastResult.status })
  }

  const inFlight = runInboxSync(slug)
  syncStateByTenant.set(slug, {
    ...state,
    inFlight,
  })

  if (!waitForCompletion) {
    void inFlight
      .then((result) => cacheSyncResult(slug, result))
      .catch((error) => cacheSyncError(slug, error))

    return NextResponse.json(getEmptySyncPayload("Sincronizacao iniciada em segundo plano."), { status: 202 })
  }

  try {
    const result = await inFlight
    cacheSyncResult(slug, result)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const result = cacheSyncError(slug, error)

    return NextResponse.json(result.body, { status: result.status })
  }
}
