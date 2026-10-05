"use client"

import { forwardRef, type ComponentProps, type ReactNode } from "react"

import { useSpectrum } from "./use-spectrum"

type ToggleButtonProps = Omit<ComponentProps<"button">, "ref" | "type"> & {
  /** Controlled selection: the parent owns the state, clicking only fires `onClick`. */
  selected?: boolean
  /** Spectrum `emphasized` fills the selected button with the accent colour (strong; use sparingly). */
  emphasized?: boolean
  /** Quiet buttons have no background until hovered or selected. Default: true. */
  quiet?: boolean
  children?: ReactNode
}

/**
 * Spectrum `sp-action-button` used as a filter chip / segmented option / tab. It is deliberately
 * controlled (no `toggles`): the screens already keep the selected value in their own state.
 */
export const ToggleButton = forwardRef<HTMLElement, ToggleButtonProps>(function ToggleButton(
  { selected, emphasized = false, quiet = true, disabled, children, className, ...rest },
  ref,
) {
  useSpectrum("actionButton")

  return (
    <sp-action-button
      ref={ref}
      className={className}
      {...({
        selected: selected ? true : undefined,
        emphasized: emphasized || undefined,
        quiet: quiet || undefined,
        disabled: disabled || undefined,
        "aria-pressed": selected ? "true" : "false",
      } as object)}
      {...(rest as object)}
    >
      {children}
    </sp-action-button>
  )
})
