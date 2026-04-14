"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Filter, Plus, MoreVertical, Tag, Edit, Power, Trash2, CheckCircle, Square, CheckSquare, X, ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CatalogItem {
  id: string
  name: string
  description: string
  category: string
  sku?: string
  status: "active" | "inactive"
  tags: Record<string, string>
  image: string
}

const mockCategories = [
  { id: "all", name: "Todos", count: 24 },
  { id: "tintas", name: "Tintas", count: 8 },
  { id: "revestimentos", name: "Revestimentos", count: 6 },
  { id: "pisos", name: "Pisos", count: 5 },
  { id: "moveis", name: "Móveis", count: 3 },
  { id: "objetos", name: "Objetos", count: 2 },
]

const mockItems: CatalogItem[] = [
  {
    id: "1",
    name: "Tinta Azul Petróleo",
    description: "Tom profundo e elegante para ambientes sofisticados",
    category: "Tintas",
    sku: "TIN-001",
    status: "active",
    tags: { cor: "Azul", acabamento: "Fosco", marca: "Suvinil" },
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
  },
  {
    id: "2",
    name: "Tinta Azul Serenity",
    description: "Tom suave e relaxante para quartos e salas",
    category: "Tintas",
    sku: "TIN-002",
    status: "active",
    tags: { cor: "Azul Claro", acabamento: "Acetinado", marca: "Coral" },
    image: "https://images.unsplash.com/photo-1525909002-1b05e0c869d8?w=400&h=400&fit=crop",
  },
  {
    id: "3",
    name: "Porcelanato Carrara",
    description: "Porcelanato polido que reproduz o mármore italiano",
    category: "Pisos",
    sku: "PIS-001",
    status: "active",
    tags: { cor: "Branco", material: "Porcelanato", dimensao: "60x120cm" },
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=400&fit=crop",
  },
  {
    id: "4",
    name: "Revestimento 3D Wave",
    description: "Revestimento tridimensional para paredes de destaque",
    category: "Revestimentos",
    sku: "REV-001",
    status: "active",
    tags: { cor: "Branco", material: "Gesso", estilo: "Moderno" },
    image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=400&h=400&fit=crop",
  },
  {
    id: "5",
    name: "Sofá Modular Cinza",
    description: "Sofá modular em tecido suede com configuração flexível",
    category: "Móveis",
    sku: "MOV-001",
    status: "active",
    tags: { cor: "Cinza", material: "Suede", estilo: "Contemporâneo" },
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop",
  },
  {
    id: "6",
    name: "Piso Vinílico Madeira",
    description: "Piso vinílico que reproduz madeira natural",
    category: "Pisos",
    sku: "PIS-002",
    status: "active",
    tags: { cor: "Madeira", material: "Vinílico", dimensao: "20x120cm" },
    image: "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=400&h=400&fit=crop",
  },
]

