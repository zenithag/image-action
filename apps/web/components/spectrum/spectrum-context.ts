"use client"

import { createContext, useContext } from "react"

// True inside the tenant console / superadmin, where shared primitives (ui/button...) render
// Spectrum elements. The public site renders the same primitives without it.
export const SpectrumContext = createContext(false)

export function useInSpectrum() {
  return useContext(SpectrumContext)
}
