"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import {
  Bot,
  Check,
  Clock,
  Copy,
  Download,
  ImagePlus,
  GitBranch,
  Layers3,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Send,
  Shuffle,
  Sparkles,
  Split,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  ConversationFlow,
  ConversationFlowContentItem,
  ConversationFlowGraph,
  ConversationFlowLibraryFolder,
  ConversationFlowLibraryItem,
  ConversationFlowMenuAnswer,
  ConversationFlowNodeData,
  ConversationFlowNodeType,
} from "@/lib/conversation-flow-types"
import type { TenantSettings } from "@/lib/tenant-settings-types"

type FlowNode = Node<ConversationFlowNodeData & { nodeType: ConversationFlowNodeType }>
type FlowEdge = Edge

type LibraryPayload = {
  folders: ConversationFlowLibraryFolder[]
  unfiledFlows: ConversationFlowLibraryItem[]
}

type ImportedFlowPayload = {
  flow: ConversationFlow
}

const blockTypes: Array<{ type: ConversationFlowNodeType; label: string; icon: typeof MessageSquare }> = [
  { type: "content", label: "Conteúdo", icon: MessageSquare },
  { type: "scenario_image", label: "Cenário", icon: ImagePlus },
  { type: "reference_image", label: "Referência", icon: ImagePlus },
  { type: "create_composition", label: "Gerar composição", icon: Sparkles },
  { type: "menu", label: "Menu", icon: GitBranch },
  { type: "action", label: "Ação", icon: Tag },
  { type: "condition", label: "Condição", icon: Split },
  { type: "flow_connection", label: "Conexão", icon: Send },
  { type: "randomizer", label: "Randomizador", icon: Shuffle },
  { type: "smart_delay", label: "Atraso", icon: Clock },
]

const stateOptions = [
  { value: "idle", label: "Aguardando" },
  { value: "awaiting_base_image", label: "Solicitando foto" },
  { value: "collecting_preferences", label: "Coletando preferências" },
  { value: "showing_options", label: "Mostrando opções" },
  { value: "awaiting_selection", label: "Aguardando seleção" },
  { value: "composing", label: "Gerando imagem" },
  { value: "completed", label: "Concluído" },
]

function defaultData(type: ConversationFlowNodeType): ConversationFlowNodeData {
  if (type === "start") {
    return {
      label: "Boas-vindas",
      contents: [{ type: "text", text: "Olá! Como posso ajudar?" }],
    }
  }

  if (type === "menu") {
    return {
      label: "Menu",
      question: "Escolha uma opção:",
      invalid_text: "Digite uma opção válida.",
      max_errors: 3,
      timeout_minutes: 0,
      answers: [
        { id: "answer_1", label: "Opção 1" },
        { id: "answer_2", label: "Opção 2" },
      ],
    }
  }

  if (type === "scenario_image") {
    return {
      label: "Receber cenário",
      question: "Envie uma foto do ambiente/cenário que será usado como base da composição.",
      invalid_text: "Preciso de uma imagem do ambiente para continuar. Envie uma foto do cenário.",
      timeout_minutes: 0,
      required: true,
    }
  }

  if (type === "reference_image") {
    return {
      label: "Receber referência",
      question: "Agora envie a imagem de referência do produto, material, cor ou estilo que deseja aplicar.",
      invalid_text: "Preciso de uma imagem de referência para continuar. Envie a foto do produto, material ou estilo.",
      timeout_minutes: 0,
      required: true,
    }
  }

  if (type === "create_composition") {
    return {
      label: "Gerar composição",
      prompt: "Criar uma composição visual realista aplicando a referência enviada sobre o cenário, preservando enquadramento, iluminação e estrutura do ambiente.",
      mode: "interior",
      changeStrength: 70,
    }
  }

  if (type === "action") return { label: "Ação", action: "set_context", field: "marcador", value: "Fluxo" }
  if (type === "condition") return { label: "Condição", conditions: [{ field: "last_user_message", operator: "contains", value: "sim", handle: "true" }] }
  if (type === "flow_connection") return { label: "Conexão de fluxo", flow_id: null }
  if (type === "randomizer") return { label: "Randomizador" }
  if (type === "smart_delay") return { label: "Atraso", seconds: 5 }

  return {
    label: "Conteúdo",
    contents: [{ type: "text", text: "Digite a mensagem aqui." }],
  }
}

