"use client"

import { useRef } from "react"

import { useElementEvent, useSpectrum } from "./use-spectrum"

type SearchFieldProps = {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  width?: number | string
}

/** Spectrum `sp-search`. Controlled; Enter does not submit anything. */
export function SearchField({ label, value, onValueChange, placeholder, width }: SearchFieldProps) {
  const ref = useRef<HTMLElement>(null)
  useSpectrum("search")
  useElementEvent(ref, "input", (event) => {
    onValueChange((event.target as HTMLElement & { value?: string }).value ?? "")
  })
  useElementEvent(ref, "submit", (event) => event.preventDefault())

  return <sp-search ref={ref} label={label} placeholder={placeholder} value={value} style={{ width }} />
}
