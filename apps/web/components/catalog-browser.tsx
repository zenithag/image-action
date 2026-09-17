"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Edit,
  Filter,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Plus,
  Power,
  Search,
  Square,
  Tag,
  Trash2,
  X,
} from "lucide-react"

import { SafeImage } from "@/components/safe-image"
import { Button } from "@/components/ui/button"
import type { CatalogItem, CatalogItemInput, CatalogItemStatus } from "@/lib/catalog-types"
import { cn } from "@/lib/utils"

type ProductFormValues = {
  name: string
  description: string
  category: string
  sku: string
  productType: string
  usageMode: string
  tagsText: string
  imageUrl: string
}

type CatalogImportPreview = {
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
  }
  rows: Array<{
    rowNumber: number
    raw: Record<string, string>
    normalized: CatalogItemInput | null
    errors: string[]
  }>
}

interface CatalogBrowserProps {
  tenantSlug: string
}

const RESERVED_CATALOG_TAG_KEYS = ["product_type", "usage_mode"] as const

const PRODUCT_TYPE_OPTIONS = [
  { value: "tinta", label: "Tinta" },
  { value: "revestimento", label: "Revestimento" },
  { value: "movel", label: "Móvel" },
  { value: "roupa", label: "Roupa" },
  { value: "automotivo", label: "Automotivo" },
  { value: "decoracao", label: "Decoração" },
  { value: "outro", label: "Outro" },
] as const

const USAGE_MODE_OPTIONS = [
  { value: "catalogo", label: "Produto de catálogo" },
  { value: "referencia", label: "Imagem de referência" },
] as const

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function readImageAsDataUrl(file: File) {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("A imagem precisa ter no maximo 2MB.")
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Envie um arquivo de imagem valido.")
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."))
    reader.readAsDataURL(file)
  })
}

async function readFileAsText(file: File) {
  return file.text()
}

function parseTags(value: string) {
  return Object.fromEntries(
    value
      .split(/\r?\n|\\n|,/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split(":")
        return [key?.trim(), rest.join(":").trim()]
      })
      .filter(([key, tagValue]) => key && tagValue)
  )
}

function formatTags(tags: Record<string, string>) {
  return Object.entries(tags)
    .filter(([key]) => !RESERVED_CATALOG_TAG_KEYS.includes(key as typeof RESERVED_CATALOG_TAG_KEYS[number]))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")
}

function productToFormValues(item?: CatalogItem): ProductFormValues {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    category: item?.category ?? "Tintas",
    sku: item?.sku ?? "",
    productType: item?.tags.product_type ?? "outro",
    usageMode: item?.tags.usage_mode ?? "catalogo",
    tagsText: item ? formatTags(item.tags) : "",
    imageUrl: item?.imageUrl ?? "",
  }
}

function formValuesToPayload(values: ProductFormValues): CatalogItemInput {
  const tags = {
    ...parseTags(values.tagsText),
    product_type: values.productType,
    usage_mode: values.usageMode,
  }

  return {
    name: values.name,
    description: values.description,
    category: values.category,
    sku: values.sku,
    tags,
    imageUrl: values.imageUrl,
  }
}

function getProductTypeLabel(value?: string) {
  return PRODUCT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Outro"
}

function getUsageModeLabel(value?: string) {
  return USAGE_MODE_OPTIONS.find((option) => option.value === value)?.label ?? "Produto de catálogo"
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisicao invalida."
    throw new Error(errorMessage)
  }

  return payload as T
}

