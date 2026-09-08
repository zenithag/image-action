import Image from "next/image"

import { cn } from "@/lib/utils"

interface BrandPhotoProps {
  src: string
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
  /** Intensidade do overlay azul-marinho — mantém fotos de banco de imagens visualmente unificadas à marca. */
  overlay?: "light" | "medium"
}

/**
 * Wrapper de next/image com tratamento de marca consistente (overlay Dark
 * Blue) para fotografia de banco de imagens usada nas páginas de segmento
 * que ainda não têm fotografia real própria da ComoFica.ai.
 */
export function BrandPhoto({ src, alt, className, sizes, priority, overlay = "medium" }: BrandPhotoProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "(max-width: 800px) 100vw, 50vw"}
        className="object-cover"
      />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-brand-blue via-brand-blue/10 to-transparent",
          overlay === "light" && "from-brand-blue/60 via-transparent"
        )}
        aria-hidden="true"
      />
    </div>
  )
}
