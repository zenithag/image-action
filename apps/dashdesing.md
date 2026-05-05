  "use client"

  import { useState } from "react"
  import { AppSidebar } from "@/components/app-sidebar"
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
    teal: "#2dd4bf",      // Verde-água vibrante
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
    { name: "Excelente", value: 45, fill: CHART_COLORS.teal },
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

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium text-popover-foreground">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
              {entry.name}: <span className="font-medium text-popover-foreground">{entry.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  export default function AnalyticsPage() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        color: "bg-chart-2/20 text-chart-2",
      },
      {
        label: "Novos Contatos",
        value: "34",
        change: 8,
        icon: Users,
        color: "bg-chart-3/20 text-chart-3",
      },
      {
        label: "Taxa de Conversão",
        value: "57%",
        change: -3,
        icon: TrendingUp,
        color: "bg-chart-4/20 text-chart-4",
      },
    ]

    return (
      <div className="flex h-screen bg-background">
        <AppSidebar
          variant="tenant"
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((p) => !p)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Métricas e indicadores do seu atendimento
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select className="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option>Últimos 7 dias</option>
                <option>Últimos 30 dias</option>
                <option>Este mês</option>
                <option>Mês passado</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Main Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
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
            <div className="mt-6 grid grid-cols-2 gap-6">
              {/* Area Chart - Conversas e Composições */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-card-foreground">
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
                          <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
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
                        className="fill-muted-foreground text-xs"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        className="fill-muted-foreground text-xs"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="conversas"
                        name="Conversas"
                        stroke={CHART_COLORS.teal}
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
                <div className="mt-4 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.teal }} />
                    <span className="text-xs text-muted-foreground">Conversas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.slate }} />
                    <span className="text-xs text-muted-foreground">Composições</span>
                  </div>
                </div>
              </div>

              {/* Bar Chart - Atendimento por Hora */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-card-foreground">
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
                        className="fill-muted-foreground text-xs"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        className="fill-muted-foreground text-xs"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="ia"
                        name="IA"
                        fill={CHART_COLORS.teal}
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
                <div className="mt-4 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" style={{ color: CHART_COLORS.teal }} />
                    <span className="text-xs text-muted-foreground">Assistente IA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" style={{ color: CHART_COLORS.amber }} />
                    <span className="text-xs text-muted-foreground">Operador</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="mt-6 grid grid-cols-3 gap-6">
              {/* Pie Chart - Composições por Modo */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Composições por Modo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Distribuição por tipo
                  </p>
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
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                      <span className="ml-auto text-xs font-medium text-card-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radial Chart - Satisfação */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Satisfação dos Clientes
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Avaliações do atendimento
                  </p>
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
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
                                <p className="text-sm font-medium text-popover-foreground">{data.name}</p>
                                <p className="text-xs text-muted-foreground">{data.value}%</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Response Time Stats */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Tempos de Resposta
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Média até primeira resposta
                  </p>
                </div>
                <div className="space-y-6">
                  <div className="rounded-xl p-5" style={{ background: `linear-gradient(to bottom right, ${CHART_COLORS.teal}20, ${CHART_COLORS.teal}08)` }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${CHART_COLORS.teal}30` }}>
                        <Bot className="h-5 w-5" style={{ color: CHART_COLORS.teal }} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Assistente IA</p>
                        <p className="text-2xl font-bold text-card-foreground">2.3s</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: "95%", backgroundColor: CHART_COLORS.teal }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">95% das respostas em menos de 5s</p>
                  </div>

                  <div className="rounded-xl p-5" style={{ background: `linear-gradient(to bottom right, ${CHART_COLORS.amber}20, ${CHART_COLORS.amber}08)` }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${CHART_COLORS.amber}30` }}>
                        <User className="h-5 w-5" style={{ color: CHART_COLORS.amber }} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Operador</p>
                        <p className="text-2xl font-bold text-card-foreground">4.2min</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: "78%", backgroundColor: CHART_COLORS.amber }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">78% das respostas em menos de 10min</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Costs Chart */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Evolução de Custos
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Consumo de recursos ao longo do mês (R$)
                  </p>
                </div>
                <div className="flex items-center gap-4 rounded-lg bg-secondary px-4 py-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total do mês</p>
                    <p className="text-lg font-bold text-primary">R$ 273,00</p>
                  </div>
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
                      className="fill-muted-foreground text-xs"
                      tickFormatter={(value) => `Dia ${value}`}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      className="fill-muted-foreground text-xs"
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="tokens"
                      name="Tokens LLM"
                      stroke={CHART_COLORS.teal}
                      strokeWidth={2.5}
                      dot={{ fill: CHART_COLORS.teal, strokeWidth: 0, r: 4 }}
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
                      animationBegin={300}
                    />
                    <Line
                      type="monotone"
                      dataKey="mensagens"
                      name="Mensagens"
                      stroke={CHART_COLORS.amber}
                      strokeWidth={2.5}
                      dot={{ fill: CHART_COLORS.amber, strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      animationDuration={1500}
                      animationEasing="ease-out"
                      animationBegin={600}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.teal }} />
                  <span className="text-xs text-muted-foreground">Tokens LLM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.slate }} />
                  <span className="text-xs text-muted-foreground">Composições</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS.amber }} />
                  <span className="text-xs text-muted-foreground">Mensagens</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
