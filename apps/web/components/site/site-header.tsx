"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { CTA_MESSAGES, PRIMARY_NAV, SOLUTIONS, buildWhatsAppLink } from "@/lib/site-config"

/**
 * SiteHeader (Guia de Estratégia, cap. 5.2 e 4.2/4.3). Dropdown "Soluções"
 * feito à mão (sem @radix-ui/react-navigation-menu) pra manter o componente
 * enxuto — fecha por Escape e por clique fora, como o guia exige (cap. 16.2).
 * O menu mobile usa o Sheet (Radix Dialog), que já trata foco e Escape.
 */
export function SiteHeader() {
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!solutionsOpen) return

    function handlePointer(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSolutionsOpen(false)
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSolutionsOpen(false)
    }

    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [solutionsOpen])

  const homeCta = CTA_MESSAGES.home

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="ComoFica.ai, início" className="shrink-0">
          <Image
            src="/logo-horizontal-azul.svg"
            alt="ComoFica.ai"
            width={140}
            height={32}
            priority
            className="h-8 w-[140px]"
          />
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-expanded={solutionsOpen}
              aria-haspopup="true"
              onClick={() => setSolutionsOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-brand-blue/90 transition-colors hover:bg-brand-blue/5 hover:text-brand-blue"
            >
              Soluções
              <ChevronDown className={cn("size-3.5 transition-transform", solutionsOpen && "rotate-180")} />
            </button>
            {solutionsOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-black/5 bg-white p-2 shadow-[0_24px_48px_-12px_rgba(0,22,90,0.18)]">
                {SOLUTIONS.map((solution) => (
                  <Link
                    key={solution.slug}
                    href={solution.href}
                    onClick={() => setSolutionsOpen(false)}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-brand-blue/5"
                  >
                    <span className="flex items-center gap-2 font-medium text-brand-blue">
                      {solution.label}
                      {solution.badge && (
                        <span className="rounded-full bg-brand-tiffany/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-tiffany-dark">
                          {solution.badge}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{solution.description}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {PRIMARY_NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-brand-blue/90 transition-colors hover:bg-brand-blue/5 hover:text-brand-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-brand-blue/70 transition-colors hover:text-brand-blue"
          >
            Entrar
          </Link>
          <Button asChild size="sm" className="bg-brand-blue text-white hover:bg-brand-blue-light">
            <a href={buildWhatsAppLink(homeCta.message)} target="_blank" rel="noreferrer">
              {homeCta.label}
            </a>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="flex size-10 items-center justify-center rounded-full text-brand-blue lg:hidden"
            >
              <Menu className="size-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-[85vw] max-w-sm flex-col gap-6 overflow-y-auto p-6">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Image src="/logo-horizontal-azul.svg" alt="ComoFica.ai" width={130} height={30} className="h-7 w-[130px]" />

            <nav aria-label="Navegação mobile" className="flex flex-col gap-1">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Soluções
              </p>
              {SOLUTIONS.map((solution) => (
                <Link
                  key={solution.slug}
                  href={solution.href}
                  className="rounded-xl px-2 py-2.5 text-[15px] font-medium text-brand-blue hover:bg-brand-blue/5"
                >
                  {solution.label}
                </Link>
              ))}

              <div className="my-2 h-px bg-black/5" />

              {PRIMARY_NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-2 py-2.5 text-[15px] font-medium text-brand-blue hover:bg-brand-blue/5"
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="rounded-xl px-2 py-2.5 text-[15px] font-medium text-brand-blue hover:bg-brand-blue/5">
                Entrar
              </Link>
            </nav>

            <Button asChild className="mt-auto w-full bg-brand-blue text-white hover:bg-brand-blue-light">
              <a href={buildWhatsAppLink(homeCta.message)} target="_blank" rel="noreferrer">
                {homeCta.label}
              </a>
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
