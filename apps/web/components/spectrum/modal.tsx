"use client"

import { useEffect, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useSpectrum } from "./use-spectrum"

type ModalProps = {
  /** Render the surface as a form (the screen supplies `onSubmit`). */
  as?: "div" | "form"
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  /** Called on Escape and on a click outside the dialog. Omit for a dialog that must be answered. */
  onClose?: () => void
  /** Width/height utilities for the dialog surface (w-full max-w-xl max-h-[90vh]...). */
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  children: ReactNode
}

/**
 * Spectrum dialog surface: `sp-underlay` for the backdrop and a Spectrum 2 dialog container
 * (elevated background, 16px corners, elevated shadow). Content is whatever the screen renders;
 * it keeps its own header, body and footer.
 */
export function Modal({ onClose, className, children, as = "div", onSubmit, ...aria }: ModalProps) {
  // The surface is a div, or a form when the dialog is a form; both take the same props here.
  const Surface = as as "div"
  useSpectrum("underlay")

  useEffect(() => {
    if (!onClose) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <sp-underlay style={{ zIndex: 0 }} {...({ open: true } as object)} />
      <Surface
        role="dialog"
        aria-modal="true"
        {...aria}
        {...(onSubmit ? ({ onSubmit } as object) : null)}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "relative z-10 flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto rounded-[var(--cf-radius-xl,16px)] bg-[var(--spectrum-background-elevated-color,var(--card))] text-[var(--cf-ink)] shadow-[0_8px_32px_rgba(0,0,0,0.3)] outline-none",
          className,
        )}
      >
        {children}
      </Surface>
    </div>
  )
}
