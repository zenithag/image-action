"use client"

import { useState } from "react"
import Link from "next/link"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Empty, Metric, MetricStrip, Section } from "@/components/molecules/flat-blocks"
import { Pill, SearchField } from "@/components/spectrum"
import { ArrowRight, CheckCircle2, Clock3, Cpu, UserRound } from "@/components/spectrum/icons"
import type { AnalyticsPayload } from "@/components/tenant-analytics-view"

const number = new Intl.NumberFormat("pt-BR")
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

const axis = { fill: "var(--muted-foreground)", fontSize: 12 }
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }

/**
 * Visão geral, flat: the same building blocks as Analytics (indicator strip, sections on the page
 * background separated by rules), so the two screens read as one system.
 */
export function TenantOverview({ data, tenantSlug }: { data: AnalyticsPayload; tenantSlug: string }) {
  const [search, setSearch] = useState("")
  const term = search.trim().toLocaleLowerCase("pt-BR")
  const conversations = data.recentConversations.filter((item) =>
    `${item.contactName} ${item.lastMessage}`.toLocaleLowerCase("pt-BR").includes(term)
  )
  const base = `/tenant/${tenantSlug}`
  const hasTimeline = data.conversationData.some((item) => item.conversas > 0 || item.composicoes > 0)
  const operational = [
    { icon: Cpu, label: "Latência da IA", value: data.responseTimes.aiLabel ?? "n/d" },
    { icon: UserRound, label: "Resposta do operador", value: data.responseTimes.operatorLabel ?? "n/d" },
    { icon: Clock3, label: "Respostas da IA em até 5 s", value: data.responseTimes.aiFastRate == null ? "n/d" : `${data.responseTimes.aiFastRate}%` },
  ]

  return (
    <div className="space-y-8 px-8 py-6">
      <MetricStrip columns={4}>
        <Metric label="Conversas" value={number.format(data.stats.conversations)} delta={data.deltas.conversations} />
        <Metric label="Mensagens" value={number.format(data.stats.messages)} delta={data.deltas.messages} />
        <Metric label="Composições" value={number.format(data.stats.compositions)} delta={data.deltas.compositions} />
        <Metric
          label="Pipeline"
          value={number.format(data.stats.compositions)}
          hint={`${number.format(data.stats.completedCompositions)} concluídas · ${number.format(data.stats.failedCompositions)} falhas`}
        />
      </MetricStrip>

      <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section
          title="Volume por dia"
          aside={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cf-chart-2)" }} />Conversas</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cf-chart-1)" }} />Composições</span>
              <span>{data.meta.label}</span>
            </div>
          }
        >
          <div className="h-64" role="img" aria-label={`Volume de conversas e composições: ${data.meta.label}`}>
            {hasTimeline ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={data.conversationData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} tickMargin={10} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" name="Composições" dataKey="composicoes" stroke="var(--cf-chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" name="Conversas" dataKey="conversas" stroke="var(--cf-chart-2)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem atividade em {data.meta.label.toLowerCase()}.</Empty>
            )}
          </div>
        </Section>

        <div className="space-y-8">
          <Section title="Fila de revisão" aside={<span className="text-xs text-muted-foreground">{data.reviewQueue.length} {data.reviewQueue.length === 1 ? "item" : "itens"}</span>}>
            {data.reviewQueue.length === 0 ? (
              <div className="flex items-center gap-3 py-2 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>
                  <b className="text-foreground">Tudo em dia.</b>{" "}
                  <span className="text-muted-foreground">Nenhuma composição aguardando revisão.</span>
                </span>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.reviewQueue.map((job) => (
                  <li key={job.id}>
                    <Link href={`${base}/compositions`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{job.contactName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{job.catalogItemName || job.prompt}</span>
                      </span>
                      <Pill tone={job.status === "failed" ? "danger" : job.status === "processing" ? "ai" : "neutral"}>
                        {job.status === "failed" ? "Falhou" : job.status === "processing" ? "Processando" : "Na fila"}
                      </Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Informações operacionais">
            <dl className="divide-y divide-border">
              {operational.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </dt>
                  <dd className="text-sm font-extrabold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>

      <Section
        title="Últimas conversas"
        className="border-t border-border pt-8"
        aside={
          <div className="flex items-center gap-4">
            <SearchField label="Buscar nas últimas conversas" placeholder="Buscar conversa..." value={search} onValueChange={setSearch} width={260} />
            <Link href={`${base}/inbox`} className="flex items-center gap-1 text-sm font-bold text-[var(--cf-accent-ink,var(--primary))] hover:underline">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      >
        {conversations.length > 0 ? (
          <ul className="divide-y divide-border">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cf-accent-soft,var(--muted))] text-xs font-bold text-[var(--cf-accent-ink,var(--foreground))]">
                  {conversation.contactName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{conversation.contactName}</span>
                    <Pill tone={conversation.handledBy === "ai" ? "ai" : "human"}>{conversation.handledBy === "ai" ? "IA" : "OP"}</Pill>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{conversation.lastMessage || "Sem mensagem"}</span>
                </span>
                {conversation.unreadCount > 0 && <Pill tone="brand">{conversation.unreadCount}</Pill>}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {Number.isNaN(Date.parse(conversation.lastMessageAt)) ? "—" : dateTime.format(new Date(conversation.lastMessageAt))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{search ? "Nenhuma conversa encontrada. Tente outro nome ou mensagem." : "Suas conversas aparecerão aqui."}</Empty>
        )}
      </Section>
    </div>
  )
}
