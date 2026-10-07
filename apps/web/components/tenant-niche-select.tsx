"use client"
import { useEffect, useState } from "react"
import { Input, NativeSelect } from "@/components/spectrum/fields"
import { Modal } from "@/components/spectrum/modal"
import { Button } from "@/components/ui/button"
import { defaultTenantNiches, type TenantNiche } from "@/lib/tenant-niches"

export function TenantNicheSelect({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const [niches, setNiches] = useState<TenantNiche[]>(defaultTenantNiches)
  const [form, setForm] = useState<TenantNiche | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => { void fetch("/api/superadmin/niches", { cache: "no-store" }).then(async response => { if (response.ok) setNiches(await response.json()) }).catch(() => undefined) }, [])
  async function save() {
    if (!form || saving) return
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/superadmin/niches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.")
      setNiches(data); setForm(null)
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar.") }
    finally { setSaving(false) }
  }
  return <div className="space-y-2">
    <NativeSelect aria-label="Nicho do cliente" value={value} onChange={event => onChange(event.target.value)} className={className}>
      {niches.map(niche => <option key={niche.code} value={niche.code}>{niche.label}</option>)}
    </NativeSelect>
    <div className="flex flex-wrap gap-3 text-xs">
      <button type="button" className="text-primary underline" onClick={() => { setError(""); setForm({ code: "", label: "" }) }}>Cadastrar nicho</button>
      <button type="button" className="text-primary underline" onClick={() => { setError(""); setForm(niches.find(niche => niche.code === value) ?? { code: value, label: value }) }}>Renomear nicho</button>
    </div>
    {form && <Modal aria-label="Configurar nicho" onClose={() => !saving && setForm(null)} className="w-full max-w-md space-y-4 p-6">
      <h2 className="text-lg font-semibold">Configurar nicho</h2>
      <label className="block space-y-1 text-sm">Código<Input value={form.code} disabled={niches.some(niche => niche.code === form.code)} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="ex: arquitetura" /></label>
      <label className="block space-y-1 text-sm">Nome<Input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} /></label>
      <p className="text-xs text-muted-foreground">O nicho organiza os clientes. Alvos e instruções de composição são configurados em Segmentação.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setForm(null)}>Cancelar</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar"}</Button></div>
    </Modal>}
  </div>
}