function nodeLabel(type: ConversationFlowNodeType) {
  if (type === "start") return "Início"
  if (type === "scenario_image") return "Cenário"
  if (type === "reference_image") return "Referência"
  if (type === "create_composition") return "Gerar composição"
  return blockTypes.find((item) => item.type === type)?.label ?? type
}

function nodeColor(type: ConversationFlowNodeType) {
  return {
    start: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    content: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    menu: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    action: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    condition: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    flow_connection: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    randomizer: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    smart_delay: "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    scenario_image: "border-lime-500/25 bg-lime-500/10 text-lime-700 dark:text-lime-300",
    reference_image: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    create_composition: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  }[type]
}

function branchHandles(data: FlowNode["data"]) {
  if (data.nodeType === "menu") {
    const handles = (data.answers ?? []).map((answer) => ({ id: answer.id, label: answer.label }))
    return data.timeout_minutes ? [...handles, { id: "timeout", label: "Timeout" }] : handles
  }

  if (data.nodeType === "condition") {
    return [
      ...(data.conditions ?? []).map((condition) => ({
        id: condition.handle,
        label: condition.value ? String(condition.value) : "Verdadeiro",
      })),
      { id: "false", label: "Falso" },
    ]
  }

  return []
}

function ConversationFlowCanvasNode({ data, selected }: NodeProps<FlowNode>) {
  const handles = branchHandles(data)
  const hasBranches = handles.length > 0

  return (
    <div
      className={cn(
        "relative min-w-36 rounded-[8px] border bg-card px-3 py-2 text-sm font-semibold shadow-sm",
        nodeColor(data.nodeType),
        selected && "ring-2 ring-primary/50"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="max-w-44 truncate">{data.label}</div>
      {hasBranches && (
        <div className="mt-2 space-y-1 text-[10px] font-medium text-current/75">
          {handles.map((handle) => (
            <div key={handle.id} className="truncate pr-3">{handle.label}</div>
          ))}
        </div>
      )}
      {hasBranches ? (
        handles.map((handle, index) => (
          <Handle
            key={handle.id}
            id={handle.id}
            type="source"
            position={Position.Right}
            className="!h-3 !w-3 !border-2 !border-background !bg-primary"
            style={{ top: `${((index + 1) / (handles.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-background !bg-primary"
        />
      )}
    </div>
  )
}

function graphToFlowState(graph: ConversationFlowGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: "conversationFlow",
      position: node.position,
      data: {
        ...node.data,
        nodeType: node.type,
        label: node.data.label || nodeLabel(node.type),
      },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      animated: Boolean(edge.sourceHandle),
    })),
  }
}

function flowStateToGraph(nodes: FlowNode[], edges: FlowEdge[]): ConversationFlowGraph {
  return {
    nodes: nodes.map((node) => {
      const { nodeType, ...data } = node.data

      return {
        id: node.id,
        type: node.id === "start" ? "start" : nodeType,
        position: node.position,
        data,
      }
    }),
    edges: edges
      .filter((edge) => edge.source && edge.target)
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      })),
  }
}

function contentDefaults(type: ConversationFlowContentItem["type"]): ConversationFlowContentItem {
  if (type === "text") return { type, text: "Nova mensagem" }
  if (type === "contact") return { type, name: "Nome do contato", phone: "" }
  if (type === "document") return { type, url: "", caption: "", fileName: "arquivo.pdf" }
  if (type === "delay" || type === "typing" || type === "wait") return { type, seconds: type === "typing" ? 3 : 5 }

  return { type, url: "", caption: "" }
}

function exportFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${normalized || "fluxo"}.conversation-flow.json`
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisição inválida."
    throw new Error(message)
  }

  return payload as T
}

export default function TenantFlowsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const exportTextAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const [library, setLibrary] = useState<LibraryPayload>({ folders: [], unfiledFlows: [] })
  const [publishedFlows, setPublishedFlows] = useState<ConversationFlowLibraryItem[]>([])
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [flowMeta, setFlowMeta] = useState({ name: "", description: "" })
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [newFlowName, setNewFlowName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exportJson, setExportJson] = useState("")
  const [exportName, setExportName] = useState("")
  const allFlows = useMemo(
    () => [...library.unfiledFlows, ...library.folders.flatMap((folder) => folder.flows)],
    [library]
  )
  const selectedFlow = useMemo(
    () => allFlows.find((flow) => flow.id === selectedFlowId) ?? null,
    [allFlows, selectedFlowId]
  )
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )
  const nodeTypes = useMemo(() => ({ conversationFlow: ConversationFlowCanvasNode }), [])
  const nodeOptions = useMemo(
    () => nodes.map((node) => ({ id: node.id, label: String(node.data.label || node.id) })),
    [nodes]
  )

  async function loadData(nextSelectedFlowId?: string) {
    setIsLoading(true)
    setError(null)

    try {
      const [libraryData, publishedData, settingsData] = await Promise.all([
        requestJson<LibraryPayload>(`/api/tenant/${slug}/conversation-flows`, { cache: "no-store" }),
        requestJson<{ flows: ConversationFlowLibraryItem[] }>(`/api/tenant/${slug}/conversation-flows?published=1`, { cache: "no-store" }),
        requestJson<TenantSettings>(`/api/tenant/${slug}/settings`, { cache: "no-store" }),
      ])
      const flows = [...libraryData.unfiledFlows, ...libraryData.folders.flatMap((folder) => folder.flows)]
      const nextSelected = flows.find((flow) => flow.id === nextSelectedFlowId)
        ?? flows.find((flow) => flow.id === selectedFlowId)
        ?? flows[0]
        ?? null

      setLibrary(libraryData)
      setPublishedFlows(publishedData.flows)
      setSettings(settingsData)
      setSelectedFlowId(nextSelected?.id ?? null)

      if (nextSelected) {
        const state = graphToFlowState(nextSelected.draftGraph)
        setFlowMeta({ name: nextSelected.name, description: nextSelected.description })
        setNodes(state.nodes)
        setEdges(state.edges)
        setSelectedNodeId(state.nodes[0]?.id ?? null)
      } else {
        setFlowMeta({ name: "", description: "" })
        setNodes([])
        setEdges([])
        setSelectedNodeId(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar fluxos.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [slug])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, id: `${connection.source}_${connection.target}_${Date.now()}` }, current))
  }, [setEdges])

  function selectFlow(flow: ConversationFlowLibraryItem) {
    setSelectedFlowId(flow.id)
    setFlowMeta({ name: flow.name, description: flow.description })
    const state = graphToFlowState(flow.draftGraph)
    setNodes(state.nodes)
    setEdges(state.edges)
    setSelectedNodeId(state.nodes[0]?.id ?? null)
  }

  function updateNodeData(nodeId: string, updater: (data: ConversationFlowNodeData & { nodeType: ConversationFlowNodeType }) => ConversationFlowNodeData & { nodeType: ConversationFlowNodeType }) {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node
        const data = updater(node.data)
        return {
          ...node,
          data,
        }
      })
    )
  }

  function addBlock(type: ConversationFlowNodeType) {
    const id = `${type}_${Date.now()}`
    const data = { ...defaultData(type), nodeType: type }
    setNodes((current) => [
      ...current,
      {
        id,
        type: "conversationFlow",
        position: { x: 180 + current.length * 24, y: 180 + current.length * 28 },
        data,
      },
    ])
    setSelectedNodeId(id)
  }

  function removeNode(nodeId: string) {
    if (nodeId === "start") return
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNodeId("start")
  }

  function edgeTarget(source: string, handle?: string | null) {
    return edges.find((edge) => edge.source === source && (edge.sourceHandle ?? null) === (handle ?? null))?.target ?? ""
  }

  function setHandleEdge(source: string, handle: string | null, target: string) {
    setEdges((current) => [
      ...current.filter((edge) => !(edge.source === source && (edge.sourceHandle ?? null) === handle)),
      ...(target ? [{
        id: `${source}_${handle || "default"}_${target}`,
        source,
        target,
        sourceHandle: handle ?? undefined,
        animated: Boolean(handle),
      }] : []),
    ])
  }

  function addContent(node: FlowNode, type: ConversationFlowContentItem["type"]) {
    updateNodeData(node.id, (data) => ({
      ...data,
      contents: [...(data.contents ?? []), contentDefaults(type)],
    }))
  }

  function updateContent(node: FlowNode, index: number, patch: Partial<ConversationFlowContentItem>) {
    updateNodeData(node.id, (data) => ({
      ...data,
      contents: (data.contents ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  function removeContent(node: FlowNode, index: number) {
    updateNodeData(node.id, (data) => ({
      ...data,
      contents: (data.contents ?? []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function addAnswer(node: FlowNode) {
    updateNodeData(node.id, (data) => {
      const next = (data.answers?.length ?? 0) + 1
      return {
        ...data,
        answers: [...(data.answers ?? []), { id: `answer_${next}`, label: `Opção ${next}` }],
      }
    })
  }

  function updateAnswer(node: FlowNode, answerId: string, patch: Partial<ConversationFlowMenuAnswer>) {
    updateNodeData(node.id, (data) => ({
      ...data,
      answers: (data.answers ?? []).map((answer) => answer.id === answerId ? { ...answer, ...patch } : answer),
    }))
  }

  function removeAnswer(node: FlowNode, answerId: string) {
    updateNodeData(node.id, (data) => ({
      ...data,
      answers: (data.answers ?? []).filter((answer) => answer.id !== answerId),
    }))
    setEdges((current) => current.filter((edge) => !(edge.source === node.id && edge.sourceHandle === answerId)))
  }

  async function createFlow() {
    const name = newFlowName.trim()
    if (!name) return

    try {
      const flow = await requestJson<ConversationFlow>(`/api/tenant/${slug}/conversation-flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      setNewFlowName("")
      await loadData(flow.id)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Nao foi possivel criar o fluxo.")
    }
  }

  async function saveFlow() {
    if (!selectedFlowId) return
    setIsSaving(true)
    setError(null)

    try {
      await requestJson(`/api/tenant/${slug}/conversation-flows/${selectedFlowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...flowMeta,
          graph: flowStateToGraph(nodes, edges),
        }),
      })
      await loadData(selectedFlowId)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar o fluxo.")
    } finally {
      setIsSaving(false)
    }
  }

  async function publishFlow() {
    if (!selectedFlowId) return
    setIsPublishing(true)
    setError(null)

    try {
      await saveFlow()
      await requestJson(`/api/tenant/${slug}/conversation-flows/${selectedFlowId}/publish`, { method: "POST" })
      await loadData(selectedFlowId)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Nao foi possivel publicar o fluxo.")
    } finally {
      setIsPublishing(false)
    }
  }

  async function deleteFlow() {
    if (!selectedFlowId || !selectedFlow) return
    if (!window.confirm(`Excluir o fluxo "${selectedFlow.name}"? Sessões ativas serão pausadas.`)) return

    try {
      await requestJson(`/api/tenant/${slug}/conversation-flows/${selectedFlowId}`, { method: "DELETE" })
      await loadData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir o fluxo.")
    }
  }

  async function updateDefaultFlow(flowId: string) {
    if (!settings) return

    try {
      const nextSettings = await requestJson<TenantSettings>(`/api/tenant/${slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation: { defaultConversationFlowId: flowId } }),
      })
      setSettings(nextSettings)
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Nao foi possivel salvar o fluxo padrao.")
    }
  }

  function buildExportPayload() {
    if (!selectedFlow) return null
    const flowName = flowMeta.name.trim() || selectedFlow.name
    const payload = {
      schema: "comofica.conversation-flow",
      version: 1,
      exportedAt: new Date().toISOString(),
      flow: {
        name: flowName,
        description: flowMeta.description.trim(),
        graph: flowStateToGraph(nodes, edges),
      },
    }
    return {
      fileName: exportFileName(flowName),
      json: JSON.stringify(payload, null, 2),
    }
  }

  function exportFlow() {
    const exportPayload = buildExportPayload()
    if (!exportPayload) return

    setExportName(exportPayload.fileName)
    setExportJson(exportPayload.json)
    setNotice(null)
    setError(null)
  }

  async function copyExportJson() {
    if (!exportJson) return

    exportTextAreaRef.current?.focus()
    exportTextAreaRef.current?.select()

    try {
      await navigator.clipboard.writeText(exportJson)
      setNotice("JSON do fluxo copiado.")
    } catch {
      const copied = document.execCommand("copy")
      setNotice(copied ? "JSON do fluxo copiado." : "JSON selecionado. Pressione Cmd+C para copiar.")
      setError(null)
    }
  }

  function downloadExportJson() {
    if (!exportJson || !exportName) return

    const blob = new Blob([exportJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = exportName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importFlow(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setError(null)

    try {
      const payload = JSON.parse(await file.text()) as unknown
      const imported = await requestJson<ImportedFlowPayload>(`/api/tenant/${slug}/conversation-flows/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      await loadData(imported.flow.id)
    } catch (importError) {
      const message = importError instanceof SyntaxError
        ? "Arquivo JSON invalido."
        : importError instanceof Error ? importError.message : "Nao foi possivel importar o fluxo."
      setError(message)
    } finally {
      setIsImporting(false)
      event.target.value = ""
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex min-h-[64px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-5 lg:px-7">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Automação WhatsApp</p>
          <h1 className="font-display text-xl font-semibold leading-tight text-foreground">Fluxos de conversa</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="flex min-w-[220px] flex-1 gap-2 sm:flex-none"
            onSubmit={(event) => {
              event.preventDefault()
              void createFlow()
            }}
          >
            <input
              value={newFlowName}
              onChange={(event) => setNewFlowName(event.target.value)}
              placeholder="Nome do novo fluxo"
              className="h-9 min-w-0 flex-1 rounded-[8px] border border-border bg-card px-3 text-xs text-foreground outline-none sm:w-48"
            />
            <Button type="submit" size="sm" disabled={!newFlowName.trim()}>
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </form>
          {allFlows.length > 0 && (
            <select
              value={selectedFlowId ?? ""}
              onChange={(event) => {
                const flow = allFlows.find((item) => item.id === event.target.value)
                if (flow) selectFlow(flow)
              }}
              className="h-9 rounded-[8px] border border-border bg-card px-3 text-xs text-foreground outline-none"
            >
              {allFlows.map((flow) => (
                <option key={flow.id} value={flow.id}>{flow.name}</option>
              ))}
            </select>
          )}
          <select
            value={settings?.automation.defaultConversationFlowId ?? ""}
            onChange={(event) => void updateDefaultFlow(event.target.value)}
            className="h-9 rounded-[8px] border border-border bg-card px-3 text-xs text-foreground outline-none"
          >
            <option value="">Sem fluxo padrão</option>
            {publishedFlows.map((flow) => (
              <option key={flow.id} value={flow.id}>{flow.name}</option>
            ))}
          </select>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importFlow(event)}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar
          </Button>
          <Button size="sm" variant="outline" onClick={exportFlow} disabled={!selectedFlow}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={saveFlow} disabled={!selectedFlowId || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
          <Button size="sm" onClick={publishFlow} disabled={!selectedFlowId || isPublishing}>
            {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Publicar
          </Button>
        </div>
      </header>

      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {notice && (
        <div className="shrink-0 border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {exportJson && (
        <section className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-5 lg:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Exportação do fluxo</p>
              <p className="mt-1 text-sm font-medium text-foreground">{exportName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copyExportJson()}>
                <Copy className="h-4 w-4" />
                Copiar JSON
              </Button>
              <Button size="sm" variant="outline" onClick={downloadExportJson}>
                <Download className="h-4 w-4" />
                Baixar arquivo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setExportJson("")}>
                <X className="h-4 w-4" />
                Fechar
              </Button>
            </div>
          </div>
          <textarea
            ref={exportTextAreaRef}
            readOnly
            value={exportJson}
            className="mt-3 h-40 w-full resize-y rounded-[8px] border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none"
          />
        </section>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_360px] xl:grid-rows-1">
        <aside className="hidden min-h-0 border-r border-border bg-card xl:flex xl:flex-col">
          <div className="border-b border-border p-3">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void createFlow()
              }}
            >
              <input
                value={newFlowName}
                onChange={(event) => setNewFlowName(event.target.value)}
                placeholder="Novo fluxo"
                className="min-w-0 flex-1 rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none"
              />
              <Button type="submit" size="icon" className="h-9 w-9" disabled={!newFlowName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : allFlows.length > 0 ? (
              <div className="space-y-2">
                {allFlows.map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => selectFlow(flow)}
                    className={cn(
                      "w-full rounded-[8px] border px-3 py-3 text-left transition-colors",
                      selectedFlowId === flow.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{flow.name}</span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        flow.status === "published" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      )}>
                        {flow.status === "published" ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{flow.description || "Sem descrição"}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{flow.activeSessionsCount} sessões ativas</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[8px] border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Crie o primeiro fluxo para montar a conversa.
              </div>
            )}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-hidden">
          {selectedFlow ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
                <input
                  value={flowMeta.name}
                  onChange={(event) => setFlowMeta((current) => ({ ...current, name: event.target.value }))}
                  className="min-w-56 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-border focus:bg-background"
                />
                <input
                  value={flowMeta.description}
                  onChange={(event) => setFlowMeta((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Descrição"
                  className="min-w-56 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-muted-foreground outline-none focus:border-border focus:bg-background"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={deleteFlow}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  fitView
                >
                  <Background gap={24} />
                  <MiniMap pannable zoomable />
                  <Controls />
                </ReactFlow>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <Layers3 className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">Nenhum fluxo selecionado</h2>
              <p className="mt-1 text-sm text-muted-foreground">Crie ou selecione um fluxo para abrir o editor.</p>
              <form
                className="mt-5 flex w-full max-w-md gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void createFlow()
                }}
              >
                <input
                  value={newFlowName}
                  onChange={(event) => setNewFlowName(event.target.value)}
                  placeholder="Ex.: Boas-vindas do WhatsApp"
                  className="min-w-0 flex-1 rounded-[8px] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                />
                <Button type="submit" disabled={!newFlowName.trim()}>
                  <Plus className="h-4 w-4" />
                  Criar fluxo
                </Button>
              </form>
            </div>
          )}
        </main>

        <aside className="min-h-0 max-h-80 overflow-y-auto border-t border-border bg-card xl:max-h-none xl:border-l xl:border-t-0">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Blocos</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {blockTypes.map((block) => (
                <button
                  key={block.type}
                  type="button"
                  onClick={() => addBlock(block.type)}
                  disabled={!selectedFlow}
                  className="flex items-center gap-2 rounded-[8px] border border-border bg-background px-2 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <block.icon className="h-4 w-4 text-primary" />
                  {block.label}
                </button>
              ))}
            </div>
          </div>

          {selectedNode ? (
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{nodeLabel(selectedNode.data.nodeType)}</p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">{selectedNode.id}</h3>
                </div>
                {selectedNode.id !== "start" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeNode(selectedNode.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <label className="block text-xs font-semibold text-muted-foreground">
                Nome do bloco
                <input
                  value={String(selectedNode.data.label ?? "")}
                  onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, label: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
              </label>

              {(selectedNode.data.nodeType === "start" || selectedNode.data.nodeType === "content") && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mensagens</p>
                  {(selectedNode.data.contents ?? []).map((item, index) => (
                    <div key={index} className="rounded-[8px] border border-border bg-background p-3">
                      <div className="mb-2 flex gap-2">
                        <select
                          value={item.type}
                          onChange={(event) => updateContent(selectedNode, index, contentDefaults(event.target.value as ConversationFlowContentItem["type"]))}
                          className="min-w-0 flex-1 rounded-[8px] border border-border bg-card px-2 py-2 text-xs"
                        >
                          <option value="text">Texto</option>
                          <option value="image">Imagem</option>
                          <option value="contact">Contato</option>
                          <option value="delay">Atraso</option>
                          <option value="typing">Digitando</option>
                        </select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeContent(selectedNode, index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {item.type === "text" && (
                        <textarea
                          value={item.text ?? ""}
                          onChange={(event) => updateContent(selectedNode, index, { text: event.target.value })}
                          className="h-24 w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none"
                        />
                      )}
                      {item.type === "image" && (
                        <div className="space-y-2">
                          <input value={item.url ?? ""} onChange={(event) => updateContent(selectedNode, index, { url: event.target.value })} placeholder="URL da imagem" className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                          <input value={item.caption ?? ""} onChange={(event) => updateContent(selectedNode, index, { caption: event.target.value })} placeholder="Legenda" className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                        </div>
                      )}
                      {item.type === "contact" && (
                        <div className="space-y-2">
                          <input value={item.name ?? ""} onChange={(event) => updateContent(selectedNode, index, { name: event.target.value })} placeholder="Nome" className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                          <input value={item.phone ?? ""} onChange={(event) => updateContent(selectedNode, index, { phone: event.target.value })} placeholder="Telefone" className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                        </div>
                      )}
                      {(item.type === "delay" || item.type === "typing") && (
                        <input value={item.seconds ?? 5} type="number" min={1} onChange={(event) => updateContent(selectedNode, index, { seconds: Number(event.target.value) })} className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {(["text", "image", "contact", "delay", "typing"] as const).map((type) => (
                      <Button key={type} variant="outline" size="sm" onClick={() => addContent(selectedNode, type)}>{type}</Button>
                    ))}
                  </div>
                </div>
              )}

              {(selectedNode.data.nodeType === "scenario_image" || selectedNode.data.nodeType === "reference_image") && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {selectedNode.data.nodeType === "scenario_image" ? "Imagem de cenário" : "Imagem de referência"}
                  </p>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Mensagem antes de esperar a imagem
                    <textarea
                      value={selectedNode.data.question ?? ""}
                      onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, question: event.target.value }))}
                      className="mt-1 h-24 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Resposta quando não vier imagem
                    <textarea
                      value={selectedNode.data.invalid_text ?? ""}
                      onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, invalid_text: event.target.value }))}
                      className="mt-1 h-20 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Timeout em minutos
                    <input
                      value={selectedNode.data.timeout_minutes ?? 0}
                      type="number"
                      min={0}
                      onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, timeout_minutes: Number(event.target.value) }))}
                      className="mt-1 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none"
                    />
                  </label>
                </div>
              )}

              {selectedNode.data.nodeType === "create_composition" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Composição</p>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Instrução para geração
                    <textarea
                      value={selectedNode.data.prompt ?? ""}
                      onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, prompt: event.target.value }))}
                      className="mt-1 h-28 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Modo
                      <select
                        value={selectedNode.data.mode ?? "interior"}
                        onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, mode: event.target.value }))}
                        className="mt-1 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="interior">Interiores</option>
                        <option value="product">Produto</option>
                        <option value="print">Estampa</option>
                        <option value="fashion">Moda</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Intensidade
                      <input
                        value={selectedNode.data.changeStrength ?? 70}
                        type="number"
                        min={0}
                        max={100}
                        onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, changeStrength: Number(event.target.value) }))}
                        className="mt-1 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none"
                      />
                    </label>
                  </div>
                </div>
              )}

              {selectedNode.data.nodeType === "menu" && (
                <div className="space-y-3">
                  <textarea value={selectedNode.data.question ?? ""} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, question: event.target.value }))} className="h-24 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                  <input value={selectedNode.data.invalid_text ?? ""} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, invalid_text: event.target.value }))} placeholder="Texto para resposta inválida" className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={selectedNode.data.max_errors ?? 3} type="number" min={0} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, max_errors: Number(event.target.value) }))} className="rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                    <input value={selectedNode.data.timeout_minutes ?? 0} type="number" min={0} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, timeout_minutes: Number(event.target.value) }))} className="rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                  </div>
                  <select value={edgeTarget(selectedNode.id, "timeout")} onChange={(event) => setHandleEdge(selectedNode.id, "timeout", event.target.value)} className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Encerrar no timeout</option>
                    {nodeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  {(selectedNode.data.answers ?? []).map((answer) => (
                    <div key={answer.id} className="grid grid-cols-[1fr_120px_32px] gap-2">
                      <input value={answer.label} onChange={(event) => updateAnswer(selectedNode, answer.id, { label: event.target.value })} className="min-w-0 rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                      <select value={edgeTarget(selectedNode.id, answer.id)} onChange={(event) => setHandleEdge(selectedNode.id, answer.id, event.target.value)} className="min-w-0 rounded-[8px] border border-border bg-background px-2 py-2 text-sm">
                        <option value="">Fim</option>
                        {nodeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeAnswer(selectedNode, answer.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addAnswer(selectedNode)}>Adicionar opção</Button>
                </div>
              )}

              {selectedNode.data.nodeType === "action" && (
                <div className="space-y-3">
                  <select value={selectedNode.data.action ?? "set_context"} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, action: event.target.value as never }))} className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                    <option value="set_ai">Devolver para IA</option>
                    <option value="set_operator">Transferir para operador</option>
                    <option value="set_state">Atualizar etapa da conversa</option>
                    <option value="add_context_tag">Adicionar tag de contexto</option>
                    <option value="remove_context_tag">Remover tag de contexto</option>
                    <option value="set_context">Salvar contexto</option>
                    <option value="complete_conversation">Fechar conversa</option>
                  </select>
                  {selectedNode.data.action === "set_state" && (
                    <select value={selectedNode.data.state ?? "idle"} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, state: event.target.value }))} className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                      {stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  )}
                  {["add_context_tag", "remove_context_tag"].includes(selectedNode.data.action ?? "") && (
                    <input value={selectedNode.data.tag ?? ""} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, tag: event.target.value }))} placeholder="Tag" className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                  )}
                  {selectedNode.data.action === "set_context" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input value={selectedNode.data.field ?? ""} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, field: event.target.value }))} placeholder="Campo" className="rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                      <input value={String(selectedNode.data.value ?? "")} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, value: event.target.value }))} placeholder="Valor" className="rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                    </div>
                  )}
                </div>
              )}

              {selectedNode.data.nodeType === "condition" && (
                <div className="space-y-3">
                  {(selectedNode.data.conditions ?? []).map((condition, index) => (
                    <div key={condition.handle} className="space-y-2 rounded-[8px] border border-border bg-background p-3">
                      <input value={condition.field} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, conditions: (data.conditions ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value } : item) }))} className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                      <select value={condition.operator} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, conditions: (data.conditions ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as never } : item) }))} className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm">
                        <option value="equals">Igual</option>
                        <option value="not_equals">Diferente</option>
                        <option value="contains">Contém</option>
                        <option value="not_contains">Não contém</option>
                        <option value="filled">Preenchido</option>
                        <option value="blank">Vazio</option>
                        <option value="true">Verdadeiro</option>
                        <option value="false">Falso</option>
                      </select>
                      {!["filled", "blank", "true", "false"].includes(condition.operator) && (
                        <input value={String(condition.value ?? "")} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, conditions: (data.conditions ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm outline-none" />
                      )}
                      <select value={edgeTarget(selectedNode.id, condition.handle)} onChange={(event) => setHandleEdge(selectedNode.id, condition.handle, event.target.value)} className="w-full rounded-[8px] border border-border bg-card px-3 py-2 text-sm">
                        <option value="">Fim se verdadeiro</option>
                        {nodeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </div>
                  ))}
                  <select value={edgeTarget(selectedNode.id, "false")} onChange={(event) => setHandleEdge(selectedNode.id, "false", event.target.value)} className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Fim se falso</option>
                    {nodeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </div>
              )}

              {selectedNode.data.nodeType === "flow_connection" && (
                <select value={selectedNode.data.flow_id ?? ""} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, flow_id: event.target.value || null }))} className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Selecione um fluxo publicado</option>
                  {publishedFlows.filter((flow) => flow.id !== selectedFlowId).map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
                </select>
              )}

              {selectedNode.data.nodeType === "randomizer" && (
                <div className="space-y-2">
                  {edges.filter((edge) => edge.source === selectedNode.id).map((edge) => (
                    <div key={edge.id} className="grid grid-cols-[1fr_32px] gap-2">
                      <select value={edge.target} onChange={(event) => setEdges((current) => current.map((item) => item.id === edge.id ? { ...item, target: event.target.value } : item))} className="rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                        {nodeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setEdges((current) => current.filter((item) => item.id !== edge.id))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setHandleEdge(selectedNode.id, `random_${Date.now()}`, nodeOptions.find((option) => option.id !== selectedNode.id)?.id ?? "")}>Adicionar saída</Button>
                </div>
              )}

              {selectedNode.data.nodeType === "smart_delay" && (
                <label className="block text-xs font-semibold text-muted-foreground">
                  Segundos
                  <input value={selectedNode.data.seconds ?? 5} type="number" min={1} onChange={(event) => updateNodeData(selectedNode.id, (data) => ({ ...data, seconds: Number(event.target.value) }))} className="mt-1 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none" />
                </label>
              )}

              {!["menu", "condition", "flow_connection", "randomizer"].includes(selectedNode.data.nodeType) && (
                <label className="block text-xs font-semibold text-muted-foreground">
                  Próximo bloco
                  <select value={edgeTarget(selectedNode.id)} onChange={(event) => setHandleEdge(selectedNode.id, null, event.target.value)} className="mt-1 w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Fim</option>
                    {nodeOptions.filter((option) => option.id !== selectedNode.id).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              )}
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <Bot className="h-8 w-8" />
              <p className="mt-3">Selecione um bloco no canvas.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
