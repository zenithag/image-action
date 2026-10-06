"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Empty, Metric, Section } from "@/components/molecules/flat-blocks"
import styles from "./analytics-layout.module.css"
import { MessageSquare, Image, Users, CheckCircle2, Inbox } from "@/components/spectrum/icons"
import { Pill } from "@/components/spectrum"
import type { AnalyticsPayload } from "@/components/tenant-analytics-view"

const number = new Intl.NumberFormat("pt-BR")
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

const axis = { fill: "var(--muted-foreground)", fontSize: 12 }
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
}
const chartColors = ["var(--cf-chart-1)", "var(--cf-chart-2)", "var(--cf-chart-3)", "var(--cf-chart-4)"]

const statusLabel: Record<AnalyticsPayload["reviewQueue"][number]["status"], string> = {
  queued: "Na fila",
  processing: "Processando",
  failed: "Falhou",
  done: "Concluída",
}

export function AnalyticsFlat({ data }: { data: AnalyticsPayload }) {
  const hasTimeline = data.conversationData.some((item) => item.conversas > 0 || item.composicoes > 0 || item.contatos > 0)
  const hasHourly = data.hourlyData.some((item) => item.mensagens > 0 || item.ia > 0 || item.operador > 0)
  const modes = data.compositionModeData.filter((item) => item.value > 0)
  const responses = [
    { label: "IA", value: data.responseTimes.aiLabel, rate: data.responseTimes.aiFastRate },
    { label: "Operador", value: data.responseTimes.operatorLabel, rate: data.responseTimes.operatorFastRate },
  ]

  return (
    <div className={styles.dashboard}>
      <div className={styles.metrics}>
        <div className={styles.metric}><span className={styles.metricIcon}><MessageSquare aria-hidden="true" /></span><Metric label="Conversas" value={number.format(data.stats.conversations)} delta={data.deltas.conversations} /></div>
        <div className={styles.metric}><span className={styles.metricIcon}><MessageSquare aria-hidden="true" /></span><Metric label="Mensagens" value={number.format(data.stats.messages)} delta={data.deltas.messages} /></div>
        <div className={styles.metric}><span className={styles.metricIcon}><Image aria-hidden="true" /></span><Metric label="Composições" value={number.format(data.stats.compositions)} delta={data.deltas.compositions} /></div>
        <div className={styles.metric}><span className={styles.metricIcon}><Users aria-hidden="true" /></span><Metric label="Contatos" value={number.format(data.stats.contacts)} delta={data.deltas.contacts} /></div>
        <div className={styles.metric}><span className={styles.metricIcon}><CheckCircle2 aria-hidden="true" /></span><Metric
          label="Conclusão"
          value={data.stats.compositions > 0 ? `${data.stats.completionRate}%` : "—"}
          delta={data.stats.compositions > 0 ? data.deltas.completionRate : null}
          hint={`${number.format(data.stats.completedCompositions)} concluídas · ${number.format(data.stats.failedCompositions)} falhas`}
        /></div>
      </div>

      <Section title="Gerações por operador" aside={<span className="text-xs text-muted-foreground">No período selecionado · inclui presets</span>}>
        {data.operatorGenerationData?.length ? <ul className="divide-y divide-border">
          {data.operatorGenerationData.map(operator => <li key={operator.id || "unregistered"} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="text-sm font-semibold">{operator.name}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{number.format(operator.generations)} {operator.generations === 1 ? "geração" : "gerações"} · {number.format(operator.completed)} {operator.completed === 1 ? "concluída" : "concluídas"} · {number.format(operator.failed)} {operator.failed === 1 ? "falha" : "falhas"}</span>
          </li>)}
        </ul> : <Empty>Nenhuma geração por operador no período.</Empty>}
      </Section>

      <div className={styles.chartRow}>
        <Section
          title="Atividade"
          aside={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {[["Conversas", 1], ["Composições", 0], ["Contatos", 2]].map(([label, index]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[index as number] }} />
                  {label}
                </span>
              ))}
            </div>
          }
        >
          <div className="h-64">
            {hasTimeline ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={data.conversationData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} tickMargin={10} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area fillOpacity={0.06} fill={chartColors[0]} type="monotone" name="Composições" dataKey="composicoes" stroke={chartColors[0]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Area fillOpacity={0.06} fill={chartColors[1]} type="monotone" name="Conversas" dataKey="conversas" stroke={chartColors[1]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Area fillOpacity={0.06} fill={chartColors[2]} type="monotone" name="Contatos" dataKey="contatos" stroke={chartColors[2]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem atividade em {data.meta.label.toLowerCase()}.</Empty>
            )}
          </div>
        </Section>

        <Section title="Composições por modo">
          {modes.length > 0 ? (
            <div className={styles.modes}>
              <div className={styles.donut}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={modes} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none" isAnimationActive={false}>
                      {modes.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full min-w-0 space-y-2 text-sm">
                {modes.map((entry, index) => (
                  <li key={entry.name} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />
                      <span className="truncate">{entry.name}</span>
                    </span>
                    <b className="tabular-nums text-foreground">{entry.value}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty>Sem composições no período.</Empty>
          )}
        </Section>
      </div>

      <div className={styles.chartRow}>
        <Section
          title="Atendimento por hora"
          aside={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {[["IA", 1], ["Operador", 0]].map(([label, index]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: chartColors[index as number] }} />
                  {label}
                </span>
              ))}
            </div>
          }
        >
          <div className="h-56">
            {hasHourly ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={data.hourlyData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={axis} interval={2} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axis} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--cf-chart-track, var(--muted))" }} />
                  <Bar dataKey="ia" name="IA" stackId="a" fill={chartColors[1]} isAnimationActive={false} />
                  <Bar dataKey="operador" name="Operador" stackId="a" fill={chartColors[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem mensagens no período.</Empty>
            )}
          </div>
        </Section>

        <Section title="Tempos de resposta">
          <div className={styles.responses}>
            {responses.map((response) => (
              <div key={response.label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{response.label}</span>
                  <span className="text-xl font-semibold tabular-nums text-foreground">{response.value ?? "n/d"}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--cf-chart-track,var(--muted))]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${response.rate ?? 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{response.rate ?? 0}% em até 5 s</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className={styles.bottomRow}>
        <Section title="Fila de revisão" aside={<span className="text-xs text-muted-foreground">{data.reviewQueue.length} {data.reviewQueue.length === 1 ? "item" : "itens"}</span>}>
          {data.reviewQueue.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.reviewQueue.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{job.contactName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{job.catalogItemName || job.prompt}</span>
                    <span className="block truncate text-xs text-muted-foreground">Gerada por: {job.operatorName}</span>
                  </span>
                  <Pill tone={job.status === "failed" ? "danger" : job.status === "processing" ? "ai" : "neutral"}>{statusLabel[job.status]}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}><Inbox aria-hidden="true" /><Empty>Nenhuma composição aguardando revisão.</Empty></div>
          )}
        </Section>

        <Section title="Últimas conversas">
          {data.recentConversations.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.recentConversations.map((conversation) => (
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
            <Empty>Nenhuma conversa registrada.</Empty>
          )}
        </Section>
      </div>
    </div>
  )
}
