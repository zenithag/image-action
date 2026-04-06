"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api"
import type { Conversation } from "@studio/contracts"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { ActivityRow } from "@/components/molecules/activity-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TenantDashboardPage() {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Conversation[]>("/v1/conversations", {
          accessToken: session?.accessToken,
        })
        setConversations(data)
      } catch {
        // empty
      }
    }
    load()
  }, [session?.accessToken])

  const active = conversations.filter((c) => c.state !== "completed" && c.state !== "idle")
  const composing = conversations.filter((c) => c.state === "composing")
  const operatorHandled = conversations.filter((c) => c.handled_by === "operator")

  return (
    <div className="space-y-8 p-6">
      <SectionHeading
        eyebrow="Dashboard"
        title="Visao geral do tenant"
        description="Metricas em tempo real das conversas e jobs."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Conversas ativas"
          value={String(active.length)}
          hint={`${operatorHandled.length} com operador`}
        />
        <MetricCard
          label="Jobs compondo"
          value={String(composing.length)}
          hint="Composicoes em andamento"
        />
        <MetricCard
          label="Total conversas"
          value={String(conversations.length)}
          hint="Todas as conversas do tenant"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Conversas recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {conversations.slice(0, 10).map((conv) => (
            <ActivityRow
              key={conv.id}
              title={`Conversa ${conv.id.slice(0, 8)}`}
              detail={`Estado: ${conv.state} · Atendimento: ${conv.handled_by}`}
              status={conv.state}
              tone={conv.handled_by === "operator" ? "default" : "secondary"}
            />
          ))}
          {conversations.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
