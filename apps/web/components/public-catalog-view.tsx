"use client"

import type { CSSProperties } from "react"
import { useState } from "react"
import Link from "next/link"

import { SafeImage } from "@/components/safe-image"

type PublicCatalogItem = {
  id: string
  name: string
  description: string
  category: string
  sku?: string
  tags: Record<string, string>
  imageUrl: string
  productUrl: string
}

type PublicCatalogViewProps = {
  companyName: string
  description: string
  primaryColor: string
  items: PublicCatalogItem[]
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function getTagText(tags: Record<string, string>) {
  return Object.entries(tags)
    .filter(([, value]) => value.trim())
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ")
}

function getCategoryCards(items: PublicCatalogItem[]) {
  const cards = new Map<string, { category: string; count: number; images: string[] }>()

  for (const item of items) {
    const category = item.category.trim() || "Sem categoria"
    const current = cards.get(category) ?? { category, count: 0, images: [] }

    current.count += 1
    if (current.images.length < 3) {
      current.images.push(item.imageUrl)
    }
    cards.set(category, current)
  }

  return [...cards.values()].sort((left, right) => left.category.localeCompare(right.category, "pt-BR"))
}

function categorySummary(count: number) {
  return count === 1 ? "1 produto" : `${count} produtos`
}

function getFeaturedItems(items: PublicCatalogItem[]) {
  return items.slice(0, 3)
}

export function PublicCatalogView({
  companyName,
  description,
  primaryColor,
  items,
}: PublicCatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [query, setQuery] = useState("")
  const categoryCards = getCategoryCards(items)
  const normalizedQuery = normalizeText(query.trim())
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    const searchable = normalizeText([
      item.name,
      item.description,
      item.category,
      item.sku,
      ...Object.entries(item.tags).flatMap(([key, value]) => [key, value]),
    ].filter(Boolean).join(" "))
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)

    return matchesCategory && matchesQuery
  })
  const activeCategoryLabel = selectedCategory === "all" ? "Todos os produtos" : selectedCategory
  const accentStyle = { "--catalog-accent": primaryColor } as CSSProperties
  const featuredItems = getFeaturedItems(items)

  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-950"
      style={{
        ...accentStyle,
        backgroundImage:
          "linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <section className="border-b border-slate-200 bg-white/92 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[color:var(--catalog-accent)] text-lg font-black text-white shadow-sm">
              C
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--catalog-accent)]">
                ComoFica Store
              </p>
              <p className="text-sm font-semibold text-slate-700">{companyName}</p>
            </div>
          </div>
          <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:block">
            Catálogo público
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_380px]">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div
              className="relative min-h-[330px] px-5 py-8 sm:px-8 lg:px-10"
              style={{
                background: `radial-gradient(circle at 12% 18%, ${primaryColor}26, transparent 36%), linear-gradient(135deg, #ffffff 0%, #f1f8f7 100%)`,
              }}
            >
              <div className="absolute right-5 top-5 rounded-full bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                {categorySummary(items.length)}
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--catalog-accent)]">
                Vitrine de produtos
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl font-black leading-[0.95] tracking-[-0.06em] text-slate-950 sm:text-6xl">
                Produtos {companyName}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {description}
              </p>
              <label className="mt-8 block max-w-2xl">
                <span className="sr-only">Buscar produto</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome, SKU, categoria ou atributo"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[color:var(--catalog-accent)] focus:ring-4 focus:ring-[color:var(--catalog-accent)]/15"
                />
              </label>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Destaques</p>
                <p className="mt-1 text-lg font-bold">Prontos para simular</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                {featuredItems.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {featuredItems.length > 0 ? featuredItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.productUrl}
                  className="group flex gap-3 rounded-2xl bg-white/8 p-2 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-white/10">
                    <SafeImage
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      fallbackClassName="min-h-0 gap-0 p-0"
                      fallbackLabel="Sem imagem"
                      fallbackHint=""
                    />
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--catalog-accent)]">
                      {item.category}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold leading-tight text-white">
                      {item.name}
                    </p>
                    {item.sku && <p className="mt-1 truncate font-mono text-[10px] text-white/45">{item.sku}</p>}
                  </div>
                </Link>
              )) : (
                <p className="rounded-2xl bg-white/8 p-4 text-sm text-white/60">Nenhum produto ativo.</p>
              )}
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            aria-pressed={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            className={`group min-h-[126px] rounded-[1.5rem] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--catalog-accent)] ${
              selectedCategory === "all"
                ? "border-[color:var(--catalog-accent)] bg-white"
                : "border-slate-200 bg-white"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--catalog-accent)]">
              Tudo
            </span>
            <strong className="mt-3 block font-display text-2xl tracking-[-0.04em]">
              Todos os produtos
            </strong>
            <span className="mt-2 block text-sm text-slate-500">
              {categorySummary(items.length)}
            </span>
          </button>

          {categoryCards.map((card) => (
            <button
              key={card.category}
              type="button"
              aria-pressed={selectedCategory === card.category}
              onClick={() => setSelectedCategory(card.category)}
              className={`group min-h-[126px] overflow-hidden rounded-[1.5rem] border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--catalog-accent)] ${
                selectedCategory === card.category
                  ? "border-[color:var(--catalog-accent)]"
                  : "border-slate-200"
              }`}
            >
              <div className="grid h-14 grid-cols-3 overflow-hidden bg-slate-100">
                {card.images.map((imageUrl, index) => (
                  <SafeImage
                    key={`${card.category}-${imageUrl}-${index}`}
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-85 transition group-hover:scale-105"
                    loading="lazy"
                    fallbackClassName="min-h-0 gap-0 p-0"
                    fallbackLabel="Sem imagem"
                    fallbackHint=""
                  />
                ))}
              </div>
              <div className="p-4">
                <strong className="block truncate font-display text-xl tracking-[-0.04em]">
                  {card.category}
                </strong>
                <span className="mt-1 block text-sm text-slate-500">
                  {categorySummary(card.count)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mb-5 mt-7 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--catalog-accent)]">
              {activeCategoryLabel}
            </p>
            <p className="text-sm text-slate-500">
              {categorySummary(filteredItems.length)} encontrados
            </p>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Clique em um produto para copiar SKU ou abrir a conversa no WhatsApp.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-display text-2xl font-bold">Nenhum produto ativo no catálogo.</p>
            <p className="mt-2 text-sm text-slate-500">Volte mais tarde para ver novas referências.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-display text-2xl font-bold">Nenhum produto encontrado.</p>
            <p className="mt-2 text-sm text-slate-500">Tente outra categoria ou termo de busca.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const tagText = getTagText(item.tags)

              return (
                <Link
                  key={item.id}
                  href={item.productUrl}
                  className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--catalog-accent)]"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                      fallbackLabel="Imagem indisponível"
                      fallbackHint="Abra o produto para ver os detalhes."
                    />
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <div className="flex flex-col items-start gap-2">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--catalog-accent)]">
                          {item.category}
                        </p>
                        {item.sku && (
                          <span className="max-w-full rounded-full bg-slate-100 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">
                            {item.sku}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3 line-clamp-2 font-display text-xl font-bold leading-tight tracking-[-0.03em]">
                        {item.name}
                      </h2>
                    </div>
                    {item.description && (
                      <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                        {item.description}
                      </p>
                    )}
                    {tagText && (
                      <p className="border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
                        {tagText}
                      </p>
                    )}
                    <span className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white transition group-hover:bg-[color:var(--catalog-accent)]">
                      Ver produto
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
