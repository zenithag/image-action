"use client"

import { Search, Plus, MoreVertical, Phone, MessageSquare, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Contatos</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Gerencie os contatos que interagiram com sua empresa
          </p>
        </div>
        <Button className="font-sans rounded-[5px] shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0">
          <Plus className="mr-2 h-4 w-4" />
          Importar Contatos
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border px-6 py-3 bg-card/30">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar contatos..."
            className="w-full rounded-[5px] border border-input bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-6xl mx-auto overflow-hidden rounded-[5px] border border-border bg-card shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Contato
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Telefone
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Conversas
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Último Contato
                </th>
                <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-sans">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockContacts.map((contact) => (
                <tr key={contact.id} className="group transition-colors hover:bg-primary/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 border border-border/50 shadow-sm">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <p className="text-sm font-medium text-foreground font-display group-hover:text-primary transition-colors">{contact.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
                      <Phone className="h-3.5 w-3.5 text-primary/70" />
                      {contact.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
                      <MessageSquare className="h-3.5 w-3.5 text-primary/70" />
                      <span className="font-medium text-foreground">{contact.conversationsCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans text-nowrap">
                      <Calendar className="h-3.5 w-3.5 text-primary/70" />
                      {contact.lastContact}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[5px] hover:bg-primary/10 hover:text-primary transition-all">
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
  )
}
