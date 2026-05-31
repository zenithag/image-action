import type {
  ConversationFlow,
  ConversationFlowActiveSession,
  ConversationFlowEdge,
  ConversationFlowEvent,
  ConversationFlowEventStatus,
  ConversationFlowFolder,
  ConversationFlowGraph,
  ConversationFlowLibraryFolder,
  ConversationFlowLibraryItem,
  ConversationFlowNode,
  ConversationFlowNodeData,
  ConversationFlowNodeType,
  ConversationFlowSession,
  ConversationFlowSessionStatus,
  ConversationFlowVersion,
} from "@/lib/conversation-flow-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type ConversationFlowsData = {
  folders: ConversationFlowFolder[]
  flows: ConversationFlow[]
  versions: ConversationFlowVersion[]
  sessions: ConversationFlowSession[]
  events: ConversationFlowEvent[]
}

type CreateFlowInput = {
  name: string
  description?: string
  folderId?: string | null
  createdBy?: string | null
}

type ImportFlowInput = CreateFlowInput & {
  graph: unknown
}

type UpdateFlowInput = {
  name?: string
  description?: string
  folderId?: string | null
  graph?: ConversationFlowGraph
}

type CreateSessionInput = {
  tenantSlug: string
  conversationId: string
  channelInstanceId: string
  externalContactId: string
  flowId: string
  startedBy?: string | null
}

const dataFile = getRuntimeDataFile("conversation-flows.json")
const storeKey = "conversation-flows"
let mutationQueue = Promise.resolve()

export function createDefaultConversationFlowGraph(): ConversationFlowGraph {
  return {
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 80, y: 140 },
        data: {
          label: "Boas-vindas",
          contents: [
            { type: "text", text: "Olá! Como posso ajudar?" },
          ],
        },
      },
    ],
    edges: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeDate(value: unknown, fallback = new Date().toISOString()) {
  const text = normalizeText(value)
  return Number.isFinite(new Date(text).getTime()) ? text : fallback
}

function normalizeNodeType(value: unknown): ConversationFlowNodeType {
  if (
    value === "start" ||
    value === "content" ||
    value === "menu" ||
    value === "action" ||
    value === "condition" ||
    value === "flow_connection" ||
    value === "randomizer" ||
    value === "smart_delay" ||
    value === "scenario_image" ||
    value === "reference_image" ||
    value === "create_composition"
  ) {
    return value
  }

  if (value === "message") return "content"
  if (value === "delay" || value === "smartDelay" || value === "smart-delay") return "smart_delay"
  if (value === "flow" || value === "connection" || value === "flowConnection") return "flow_connection"

  return "content"
}

function normalizeNodeData(value: unknown): ConversationFlowNodeData {
  return isRecord(value) ? value as ConversationFlowNodeData : {}
}

function normalizeNode(value: unknown, index: number): ConversationFlowNode | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id) || `node_${index + 1}`
  const position = isRecord(value.position) ? value.position : {}

  return {
    id,
    type: id === "start" ? "start" : normalizeNodeType(value.type),
    position: {
      x: normalizeNumber(position.x, 80 + index * 160),
      y: normalizeNumber(position.y, 140 + index * 80),
    },
    data: normalizeNodeData(value.data),
  }
}

function normalizeEdge(value: unknown, index: number): ConversationFlowEdge | null {
  if (!isRecord(value)) {
    return null
  }

  const source = normalizeText(value.source)
  const target = normalizeText(value.target)

  if (!source || !target) {
    return null
  }

  const sourceHandle = normalizeText(value.sourceHandle)

  return {
    id: normalizeText(value.id) || `${source}_${sourceHandle || "default"}_${target}_${index}`,
    source,
    target,
    sourceHandle: sourceHandle || null,
    targetHandle: normalizeText(value.targetHandle) || null,
  }
}

export function normalizeConversationFlowGraph(value: unknown): ConversationFlowGraph {
  const graph = isRecord(value) ? value : {}
  const nodes = Array.isArray(graph.nodes)
    ? graph.nodes.map(normalizeNode).filter((node): node is ConversationFlowNode => Boolean(node))
    : []
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = Array.isArray(graph.edges)
    ? graph.edges
      .map(normalizeEdge)
      .filter((edge): edge is ConversationFlowEdge => {
        if (!edge) return false
        return nodeIds.has(edge.source) && nodeIds.has(edge.target)
      })
    : []
  const startNode = nodes.find((node) => node.id === "start")

  if (!startNode) {
    return createDefaultConversationFlowGraph()
  }

  return {
    nodes: [
      { ...startNode, type: "start" },
      ...nodes.filter((node) => node.id !== "start"),
    ],
    edges,
  }
}

