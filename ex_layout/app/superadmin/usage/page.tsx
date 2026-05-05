"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, TrendingDown, Zap, Brain, Sparkles, Bot, Building2 } from "lucide-react"

// Dados de uso de tokens por provedor (últimos 30 dias)
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

// Picos de uso por hora (últimas 24h)
const hourlyPeaks = [
  { hour: "00h", tokens: 45000 },
  { hour: "02h", tokens: 23000 },
  { hour: "04h", tokens: 12000 },
  { hour: "06h", tokens: 34000 },
  { hour: "08h", tokens: 89000 },
  { hour: "10h", tokens: 156000 },
  { hour: "12h", tokens: 178000 },
  { hour: "14h", tokens: 198000 },
  { hour: "16h", tokens: 234000 },
  { hour: "18h", tokens: 189000 },
  { hour: "20h", tokens: 145000 },
  { hour: "22h", tokens: 78000 },
]

// Uso por tenant
const tenantTokenUsage = [
  {
    id: "1",
    name: "Loja Fashion Store",
    openai: 456000,
    claude: 234000,
    nanoBanana: 89000,
    totalTokens: 779000,
    cost: 2340.50,
    trend: 12.5,
    limit: 1000000,
  },
  {
    id: "2",
    name: "Tech Solutions LTDA",
    openai: 678000,
    claude: 345000,
    nanoBanana: 156000,
    totalTokens: 1179000,
    cost: 3890.25,
    trend: -5.2,
    limit: 1500000,
  },
  {
    id: "3",
    name: "Moveis Premium",
    openai: 234000,
    claude: 156000,
    nanoBanana: 67000,
    totalTokens: 457000,
    cost: 1250.00,
    trend: 8.7,
    limit: 800000,
  },
  {
    id: "4",
    name: "Auto Parts Express",
    openai: 567000,
    claude: 289000,
    nanoBanana: 134000,
    totalTokens: 990000,
    cost: 2980.75,
    trend: 23.4,
    limit: 1200000,
  },
  {
    id: "5",
    name: "Eletro Shop",
    openai: 345000,
    claude: 198000,
    nanoBanana: 78000,
    totalTokens: 621000,
    cost: 1890.00,
    trend: -2.1,
    limit: 900000,
  },
]

// Distribuição geral por provedor
const providerDistribution = [
  { name: "OpenAI", value: 2280000, color: "#10B981" },
  { name: "Claude", value: 1222000, color: "#8B5CF6" },
  { name: "Nano Banana", value: 524000, color: "#F59E0B" },
]

// Custo por provedor
const costByProvider = [
  { provider: "OpenAI", inputCost: 0.01, outputCost: 0.03, totalCost: 8450.00 },
  { provider: "Claude", inputCost: 0.008, outputCost: 0.024, totalCost: 4890.00 },
  { provider: "Nano Banana", inputCost: 0.002, outputCost: 0.006, totalCost: 1260.00 },
]

const COLORS = ["#10B981", "#8B5CF6", "#F59E0B"]

