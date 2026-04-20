"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, Brain, Building2, Loader2, Sparkles, TrendingUp } from "lucide-react"

import type { Tenant } from "@/lib/tenant-types"
import { cn } from "@/lib/utils"

export default function UsagePage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTenants() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/superadmin/tenants", { cache: "no-store" })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Nao foi possivel carregar tenants.")
        }

        setTenants(Array.isArray(data) ? data : [])
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar tenants.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadTenants()
  }, [])

  const totals = useMemo(() => tenants.reduce(
    (acc, tenant) => ({
      tenants: acc.tenants + 1,
      conversations: acc.conversations + tenant.stats.conversations,
      compositions: acc.compositions + tenant.stats.compositions,
      contacts: acc.contacts + tenant.stats.contacts,
    }),
    { tenants: 0, conversations: 0, compositions: 0, contacts: 0 }
  ), [tenants])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Uso & Custos</h1>
          <p className="text-sm text-muted-foreground">Sem dados mockados. Os indicadores reais aparecem quando houver eventos de uso.</p>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-4 border-b border-border bg-card/20 px-6 py-4">
        {[
          { label: "Tenants reais", value: totals.tenants, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
          { label: "Conversas", value: totals.conversations, icon: BarChart3, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Composicoes", value: totals.compositions, icon: Sparkles, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Custo apurado", value: "R$ 0,00", icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10" },
        ].map((kpi) => (
          <div key={kpi.label} className="flex items-center gap-3 rounded-[5px] border border-border bg-card p-4">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px]", kpi.bg)}>
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <p className="font-display text-lg font-bold leading-tight text-foreground">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {isLoading ? (
          <div className="flex h-full items-center justify-center rounded-[5px] border border-border bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dados reais...</p>
            </div>
          </div>
        ) : (
          <div className="rounded-[5px] border border-border bg-card p-10 text-center">
            <Brain className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
            <h2 className="font-display text-xl font-bold text-foreground">Ainda nao ha uso real registrado</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Esta tela nao exibe mais numeros ficticios. Quando tenants reais começarem a usar IA, composições e canais,
              os totais e custos podem ser conectados aos eventos persistidos.
            </p>

            {tenants.length > 0 ? (
              <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-[5px] border border-border text-left">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tenant</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conversas</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Composicoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td className="px-4 py-3">
                          <p className="font-display text-sm font-bold text-foreground">{tenant.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{tenant.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">{tenant.stats.conversations}</td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">{tenant.stats.compositions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
