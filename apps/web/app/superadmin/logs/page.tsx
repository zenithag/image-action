"use client"

import { useEffect, useState } from "react"
import type { listCompositionLogs } from "@/lib/server/composition-logs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Entry = Awaited<ReturnType<typeof listCompositionLogs>>[number]
const cost = (value?: number | null) => value == null ? "não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(value)
const outcomeLabels: Record<string, string> = { image: "Imagem retornada", "no-image": "Sem imagem", error: "Erro", approved: "Aprovada", rejected: "Reprovada", "invalid-review": "Avaliação inválida" }
const statusLabels: Record<string, string> = { queued: "Na fila", processing: "Processando", done: "Concluído", failed: "Falhou" }

async function request<T>(body?: { tenantSlug: string; jobId: string }) {
  const response = await fetch("/api/superadmin/composition-logs", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os logs.")
  return payload as T
}

export default function CompositionLogsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [purpose, setPurpose] = useState("all")
  async function load() {
    setLoading(true)
    setError(null)
    try { setEntries((await request<{ entries: Entry[] }>()).entries) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os logs.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function reconcile(entry: Entry) {
    setBusy(`${entry.tenantSlug}:${entry.id}`)
    setError(null)
    setNotice(null)
    try {
      const result = await request<{ verified: number; notVerified: number }>({ tenantSlug: entry.tenantSlug, jobId: entry.id })
      setNotice(`${result.verified} chamadas conferidas no OpenRouter; ${result.notVerified} não conferidas.`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível conferir o pedido.") }
    finally { setBusy(null) }
  }
  const visible = entries.filter(entry => (purpose === "all" || entry.summary.purpose === purpose) && `${entry.id} ${entry.tenantName} ${entry.tenantSlug} ${entry.contactName} ${entry.operatorName ?? ""}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="flex h-full flex-col bg-background">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
      <div><h1 className="text-lg font-bold">Logs</h1><p className="text-sm text-muted-foreground">Últimos 200 pedidos, incluindo presets, composições finais e falhas.</p></div>
      <Button variant="outline" disabled={loading || !!busy} onClick={() => void load()}>Atualizar</Button>
    </header>
    <main className="space-y-4 overflow-auto p-6">
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Buscar pedido, cliente ou usuário" placeholder="Buscar pedido, cliente ou usuário" value={query} onChange={event => setQuery(event.target.value)} className="max-w-md" />
        <select aria-label="Destino da composição" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={purpose} onChange={event => setPurpose(event.target.value)}>
          <option value="all">Todos os destinos</option><option value="studio-preset">Preset do Studio</option><option value="composition">Composições finais</option>
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {loading ? <p role="status">Carregando logs…</p> : !visible.length ? <p>Nenhum pedido encontrado.</p> : visible.map(entry => <article key={`${entry.tenantSlug}:${entry.id}`} className="space-y-3 rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">{entry.tenantName} · {entry.operatorName || entry.contactName}</h2>
            <p className="break-all text-xs text-muted-foreground">Pedido {entry.id} · {new Date(entry.createdAt).toLocaleString("pt-BR")} · {statusLabels[entry.status]}</p>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{entry.summary.purpose === "studio-preset" ? "Preset do Studio" : "Composição final"}</span>
        </div>
        <p className="text-sm">Origem: {entry.summary.originalPurpose === "studio-preset" ? "preset do Studio" : entry.summary.originalPurpose === "composition" ? "composição final" : "não registrada no histórico"}. Destino: {entry.summary.purpose === "studio-preset" ? "versões de preset no Studio" : "lista de composições finais"}.</p>
        {!!entry.presetIds.length && <p className="text-xs text-muted-foreground">Presets combinados: {entry.presetIds.join(", ")}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span>{entry.summary.providerRequests} chamadas registradas</span><span>{entry.summary.chargedRequests} chamadas com cobrança informada</span><span>{entry.summary.generations} tentativas de imagem no OpenRouter</span><span>{entry.summary.reviews} avaliações</span><span>{entry.summary.imagesReturned} respostas com imagem</span><span>{entry.summary.rejections} reprovações</span>
          {!!entry.summary.unclassified && <span>{entry.summary.unclassified} chamadas antigas sem classificação</span>}
          <span>{entry.summary.verifiedRequests} conferidas no OpenRouter</span>
        </div>
        {(entry.summary.generations > 1 || entry.summary.reviews > 1) && <p className="text-sm font-medium">Mais de uma tentativa neste pedido.</p>}
        <p className="text-sm">Custo: {entry.summary.completeCostUsd !== null ? cost(entry.summary.completeCostUsd) : `${cost(entry.summary.knownCostUsd)} registrado; total incompleto (${entry.summary.unknownCosts} custos não informados)`}.</p>
        <p className="text-xs text-muted-foreground">Geração: {cost(entry.summary.generationCostUsd)} · Avaliação: {cost(entry.summary.reviewCostUsd)} · Novas tentativas: {cost(entry.summary.retryCostUsd)} (já incluídas no total).</p>
        <p className="text-xs text-muted-foreground">Primeira avaliação: {entry.summary.firstAttemptApproved === true ? "aprovada" : entry.summary.firstAttemptApproved === false ? "reprovada" : "não registrada"} · Tempo de execução: {entry.summary.durationMs === null ? "não registrado" : `${(entry.summary.durationMs / 1000).toFixed(1)} s`}.</p>
        {!!entry.summary.missingRequestIds && <p className="text-xs text-muted-foreground">{entry.summary.missingRequestIds} chamadas sem ID: não é possível conferir essas chamadas na API.</p>}
        {!entry.calls.length && <p className="text-xs text-muted-foreground">Sem registros de chamadas; isso não comprova ausência de consumo.</p>}
        {entry.errorMessage && <p className="text-sm text-destructive">{entry.errorMessage}</p>}
        <details><summary className="cursor-pointer text-sm font-medium">Chamadas deste pedido ({entry.calls.length})</summary>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border"><th className="p-2">Etapa / tentativa</th><th className="p-2">Modelo / ID</th><th className="p-2">Resultado</th><th className="p-2">Custo</th><th className="p-2">Conferência</th></tr></thead>
            <tbody>{entry.calls.map((call, index) => <tr key={call.requestId || index} className="border-b border-border align-top">
              <td className="p-2">{call.kind === "generation" ? "Geração" : call.kind === "review" ? "Avaliação" : "Não classificada"} · {call.attempt ?? "—"}</td>
              <td className="p-2"><p>{call.model}</p><p className="break-all text-muted-foreground">{call.requestId || "ID não informado"}</p><p>{new Date(call.createdAt).toLocaleString("pt-BR")}</p></td>
              <td className="p-2">{outcomeLabels[call.outcome ?? ""] || "Não registrado"}{call.issues?.map((issue, i) => <p key={i} className="mt-1 text-muted-foreground">{issue}</p>)}</td>
              <td className="p-2">{cost(call.costUsd)}</td><td className="p-2">{call.verifiedAt ? `Conferida em ${new Date(call.verifiedAt).toLocaleString("pt-BR")}` : "Não conferida"}{call.outputMedia !== undefined && <p>Mídias de saída: {call.outputMedia}</p>}</td>
            </tr>)}</tbody></table></div>
        </details>
        <Button variant="outline" size="sm" disabled={!!busy || !entry.calls.some(call => call.requestId)} onClick={() => void reconcile(entry)}>{busy === `${entry.tenantSlug}:${entry.id}` ? "Conferindo…" : "Conferir no OpenRouter"}</Button>
      </article>)}
    </main>
  </div>
}