export function CatalogBrowser() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState({
    status: [] as string[],
    tags: {} as Record<string, string[]>,
  })

  const allTagKeys = Array.from(new Set(mockItems.flatMap(item => Object.keys(item.tags))))
  const tagOptions: Record<string, string[]> = {}
  allTagKeys.forEach(key => {
    tagOptions[key] = Array.from(new Set(mockItems.map(item => item.tags[key]).filter(Boolean)))
  })

  const filteredItems = mockItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory =
      selectedCategory === "all" ||
      item.category.toLowerCase() === selectedCategory.toLowerCase()

    const matchesStatus =
      activeFilters.status.length === 0 ||
      activeFilters.status.includes(item.status)

    const matchesTags = Object.entries(activeFilters.tags).every(([key, values]) => {
      if (values.length === 0) return true
      return values.includes(item.tags[key])
    })

    return matchesSearch && matchesCategory && matchesStatus && matchesTags
  })

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map((item) => item.id))
    }
  }

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Catálogo de Produtos</h1>
          <p className="text-sm text-muted-foreground font-sans">Gerencie os itens para composição visual</p>
        </div>
        <Button className="font-sans">
          <Plus className="mr-2 h-4 w-4" /> Novo Item
        </Button>
      </div>

      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[5px] border border-input bg-card px-4 py-2 pl-10 text-sm font-sans"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="font-sans ml-auto">
          <Filter className="mr-2 h-4 w-4" /> Filtros
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {filtersOpen && (
          <div className="absolute inset-y-0 right-0 z-50 w-80 border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-bold flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Filtros</h3>
              <button onClick={() => setFiltersOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {["active", "inactive"].map(s => (
                    <button key={s} onClick={() => setActiveFilters(prev => ({ ...prev, status: prev.status.includes(s) ? prev.status.filter(x => x !== s) : [...prev.status, s] }))} className={cn("rounded-[5px] border px-3 py-1 text-xs font-sans", activeFilters.status.includes(s) ? "bg-primary text-white" : "text-muted-foreground hover:border-primary/50")}>
                      {s === "active" ? "Ativos" : "Inativos"}
                    </button>
                  ))}
                </div>
              </div>
              {Object.entries(tagOptions).map(([key, options]) => (
                <div key={key} className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{key}</h4>
                  <div className="flex flex-wrap gap-2">
                    {options.map(o => (
                      <button key={o} onClick={() => { const current = activeFilters.tags[key] || []; setActiveFilters(prev => ({ ...prev, tags: { ...prev.tags, [key]: current.includes(o) ? current.filter(x => x !== o) : [...current, o] } })) }} className={cn("rounded-[5px] border px-3 py-1 text-xs font-sans", (activeFilters.tags[key] || []).includes(o) ? "bg-primary/10 text-primary border-primary" : "text-muted-foreground")}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t"><Button variant="outline" className="w-full text-xs" onClick={() => setActiveFilters({ status: [], tags: {} })}>Limpar Filtros</Button></div>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-40 flex items-center gap-4 bg-primary/10 border-b border-primary/20 px-6 py-3 backdrop-blur-md">
            <span className="text-sm font-bold text-primary mr-4">{selectedIds.length} selecionados</span>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds([])} className="h-8 text-xs"><CheckCircle className="mr-2 h-3 w-3" /> Ativar</Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds([])} className="h-8 text-xs"><Power className="mr-2 h-3 w-3" /> Desativar</Button>
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Excluir?")) setSelectedIds([]) }} className="h-8 text-xs text-destructive hover:bg-destructive hover:text-white"><Trash2 className="mr-2 h-3 w-3" /> Excluir</Button>
            <button onClick={() => setSelectedIds([])} className="ml-auto text-xs text-muted-foreground">Cancelar</button>
          </div>
        )}

        <div className="w-60 border-r border-border p-4 bg-card/30">
          <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3">Categorias</h3>
          {mockCategories.map(c => (
            <button key={c.id} onClick={() => setSelectedCategory(c.id)} className={cn("flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-sm font-sans mb-1", selectedCategory === c.id ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-primary/5")}>
              <span>{c.name}</span><span className="text-[10px] opacity-60">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-16 scrollbar-hide">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
              {selectedIds.length > 0 && selectedIds.length === filteredItems.length ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
              {selectedIds.length > 0 ? "Desmarcar tudo" : "Selecionar tudo"}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map(item => (
              <ProductCard key={item.id} item={item} isSelected={selectedIds.includes(item.id)} onToggleSelect={() => toggleSelectItem(item.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductCard({ item, isSelected, onToggleSelect }: { item: CatalogItem; isSelected: boolean; onToggleSelect: () => void }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [status, setStatus] = useState<"active" | "inactive">(item.status)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  return (
    <>
      <div className={cn("group relative overflow-hidden rounded-[5px] border transition-all duration-300", isSelected ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40")}>
        <div onClick={onToggleSelect} className={cn("absolute left-3 top-3 z-30 cursor-pointer rounded-[4px] p-1.5 backdrop-blur-md", isSelected ? "bg-primary text-white" : "bg-black/20 text-white/80 opacity-0 group-hover:opacity-100")}>
          {isSelected ? <CheckCircle className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </div>
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img src={item.image} alt={item.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
        <div ref={menuRef} className="absolute right-2 top-2 z-40">
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-[5px] bg-background/90 p-2 shadow-sm text-foreground hover:bg-background"><MoreVertical className="h-4 w-4" /></button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-40 min-w-[160px] rounded-[6px] border border-border bg-card shadow-xl p-1">
              <button onClick={() => { setEditOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-[4px] hover:bg-muted"><Edit className="h-3.5 w-3.5" /> Editar</button>
              <button onClick={() => { setStatus(s => s === "active" ? "inactive" : "active"); setMenuOpen(false) }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm rounded-[4px] hover:bg-muted"><span className="flex items-center gap-3"><Power className="h-3.5 w-3.5" /> {status === "active" ? "Desativar" : "Ativar"}</span></button>
              <div className="my-1 border-t" />
              <button onClick={() => { setDeleteOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-destructive rounded-[4px] hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div><h4 className="font-bold font-display group-hover:text-primary">{item.name}</h4><p className="text-[10px] text-muted-foreground uppercase">{item.category}</p></div>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{status === "active" ? "Ativo" : "Inativo"}</span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground font-sans mb-3">{item.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(item.tags).slice(0, 3).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-secondary text-[9px] font-bold text-secondary-foreground"><Tag className="h-2.5 w-2.5" />{v}</span>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3"><span className="text-[10px] font-bold opacity-40">SKU: {item.sku}</span><button onClick={() => setDetailOpen(true)} className="text-xs font-bold text-primary hover:underline">Detalhes</button></div>
        </div>
      </div>
      {detailOpen && <ProductDetailModal item={{ ...item, status }} onClose={() => setDetailOpen(false)} />}
      {editOpen && <ProductEditModal item={item} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <ConfirmDeleteModal itemName={item.name} onClose={() => setDeleteOpen(false)} onConfirm={() => setDeleteOpen(false)} />}
    </>
  )
}

function ProductDetailModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[8px] border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="relative h-64 bg-muted">
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          <button onClick={onClose} className="absolute right-4 top-4 bg-background/80 p-2 rounded-[5px]"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">
          <h2 className="text-xl font-bold font-display">{item.name}</h2>
          <p className="text-sm text-muted-foreground mb-4">{item.category}</p>
          <div className="mb-6"><p className="text-[10px] font-bold uppercase opacity-40 mb-1">Descrição</p><p className="text-sm leading-relaxed">{item.description}</p></div>
          <div className="mb-8"><p className="text-[10px] font-bold uppercase opacity-40 mb-2">Atributos</p><div className="flex flex-wrap gap-2">{Object.entries(item.tags).map(([k, v]) => (<div key={k} className="bg-secondary rounded-[4px] px-3 py-1.5 flex items-center gap-2"><span className="text-[10px] opacity-60 uppercase">{k}:</span><span className="text-xs font-bold">{v}</span></div>))}</div></div>
          <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Fechar</Button><Button>Usar este produto</Button></div>
        </div>
      </div>
    </div>
  )
}

function ProductEditModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const [f, setF] = useState({ name: item.name, desc: item.description, cat: item.category, sku: item.sku || "" })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-[8px] bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6 font-display">Editar</h2>
        <div className="space-y-4 mb-8">
          <div><label className="text-[10px] font-bold uppercase opacity-40 block mb-1">Nome</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="w-full bg-muted/50 border rounded-[5px] px-3 py-2 text-sm" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold uppercase opacity-40 block mb-1">Categoria</label><input value={f.cat} className="w-full bg-muted/50 border rounded-[5px] px-3 py-2 text-sm" /></div>
            <div><label className="text-[10px] font-bold uppercase opacity-40 block mb-1">SKU</label><input value={f.sku} className="w-full bg-muted/50 border rounded-[5px] px-3 py-2 text-sm" /></div>
          </div>
          <div><label className="text-[10px] font-bold uppercase opacity-40 block mb-1">Descrição</label><textarea value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} className="w-full bg-muted/50 border rounded-[5px] px-3 py-2 text-sm h-24 resize-none" /></div>
        </div>
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={onClose}>Salvar Alterações</Button></div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ itemName, onClose, onConfirm }: { itemName: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-[8px] bg-card p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
        <div className="mx-auto bg-destructive/10 text-destructive h-12 w-12 rounded-full flex items-center justify-center mb-4"><Trash2 className="h-6 w-6" /></div>
        <h2 className="text-lg font-bold mb-2 font-display">Excluir Produto</h2>
        <p className="text-sm text-muted-foreground mb-8 font-sans">Deseja excluir permanentemente <strong>{itemName}</strong>?</p>
        <div className="flex flex-col gap-2"><Button variant="destructive" onClick={onConfirm}>Sim, excluir</Button><Button variant="outline" onClick={onClose}>Cancelar</Button></div>
      </div>
    </div>
  )
}
