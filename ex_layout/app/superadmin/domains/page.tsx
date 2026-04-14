"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Globe } from "lucide-react"

const mockDomains = [
  {
    id: "1",
    domain: "empresa.com.br",
    tenant: "Empresa A",
    status: "ativo",
    sslStatus: "válido",
    createdAt: "10 de janeiro de 2025",
    expiresAt: "10 de janeiro de 2026",
  },
  {
    id: "2",
    domain: "loja.com.br",
    tenant: "Empresa B",
    status: "ativo",
    sslStatus: "válido",
    createdAt: "15 de fevereiro de 2025",
    expiresAt: "15 de fevereiro de 2026",
  },
  {
    id: "3",
    domain: "antigo.com.br",
    tenant: "Empresa C",
    status: "inativo",
    sslStatus: "expirado",
    createdAt: "20 de março de 2024",
    expiresAt: "20 de março de 2025",
  },
]

export default function DomainsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="superadmin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Domínios</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie todos os domínios customizados dos tenants
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Domínio
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="border-b border-border bg-card px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar domínio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="border-b border-border bg-card">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                      Domínio
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                      Tenant
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                      SSL
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground">
                      Vencimento
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockDomains.map((domain) => (
                    <tr key={domain.id} className="bg-background hover:bg-card/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{domain.domain}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{domain.tenant}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            domain.status === "ativo"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {domain.status === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {domain.sslStatus === "válido" ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600">Válido</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <span className="text-sm text-red-600">Expirado</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{domain.expiresAt}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
