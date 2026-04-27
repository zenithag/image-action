"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"

type PublicProductActionsProps = {
  productName: string
  sku?: string
  whatsappNumber?: string
  primaryColor: string
}

function getCompositionRequestText(productName: string, sku?: string) {
  const skuText = sku ? ` SKU ${sku}` : ""

  return `Olá! Gostaria de fazer uma composição utilizando o produto ${productName}${skuText} para ver como ele fica no meu ambiente.`
}

function getWhatsAppUrl(phoneNumber: string | undefined, productName: string, sku?: string) {
  const text = encodeURIComponent(getCompositionRequestText(productName, sku))

  if (!phoneNumber) {
    return `https://wa.me/?text=${text}`
  }

  return `https://wa.me/${phoneNumber}?text=${text}`
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall back for browsers/webviews that block the Clipboard API.
    }
  }

  const textArea = document.createElement("textarea")
  textArea.value = text
  textArea.setAttribute("readonly", "")
  textArea.style.left = "-9999px"
  textArea.style.opacity = "0"
  textArea.style.position = "fixed"
  textArea.style.top = "0"

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  textArea.setSelectionRange(0, textArea.value.length)

  try {
    return document.execCommand("copy")
  } finally {
    document.body.removeChild(textArea)
  }
}

export function PublicProductActions({
  productName,
  sku,
  whatsappNumber,
  primaryColor,
}: PublicProductActionsProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle")
  const copyStatusTimerRef = useRef<number | null>(null)
  const whatsappUrl = getWhatsAppUrl(whatsappNumber, productName, sku)
  const accentStyle = { "--catalog-accent": primaryColor } as CSSProperties

  useEffect(() => {
    return () => {
      if (copyStatusTimerRef.current) {
        window.clearTimeout(copyStatusTimerRef.current)
      }
    }
  }, [])

  async function copySku() {
    if (!sku) return

    const didCopy = await copyTextToClipboard(sku)
    setCopyStatus(didCopy ? "copied" : "failed")

    if (copyStatusTimerRef.current) {
      window.clearTimeout(copyStatusTimerRef.current)
    }

    copyStatusTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle")
    }, 1800)
  }

  return (
    <div className="grid gap-3" style={accentStyle}>
      {sku && (
        <button
          type="button"
          onClick={copySku}
          className="h-12 rounded-full border border-black/10 bg-white px-4 text-sm font-bold uppercase tracking-[0.12em] text-slate-700 transition hover:border-[color:var(--catalog-accent)] hover:text-[color:var(--catalog-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--catalog-accent)]"
        >
          {copyStatus === "copied" ? "SKU copiado" : copyStatus === "failed" ? "Copie manualmente" : "Copiar SKU"}
        </button>
      )}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="flex h-12 items-center justify-center rounded-full bg-[color:var(--catalog-accent)] px-5 text-center text-sm font-bold uppercase tracking-[0.12em] text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--catalog-accent)] focus-visible:ring-offset-2"
      >
        {whatsappNumber ? "Fazer composição no WhatsApp" : "Abrir no WhatsApp"}
      </a>
    </div>
  )
}
