"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { ensureSpectrumTheme } from "./theme-ready"

const loaders = {
  button: () => import("@spectrum-web-components/button/sp-button.js"),
  actionButton: () => import("@spectrum-web-components/action-button/sp-action-button.js"),
  picker: () => import("@spectrum-web-components/picker/sp-picker.js"),
  menu: () => import("@spectrum-web-components/menu/sp-menu-item.js"),
  search: () => import("@spectrum-web-components/search/sp-search.js"),
  textfield: () => import("@spectrum-web-components/textfield/sp-textfield.js"),
  numberField: () => import("@spectrum-web-components/number-field/sp-number-field.js"),
  checkbox: () => import("@spectrum-web-components/checkbox/sp-checkbox.js"),
  switch: () => import("@spectrum-web-components/switch/sp-switch.js"),
  sidenav: () => import("@spectrum-web-components/sidenav/sp-sidenav.js"),
  sidenavItem: () => import("@spectrum-web-components/sidenav/sp-sidenav-item.js"),
  sidenavHeading: () => import("@spectrum-web-components/sidenav/sp-sidenav-heading.js"),
  progressCircle: () => import("@spectrum-web-components/progress-circle/sp-progress-circle.js"),
  tabs: () => import("@spectrum-web-components/tabs/sp-tabs.js"),
  tab: () => import("@spectrum-web-components/tabs/sp-tab.js"),
  underlay: () => import("@spectrum-web-components/underlay/sp-underlay.js"),
  divider: () => import("@spectrum-web-components/divider/sp-divider.js"),
} as const

export type SpectrumModule = keyof typeof loaders

// Spectrum Web Components touch `HTMLElement` at import time, so they can only be loaded in
// the browser. Atoms call this from an effect; until the element upgrades it renders as an
// unknown inline element, which is harmless for the server-rendered HTML.
//
// Returns `true` once every requested module is defined. Compound elements whose children read
// state from the parent when they upgrade (sidenav) must only be rendered after that, otherwise
// the parent writes attributes onto children that are not upgraded yet and they throw.
export function useSpectrum(...modules: SpectrumModule[]) {
  const [ready, setReady] = useState(false)
  const key = modules.join(",")

  useEffect(() => {
    let cancelled = false

    // Sequential on purpose: list parents first (menu before menu items, sidenav before items).
    void (async () => {
      await ensureSpectrumTheme()
      for (const name of modules) await loaders[name]()
      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return ready
}

// React 19 maps `onX` props on custom elements inconsistently for lowercase DOM events such as
// `change`; subscribing through the ref keeps behaviour explicit.
export function useElementEvent<T extends HTMLElement>(
  ref: RefObject<T | null>,
  type: string,
  handler: ((event: Event) => void) | undefined,
) {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const listener = (event: Event) => latest.current?.(event)
    element.addEventListener(type, listener)

    return () => element.removeEventListener(type, listener)
  }, [ref, type])
}
