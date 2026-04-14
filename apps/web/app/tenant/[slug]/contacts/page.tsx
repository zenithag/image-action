"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Plus, MoreVertical, Phone, MessageSquare, Calendar, Eye, Edit, Trash2, X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Contact {
  id: string
  name: string
  phone: string
  conversationsCount: number
  lastContact: string
}

const mockContacts: Contact[] = [
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
  const [searchQuery, setSearchQuery] = useState("")
  
  const filteredContacts = mockContacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  )

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
        <Button className="font-sans rounded-[5px]">
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              {filteredContacts.map((contact) => (
                <ContactTableRow key={contact.id} contact={contact} />
              ))}
            </tbody>
          </table>
          {filteredContacts.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-muted-foreground italic">Nenhum contato encontrado...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactTableRow({ contact }: { contact: Contact }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  return (
    <>
      <tr className="group transition-colors hover:bg-primary/[0.02]">
        <td className="px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
              {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <p className="text-sm font-bold text-foreground font-display group-hover:text-primary transition-colors">{contact.name}</p>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-sans">
            <Calendar className="h-3.5 w-3.5 text-primary/70" />
            {contact.lastContact}
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="relative inline-block" ref={menuRef}>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn("h-9 w-9 rounded-[5px] transition-all", menuOpen ? "bg-primary/10 text-primary" : "hover:bg-primary/10 hover:text-primary")}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            
            {menuOpen && (
              <div className="absolute right-0 top-10 z-50 min-w-[180px] origin-top-right rounded-[6px] border border-border bg-card p-1 shadow-xl animate-in fade-in zoom-in duration-150">
                <button onClick={() => { setDetailOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-[4px] hover:bg-primary/10 hover:text-primary transition-colors">
                  <Eye className="h-3.5 w-3.5" /> Ver Detalhes
                </button>
                <button onClick={() => { setEditOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-[4px] hover:bg-primary/10 hover:text-primary transition-colors">
                  <Edit className="h-3.5 w-3.5" /> Editar Contato
                </button>
                <div className="my-1 border-t border-border" />
                <button onClick={() => { setDeleteOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-destructive rounded-[4px] hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {detailOpen && <ContactDetailsModal contact={contact} onClose={() => setDetailOpen(false)} />}
      {editOpen && <ContactEditModal contact={contact} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <ConfirmDeleteContactModal contactName={contact.name} onClose={() => setDeleteOpen(false)} />}
    </>
  )
}

const mockContactDetails: Record<string, {
  email?: string
  tags: string[]
  compositions: { id: string; product: string; mode: string; status: string; date: string; image: string }[]
  productsOfInterest: { name: string; category: string; interactions: number; image: string }[]
}> = {
  "1": {
    email: "maria.silva@email.com",
    tags: ["VIP", "Recorrente"],
    compositions: [
      { id: "c1", product: "Tinta Azul Petróleo", mode: "Interiores", status: "done", date: "Hoje, 14:36", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=80&h=80&fit=crop" },
      { id: "c2", product: "Porcelanato Carrara", mode: "Interiores", status: "done", date: "Ontem, 10:21", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=80&h=80&fit=crop" },
      { id: "c3", product: "Sofá Modular Cinza", mode: "Interiores", status: "failed", date: "3 dias atrás", image: "" },
    ],
    productsOfInterest: [
      { name: "Tinta Azul Petróleo", category: "Tintas", interactions: 3, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=60&h=60&fit=crop" },
      { name: "Porcelanato Carrara", category: "Pisos", interactions: 2, image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=60&h=60&fit=crop" },
      { name: "Sofá Modular Cinza", category: "Móveis", interactions: 1, image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=60&h=60&fit=crop" },
    ],
  },
  "2": {
    tags: ["Lead Frio"],
    compositions: [
      { id: "c4", product: "Revestimento 3D Wave", mode: "Interiores", status: "done", date: "Hoje, 14:20", image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=80&h=80&fit=crop" },
    ],
    productsOfInterest: [
      { name: "Revestimento 3D Wave", category: "Revestimentos", interactions: 2, image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=60&h=60&fit=crop" },
    ],
  },
}

const genericDetails = {
  tags: [],
  compositions: [],
  productsOfInterest: [],
}

function ContactDetailsModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const details = mockContactDetails[contact.id] ?? genericDetails
  const initials = contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-[10px] bg-card shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-5 p-6 border-b border-border bg-muted/20">
          <div className="h-16 w-16 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold border border-primary/20">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold font-display">{contact.name}</h2>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
            {details.email && <p className="text-xs text-muted-foreground">{details.email}</p>}
            <div className="flex gap-2 mt-2">
              {details.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">{tag}</span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/10">
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-primary">{contact.conversationsCount}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Conversas</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-primary">{details.compositions.length}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Gerações</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-2xl font-bold text-primary">{details.productsOfInterest.length}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mt-1">Produtos Vistos</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Composition History */}
          <div className="p-6 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Histórico de Gerações</h3>
            {details.compositions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma geração ainda.</p>
            ) : (
              <div className="space-y-3">
                {details.compositions.map(comp => (
                  <div key={comp.id} className="flex items-center gap-4 p-3 rounded-[6px] border border-border bg-muted/10 hover:border-primary/30 transition-colors">
                    {comp.image ? (
                      <img src={comp.image} alt={comp.product} className="h-12 w-12 rounded-[4px] object-cover border border-border shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-[4px] bg-muted border border-dashed border-border flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-muted-foreground">N/A</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{comp.product}</p>
                      <p className="text-xs text-muted-foreground">{comp.mode} · {comp.date}</p>
                    </div>
                    <span className={cn(
                      "shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                      comp.status === "done" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    )}>
                      {comp.status === "done" ? "Concluído" : "Falhou"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Products of Interest */}
          <div className="p-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Produtos de Interesse</h3>
            {details.productsOfInterest.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum produto identificado ainda.</p>
            ) : (
              <div className="space-y-3">
                {details.productsOfInterest.map(prod => (
                  <div key={prod.name} className="flex items-center gap-4">
                    <img src={prod.image} alt={prod.name} className="h-10 w-10 rounded-[4px] object-cover border border-border shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">{prod.name}</p>
                      <p className="text-xs text-muted-foreground">{prod.category}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-primary">{prod.interactions}</p>
                      <p className="text-[10px] text-muted-foreground">interações</p>
                    </div>
                    <div className="shrink-0 w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(prod.interactions / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-5 border-t border-border bg-muted/10">
          <Button className="flex-1 font-sans py-5">Ir para Conversa</Button>
          <Button variant="outline" onClick={onClose} className="flex-1 font-sans py-5">Fechar</Button>
        </div>
      </div>
    </div>
  )
}

function ContactEditModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-[10px] bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-6 font-display">Editar Contato</h2>
        <div className="space-y-4 mb-8">
          <div><label className="text-[10px] font-bold uppercase opacity-40 block mb-1">Nome Completo</label><input defaultValue={contact.name} className="w-full bg-muted/50 border rounded-[5px] px-3 py-2 text-sm" /></div>
          <div><label className="text-[10px] font-bold uppercase opacity-40 block mb-1">WhatsApp</label><input defaultValue={contact.phone} className="w-full bg-muted/50 border rounded-[5px] px-3 py-2 text-sm" /></div>
        </div>
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={onClose}>Salvar</Button></div>
      </div>
    </div>
  )
}

function ConfirmDeleteContactModal({ contactName, onClose }: { contactName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-xs rounded-[10px] bg-card p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
        <div className="mx-auto bg-destructive/10 text-destructive h-12 w-12 rounded-full flex items-center justify-center mb-4"><Trash2 size={24}/></div>
        <h2 className="font-bold mb-2">Excluir Contato</h2>
        <p className="text-xs text-muted-foreground mb-6">Tem certeza que deseja remover <strong>{contactName}</strong> dos seus contatos?</p>
        <div className="flex flex-col gap-2"><Button variant="destructive" onClick={onClose}>Excluir</Button><Button variant="outline" onClick={onClose}>Voltar</Button></div>
      </div>
    </div>
  )
}