export function CatalogBrowser({ tenantSlug }: CatalogBrowserProps) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<CatalogImportPreview | null>(null)
  const [importFileName, setImportFileName] = useState("")
  const [importCsvText, setImportCsvText] = useState("")
  const [activeFilters, setActiveFilters] = useState({
    status: [] as CatalogItemStatus[],
    tags: {} as Record<string, string[]>,
  })

  async function loadItems() {
    setIsLoading(true)
    setError(null)

    try {
      const data = await requestJson<CatalogItem[]>(`/api/tenant/${tenantSlug}/catalog/items`, { cache: "no-store" })
      setItems(data)
      setSelectedIds((current) => current.filter((id) => data.some((item) => item.id === id)))
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Erro ao carregar produtos."))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [tenantSlug])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1))

    return [
      { id: "all", name: "Todos", count: items.length },
      ...Array.from(counts.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, count]) => ({ id: name, name, count })),
    ]
  }, [items])

  const categoryNames = useMemo(() => categories.filter((item) => item.id !== "all").map((item) => item.name), [categories])

  const tagOptions = useMemo(() => {
    const options: Record<string, Set<string>> = {}
    items.forEach((item) => {
      Object.entries(item.tags).forEach(([key, value]) => {
        options[key] ??= new Set()
        options[key].add(value)
      })
    })

    return Object.fromEntries(
      Object.entries(options).map(([key, values]) => [key, Array.from(values).sort()])
    ) as Record<string, string[]>
  }, [items])

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch) ||
        item.sku?.toLowerCase().includes(normalizedSearch)

      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
      const matchesStatus = activeFilters.status.length === 0 || activeFilters.status.includes(item.status)
      const matchesTags = Object.entries(activeFilters.tags).every(([key, values]) =>
        values.length === 0 || values.includes(item.tags[key])
      )

      return matchesSearch && matchesCategory && matchesStatus && matchesTags
    })
  }, [activeFilters, items, searchQuery, selectedCategory])

  function toggleSelectAll() {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([])
      return
    }

    setSelectedIds(filteredItems.map((item) => item.id))
  }

  function toggleSelectItem(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id])
  }

  async function createItem(payload: CatalogItemInput) {
    const item = await requestJson<CatalogItem>(`/api/tenant/${tenantSlug}/catalog/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
    setItems((current) => [item, ...current])
  }

  async function updateItem(id: string, payload: Partial<CatalogItemInput>) {
    const item = await requestJson<CatalogItem>(`/api/tenant/${tenantSlug}/catalog/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
    setItems((current) => current.map((currentItem) => currentItem.id === id ? item : currentItem))
  }

  async function deleteItem(id: string) {
    await requestJson<{ ok: true }>(`/api/tenant/${tenantSlug}/catalog/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    setItems((current) => current.filter((item) => item.id !== id))
    setSelectedIds((current) => current.filter((itemId) => itemId !== id))
  }

  async function bulkAction(action: { status?: CatalogItemStatus; delete?: boolean }) {
    if (selectedIds.length === 0 || isMutating) return
    if (action.delete && !window.confirm("Excluir produtos selecionados?")) return

    setIsMutating(true)
    setError(null)

    try {
      await requestJson<{ ok: true }>(`/api/tenant/${tenantSlug}/catalog/items/bulk`, {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds, ...action }),
      })
      setSelectedIds([])
      await loadItems()
    } catch (bulkError) {
      setError(getErrorMessage(bulkError, "Erro na acao em lote."))
    } finally {
      setIsMutating(false)
    }
  }

  async function exportCsv() {
    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/catalog/items/export`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Nao foi possivel exportar o CSV.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `${tenantSlug}-catalogo.csv`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (exportError) {
      setError(getErrorMessage(exportError, "Erro ao exportar o catálogo."))
    } finally {
      setIsExporting(false)
    }
  }

  async function previewImport(csvText: string, fileName: string) {
    setIsImporting(true)
    setError(null)

    try {
      const preview = await requestJson<CatalogImportPreview>(`/api/tenant/${tenantSlug}/catalog/items/import`, {
        method: "POST",
        body: JSON.stringify({ csvText, mode: "preview" }),
      })
      setImportCsvText(csvText)
      setImportFileName(fileName)
      setImportPreview(preview)
      setImportOpen(true)
    } catch (importError) {
      setError(getErrorMessage(importError, "Erro ao analisar o CSV."))
    } finally {
      setIsImporting(false)
    }
  }

  async function applyImport() {
    if (!importCsvText) return

    setIsImporting(true)
    setError(null)

    try {
      await requestJson<{ importedItems: CatalogItem[] }>(`/api/tenant/${tenantSlug}/catalog/items/import`, {
        method: "POST",
        body: JSON.stringify({ csvText: importCsvText, mode: "import" }),
      })
      setImportOpen(false)
      setImportPreview(null)
      setImportCsvText("")
      setImportFileName("")
      await loadItems()
    } catch (importError) {
      setError(getErrorMessage(importError, "Erro ao importar o CSV."))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-8">
        <div className="flex flex-col">
          <h1 className="font-mono text-[13px] font-semibold tracking-tight text-foreground">catálogo</h1>
          <p className="text-[10px] leading-none text-muted-foreground">biblioteca · {items.length} itens</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => void exportCsv()} disabled={isLoading || isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            csv
          </Button>
          <label className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded border border-input bg-background px-3 py-1.5 text-[11px] font-medium transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground h-8",
            (isLoading || isImporting) && "pointer-events-none opacity-50",
          )}>
            {isImporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            import
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return

                void readFileAsText(file).then((csvText) => previewImport(csvText, file.name))
                event.currentTarget.value = ""
              }}
            />
          </label>
          <Button size="sm" className="h-8 text-[11px]" onClick={() => setCreateOpen(true)} disabled={isLoading}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> novo
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-8 py-2.5">
        <div className="relative flex-1" style={{ maxWidth: 380 }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="buscar por nome ou SKU"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded border border-input bg-background py-1.5 pl-9 pr-3 text-[12px] outline-none focus:border-primary"
          />
        </div>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              "rounded border px-2.5 py-1 text-[10px] font-medium transition-colors",
              selectedCategory === category.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {category.name}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filteredItems.length} itens</span>
      </div>

      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {filtersOpen && (
          <div className="absolute inset-y-0 right-0 z-50 flex w-80 animate-in flex-col border-l border-border bg-card slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="flex items-center gap-2 font-bold"><Filter className="h-4 w-4 text-primary" /> Filtros</h3>
              <button onClick={() => setFiltersOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              <div className="space-y-3">
                <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {(["active", "inactive"] as CatalogItemStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setActiveFilters((current) => ({
                        ...current,
                        status: current.status.includes(status)
                          ? current.status.filter((item) => item !== status)
                          : [...current.status, status],
                      }))}
                      className={cn(
                        "rounded border px-3 py-1 text-xs font-sans",
                        activeFilters.status.includes(status)
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {status === "active" ? "Ativos" : "Inativos"}
                    </button>
                  ))}
                </div>
              </div>

              {Object.entries(tagOptions).map(([key, options]) => (
                <div key={key} className="space-y-3">
                  <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{key}</h4>
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          const currentValues = activeFilters.tags[key] || []
                          setActiveFilters((current) => ({
                            ...current,
                            tags: {
                              ...current.tags,
                              [key]: currentValues.includes(option)
                                ? currentValues.filter((value) => value !== option)
                                : [...currentValues, option],
                            },
                          }))
                        }}
                        className={cn(
                          "rounded border px-3 py-1 text-xs font-sans",
                          (activeFilters.tags[key] || []).includes(option)
                            ? "border-primary bg-primary/10 text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-4">
              <Button variant="outline" className="w-full text-xs" onClick={() => setActiveFilters({ status: [], tags: {} })}>
                Limpar Filtros
              </Button>
            </div>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="absolute left-0 right-0 top-0 z-40 flex items-center gap-4 border-b border-primary/20 bg-accent px-6 py-3">
            <span className="mr-4 text-sm font-bold text-primary">{selectedIds.length} selecionados</span>
            <Button variant="outline" size="sm" disabled={isMutating} onClick={() => void bulkAction({ status: "active" })} className="h-8 text-xs">
              <CheckCircle className="mr-2 h-3 w-3" /> Ativar
            </Button>
            <Button variant="outline" size="sm" disabled={isMutating} onClick={() => void bulkAction({ status: "inactive" })} className="h-8 text-xs">
              <Power className="mr-2 h-3 w-3" /> Desativar
            </Button>
            <Button variant="outline" size="sm" disabled={isMutating} onClick={() => void bulkAction({ delete: true })} className="h-8 text-xs text-destructive hover:bg-destructive hover:text-white">
              <Trash2 className="mr-2 h-3 w-3" /> Excluir
            </Button>
            <button onClick={() => setSelectedIds([])} className="ml-auto text-xs text-muted-foreground">Cancelar</button>
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto p-8 scrollbar-hide", selectedIds.length > 0 && "pt-16")}>
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
              {selectedIds.length > 0 && selectedIds.length === filteredItems.length ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
              {selectedIds.length > 0 ? "Desmarcar tudo" : "Selecionar tudo"}
            </button>
            <span className="text-xs text-muted-foreground">{filteredItems.length} produto(s)</span>
          </div>

          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Carregando catálogo...
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  categories={categoryNames}
                  isSelected={selectedIds.includes(item.id)}
                  onToggleSelect={() => toggleSelectItem(item.id)}
                  onDelete={deleteItem}
                  onUpdate={updateItem}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-border bg-card/40 text-center">
              <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
              <h3 className="font-bold text-foreground">Nenhum produto encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">Cadastre um produto ou ajuste os filtros.</p>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <ProductCreateModal
          categories={categoryNames}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            await createItem(payload)
            setCreateOpen(false)
          }}
        />
      )}

      {importOpen && importPreview && (
        <CatalogImportModal
          fileName={importFileName}
          preview={importPreview}
          isImporting={isImporting}
          onClose={() => {
            setImportOpen(false)
            setImportPreview(null)
            setImportCsvText("")
            setImportFileName("")
          }}
          onConfirm={() => void applyImport()}
        />
      )}
    </div>
  )
}

function ProductCard({
  item,
  categories,
  isSelected,
  onToggleSelect,
  onDelete,
  onUpdate,
}: {
  item: CatalogItem
  categories: string[]
  isSelected: boolean
  onToggleSelect: () => void
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, payload: Partial<CatalogItemInput>) => Promise<void>
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  async function toggleStatus() {
    setIsMutating(true)
    setError(null)

    try {
      await onUpdate(item.id, { status: item.status === "active" ? "inactive" : "active" })
    } catch (statusError) {
      setError(getErrorMessage(statusError, "Erro ao alterar status."))
    } finally {
      setIsMutating(false)
      setMenuOpen(false)
    }
  }

  return (
    <>
      <div className={cn("group relative overflow-hidden rounded border transition-all duration-300", isSelected ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40")}>
        <div onClick={onToggleSelect} className={cn("absolute left-3 top-3 z-30 cursor-pointer rounded bg-black/20 p-1.5", isSelected ? "bg-primary text-white" : "text-white/80 opacity-0 group-hover:opacity-100")}>
          {isSelected ? <CheckCircle className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </div>
        <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: "4/3" }}>
          <SafeImage
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            fallbackLabel="Sem imagem"
            fallbackHint="Adicione uma imagem no cadastro."
          />
          {item.sku && (
            <span className="absolute left-2.5 top-2.5 rounded border border-border/60 bg-background/90 px-2 py-0.5 font-mono text-[11px] text-foreground">
              {item.sku}
            </span>
          )}
        </div>
        <div ref={menuRef} className="absolute right-2 top-2 z-40">
          <button onClick={() => setMenuOpen((current) => !current)} className="rounded bg-background/90 p-2 text-foreground hover:bg-background">
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-40 min-w-[160px] rounded border border-border bg-card p-1">
              <button onClick={() => { setEditOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted">
                <Edit className="h-3.5 w-3.5" /> Editar
              </button>
              <button disabled={isMutating} onClick={() => void toggleStatus()} className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                <Power className="h-3.5 w-3.5" /> {item.status === "active" ? "Desativar" : "Ativar"}
              </button>
              <div className="my-1 border-t" />
              <button onClick={() => { setDeleteOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold font-display group-hover:text-primary">{item.name}</h4>
              <p className="text-[10px] uppercase text-muted-foreground">{item.category}</p>
            </div>
            <span className={cn("rounded px-2 py-0.5 text-[9px] font-bold uppercase", item.status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
              {item.status === "active" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-[4px] bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
              {getProductTypeLabel(item.tags.product_type)}
            </span>
            <span className={cn(
              "rounded-[4px] px-2 py-0.5 text-[9px] font-bold uppercase",
              item.tags.usage_mode === "referencia"
                ? "bg-amber-500/15 text-amber-700"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
            )}>
              {getUsageModeLabel(item.tags.usage_mode)}
            </span>
          </div>
          <p className="mb-3 line-clamp-2 text-xs text-muted-foreground font-sans">{item.description || "Sem descrição."}</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(item.tags)
              .filter(([key]) => !RESERVED_CATALOG_TAG_KEYS.includes(key as typeof RESERVED_CATALOG_TAG_KEYS[number]))
              .slice(0, 3)
              .map(([key, value]) => (
              <span key={key} className="flex items-center gap-1 rounded-[4px] bg-secondary px-2 py-0.5 text-[9px] font-bold text-secondary-foreground">
                <Tag className="h-2.5 w-2.5" />{value}
              </span>
            ))}
          </div>
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-mono text-sm font-medium">{item.sku || "—"}</span>
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold", item.status === "active" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-600")}>
              {item.status === "active" ? "em estoque" : "indisponível"}
            </span>
          </div>
        </div>
      </div>
      {detailOpen && <ProductDetailModal item={item} onClose={() => setDetailOpen(false)} />}
      {editOpen && (
        <ProductEditModal
          item={item}
          categories={categories}
          onClose={() => setEditOpen(false)}
          onSave={async (payload) => {
            await onUpdate(item.id, payload)
            setEditOpen(false)
          }}
        />
      )}
      {deleteOpen && (
        <ConfirmDeleteModal
          itemName={item.name}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async () => {
            await onDelete(item.id)
            setDeleteOpen(false)
          }}
        />
      )}
    </>
  )
}

function ProductDetailModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded border bg-card" onClick={(event) => event.stopPropagation()}>
        <div className="relative h-64 bg-muted">
          <SafeImage
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            fallbackLabel="Imagem indisponível"
            fallbackHint="Edite o produto para trocar a imagem."
          />
          <button onClick={onClose} className="absolute right-4 top-4 rounded bg-background/80 p-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">
          <h2 className="text-xl font-bold font-display">{item.name}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{item.category}</p>
          <div className="mb-6">
            <p className="mb-1 text-[11px] font-medium uppercase opacity-40">Descrição</p>
            <p className="text-sm leading-relaxed">{item.description || "Sem descrição."}</p>
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-border bg-muted/30 p-4">
              <p className="mb-1 text-[11px] font-medium uppercase opacity-40">Tipo do item</p>
              <p className="text-sm font-medium">{getProductTypeLabel(item.tags.product_type)}</p>
            </div>
            <div className="rounded border border-border bg-muted/30 p-4">
              <p className="mb-1 text-[11px] font-medium uppercase opacity-40">Modo de uso</p>
              <p className="text-sm font-medium">{getUsageModeLabel(item.tags.usage_mode)}</p>
            </div>
          </div>
          <div className="mb-8">
            <p className="mb-2 text-[11px] font-medium uppercase opacity-40">Atributos</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(item.tags).filter(([key]) => !RESERVED_CATALOG_TAG_KEYS.includes(key as typeof RESERVED_CATALOG_TAG_KEYS[number])).length > 0 ? Object.entries(item.tags)
                .filter(([key]) => !RESERVED_CATALOG_TAG_KEYS.includes(key as typeof RESERVED_CATALOG_TAG_KEYS[number]))
                .map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 rounded bg-secondary px-3 py-1.5">
                  <span className="text-[10px] uppercase opacity-60">{key}:</span>
                  <span className="text-xs font-bold">{value}</span>
                </div>
              )) : <span className="text-sm text-muted-foreground">Nenhum atributo cadastrado.</span>}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button>Usar este produto</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductEditModal({
  item,
  categories,
  onClose,
  onSave,
}: {
  item: CatalogItem
  categories: string[]
  onClose: () => void
  onSave: (payload: CatalogItemInput) => Promise<void>
}) {
  return (
    <ProductFormModal
      title="Editar Produto"
      subtitle="Atualize os dados do item no catálogo"
      initialValues={productToFormValues(item)}
      categories={categories}
      submitLabel="Salvar Alterações"
      onClose={onClose}
      onSubmit={onSave}
    />
  )
}

function ProductCreateModal({
  categories,
  onClose,
  onCreate,
}: {
  categories: string[]
  onClose: () => void
  onCreate: (payload: CatalogItemInput) => Promise<void>
}) {
  return (
    <ProductFormModal
      title="Novo Produto"
      subtitle="Cadastre um novo item no catálogo"
      initialValues={productToFormValues()}
      categories={categories}
      submitLabel="Criar Produto"
      onClose={onClose}
      onSubmit={onCreate}
    />
  )
}

function CatalogImportModal({
  fileName,
  preview,
  isImporting,
  onClose,
  onConfirm,
}: {
  fileName: string
  preview: CatalogImportPreview
  isImporting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const previewRows = preview.rows.slice(0, 8)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded bg-card p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-display">Importar Catálogo CSV</h2>
            <p className="text-sm text-muted-foreground">{fileName || "Arquivo selecionado"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-border p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Linhas</p>
            <p className="mt-2 text-2xl font-bold">{preview.summary.totalRows}</p>
          </div>
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Válidas</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{preview.summary.validRows}</p>
          </div>
          <div className="rounded border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Com erro</p>
            <p className="mt-2 text-2xl font-bold text-destructive">{preview.summary.invalidRows}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-border">
          <div className="grid grid-cols-[80px_1.4fr_1fr_1fr_1.2fr] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span>Linha</span>
            <span>Nome</span>
            <span>Categoria</span>
            <span>SKU</span>
            <span>Status</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {previewRows.map((row) => (
              <div key={row.rowNumber} className="border-b border-border px-4 py-3 text-sm last:border-b-0">
                <div className="grid grid-cols-[80px_1.4fr_1fr_1fr_1.2fr] gap-3">
                  <span className="font-mono text-muted-foreground">{row.rowNumber}</span>
                  <span className="font-medium">{row.raw.name || "-"}</span>
                  <span>{row.raw.category || "-"}</span>
                  <span className="font-mono">{row.raw.sku || "-"}</span>
                  <span className={cn(
                    "font-medium",
                    row.errors.length > 0 ? "text-destructive" : "text-emerald-600",
                  )}>
                    {row.errors.length > 0 ? row.errors.join(" ") : "Pronto para importar"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {preview.rows.length > previewRows.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            Mostrando {previewRows.length} de {preview.rows.length} linhas analisadas.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={isImporting || preview.summary.invalidRows > 0 || preview.summary.validRows === 0}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Importar {preview.summary.validRows} item(ns)
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProductFormModal({
  title,
  subtitle,
  initialValues,
  categories,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  subtitle: string
  initialValues: ProductFormValues
  categories: string[]
  submitLabel: string
  onClose: () => void
  onSubmit: (payload: CatalogItemInput) => Promise<void>
}) {
  const [form, setForm] = useState<ProductFormValues>(initialValues)
  const [categorySearch, setCategorySearch] = useState(initialValues.category)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredCategories = categories.filter((category) => category.toLowerCase().includes(categorySearch.toLowerCase()))
  const canCreateCategory = categorySearch.trim().length > 0 && !categories.some((category) => category.toLowerCase() === categorySearch.toLowerCase())

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [])

  async function submitForm(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(formValuesToPayload({ ...form, category: categorySearch.trim() || form.category }))
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Nao foi possivel salvar o produto."))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleImageChange(file?: File) {
    if (!file) return

    try {
      const imageUrl = await readImageAsDataUrl(file)
      setForm((current) => ({ ...current, imageUrl }))
    } catch (imageError) {
      setError(getErrorMessage(imageError, "Nao foi possivel carregar a imagem."))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <form className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded bg-card p-6 animate-in fade-in zoom-in duration-200" onClick={(event) => event.stopPropagation()} onSubmit={submitForm}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-display">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-8 space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">Nome do Produto</label>
            <input
              autoFocus
              placeholder="Ex: Tinta Coral Rende Muito"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative" ref={categoryRef}>
              <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">Categoria</label>
              <div className="flex cursor-text items-center rounded border border-border bg-muted/30 px-3 py-2 transition-all focus-within:ring-1 focus-within:ring-primary" onClick={() => setCategoryDropdownOpen(true)}>
                <input
                  placeholder="Pesquisar categoria..."
                  value={categorySearch}
                  onChange={(event) => {
                    setCategorySearch(event.target.value)
                    setForm({ ...form, category: event.target.value })
                    setCategoryDropdownOpen(true)
                  }}
                  onFocus={() => setCategoryDropdownOpen(true)}
                  className="w-full border-none bg-transparent text-sm outline-none"
                />
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", categoryDropdownOpen && "rotate-180")} />
              </div>

              {categoryDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded border border-border bg-card animate-in fade-in slide-in-from-top-1 duration-150">
                  {filteredCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setCategorySearch(category)
                        setForm({ ...form, category })
                        setCategoryDropdownOpen(false)
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      {category}
                      {form.category === category && <Check className="h-3 w-3" />}
                    </button>
                  ))}

                  {canCreateCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        const category = categorySearch.trim()
                        setForm({ ...form, category })
                        setCategoryDropdownOpen(false)
                      }}
                      className="w-full border-t border-border px-3 py-2 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                    >
                      <Plus className="mr-2 inline h-3 w-3" />
                      Criar "{categorySearch.trim()}"
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">SKU (Opcional)</label>
              <input
                placeholder="Ex: TIN-999"
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">Tipo do item</label>
              <select
                value={form.productType}
                onChange={(event) => setForm({ ...form, productType: event.target.value })}
                className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-primary"
              >
                {PRODUCT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">Modo de uso</label>
              <select
                value={form.usageMode}
                onChange={(event) => setForm({ ...form, usageMode: event.target.value })}
                className="w-full rounded border border-border bg-muted/30 px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-primary"
              >
                {USAGE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">Descrição</label>
            <textarea
              placeholder="Descreva as características principais do produto..."
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="h-24 w-full resize-none rounded border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase opacity-40">Atributos</label>
            <textarea
              placeholder={"cor: Azul\nacabamento: Fosco\nmarca: Coral"}
              value={form.tagsText}
              onChange={(event) => setForm({ ...form, tagsText: event.target.value })}
              className="h-24 w-full resize-none rounded border border-border bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Use uma linha por atributo no formato chave: valor. Tipo e modo de uso ficam nos campos acima.</p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void handleImageChange(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded border-2 border-dashed border-border bg-muted/10 p-6 text-center transition-colors hover:bg-muted/20"
            >
              {form.imageUrl ? (
                <SafeImage
                  src={form.imageUrl}
                  alt="Preview do produto"
                  className="mx-auto mb-3 h-32 max-w-full rounded object-cover"
                  fallbackClassName="w-full"
                  fallbackLabel="Preview indisponível"
                  fallbackHint="Troque o arquivo ou use outra imagem."
                />
              ) : (
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded border border-border bg-background transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <p className="text-xs font-bold text-muted-foreground">Adicionar ou trocar imagem</p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">PNG, JPG ou WEBP (Max 2MB)</p>
            </button>
          </div>

          {error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="font-sans" disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" className="px-8 font-sans" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ConfirmDeleteModal({
  itemName,
  onClose,
  onConfirm,
}: {
  itemName: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmDelete() {
    setIsDeleting(true)
    setError(null)

    try {
      await onConfirm()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Nao foi possivel excluir o produto."))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded bg-card p-6 text-center" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded bg-destructive/10 text-destructive">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-lg font-bold font-display">Excluir Produto</h2>
        <p className="mb-6 text-sm text-muted-foreground font-sans">Deseja excluir permanentemente <strong>{itemName}</strong>?</p>
        {error && <p className="mb-4 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-2">
          <Button variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sim, excluir
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
