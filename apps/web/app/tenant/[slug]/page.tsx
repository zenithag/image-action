"use client"

import {
  MessageSquare,
  Image as ImageIcon,
  Users,
  TrendingUp,
  Bot,
  User,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts"

// Dados para o gráfico de área (conversas por dia)
const conversationData = [
  { day: "Seg", conversas: 18, composicoes: 12 },
  { day: "Ter", conversas: 25, composicoes: 15 },
  { day: "Qua", conversas: 22, composicoes: 18 },
  { day: "Qui", conversas: 30, composicoes: 22 },
  { day: "Sex", conversas: 28, composicoes: 20 },
  { day: "Sab", conversas: 16, composicoes: 10 },
  { day: "Dom", conversas: 17, composicoes: 8 },
]

// Dados para gráfico de barras (atendimento por hora)
const hourlyData = [
  { hour: "08h", ia: 8, operador: 2 },
  { hour: "09h", ia: 15, operador: 3 },
  { hour: "10h", ia: 22, operador: 5 },
  { hour: "11h", ia: 18, operador: 4 },
  { hour: "12h", ia: 12, operador: 3 },
  { hour: "13h", ia: 10, operador: 2 },
  { hour: "14h", ia: 20, operador: 6 },
  { hour: "15h", ia: 25, operador: 5 },
  { hour: "16h", ia: 22, operador: 4 },
  { hour: "17h", ia: 18, operador: 3 },
  { hour: "18h", ia: 14, operador: 2 },
]

// Cores neutras para os gráficos
const CHART_COLORS = {
  green: "#00AF67",      // Nova cor primária padronizada
  teal: "#14b8a6",       // Verde-azulado para gráficos secundários
  slate: "#64748b",     // Cinza-azulado
  amber: "#f59e0b",     // Âmbar/dourado
  stone: "#78716c",     // Cinza-quente
  rose: "#f43f5e",      // Rosa-avermelhado
  sky: "#0ea5e9",       // Azul-céu
  emerald: "#10b981",   // Verde esmeralda
}

// Dados para gráfico de pizza (composições por modo)
const compositionModeData = [
  { name: "Interiores", value: 67, color: CHART_COLORS.teal },
  { name: "Produto", value: 18, color: CHART_COLORS.slate },
  { name: "Estampa", value: 8, color: CHART_COLORS.amber },
  { name: "Vestuário", value: 4, color: CHART_COLORS.stone },
  { name: "Acessórios", value: 3, color: CHART_COLORS.sky },
]

// Dados para gráfico radial (taxa de satisfação)
const satisfactionData = [
  { name: "Excelente", value: 45, fill: CHART_COLORS.green },
  { name: "Bom", value: 30, fill: CHART_COLORS.sky },
  { name: "Regular", value: 18, fill: CHART_COLORS.amber },
  { name: "Ruim", value: 7, fill: CHART_COLORS.rose },
]

// Dados para gráfico de linha (custos)
const costData = [
  { day: "01", tokens: 42, composicoes: 28, mensagens: 8 },
  { day: "05", tokens: 38, composicoes: 32, mensagens: 10 },
  { day: "10", tokens: 55, composicoes: 45, mensagens: 12 },
  { day: "15", tokens: 48, composicoes: 38, mensagens: 9 },
  { day: "20", tokens: 62, composicoes: 52, mensagens: 14 },
  { day: "25", tokens: 58, composicoes: 48, mensagens: 11 },
  { day: "30", tokens: 70, composicoes: 56, mensagens: 15 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
        <p className="mb-2 text-sm font-medium text-popover-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: entry.color || entry.fill }} />
            {entry.name}: <span className="font-medium text-popover-foreground">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function TenantDashboardPage() {
  const stats = [
    {
      label: "Conversas",
      value: "156",
      change: 12,
      icon: MessageSquare,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Composições",
      value: "89",
      change: 23,
      icon: ImageIcon,
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      label: "Novos Contatos",
      value: "34",
      change: 8,
      icon: Users,
      color: "bg-emerald-500/10 text-emerald-500",
    },
    {
      label: "Taxa de Conversão",
      value: "57%",
      change: -3,
      icon: TrendingUp,
      color: "bg-amber-500/10 text-amber-500",
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground font-display">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Métricas e indicadores do seu atendimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option>Últimos 7 dias</option>
            <option>Últimos 30 dias</option>
            <option>Este mês</option>
            <option>Mês passado</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="group rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${stat.change >= 0 ? "text-primary" : "text-destructive"}`}>
                  {stat.change >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(stat.change)}%
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Area Chart - Conversas e Composições */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-card-foreground font-display">
                Atividade Semanal
              </h3>
              <p className="text-xs text-muted-foreground">
                Conversas e composições nos últimos 7 dias
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversationData}>
                  <defs>
                    <linearGradient id="colorConversas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorComposicoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.slate} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.slate} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground text-[10px]"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground text-[10px]"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="conversas"
                    name="Conversas"
                    stroke={CHART_COLORS.green}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConversas)"
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="composicoes"
                    name="Composições"
                    stroke={CHART_COLORS.slate}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorComposicoes)"
                    animationDuration={1500}
                    animationEasing="ease-out"
                    animationBegin={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart - Atendimento por Hora */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-card-foreground font-display">
                Atendimentos por Hora
              </h3>
              <p className="text-xs text-muted-foreground">
                Distribuição IA vs Operador
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground text-[10px]"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    className="fill-muted-foreground text-[10px]"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="ia"
                    name="IA"
                    fill={CHART_COLORS.green}
                    radius={[4, 4, 0, 0]}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="operador"
                    name="Operador"
                    fill={CHART_COLORS.amber}
                    radius={[4, 4, 0, 0]}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    animationBegin={400}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Pie Chart - Composições por Modo */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-card-foreground font-display">
                Composições por Modo
              </h3>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={compositionModeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1500}
                    animationEasing="ease-out"
                  >
                    {compositionModeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
                            <p className="text-sm font-medium text-popover-foreground">{data.name}</p>
                            <p className="text-xs text-muted-foreground">{data.value} composições</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {compositionModeData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-muted-foreground">{item.name}</span>
                  <span className="ml-auto text-[10px] font-medium text-card-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Radial Chart - Satisfação */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-card-foreground font-display">
                Satisfação
              </h3>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="25%"
                  outerRadius="90%"
                  barSize={12}
                  data={satisfactionData}
                  startAngle={180}
                  endAngle={-180}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                  <Legend
                    iconSize={8}
                    layout="horizontal"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Response Time Stats */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-card-foreground font-display">
                Tempos de Resposta
              </h3>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl p-4 border border-border/50 bg-primary/5">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Assistente IA</p>
                    <p className="text-xl font-bold text-card-foreground">2.3s</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4 border border-border/50 bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Operador</p>
                    <p className="text-xl font-bold text-card-foreground">4.2min</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Costs Chart */}
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground font-display">
                Custos
              </h3>
            </div>
            <div className="rounded-lg bg-secondary px-4 py-2">
              <p className="text-[10px] text-muted-foreground">Total do mês</p>
              <p className="text-lg font-bold text-primary leading-none">R$ 273,00</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground text-[10px]"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground text-[10px]"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  name="Tokens LLM"
                  stroke={CHART_COLORS.green}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.green, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="composicoes"
                  name="Composições"
                  stroke={CHART_COLORS.slate}
                  strokeWidth={2.5}
                  dot={{ fill: CHART_COLORS.slate, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
