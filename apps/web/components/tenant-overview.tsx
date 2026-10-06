"use client"

import { useId, useState } from "react"
import styles from "./tenant-overview-cards.module.css"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Empty, Section } from "@/components/molecules/flat-blocks"
import { Pill, SearchField } from "@/components/spectrum"
import { ArrowRight, CheckCircle2, Clock3, Cpu, UserRound, MessageSquare, FileText, Layers, GitBranch } from "@/components/spectrum/icons"
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
  const chartId = useId().replace(/:/g, "")
  const [search, setSearch] = useState("")
  const term = search.trim().toLocaleLowerCase("pt-BR")
  const conversations = data.recentConversations.filter((item) =>
    `${item.contactName} ${item.lastMessage}`.toLocaleLowerCase("pt-BR").includes(term)
  )
  const base = `/tenant/${tenantSlug}`
  const hasTimeline = data.conversationData.some((item) => item.conversas > 0 || item.composicoes > 0)
  const operational = [
    { icon: Cpu, label: "Latência da IA", value: data.responseTimes.aiLabel ?? "0 s" },
    { icon: UserRound, label: "Resposta do operador", value: data.responseTimes.operatorLabel ?? "0 s" },
    { icon: Clock3, label: "Respostas da IA em até 5 s", value: `${data.responseTimes.aiFastRate ?? 0}%` },
  ]

  return (
    <div className={styles.overview}>
      <div className={styles.metrics}>
        {[
          { label: "Conversas", icon: MessageSquare, value: data.stats.conversations, delta: data.deltas.conversations },
          { label: "Mensagens", icon: FileText, value: data.stats.messages, delta: data.deltas.messages },
          { label: "Composições", icon: Layers, value: data.stats.compositions, delta: data.deltas.compositions },
          { label: "Pipeline", icon: GitBranch, value: data.stats.compositions, delta: null },
        ].map(({ label, icon: Icon, value, delta }) => (
          <section key={label} className={styles.metricCard} aria-label={label}>
            <span className={styles.metricIcon}><Icon size={25} aria-hidden="true" /></span>
            <div className={styles.metricContent}>
              <p>{label}</p>
              <strong>{number.format(value)}</strong>
              {delta !== null ? <small><b className={delta >= 0 ? "text-success-ink" : "text-danger"}>{delta >= 0 ? "+" : ""}{delta}%</b><span> vs. período anterior</span></small> : <small>{number.format(data.stats.completedCompositions)} concluídas<br />{number.format(data.stats.failedCompositions)} falhas</small>}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <Section
          title="Volume por dia"
          className={styles.chartCard}
          aside={
            <div className={styles.legend}>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cf-chart-2)" }} />Conversas</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--cf-chart-1)" }} />Composições</span>
              <span>{data.meta.label}</span>
            </div>
          }
        >
          <div className={styles.chart} role="img" aria-label={`Volume de conversas e composições: ${data.meta.label}`}>
            {hasTimeline ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={data.conversationData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id={`${chartId}-conversations`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cf-chart-2)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--cf-chart-2)" stopOpacity={0.01} /></linearGradient>
                    <linearGradient id={`${chartId}-compositions`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cf-chart-1)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--cf-chart-1)" stopOpacity={0.01} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} tickMargin={10} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" name="Composições" dataKey="composicoes" fill={`url(#${chartId}-compositions)`} stroke="var(--cf-chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Area type="monotone" name="Conversas" dataKey="conversas" fill={`url(#${chartId}-conversations)`} stroke="var(--cf-chart-2)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty>Sem atividade em {data.meta.label.toLowerCase()}.</Empty>
            )}
          </div>
        </Section>

        <div className={styles.sideCards}>
          <Section className={styles.card} title="Fila de revisão" aside={<span className="text-xs text-muted-foreground">{data.reviewQueue.length} {data.reviewQueue.length === 1 ? "item" : "itens"}</span>}>
            {data.reviewQueue.length === 0 ? (
              <div className={styles.reviewEmpty}>
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

          <Section className={styles.card} title="Informações operacionais">
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
        className={`${styles.card} ${styles.conversations}`}
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
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Contato</th><th>Última mensagem</th><th>Não lidas</th><th>Atualizado em</th><th>Status</th></tr></thead>
              <tbody>{conversations.map((conversation) => (
                <tr key={conversation.id}>
                  <td><div className={styles.contact}><span className={styles.avatar}>{conversation.contactName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span className={styles.contactName}>{conversation.contactName}</span><Pill tone={conversation.handledBy === "ai" ? "ai" : "human"}>{conversation.handledBy === "ai" ? "IA" : "OP"}</Pill></div></td>
                  <td><span className={styles.messagePreview}>{conversation.lastMessage || "Sem mensagem"}</span></td>
                  <td><Pill tone="brand">{conversation.unreadCount}</Pill></td>
                  <td className={styles.updatedAt}>{Number.isNaN(Date.parse(conversation.lastMessageAt)) ? "—" : dateTime.format(new Date(conversation.lastMessageAt))}</td>
                  <td><Pill tone={conversation.status === "open" ? "brand" : "neutral"}>{({ open: "Aberta", waiting_customer: "Aguardando cliente", waiting_operator: "Aguardando operador", closed: "Encerrada" })[conversation.status]}</Pill></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <Empty>{search ? "Nenhuma conversa encontrada. Tente outro nome ou mensagem." : "Suas conversas aparecerão aqui."}</Empty>
        )}
      </Section>
    </div>
  )
}
