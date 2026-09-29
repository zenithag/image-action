"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { SafeImage } from "@/components/safe-image"
import type { CompositionJob } from "@/lib/composition-types"

const labels = { queued: "Na fila", processing: "Gerando composição", done: "Concluída", failed: "Falhou" }

export function StudioResults({ slug, jobs, onCreated }: { slug: string; jobs: CompositionJob[]; onCreated: (job: CompositionJob) => void }) {
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correction, setCorrection] = useState("")
  const [correcting, setCorrecting] = useState(false)
  const correctionLock = useRef(false)
  const correctionRequest = useRef({ signature: "", id: "" })
  const [results, setResults] = useState(jobs)
  const [selected, setSelected] = useState("")
  const [showOriginal, setShowOriginal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const ids = jobs.map(job => job.id).join(",")

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const jobIds = ids.split(",").filter(Boolean)
    async function poll() {
      let pending = true
      try {
        const updated = await Promise.all(jobIds.map(async id => {
          const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
          if (!response.ok) throw new Error("Não foi possível atualizar os resultados. Tentaremos novamente automaticamente.")
          return await response.json() as CompositionJob
        }))
        if (controller.signal.aborted) return
        setResults(updated)
        setError(null)
        pending = updated.some(job => job.status === "queued" || job.status === "processing")
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : "Falha ao consultar os resultados.")
      }
      if (pending && !controller.signal.aborted) timer = setTimeout(poll, 4000)
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [ids, slug, refresh])

  const job = results.find(item => item.id === selected) ?? results[0] ?? jobs[0]
  if (!job) return null
  const image = showOriginal ? job.baseImageUrl : job.status === "done" ? job.resultImageUrl : undefined

  async function correct() {
    if (correctionLock.current || !correction.trim() || !job.resultImageUrl) return
    correctionLock.current = true
    setCorrecting(true)
    setError(null)
    const signature = `${job.id}:${correction.trim()}`
    if (correctionRequest.current.signature !== signature) correctionRequest.current = { signature, id: `studio:${crypto.randomUUID()}` }
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioVersion: "v1", source: "operator", sourceMessageId: correctionRequest.current.id,
          conversationId: job.conversationId, channelInstanceId: job.channelInstanceId,
          contactName: job.contactName, mode: job.mode, baseImageUrl: job.resultImageUrl,
          references: job.references, changeStrength: job.changeStrength,
          prompt: `Corrija apenas o ajuste solicitado na imagem fornecida, preservando câmera, arquitetura e os demais elementos. Ajuste: ${correction.trim()}`,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.job) throw new Error(data.error || "Não foi possível enviar a correção.")
      setResults(current => [...current, data.job])
      onCreated(data.job)
      setSelected(data.job.id)
      setShowOriginal(false)
      setCorrectionOpen(false)
      setCorrection("")
      correctionRequest.current = { signature: "", id: "" }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao enviar a correção. Tente novamente.") }
    finally { correctionLock.current = false; setCorrecting(false) }
  }

  async function retry() {
    if (retrying) return
    setRetrying(true)
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs/${encodeURIComponent(job.id)}/retry`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível tentar novamente.")
      setResults(current => current.map(item => item.id === job.id ? { ...item, status: "queued", errorMessage: undefined } : item))
      setRefresh(current => current + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao tentar novamente.") }
    finally { setRetrying(false) }
  }

  return (
    <div className="flex min-h-72 flex-1 flex-col overflow-hidden rounded border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <label className="sr-only" htmlFor="studio-result">Composição do lote</label>
        <select id="studio-result" disabled={correcting} value={job.id} onChange={event => { setSelected(event.target.value); setShowOriginal(false); setCorrectionOpen(false); setCorrection("") }} className="min-w-0 flex-1 rounded border border-border bg-background p-2 text-xs">
          {results.map((item, index) => <option key={item.id} value={item.id}>Composição {index + 1} · {labels[item.status]}</option>)}
        </select>
        {job.status === "done" && job.baseImageUrl && <button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(value => !value)} className="rounded border border-border px-3 py-2 text-xs">{showOriginal ? "Ver resultado" : "Ver original"}</button>}
      </div>
      <div className="relative flex min-h-64 flex-1 items-center justify-center">
        {image ? <SafeImage src={image} alt={showOriginal ? "Ambiente original" : "Composição gerada"} className="h-full w-full object-contain" fallbackLabel="Imagem indisponível" /> : (
          <div className="max-w-sm p-6 text-center" role="status">
            {(job.status === "queued" || job.status === "processing") && <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin motion-reduce:animate-none text-primary" />}
            <p className="text-sm font-medium">{labels[job.status]}</p>
            <p className="mt-2 text-sm text-muted-foreground">{job.status === "failed" ? job.errorMessage || "A geração não foi concluída. Tente novamente." : job.status === "done" ? "O resultado não contém uma imagem disponível." : "O resultado aparecerá aqui automaticamente. Você pode continuar preparando os próximos ambientes."}</p>
            {job.status === "failed" && <button type="button" disabled={retrying} onClick={() => void retry()} className="mt-4 rounded border border-border px-3 py-2 text-sm disabled:opacity-50">{retrying ? "Reenviando…" : "Tentar novamente"}</button>}
          </div>
        )}
      </div>
      {error && <p role="alert" className="p-3 text-sm text-destructive">{error}</p>}
      {job.status === "done" && job.resultImageUrl && (
        <div className="space-y-2 border-t border-border p-3">
          <button type="button" aria-expanded={correctionOpen} disabled={correcting} onClick={() => setCorrectionOpen(value => !value)} className="rounded border border-border px-3 py-2 text-sm">Corrigir esta composição</button>
          {correctionOpen && <form onSubmit={event => { event.preventDefault(); void correct() }} className="space-y-2">
            <label className="block text-sm">O que precisa mudar?
              <textarea required maxLength={4000} disabled={correcting} value={correction} onChange={event => setCorrection(event.target.value)} placeholder="Ex.: ajuste apenas a posição do sofá, mantendo os demais elementos." className="mt-1 min-h-20 w-full rounded border border-border bg-background p-2 text-sm" />
            </label>
            <p className="text-xs text-muted-foreground">Gera uma nova versão somente desta imagem e pode consumir créditos. A versão anterior e os outros ambientes serão mantidos. Confira se os demais elementos foram preservados.</p>
            <button type="submit" disabled={correcting || !correction.trim()} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{correcting ? "Enviando correção…" : "Gerar versão corrigida"}</button>
          </form>}
        </div>
      )}
      {job.status === "done" && job.resultImageUrl && <a href={job.resultImageUrl} target="_blank" rel="noopener noreferrer" className="border-t border-border p-3 text-center text-sm font-medium text-primary">Abrir imagem em tamanho original</a>}
    </div>
  )
}
