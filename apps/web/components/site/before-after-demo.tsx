"use client"

import Image from "next/image"
import { useId, useState } from "react"

import { cn } from "@/lib/utils"

export interface BeforeAfterItem {
  id: string
  tabLabel: string
  before: { src: string; alt: string }
  after: { src: string; alt: string }
}

interface BeforeAfterDemoProps {
  items: BeforeAfterItem[]
  className?: string
  /** Legenda fixa abaixo do comparador. */
  caption?: string
  initialPosition?: number
  /** Contexto de fundo em volta do componente — ajusta cor das abas e da legenda. */
  tone?: "blue" | "white"
}

/**
 * Comparador antes/depois reutilizável (Guia de Estratégia, componente
 * "BeforeAfterDemo", cap. 5.2). Reaproveita a lógica já validada em
 * components/home-two.tsx (clipPath + <input type="range"> sobreposto),
 * generalizada pra aceitar 1..n itens com abas.
 */
export function BeforeAfterDemo({ items, className, caption, initialPosition = 55, tone = "blue" }: BeforeAfterDemoProps) {
  const isBlue = tone === "blue"
  const [activeId, setActiveId] = useState(items[0]?.id)
  const [position, setPosition] = useState(initialPosition)
  const sliderId = useId()

  const active = items.find((item) => item.id === activeId) ?? items[0]
  if (!active) return null

  return (
    <div className={cn("w-full", className)}>
      {items.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Categorias de simulação">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === active.id}
              onClick={() => {
                setActiveId(item.id)
                setPosition(initialPosition)
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                item.id === active.id
                  ? "bg-brand-tiffany text-brand-blue"
                  : isBlue
                    ? "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                    : "bg-brand-blue/[0.06] text-brand-blue/70 hover:bg-brand-blue/10 hover:text-brand-blue"
              )}
            >
              {item.tabLabel}
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-[0_30px_70px_-20px_rgba(0,22,90,0.45)] sm:aspect-[16/10]">
        <Image
          src={active.before.src}
          alt={active.before.alt}
          fill
          priority
          quality={95}
          sizes="(max-width: 800px) 92vw, 1200px"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
          <Image
            src={active.after.src}
            alt={active.after.alt}
            fill
            priority
            quality={95}
            sizes="(max-width: 800px) 92vw, 1200px"
            className="object-cover"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 flex w-0.5 -translate-x-1/2 items-center bg-white/90"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <span className="flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-white text-brand-blue shadow-md">
            ↔
          </span>
        </div>

        <span className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
          Original
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-brand-tiffany px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
          Simulação
        </span>

        <label htmlFor={sliderId} className="sr-only">
          Comparar imagem original e simulação
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      {caption && (
        <p className={cn("mt-3 text-center text-sm sm:text-left", isBlue ? "text-white/70" : "text-muted-foreground")}>
          {caption}
        </p>
      )}
    </div>
  )
}
