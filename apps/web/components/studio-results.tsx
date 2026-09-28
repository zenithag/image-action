"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { SafeImage } from "@/components/safe-image"
import type { CompositionJob } from "@/lib/composition-types"

const labels = { queued: "Na fila", processing: "Gerando composição", done: "Concluída", failed: "Falhou" }

export function StudioResults({ slug, jobs }: { slug: string; jobs: CompositionJob[] }) {
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
        <select id="studio-result" value={job.id} onChange={event => { setSelected(event.target.value); setShowOriginal(false) }} className="min-w-0 flex-1 rounded border border-border bg-background p-2 text-xs">
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
      {job.status === "done" && job.resultImageUrl && <a href={job.resultImageUrl} target="_blank" rel="noopener noreferrer" className="border-t border-border p-3 text-center text-sm font-medium text-primary">Abrir imagem em tamanho original</a>}
    </div>
  )
}
