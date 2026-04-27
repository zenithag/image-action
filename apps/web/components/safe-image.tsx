"use client"

import type { ImgHTMLAttributes, SyntheticEvent } from "react"
import { useEffect, useState } from "react"
import { Image as ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null
  fallbackClassName?: string
  fallbackHint?: string
  fallbackLabel?: string
}

export function SafeImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackHint = "A imagem nao esta disponivel no momento.",
  fallbackLabel = "Imagem indisponivel",
  onError,
  ...props
}: SafeImageProps) {
  const [didFail, setDidFail] = useState(false)
  const normalizedSrc = typeof src === "string" && src.trim() ? src : undefined

  useEffect(() => {
    setDidFail(false)
  }, [normalizedSrc])

  if (!normalizedSrc || didFail) {
    return (
      <div
        role="img"
        aria-label={alt || fallbackLabel}
        className={cn(
          "flex min-h-24 w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,_rgba(11,114,133,0.14),_transparent_38%),linear-gradient(135deg,_hsl(var(--muted))_0%,_hsl(var(--background))_100%)] p-4 text-center text-muted-foreground",
          className,
          fallbackClassName
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
          <ImageIcon className="h-5 w-5 text-primary/70" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
          {fallbackLabel}
        </span>
        {fallbackHint && (
          <span className="max-w-48 text-[11px] leading-4 text-muted-foreground">
            {fallbackHint}
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      onError={(event: SyntheticEvent<HTMLImageElement, Event>) => {
        onError?.(event)
        setDidFail(true)
      }}
      {...props}
    />
  )
}