function normalizeSessionStatus(value: unknown): ConversationFlowSessionStatus {
  return value === "waiting" || value === "paused" || value === "completed" || value === "failed" ? value : "active"
}

function normalizeFlow(value: unknown): ConversationFlow | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const tenantSlug = normalizeText(value.tenantSlug)
  const now = new Date().toISOString()

  if (!id || !tenantSlug) {
    return null
  }

  return {
    id,
    tenantSlug,
    folderId: normalizeText(value.folderId) || null,
    copiedFromFlowId: normalizeText(value.copiedFromFlowId) || null,
    scope: "tenant",
    name: normalizeText(value.name) || "Fluxo sem nome",
    description: normalizeText(value.description),
    status: value.status === "published" ? "published" : "draft",
    draftGraph: normalizeConversationFlowGraph(value.draftGraph),
    publishedVersionId: normalizeText(value.publishedVersionId) || null,
    createdBy: normalizeText(value.createdBy) || null,
    createdAt: normalizeDate(value.createdAt, now),
    updatedAt: normalizeDate(value.updatedAt, now),
  }
}

function normalizeFolder(value: unknown): ConversationFlowFolder | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const tenantSlug = normalizeText(value.tenantSlug)
  const now = new Date().toISOString()

  if (!id || !tenantSlug) {
    return null
  }

  return {
    id,
    tenantSlug,
    name: normalizeText(value.name) || "Pasta",
    sortOrder: normalizeNumber(value.sortOrder, 0),
    createdAt: normalizeDate(value.createdAt, now),
    updatedAt: normalizeDate(value.updatedAt, now),
  }
}

function normalizeVersion(value: unknown): ConversationFlowVersion | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const tenantSlug = normalizeText(value.tenantSlug)
  const flowId = normalizeText(value.flowId)
  const now = new Date().toISOString()

  if (!id || !tenantSlug || !flowId) {
    return null
  }

  return {
    id,
    tenantSlug,
    flowId,
    versionNumber: Math.max(1, Math.round(normalizeNumber(value.versionNumber, 1))),
    graph: normalizeConversationFlowGraph(value.graph),
    publishedAt: normalizeDate(value.publishedAt, now),
    createdBy: normalizeText(value.createdBy) || null,
    createdAt: normalizeDate(value.createdAt, now),
  }
}

function normalizeSession(value: unknown): ConversationFlowSession | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const tenantSlug = normalizeText(value.tenantSlug)
  const conversationId = normalizeText(value.conversationId)
  const flowId = normalizeText(value.flowId)
  const flowVersionId = normalizeText(value.flowVersionId)
  const now = new Date().toISOString()

  if (!id || !tenantSlug || !conversationId || !flowId || !flowVersionId) {
    return null
  }

  return {
    id,
    tenantSlug,
    conversationId,
    channelInstanceId: normalizeText(value.channelInstanceId),
    externalContactId: normalizeText(value.externalContactId),
    flowId,
    flowVersionId,
    startedBy: normalizeText(value.startedBy) || null,
    status: normalizeSessionStatus(value.status),
    currentNodeId: normalizeText(value.currentNodeId) || null,
    awaitingNodeId: normalizeText(value.awaitingNodeId) || null,
    lastUserMessage: normalizeText(value.lastUserMessage) || null,
    context: isRecord(value.context) ? value.context : {},
    pausedReason: normalizeText(value.pausedReason) || null,
    completedReason: normalizeText(value.completedReason) || null,
    waitingSinceAt: normalizeText(value.waitingSinceAt) || null,
    expiresAt: normalizeText(value.expiresAt) || null,
    pausedAt: normalizeText(value.pausedAt) || null,
    completedAt: normalizeText(value.completedAt) || null,
    createdAt: normalizeDate(value.createdAt, now),
    updatedAt: normalizeDate(value.updatedAt, now),
  }
}

function normalizeEventStatus(value: unknown): ConversationFlowEventStatus {
  return value === "failed" || value === "skipped" ? value : "ok"
}