export default function UsagePage() {
  const [selectedTenant, setSelectedTenant] = useState<string>("all")
  const [timeRange, setTimeRange] = useState<string>("14d")

  const totalTokens = providerDistribution.reduce((sum, p) => sum + p.value, 0)
  const totalCost = costByProvider.reduce((sum, p) => sum + p.totalCost, 0)
  const peakHour = hourlyPeaks.reduce((max, h) => (h.tokens > max.tokens ? h : max), hourlyPeaks[0])

  // Filtrar dados por tenant se selecionado
  const filteredTenantData = selectedTenant === "all" 
    ? tenantTokenUsage 
    : tenantTokenUsage.filter(t => t.id === selectedTenant)

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="superadmin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Uso de Tokens & IA</h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento de consumo por provedor de IA
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                  <SelectItem value="14d">Ultimos 14 dias</SelectItem>
                  <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                  <SelectItem value="90d">Ultimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tenants</SelectItem>
                  {tenantTokenUsage.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Brain className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Tokens</p>
                    <p className="text-xl font-bold text-foreground">{(totalTokens / 1000000).toFixed(2)}M</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Zap className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">OpenAI</p>
                    <p className="text-xl font-bold text-foreground">{(providerDistribution[0].value / 1000000).toFixed(2)}M</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                    <Bot className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Claude</p>
                    <p className="text-xl font-bold text-foreground">{(providerDistribution[1].value / 1000000).toFixed(2)}M</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Nano Banana</p>
                    <p className="text-xl font-bold text-foreground">{(providerDistribution[2].value / 1000000).toFixed(2)}M</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
                    <TrendingUp className="h-5 w-5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                    <p className="text-xl font-bold text-foreground">R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Visao Geral</TabsTrigger>
              <TabsTrigger value="by-tenant">Por Empresa</TabsTrigger>
              <TabsTrigger value="peaks">Picos de Uso</TabsTrigger>
              <TabsTrigger value="costs">Custos Detalhados</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Token Usage Over Time */}
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle>Consumo de Tokens por Provedor</CardTitle>
                    <CardDescription>Evolucao do uso nos ultimos 14 dias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={tokenUsageByProvider}>
                        <defs>
                          <linearGradient id="colorOpenai" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorNanoBanana" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value.toLocaleString()} tokens`, ""]}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="openai"
                          name="OpenAI"
                          stroke="#10B981"
                          fillOpacity={1}
                          fill="url(#colorOpenai)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="claude"
                          name="Claude"
                          stroke="#8B5CF6"
                          fillOpacity={1}
                          fill="url(#colorClaude)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="nanoBanana"
                          name="Nano Banana"
                          stroke="#F59E0B"
                          fillOpacity={1}
                          fill="url(#colorNanoBanana)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Distribution Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuicao por Provedor</CardTitle>
                    <CardDescription>Proporcao do uso total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={providerDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {providerDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${(value / 1000000).toFixed(2)}M tokens`, ""]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {providerDistribution.map((provider, index) => (
                        <div key={provider.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: COLORS[index] }}
                            />
                            <span className="text-sm text-muted-foreground">{provider.name}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {((provider.value / totalTokens) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cost by Provider */}
              <Card>
                <CardHeader>
                  <CardTitle>Custo por Provedor</CardTitle>
                  <CardDescription>Detalhamento de custos de input e output</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    {costByProvider.map((provider, index) => (
                      <div
                        key={provider.provider}
                        className="rounded-lg border border-border bg-card/50 p-4"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index] }}
                          />
                          <span className="font-semibold text-foreground">{provider.provider}</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo Input (1k tokens)</span>
                            <span className="text-foreground">$ {provider.inputCost.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo Output (1k tokens)</span>
                            <span className="text-foreground">$ {provider.outputCost.toFixed(3)}</span>
                          </div>
                          <div className="border-t border-border pt-2">
                            <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Total</span>
                              <span className="font-bold text-foreground">
                                R$ {provider.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* By Tenant Tab */}
            <TabsContent value="by-tenant" className="space-y-6">
              <div className="grid gap-4">
                {filteredTenantData.map((tenant) => (
                  <Card key={tenant.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{tenant.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {tenant.totalTokens.toLocaleString()} tokens utilizados
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {tenant.trend > 0 ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                              <TrendingUp className="mr-1 h-3 w-3" />
                              +{tenant.trend}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-500">
                              <TrendingDown className="mr-1 h-3 w-3" />
                              {tenant.trend}%
                            </Badge>
                          )}
                          <span className="text-lg font-bold text-foreground">
                            R$ {tenant.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-4 gap-6">
                        {/* Usage by provider */}
                        <div>
                          <p className="mb-2 text-xs text-muted-foreground">OpenAI</p>
                          <div className="flex items-center gap-2">
                            <Progress value={(tenant.openai / tenant.totalTokens) * 100} className="h-2 flex-1 [&>div]:bg-emerald-500" />
                            <span className="text-sm font-medium text-foreground">{(tenant.openai / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs text-muted-foreground">Claude</p>
                          <div className="flex items-center gap-2">
                            <Progress value={(tenant.claude / tenant.totalTokens) * 100} className="h-2 flex-1 [&>div]:bg-violet-500" />
                            <span className="text-sm font-medium text-foreground">{(tenant.claude / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs text-muted-foreground">Nano Banana</p>
                          <div className="flex items-center gap-2">
                            <Progress value={(tenant.nanoBanana / tenant.totalTokens) * 100} className="h-2 flex-1 [&>div]:bg-amber-500" />
                            <span className="text-sm font-medium text-foreground">{(tenant.nanoBanana / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs text-muted-foreground">Limite do Plano</p>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(tenant.totalTokens / tenant.limit) * 100} 
                              className={`h-2 flex-1 ${(tenant.totalTokens / tenant.limit) > 0.8 ? '[&>div]:bg-rose-500' : '[&>div]:bg-primary'}`}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {((tenant.totalTokens / tenant.limit) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Peaks Tab */}
            <TabsContent value="peaks" className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle>Picos de Uso por Hora</CardTitle>
                    <CardDescription>Distribuicao de consumo nas ultimas 24 horas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={hourlyPeaks}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value.toLocaleString()} tokens`, "Consumo"]}
                        />
                        <Bar dataKey="tokens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Analise de Picos</CardTitle>
                    <CardDescription>Informacoes sobre momentos de maior uso</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-lg border border-border bg-card/50 p-4">
                      <p className="text-xs text-muted-foreground">Horario de Pico</p>
                      <p className="text-2xl font-bold text-foreground">{peakHour.hour}</p>
                      <p className="text-sm text-muted-foreground">{peakHour.tokens.toLocaleString()} tokens</p>
                    </div>

                    <div className="rounded-lg border border-border bg-card/50 p-4">
                      <p className="text-xs text-muted-foreground">Media por Hora</p>
                      <p className="text-2xl font-bold text-foreground">
                        {(hourlyPeaks.reduce((sum, h) => sum + h.tokens, 0) / hourlyPeaks.length / 1000).toFixed(0)}k
                      </p>
                      <p className="text-sm text-muted-foreground">tokens/hora</p>
                    </div>

                    <div className="rounded-lg border border-border bg-card/50 p-4">
                      <p className="text-xs text-muted-foreground">Horario de Menor Uso</p>
                      <p className="text-2xl font-bold text-foreground">04h</p>
                      <p className="text-sm text-muted-foreground">12.000 tokens</p>
                    </div>

                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-sm font-medium text-amber-500">Recomendacao</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Considere distribuir tarefas pesadas para horarios de menor uso (00h-06h) para otimizar custos.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Costs Tab */}
            <TabsContent value="costs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Evolucao de Custos</CardTitle>
                  <CardDescription>Comparativo de custos por provedor ao longo do tempo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={tokenUsageByProvider}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$ ${(v * 0.00003).toFixed(0)}`} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => [
                          `R$ ${(value * 0.00003).toFixed(2)}`,
                          name,
                        ]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="openai" name="OpenAI" stroke="#10B981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="claude" name="Claude" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="nanoBanana" name="Nano Banana" stroke="#F59E0B" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-6">
                {costByProvider.map((provider, index) => (
                  <Card key={provider.provider}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                        <CardTitle className="text-lg">{provider.provider}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-foreground">
                        R$ {provider.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">custo total no periodo</p>
                      <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Input (1k tokens)</span>
                          <span className="text-foreground">$ {provider.inputCost}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Output (1k tokens)</span>
                          <span className="text-foreground">$ {provider.outputCost}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
