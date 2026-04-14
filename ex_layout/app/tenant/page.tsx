"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, TrendingUp, Users, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const conversationData = [
  { date: "Seg", conversations: 12, messages: 45 },
  { date: "Ter", conversations: 19, messages: 65 },
  { date: "Qua", conversations: 15, messages: 52 },
  { date: "Qui", conversations: 22, messages: 78 },
  { date: "Sex", conversations: 28, messages: 95 },
  { date: "Sab", conversations: 8, messages: 25 },
  { date: "Dom", conversations: 5, messages: 18 },
]

const compositionData = [
  { date: "Seg", compositions: 5, successful: 4 },
  { date: "Ter", compositions: 8, successful: 7 },
  { date: "Qua", compositions: 6, successful: 5 },
  { date: "Qui", compositions: 10, successful: 9 },
  { date: "Sex", compositions: 12, successful: 11 },
  { date: "Sab", compositions: 3, successful: 3 },
  { date: "Dom", compositions: 2, successful: 2 },
]

const contactsData = [
  { date: "Seg", newContacts: 5, total: 125 },
  { date: "Ter", newContacts: 8, total: 133 },
  { date: "Qua", newContacts: 4, total: 137 },
  { date: "Qui", newContacts: 12, total: 149 },
  { date: "Sex", newContacts: 10, total: 159 },
  { date: "Sab", newContacts: 2, total: 161 },
  { date: "Dom", newContacts: 1, total: 162 },
]

export default function TenantDashboard() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Bem-vindo! Aqui está um resumo do seu desempenho</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Conversas Ativas</p>
                      <p className="mt-2 text-3xl font-bold text-foreground">248</p>
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600">
                        <ArrowUpRight className="h-3 w-3" />
                        +12% desde ontem
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Composições Geradas</p>
                      <p className="mt-2 text-3xl font-bold text-foreground">1,204</p>
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600">
                        <ArrowUpRight className="h-3 w-3" />
                        +8% desde ontem
                      </div>
                    </div>
                    <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600">
                      <Zap className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Novos Contatos</p>
                      <p className="mt-2 text-3xl font-bold text-foreground">162</p>
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600">
                        <ArrowUpRight className="h-3 w-3" />
                        +5% desde ontem
                      </div>
                    </div>
                    <div className="rounded-lg bg-green-500/10 p-2 text-green-600">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                      <p className="mt-2 text-3xl font-bold text-foreground">32.5%</p>
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                        <ArrowDownRight className="h-3 w-3" />
                        -2% desde ontem
                      </div>
                    </div>
                    <div className="rounded-lg bg-orange-500/10 p-2 text-orange-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
              {/* Conversations Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Conversas (últimos 7 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={conversationData}>
                      <defs>
                        <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Area
                        type="monotone"
                        dataKey="conversations"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorConversations)"
                        name="Conversas"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Compositions Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Composições (últimos 7 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={compositionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Legend />
                      <Bar dataKey="compositions" fill="hsl(var(--primary))" name="Total" />
                      <Bar dataKey="successful" fill="hsl(var(--accent))" name="Bem-sucedidas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Contacts Growth Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Crescimento de Contatos (últimos 7 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={contactsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="newContacts"
                      stroke="hsl(var(--secondary))"
                      strokeWidth={2}
                      name="Novos Contatos"
                      dot={{ fill: "hsl(var(--secondary))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Total Acumulado"
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