function normalizeEvent(value: unknown): ConversationFlowEvent | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeText(value.id)
  const tenantSlug = normalizeText(value.tenantSlug)

  if (!id || !tenantSlug) {
    return null
  }

  return {
    id,
    tenantSlug,
    sessionId: normalizeText(value.sessionId) || null,
    flowId: normalizeText(value.flowId) || null,
    conversationId: normalizeText(value.conversationId) || null,
    nodeId: normalizeText(value.nodeId) || null,
    type: normalizeText(value.type) || "event",
    status: normalizeEventStatus(value.status),
    payload: isRecord(value.payload) ? value.payload : undefined,
    errorMessage: normalizeText(value.errorMessage) || null,
    occurredAt: normalizeDate(value.occurredAt),
  }
}

async function withFlowsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readFlowsData(): Promise<ConversationFlowsData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { folders: [], flows: [], versions: [], sessions: [], events: [] },
    normalize: (parsed) => {
      const value = isRecord(parsed) ? parsed : {}

      return {
        folders: Array.isArray(value.folders) ? value.folders.map(normalizeFolder).filter((item): item is ConversationFlowFolder => Boolean(item)) : [],
        flows: Array.isArray(value.flows) ? value.flows.map(normalizeFlow).filter((item): item is ConversationFlow => Boolean(item)) : [],
        versions: Array.isArray(value.versions) ? value.versions.map(normalizeVersion).filter((item): item is ConversationFlowVersion => Boolean(item)) : [],
        sessions: Array.isArray(value.sessions) ? value.sessions.map(normalizeSession).filter((item): item is ConversationFlowSession => Boolean(item)) : [],
        events: Array.isArray(value.events) ? value.events.map(normalizeEvent).filter((item): item is ConversationFlowEvent => Boolean(item)) : [],
      }
    },
  })
}

async function writeFlowsData(data: ConversationFlowsData) {
  await writeJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { folders: [], flows: [], versions: [], sessions: [], events: [] },
  }, data)
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

function getPublishedVersion(data: ConversationFlowsData, flow: ConversationFlow) {
  return flow.publishedVersionId
    ? data.versions.find((version) => version.id === flow.publishedVersionId) ?? null
    : null
}

function activeSessionCount(data: ConversationFlowsData, flowId: string) {
  return data.sessions.filter((session) =>
    session.flowId === flowId && (session.status === "active" || session.status === "waiting")
  ).length
}

function toLibraryItem(data: ConversationFlowsData, flow: ConversationFlow): ConversationFlowLibraryItem {
  return {
    ...flow,
    publishedVersion: getPublishedVersion(data, flow),
    activeSessionsCount: activeSessionCount(data, flow.id),
  }
}

export async function listConversationFlowLibrary(tenantSlug: string) {
  const data = await readFlowsData()
  const tenantFolders = sortByName(data.folders.filter((folder) => folder.tenantSlug === tenantSlug))
  const tenantFlows = data.flows.filter((flow) => flow.tenantSlug === tenantSlug)
  const folders: ConversationFlowLibraryFolder[] = tenantFolders.map((folder) => ({
    ...folder,
    flows: sortByName(tenantFlows.filter((flow) => flow.folderId === folder.id).map((flow) => toLibraryItem(data, flow))),
  }))
  const unfiledFlows = sortByName(
    tenantFlows.filter((flow) => !flow.folderId).map((flow) => toLibraryItem(data, flow))
  )

  return { folders, unfiledFlows }
}

export async function listPublishedConversationFlows(tenantSlug: string) {
  const data = await readFlowsData()

  return sortByName(
    data.flows
      .filter((flow) => flow.tenantSlug === tenantSlug && flow.status === "published" && Boolean(flow.publishedVersionId))
      .map((flow) => toLibraryItem(data, flow))
  )
}

export async function findConversationFlow(tenantSlug: string, flowId: string) {
  const data = await readFlowsData()
  const flow = data.flows.find((item) => item.tenantSlug === tenantSlug && item.id === flowId)

  return flow ? toLibraryItem(data, flow) : null
}

export async function findConversationFlowVersion(tenantSlug: string, versionId: string) {
  const data = await readFlowsData()
  return data.versions.find((version) => version.tenantSlug === tenantSlug && version.id === versionId) ?? null
}

