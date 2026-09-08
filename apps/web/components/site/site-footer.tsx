import Image from "next/image"
import Link from "next/link"

import { FOOTER_COLUMNS } from "@/lib/site-config"

/** SiteFooter (Guia de Estratégia, cap. 4.4). */
export function SiteFooter() {
  return (
    <footer className="bg-brand-blue text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-4">
          <Image src="/logo-horizontal-branco.svg" alt="ComoFica.ai" width={150} height={34} className="h-9 w-[150px]" />
          <p className="max-w-xs text-sm leading-6 text-white/70">
            Plataforma de visualização comercial com inteligência artificial. Veja como produtos, acabamentos e
            possibilidades podem ficar antes da decisão.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-tiffany">{column.title}</p>
            <ul className="flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/75 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-white/50 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} ComoFica.ai. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}
