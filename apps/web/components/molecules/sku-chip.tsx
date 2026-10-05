"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Check, Copy } from "@/components/spectrum/icons"
import { cn } from "@/lib/utils"

/** `DEMO-TINTA-BRANCO-NEVE` -> `DEMO-TINT…NEVE`. Keeps the start and the end, which is what people recognise. */
export function abbreviateSku(sku: string, max = 16) {
  if (sku.length <= max) return sku

  const tail = 4
  return `${sku.slice(0, max - tail - 1)}…${sku.slice(-tail)}`
}

type SkuChipProps = {
  sku?: string
  className?: string
  /** Hide the copy button (used where the chip sits on top of an image). */
  compact?: boolean
}

/** Shortened SKU in the monospace face, with a copy button for the full value. */
export function SkuChip({ sku, className, compact }: SkuChipProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (!sku) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>

  async function copy() {
    try {
      await navigator.clipboard.writeText(sku as string)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be unavailable (insecure context); the full SKU is still in the title.
    }
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="min-w-0 truncate font-mono text-[11px] font-medium" title={sku}>
        {abbreviateSku(sku)}
      </span>
      {compact ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={copied ? "SKU copiado" : `Copiar SKU ${sku}`}
          title={copied ? "Copiado" : "Copiar SKU"}
          onClick={() => void copy()}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </span>
  )
}
