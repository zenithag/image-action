"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Search, Plus, MoreVertical, Phone, MessageSquare, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"

const mockContacts = [
  {
    id: "1",
    name: "Maria Silva",
    phone: "+55 11 99999-1234",
    conversationsCount: 5,
    lastContact: "Hoje, 14:35",
  },
  {
    id: "2",
    name: "Carlos Santos",
    phone: "+55 21 98888-5678",
    conversationsCount: 3,
    lastContact: "Hoje, 14:20",
  },
  {
    id: "3",
    name: "Ana Costa",
    phone: "+55 31 97777-9012",
    conversationsCount: 8,
    lastContact: "Ontem, 18:45",
  },
  {
    id: "4",
    name: "Pedro Oliveira",
    phone: "+55 41 96666-3456",
    conversationsCount: 2,
    lastContact: "Hoje, 14:40",
  },
  {
    id: "5",
    name: "Julia Ferreira",
    phone: "+55 51 95555-7890",
    conversationsCount: 12,
    lastContact: "Hoje, 11:30",
  },
  {
    id: "6",
    name: "Roberto Lima",
    phone: "+55 61 94444-2345",
    conversationsCount: 1,
    lastContact: "3 dias atrás",
  },
]

export default function ContactsPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Contatos</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os contatos que interagiram com sua empresa
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Importar Contatos
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar contatos..."
              className="w-full rounded-lg border border-input bg-input py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead className="bg-card">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Telefone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Conversas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Último Contato
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockContacts.map((contact) => (
                  <tr key={contact.id} className="bg-background hover:bg-card/50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <p className="font-medium text-foreground">{contact.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {contact.conversationsCount}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {contact.lastContact}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