export async function createConversationFlow(tenantSlug: string, input: CreateFlowInput) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    const now = new Date().toISOString()
    const flow: ConversationFlow = {
      id: crypto.randomUUID(),
      tenantSlug,
      folderId: input.folderId ?? null,
      copiedFromFlowId: null,
      scope: "tenant",
      name: normalizeText(input.name) || "Novo fluxo",
      description: normalizeText(input.description),
      status: "draft",
      draftGraph: createDefaultConversationFlowGraph(),
      publishedVersionId: null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await writeFlowsData({ ...data, flows: [flow, ...data.flows] })
    return flow
  })
}

export async function importConversationFlow(tenantSlug: string, input: ImportFlowInput) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    const now = new Date().toISOString()
    const flow: ConversationFlow = {
      id: crypto.randomUUID(),
      tenantSlug,
      folderId: input.folderId ?? null,
      copiedFromFlowId: null,
      scope: "tenant",
      name: normalizeText(input.name) || "Fluxo importado",
      description: normalizeText(input.description),
      status: "draft",
      draftGraph: normalizeConversationFlowGraph(input.graph),
      publishedVersionId: null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await writeFlowsData({ ...data, flows: [flow, ...data.flows] })
    return flow
  })
}

export async function updateConversationFlow(tenantSlug: string, flowId: string, input: UpdateFlowInput) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    let updatedFlow: ConversationFlow | null = null
    const now = new Date().toISOString()
    const flows = data.flows.map((flow) => {
      if (flow.tenantSlug !== tenantSlug || flow.id !== flowId) {
        return flow
      }

      updatedFlow = {
        ...flow,
        name: input.name !== undefined ? normalizeText(input.name) || flow.name : flow.name,
        description: input.description !== undefined ? normalizeText(input.description) : flow.description,
        folderId: input.folderId !== undefined ? input.folderId || null : flow.folderId,
        draftGraph: input.graph ? normalizeConversationFlowGraph(input.graph) : flow.draftGraph,
        updatedAt: now,
      }

      return updatedFlow
    })

    if (!updatedFlow) {
      return null
    }

    await writeFlowsData({ ...data, flows })
    return updatedFlow
  })
}

export async function publishConversationFlow(tenantSlug: string, flowId: string, createdBy?: string | null) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    const flow = data.flows.find((item) => item.tenantSlug === tenantSlug && item.id === flowId)

    if (!flow) {
      return null
    }

    const now = new Date().toISOString()
    const versionNumber = data.versions
      .filter((version) => version.flowId === flowId)
      .reduce((max, version) => Math.max(max, version.versionNumber), 0) + 1
    const version: ConversationFlowVersion = {
      id: crypto.randomUUID(),
      tenantSlug,
      flowId,
      versionNumber,
      graph: normalizeConversationFlowGraph(flow.draftGraph),
      publishedAt: now,
      createdBy: createdBy ?? null,
      createdAt: now,
    }
    let updatedFlow: ConversationFlow | null = null
    const flows = data.flows.map((item) => {
      if (item.id !== flowId) {
        return item
      }

      updatedFlow = {
        ...item,
        status: "published",
        publishedVersionId: version.id,
        updatedAt: now,
      }

      return updatedFlow
    })

    await writeFlowsData({ ...data, flows, versions: [version, ...data.versions] })

    return updatedFlow ? { flow: updatedFlow, version } : null
  })
}

export async function deleteConversationFlow(tenantSlug: string, flowId: string) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    const flow = data.flows.find((item) => item.tenantSlug === tenantSlug && item.id === flowId)

    if (!flow) {
      return null
    }

    const now = new Date().toISOString()
    await writeFlowsData({
      folders: data.folders,
      versions: data.versions,
      flows: data.flows.filter((item) => !(item.tenantSlug === tenantSlug && item.id === flowId)),
      sessions: data.sessions.map((session) =>
        session.tenantSlug === tenantSlug && session.flowId === flowId && (session.status === "active" || session.status === "waiting")
          ? { ...session, status: "paused", pausedReason: "flow_deleted", pausedAt: now, updatedAt: now }
          : session
      ),
      events: data.events,
    })

    return flow
  })
}

