"use client"

import { useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"
import {
  TrendingUp, TrendingDown, Zap, Brain, Sparkles, Bot, Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const tokenUsageByProvider = [
  { date: "01/06", openai: 125000, claude: 89000, nanoBanana: 45000 },
  { date: "02/06", openai: 132000, claude: 92000, nanoBanana: 48000 },
  { date: "03/06", openai: 98000, claude: 76000, nanoBanana: 52000 },
  { date: "04/06", openai: 145000, claude: 102000, nanoBanana: 38000 },
  { date: "05/06", openai: 178000, claude: 115000, nanoBanana: 62000 },
  { date: "06/06", openai: 156000, claude: 98000, nanoBanana: 55000 },
  { date: "07/06", openai: 189000, claude: 125000, nanoBanana: 71000 },
  { date: "08/06", openai: 167000, claude: 108000, nanoBanana: 58000 },
  { date: "09/06", openai: 145000, claude: 95000, nanoBanana: 49000 },
  { date: "10/06", openai: 198000, claude: 132000, nanoBanana: 78000 },
  { date: "11/06", openai: 234000, claude: 156000, nanoBanana: 92000 },
  { date: "12/06", openai: 212000, claude: 142000, nanoBanana: 85000 },
  { date: "13/06", openai: 187000, claude: 118000, nanoBanana: 67000 },
  { date: "14/06", openai: 256000, claude: 178000, nanoBanana: 102000 },
]

const hourlyPeaks = [
  { hour: "00h", tokens: 45000 }, { hour: "02h", tokens: 23000 },
  { hour: "04h", tokens: 12000 }, { hour: "06h", tokens: 34000 },
  { hour: "08h", tokens: 89000 }, { hour: "10h", tokens: 156000 },
  { hour: "12h", tokens: 178000 }, { hour: "14h", tokens: 198000 },
  { hour: "16h", tokens: 234000 }, { hour: "18h", tokens: 189000 },
  { hour: "20h", tokens: 145000 }, { hour: "22h", tokens: 78000 },
]

const tenantTokenUsage = [
  { id: "1", name: "Loja Fashion Store", openai: 456000, claude: 234000, nanoBanana: 89000, totalTokens: 779000, cost: 2340.50, trend: 12.5, limit: 1000000 },
  { id: "2", name: "Tech Solutions LTDA", openai: 678000, claude: 345000, nanoBanana: 156000, totalTokens: 1179000, cost: 3890.25, trend: -5.2, limit: 1500000 },
  { id: "3", name: "Moveis Premium", openai: 234000, claude: 156000, nanoBanana: 67000, totalTokens: 457000, cost: 1250.00, trend: 8.7, limit: 800000 },
  { id: "4", name: "Auto Parts Express", openai: 567000, claude: 289000, nanoBanana: 134000, totalTokens: 990000, cost: 2980.75, trend: 23.4, limit: 1200000 },
  { id: "5", name: "Eletro Shop", openai: 345000, claude: 198000, nanoBanana: 78000, totalTokens: 621000, cost: 1890.00, trend: -2.1, limit: 900000 },
]

const providerDistribution = [
  { name: "OpenAI", value: 2280000, color: "#00AF67" },
  { name: "Claude", value: 1222000, color: "#8B5CF6" },
  { name: "Nano Banana", value: 524000, color: "#F59E0B" },
]

const costByProvider = [
  { provider: "OpenAI", inputCost: 0.01, outputCost: 0.03, totalCost: 8450.00 },
  { provider: "Claude", inputCost: 0.008, outputCost: 0.024, totalCost: 4890.00 },
  { provider: "Nano Banana", inputCost: 0.002, outputCost: 0.006, totalCost: 1260.00 },
]

const COLORS = ["#00AF67", "#8B5CF6", "#F59E0B"]
const TABS = ["Visão Geral", "Por Empresa", "Picos de Uso", "Custos"]

const chartStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
}

export default function UsagePage() {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedTenant, setSelectedTenant] = useState("all")

  const totalTokens = providerDistribution.reduce((s, p) => s + p.value, 0)
  const totalCost = costByProvider.reduce((s, p) => s + p.totalCost, 0)
  const peakHour = hourlyPeaks.reduce((max, h) => h.tokens > max.tokens ? h : max, hourlyPeaks[0])
  const filteredTenants = selectedTenant === "all" ? tenantTokenUsage : tenantTokenUsage.filter(t => t.id === selectedTenant)

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Uso de Tokens & IA</h1>
          <p className="text-sm text-muted-foreground">Monitoramento de consumo por provedor de IA</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="rounded-[5px] border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option>Últimos 7 dias</option>
            <option selected>Últimos 14 dias</option>
            <option>Últimos 30 dias</option>
            <option>Últimos 90 dias</option>
          </select>
          <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} className="rounded-[5px] border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">Todos os tenants</option>
            {tenantTokenUsage.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-4 bg-card/20">
        {[
          { label: "Total de Tokens", value: `${(totalTokens / 1000000).toFixed(2)}M`, icon: Brain, color: "text-primary", bg: "bg-primary/10" },
          { label: "OpenAI", value: `${(providerDistribution[0].value / 1000000).toFixed(2)}M`, icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Claude", value: `${(providerDistribution[1].value / 1000000).toFixed(2)}M`, icon: Bot, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Nano Banana", value: `${(providerDistribution[2].value / 1000000).toFixed(2)}M`, icon: Sparkles, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Custo Total", value: `R$ ${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10" },
        ].map(kpi => (
          <div key={kpi.label} className="flex items-center gap-3 rounded-[5px] border border-border bg-card p-4">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px]", kpi.bg)}>
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground font-display leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-6 pt-1">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} className={cn("px-4 py-2.5 text-sm font-bold border-b-2 transition-colors", i === activeTab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

        {/* Tab 0 — Overview */}
        {activeTab === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 rounded-[5px] border border-border bg-card p-6">
                <h3 className="text-sm font-bold font-display mb-1">Consumo de Tokens por Provedor</h3>
                <p className="text-xs text-muted-foreground mb-6">Evolução do uso nos últimos 14 dias</p>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={tokenUsageByProvider}>
                    <defs>
                      {COLORS.map((c, i) => (
                        <linearGradient key={i} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={c} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${v.toLocaleString()} tokens`, ""]} />
                    <Legend />
                    <Area type="monotone" dataKey="openai" name="OpenAI" stroke={COLORS[0]} fill="url(#g0)" strokeWidth={2} />
                    <Area type="monotone" dataKey="claude" name="Claude" stroke={COLORS[1]} fill="url(#g1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="nanoBanana" name="Nano Banana" stroke={COLORS[2]} fill="url(#g2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-[5px] border border-border bg-card p-6">
                <h3 className="text-sm font-bold font-display mb-1">Distribuição por Provedor</h3>
                <p className="text-xs text-muted-foreground mb-4">Proporção do uso total</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={providerDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                      {providerDistribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${(v/1000000).toFixed(2)}M tokens`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {providerDistribution.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        <span className="text-muted-foreground">{p.name}</span>
                      </div>
                      <span className="font-bold">{((p.value / totalTokens) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[5px] border border-border bg-card p-6">
              <h3 className="text-sm font-bold font-display mb-1">Custo por Provedor</h3>
              <p className="text-xs text-muted-foreground mb-6">Detalhamento de custos de input e output</p>
              <div className="grid grid-cols-3 gap-6">
                {costByProvider.map((p, i) => (
                  <div key={p.provider} className="rounded-[5px] border border-border p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="font-bold">{p.provider}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Input (1k tokens)</span><span>$ {p.inputCost.toFixed(3)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Output (1k tokens)</span><span>$ {p.outputCost.toFixed(3)}</span></div>
                      <div className="border-t pt-2 flex justify-between font-bold"><span className="text-muted-foreground">Total</span><span className="text-primary">R$ {p.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1 — By Tenant */}
        {activeTab === 1 && (
          <div className="space-y-4">
            {filteredTenants.map(tenant => (
              <div key={tenant.id} className="rounded-[5px] border border-border bg-card p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[5px] bg-primary/10 text-primary">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground font-display">{tenant.name}</h3>
                      <p className="text-sm text-muted-foreground">{tenant.totalTokens.toLocaleString()} tokens utilizados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 border", tenant.trend > 0 ? "border-primary/20 bg-primary/10 text-primary" : "border-destructive/20 bg-destructive/10 text-destructive")}>
                      {tenant.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {tenant.trend > 0 ? "+" : ""}{tenant.trend}%
                    </span>
                    <span className="text-xl font-bold text-foreground">R$ {tenant.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-6">
                  {[
                    { label: "OpenAI", value: tenant.openai, total: tenant.totalTokens, color: "bg-primary" },
                    { label: "Claude", value: tenant.claude, total: tenant.totalTokens, color: "bg-violet-500" },
                    { label: "Nano Banana", value: tenant.nanoBanana, total: tenant.totalTokens, color: "bg-amber-500" },
                    { label: "Limite do Plano", value: tenant.totalTokens, total: tenant.limit, color: tenant.totalTokens / tenant.limit > 0.8 ? "bg-destructive" : "bg-primary" },
                  ].map(bar => (
                    <div key={bar.label}>
                      <p className="text-xs text-muted-foreground mb-2">{bar.label}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", bar.color)} style={{ width: `${Math.min((bar.value / bar.total) * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium shrink-0">{bar.label === "Limite do Plano" ? `${((bar.value / bar.total) * 100).toFixed(0)}%` : `${(bar.value / 1000).toFixed(0)}k`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2 — Peaks */}
        {activeTab === 2 && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 rounded-[5px] border border-border bg-card p-6">
              <h3 className="text-sm font-bold font-display mb-1">Picos de Uso por Hora</h3>
              <p className="text-xs text-muted-foreground mb-6">Distribuição de consumo nas últimas 24 horas</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={hourlyPeaks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${v.toLocaleString()} tokens`, "Consumo"]} />
                  <Bar dataKey="tokens" fill="#00AF67" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-[5px] border border-border bg-card p-6 space-y-4">
              <h3 className="text-sm font-bold font-display">Análise de Picos</h3>
              <div className="rounded-[5px] border border-border bg-muted/20 p-4">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Horário de Pico</p>
                <p className="text-2xl font-bold text-foreground">{peakHour.hour}</p>
                <p className="text-xs text-muted-foreground">{peakHour.tokens.toLocaleString()} tokens</p>
              </div>
              <div className="rounded-[5px] border border-border bg-muted/20 p-4">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Média por Hora</p>
                <p className="text-2xl font-bold text-foreground">{(hourlyPeaks.reduce((s, h) => s + h.tokens, 0) / hourlyPeaks.length / 1000).toFixed(0)}k</p>
                <p className="text-xs text-muted-foreground">tokens/hora</p>
              </div>
              <div className="rounded-[5px] border border-border bg-muted/20 p-4">
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Menor Uso</p>
                <p className="text-2xl font-bold text-foreground">04h</p>
                <p className="text-xs text-muted-foreground">12.000 tokens</p>
              </div>
              <div className="rounded-[5px] border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-xs font-bold text-amber-500 mb-1">Recomendação</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Distribua tarefas pesadas para horários de menor uso (00h–06h) para otimizar custos.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3 — Costs */}
        {activeTab === 3 && (
          <div className="space-y-6">
            <div className="rounded-[5px] border border-border bg-card p-6">
              <h3 className="text-sm font-bold font-display mb-1">Evolução de Custos</h3>
              <p className="text-xs text-muted-foreground mb-6">Comparativo de custos por provedor ao longo do tempo</p>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={tokenUsageByProvider}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `R$ ${(v * 0.00003).toFixed(0)}`} />
                  <Tooltip contentStyle={chartStyle} formatter={(v: number, name: string) => [`R$ ${(v * 0.00003).toFixed(2)}`, name]} />
                  <Legend />
                  <Line type="monotone" dataKey="openai" name="OpenAI" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="claude" name="Claude" stroke={COLORS[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="nanoBanana" name="Nano Banana" stroke={COLORS[2]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {costByProvider.map((p, i) => (
                <div key={p.provider} className="rounded-[5px] border border-border bg-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <h3 className="font-bold">{p.provider}</h3>
                  </div>
                  <p className="text-3xl font-bold text-foreground font-display">R$ {p.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">custo total no período</p>
                  <div className="space-y-2 text-sm border-t border-border pt-4">
                    <div className="flex justify-between"><span className="text-muted-foreground">Input (1k tokens)</span><span>$ {p.inputCost}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Output (1k tokens)</span><span>$ {p.outputCost}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
