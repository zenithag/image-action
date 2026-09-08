import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { SITE_URL } from "@/lib/site-config"

export interface BreadcrumbItem {
  label: string
  /** Sem href = nível não navegável (ex.: "Soluções", que não tem página própria). */
  href?: string
}

/**
 * Breadcrumbs (Guia, cap. 14.4: "Início > Soluções > Nome do ICP"). Fica numa
 * faixa branca entre o header e o hero — não usa o sistema de `tone` porque é
 * um elemento de orientação, não uma seção de conteúdo com ritmo próprio.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="border-b border-black/5 bg-white px-4 py-3 sm:px-6 lg:px-8">
      <ol className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-brand-blue">
                {item.label}
              </Link>
            ) : (
              <span className={index === items.length - 1 ? "font-medium text-brand-blue" : undefined}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** BreadcrumbList JSON-LD (Guia, cap. 14.2) — só entra `item` (URL) pra níveis navegáveis. */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
