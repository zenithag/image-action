"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api"
import type { Tenant } from "@studio/contracts"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { ActivityRow } from "@/components/molecules/activity-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SuperadminPage() {
  const { data: session } = useSession()
  const [tenants, setTenants] = useState<Tenant[]>([])

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Tenant[]>("/v1/tenants", {
          accessToken: session?.accessToken,
        })
        setTenants(data)
      } catch {
        // empty
      }
    }
    load()
  }, [session?.accessToken])

  const activeTenants = tenants.filter((t) => t.status === "active")

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <SectionHeading
        eyebrow="Superadmin"
        title="Visao global da plataforma"
        description="Tenants, metricas e saude operacional."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Tenants ativos"
          value={String(activeTenants.length)}
          hint={`${tenants.length} total`}
        />
        <MetricCard
          label="Total tenants"
          value={String(tenants.length)}
          hint="Todos os planos"
        />
        <MetricCard
          label="Plataforma"
          value="Online"
          hint="Todos os servicos operacionais"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Tenants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenants.map((tenant) => (
            <ActivityRow
              key={tenant.id}
              title={tenant.name}
              detail={`slug: ${tenant.slug} · plano: ${tenant.plan_code}`}
              status={tenant.status}
              tone={tenant.status === "active" ? "default" : "secondary"}
            />
          ))}
          {tenants.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum tenant cadastrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