export async function createConversationFlowSession(input: CreateSessionInput) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    const flow = data.flows.find((item) => item.tenantSlug === input.tenantSlug && item.id === input.flowId)
    const version = flow?.publishedVersionId
      ? data.versions.find((item) => item.tenantSlug === input.tenantSlug && item.id === flow.publishedVersionId)
      : null

    if (!flow || !version || flow.status !== "published") {
      throw new Error("Publique o fluxo antes de iniciar.")
    }

    const now = new Date().toISOString()
    const firstNodeId = version.graph.nodes.find((node) => node.id === "start")?.id ?? version.graph.nodes[0]?.id ?? null
    const pausedSessions = data.sessions.map((session) =>
      session.tenantSlug === input.tenantSlug &&
      session.conversationId === input.conversationId &&
      (session.status === "active" || session.status === "waiting")
        ? { ...session, status: "paused" as const, pausedReason: "replaced_by_new_flow", pausedAt: now, updatedAt: now }
        : session
    )
    const session: ConversationFlowSession = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      channelInstanceId: input.channelInstanceId,
      externalContactId: input.externalContactId,
      flowId: flow.id,
      flowVersionId: version.id,
      startedBy: input.startedBy ?? null,
      status: "active",
      currentNodeId: firstNodeId,
      awaitingNodeId: null,
      lastUserMessage: null,
      context: {},
      pausedReason: null,
      completedReason: null,
      waitingSinceAt: null,
      expiresAt: null,
      pausedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    await writeFlowsData({ ...data, sessions: [session, ...pausedSessions] })
    return session
  })
}

export async function getConversationFlowSession(sessionId: string): Promise<ConversationFlowSession | null> {
  const data = await readFlowsData()
  return data.sessions.find((session) => session.id === sessionId) ?? null
}

export async function getActiveConversationFlowSession(tenantSlug: string, conversationId: string): Promise<ConversationFlowActiveSession | null> {
  const data = await readFlowsData()
  const session = data.sessions.find((item) =>
    item.tenantSlug === tenantSlug &&
    item.conversationId === conversationId &&
    (item.status === "active" || item.status === "waiting" || item.status === "paused")
  )

  if (!session) {
    return null
  }

  const flow = data.flows.find((item) => item.id === session.flowId) ?? null
  const version = data.versions.find((item) => item.id === session.flowVersionId) ?? null

  return {
    ...session,
    flow: flow ? { id: flow.id, name: flow.name, status: flow.status } : null,
    version: version ? { id: version.id, versionNumber: version.versionNumber } : null,
  }
}

export async function findRunningConversationFlowSession(tenantSlug: string, conversationId: string) {
  const data = await readFlowsData()

  return data.sessions.find((item) =>
    item.tenantSlug === tenantSlug &&
    item.conversationId === conversationId &&
    (item.status === "active" || item.status === "waiting")
  ) ?? null
}

export async function updateConversationFlowSession(sessionId: string, updates: Partial<ConversationFlowSession>): Promise<ConversationFlowSession | null> {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    let updatedSession: ConversationFlowSession | null = null
    const sessions = data.sessions.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      updatedSession = {
        ...session,
        ...updates,
        context: updates.context ?? session.context,
        updatedAt: new Date().toISOString(),
      }

      return updatedSession
    })

    if (!updatedSession) {
      return null
    }

    await writeFlowsData({ ...data, sessions })
    return updatedSession
  })
}

export async function setConversationFlowSessionStatus(sessionId: string, status: ConversationFlowSessionStatus, reason: string): Promise<ConversationFlowSession | null> {
  const now = new Date().toISOString()
  const updates: Partial<ConversationFlowSession> = { status }

  if (status === "paused") {
    updates.pausedReason = reason
    updates.pausedAt = now
  } else if (status === "completed" || status === "failed") {
    updates.completedReason = reason
    updates.completedAt = now
  } else {
    updates.pausedReason = null
    updates.pausedAt = null
  }

  return updateConversationFlowSession(sessionId, updates)
}

export async function logConversationFlowEvent(input: {
  tenantSlug: string
  sessionId?: string | null
  flowId?: string | null
  conversationId?: string | null
  nodeId?: string | null
  type: string
  status?: ConversationFlowEventStatus
  payload?: Record<string, unknown>
  errorMessage?: string | null
}) {
  return withFlowsMutation(async () => {
    const data = await readFlowsData()
    const event: ConversationFlowEvent = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      sessionId: input.sessionId ?? null,
      flowId: input.flowId ?? null,
      conversationId: input.conversationId ?? null,
      nodeId: input.nodeId ?? null,
      type: input.type,
      status: input.status ?? "ok",
      payload: input.payload,
      errorMessage: input.errorMessage ?? null,
      occurredAt: new Date().toISOString(),
    }

    await writeFlowsData({ ...data, events: [event, ...data.events].slice(0, 2000) })
    return event
  })
}
