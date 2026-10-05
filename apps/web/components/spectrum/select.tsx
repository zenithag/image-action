"use client"

import { useRef } from "react"

import { useElementEvent, useSpectrum } from "./use-spectrum"

export type SelectOption = { value: string; label: string }

type SelectProps = {
  label: string
  options: SelectOption[]
  value: string
  onValueChange: (value: string) => void
  width?: number | string
}

/** Spectrum `sp-picker`. `label` is the accessible name (no visible field label). */
export function Select({ label, options, value, onValueChange, width }: SelectProps) {
  const ref = useRef<HTMLElement>(null)
  useSpectrum("picker", "menu")
  useElementEvent(ref, "change", (event) => {
    const next = (event.target as HTMLElement & { value?: string }).value
    if (typeof next === "string" && next !== value) onValueChange(next)
  })

  return (
    <sp-picker ref={ref} label={label} value={value} style={{ width }}>
      {options.map((option) => (
        <sp-menu-item key={option.value} value={option.value}>
          {option.label}
        </sp-menu-item>
      ))}
    </sp-picker>
  )
}
