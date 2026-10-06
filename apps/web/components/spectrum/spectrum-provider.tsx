"use client"

import { useEffect, useState, type ReactNode } from "react"
import type * as React from "react"
import localFont from "next/font/local"
import { useTheme } from "next-themes"

import "./spectrum-theme.css"
import { getConsoleThemeVariables } from "@/lib/brand-palette"
import { SpectrumContext } from "./spectrum-context"
import { ensureSpectrumTheme } from "./theme-ready"

const sourceSans = localFont({
  src: "./fonts/SourceSans3VF-Upright.woff2",
  variable: "--font-source-sans",
  display: "swap",
  weight: "200 900",
  style: "normal",
})

const sourceCode = localFont({
  src: "./fonts/SourceCodeVF-Upright.woff2",
  variable: "--font-source-code",
  display: "swap",
  weight: "200 900",
  style: "normal",
})

/**
 * `primaryColor` is the tenant's colour from "Marca & dados". Left out (superadmin), the console
 * uses the Como fica.ai brand theme.
 */
export function SpectrumProvider({ children, primaryColor }: { children: ReactNode; primaryColor?: string }) {
  const { resolvedTheme } = useTheme()
  const [ready, setReady] = useState(false)

  // Remember how the person is interacting, so focus rings can be limited to keyboard use.
  useEffect(() => {
    const root = document.documentElement
    const keyboard = (event: KeyboardEvent) => {
      if (["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) root.dataset.cfInput = "keyboard"
    }
    const pointer = () => {
      root.dataset.cfInput = "pointer"
    }

    window.addEventListener("keydown", keyboard, true)
    window.addEventListener("pointerdown", pointer, true)
    window.addEventListener("mousedown", pointer, true)

    return () => {
      window.removeEventListener("keydown", keyboard, true)
      window.removeEventListener("pointerdown", pointer, true)
      window.removeEventListener("mousedown", pointer, true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    ensureSpectrumTheme().then(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <sp-theme
      system="spectrum-two"
      scale="medium"
      lang="pt-BR"
      className={`cf-panel ${sourceSans.variable} ${sourceCode.variable}`}
      color={resolvedTheme === "dark" ? "dark" : "light"}
      data-ready={ready ? "true" : "false"}
      style={{ display: "contents", ...(getConsoleThemeVariables(primaryColor, resolvedTheme === "dark") as React.CSSProperties) }}
    >
      <SpectrumContext.Provider value>{children}</SpectrumContext.Provider>
    </sp-theme>
  )
}
