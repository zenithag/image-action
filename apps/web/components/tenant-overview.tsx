"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock3, Cpu, FileText, GitBranch, Layers, MessageSquare, Search, UserRound } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { AnalyticsPayload } from "@/components/tenant-analytics-view"
import styles from "./tenant-overview.module.css"

const number = new Intl.NumberFormat("pt-BR")
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

export function TenantOverview({ data, tenantSlug }: { data: AnalyticsPayload; tenantSlug: string }) {
  const [search, setSearch] = useState("")
  const conversations = data.recentConversations.filter((item) =>
    `${item.contactName} ${item.lastMessage}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
  )
  const base = `/tenant/${tenantSlug}`
  const metrics = [
    { label: "Conversas", value: data.stats.conversations, icon: MessageSquare },
    { label: "Mensagens", value: data.stats.messages, icon: FileText },
    { label: "Composições", value: data.stats.compositions, icon: Layers },
    { label: "Pipeline", value: data.stats.compositions, icon: GitBranch },
  ]

  return (
    <div className={styles.overview}>
      <section className={styles.metrics} aria-label="Resumo da operação">
        {metrics.map(({ label, value, icon: Icon }, index) => (
          <div className={styles.metric} key={label}>
            <span className={styles.metricIcon}><Icon size={22} aria-hidden="true" /></span>
            <div>
              <h2>{label}</h2>
              <p className={styles.metricValue}>{number.format(value)}</p>
              {index === 0 && <p className={data.deltas.conversations < 0 ? styles.negative : styles.delta}>{data.deltas.conversations >= 0 ? "+" : ""}{data.deltas.conversations}% <span>vs. período anterior</span></p>}
              {index === 3 && <p className={styles.pipeline}>{number.format(data.stats.completedCompositions)} concluídas<br />{number.format(data.stats.failedCompositions)} falhas</p>}
            </div>
          </div>
        ))}
      </section>

      <div className={styles.middle}>
        <section className={styles.panel} aria-labelledby="volume-title">
          <div className={styles.sectionHeader}><h2 id="volume-title">Volume por dia</h2><span className={styles.period}>{data.meta.label}</span></div>
          <div className={styles.chart} role="img" aria-label={`Volume de conversas e composições: ${data.meta.label}`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data.conversationData} margin={{ top: 16, right: 12, bottom: 8, left: -22 }}>
                <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickMargin={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                <Line type="monotone" name="Conversas" dataKey="conversas" stroke="var(--overview-green)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                <Line type="monotone" name="Composições" dataKey="composicoes" stroke="var(--overview-blue)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legend}><span><i />Conversas</span><span><i />Composições</span></div>
        </section>

        <div className={styles.operations}>
          <section className={styles.panel} aria-labelledby="review-title">
            <div className={styles.sectionHeader}><h2 id="review-title">Fila de revisão</h2><span>{data.reviewQueue.length} {data.reviewQueue.length === 1 ? "item" : "itens"}</span></div>
            {data.reviewQueue.length === 0 ? (
              <div className={styles.clearQueue}><CheckCircle2 size={32} aria-hidden="true" /><strong>Tudo em dia</strong><p>Nenhuma composição aguardando revisão.</p></div>
            ) : (
              <div className={styles.queue}>{data.reviewQueue.map((job) => (
                <Link href={`${base}/compositions`} key={job.id} className={styles.queueItem}>
                  <div><strong>{job.contactName}</strong><p>{job.catalogItemName || job.prompt}</p></div>
                  <span className={job.status === "failed" ? styles.failed : styles.status}>{job.status === "failed" ? "Falhou" : job.status === "processing" ? "Processando" : "Na fila"}</span>
                </Link>
              ))}</div>
            )}
          </section>
          <section className={styles.panel} aria-labelledby="operations-title">
            <div className={styles.sectionHeader}><h2 id="operations-title">Informações operacionais</h2></div>
            <dl className={styles.details}>
              <div><dt><Cpu size={19} />Latência IA</dt><dd>{data.responseTimes.aiLabel ?? "n/d"}</dd></div>
              <div><dt><UserRound size={19} />Operador</dt><dd>{data.responseTimes.operatorLabel ?? "n/d"}</dd></div>
              <div><dt><Clock3 size={19} />Respostas da IA em até 5 s</dt><dd>{data.responseTimes.aiFastRate == null ? "n/d" : `${data.responseTimes.aiFastRate}%`}</dd></div>
            </dl>
          </section>
        </div>
      </div>

      <section className={styles.panel} aria-labelledby="conversations-title">
        <div className={styles.sectionHeader}>
          <h2 id="conversations-title">Últimas conversas</h2>
          <div className={styles.conversationActions}>
            <label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Buscar nas últimas conversas" placeholder="Buscar conversa..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <Link className={styles.viewAll} href={`${base}/inbox`}>Ver todas <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th>Contato</th><th>Última mensagem</th><th>Não lidas</th><th>Atualizado em</th></tr></thead>
            <tbody>{conversations.map((conversation) => (
              <tr key={conversation.id}>
                <td><div className={styles.contact}><span className={styles.avatar}>{conversation.contactName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}</span><strong>{conversation.contactName}</strong><span className={styles.status}>{conversation.handledBy === "ai" ? "IA" : "OP"}</span></div></td>
                <td><p className={styles.message}>{conversation.lastMessage || "Sem mensagem"}</p></td>
                <td><span className={styles.count}>{conversation.unreadCount}</span></td>
                <td className={styles.date}>{Number.isNaN(Date.parse(conversation.lastMessageAt)) ? "—" : date.format(new Date(conversation.lastMessageAt))}</td>
              </tr>
            ))}</tbody>
          </table>
          {conversations.length === 0 && <div className={styles.empty}><MessageSquare size={24} aria-hidden="true" /><strong>{search ? "Nenhuma conversa encontrada" : "Suas conversas aparecerão aqui"}</strong><p>{search ? "Tente buscar por outro nome ou mensagem." : "Acompanhe os atendimentos e as últimas mensagens da sua equipe."}</p></div>}
        </div>
      </section>
    </div>
  )
}
