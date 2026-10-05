"use client"

import { cloneElement, type ComponentProps, type ReactElement } from "react"

import { useSpectrum } from "./use-spectrum"

type Variant = "primary" | "secondary" | "danger"

const spectrumVariant: Record<Variant, string> = {
  primary: "accent",
  secondary: "secondary",
  danger: "negative",
}

type ButtonProps = Omit<ComponentProps<"sp-button">, "variant"> & {
  variant?: Variant
  quiet?: boolean
  /** A single SVG icon element, slotted straight into the button. */
  icon?: ReactElement<{ slot?: string }>
}

/** Spectrum `sp-button`. One `primary` per area; `icon` goes in the icon slot. */
export function Button({ variant = "secondary", quiet, icon, children, ...props }: ButtonProps) {
  useSpectrum("button")

  return (
    <sp-button
      variant={spectrumVariant[variant]}
      treatment={quiet ? "outline" : "fill"}
      {...props}
    >
      {icon ? cloneElement(icon, { slot: "icon" }) : null}
      {children}
    </sp-button>
  )
}
