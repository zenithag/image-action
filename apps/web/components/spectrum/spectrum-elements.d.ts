import type { DetailedHTMLProps, HTMLAttributes, Ref } from "react"

type El<Attrs = object> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { ref?: Ref<HTMLElement> } & Attrs

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "sp-theme": El<{
        system?: "spectrum" | "spectrum-two" | "express"
        scale?: "medium" | "large"
        color?: "light" | "dark" | "lightest" | "darkest"
        lang?: string
      }>
      "sp-button": El<{
        variant?: string
        treatment?: "fill" | "outline"
        size?: "s" | "m" | "l" | "xl"
        disabled?: boolean
        pending?: boolean
        type?: "button" | "submit" | "reset"
        href?: string
      }>
      "sp-action-button": El<{
        quiet?: boolean
        selected?: boolean
        toggles?: boolean
        emphasized?: boolean
        size?: "xs" | "s" | "m" | "l" | "xl"
        label?: string
        disabled?: boolean
      }>
      "sp-picker": El<{ label?: string; value?: string; quiet?: boolean; disabled?: boolean; size?: "s" | "m" | "l" | "xl" }>
      "sp-menu-item": El<{ value?: string; selected?: boolean; disabled?: boolean }>
      "sp-search": El<{ label?: string; placeholder?: string; value?: string; quiet?: boolean; size?: "s" | "m" | "l" | "xl" }>
      "sp-tabs": El<Record<string, unknown>>
      "sp-tab": El<Record<string, unknown>>
      "sp-underlay": El<Record<string, unknown>>
      "sp-textfield": El<Record<string, unknown>>
      "sp-number-field": El<Record<string, unknown>>
      "sp-checkbox": El<Record<string, unknown>>
      "sp-switch": El<Record<string, unknown>>
      "sp-sidenav": El<{ variant?: "multilevel"; manageTabIndex?: boolean; value?: string }>
      "sp-sidenav-item": El<{ label?: string; value?: string; href?: string; selected?: boolean; disabled?: boolean }>
      "sp-sidenav-heading": El<{ label?: string }>
      "sp-divider": El<{ size?: "s" | "m" | "l"; vertical?: boolean }>
      "sp-progress-circle": El<{ indeterminate?: boolean; size?: "s" | "m" | "l"; label?: string }>
    }
  }
}
