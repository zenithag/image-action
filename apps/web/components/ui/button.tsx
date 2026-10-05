"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useInSpectrum } from "@/components/spectrum/spectrum-context"
import { layoutClasses } from "@/components/spectrum/layout-classes"
import { useSpectrum } from "@/components/spectrum/use-spectrum"

// Used by the public site and by `asChild` links. Inside the console the radius and colours come
// from the design-system tokens; outside it the fallbacks keep the previous look.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_:is(svg,[data-icon])]:pointer-events-none [&_:is(svg,[data-icon])]:size-4 shrink-0 rounded-[var(--cf-radius-full,0px)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--cf-brand-hover,color-mix(in_srgb,var(--primary)_90%,transparent))]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90",
        ghost: "text-foreground hover:bg-muted hover:text-foreground",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 py-1 text-xs",
        lg: "h-10 px-4 py-2",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

type SpectrumVariant = "accent" | "secondary" | "negative"

const spectrumVariant: Record<NonNullable<ButtonProps["variant"]>, SpectrumVariant> = {
  default: "accent",
  secondary: "secondary",
  destructive: "negative",
  outline: "secondary",
  ghost: "secondary",
}

const spectrumSize = { sm: "s", default: "m", lg: "l", icon: "m" } as const

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, children, ...props }, ref) => {
    const inSpectrum = useInSpectrum()
    useSpectrum("button", "actionButton")

    if (asChild) {
      return <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>{children}</Slot>
    }

    if (!inSpectrum) {
      return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={type} {...props}>{children}</button>
    }

    const resolvedVariant = variant ?? "default"
    const resolvedSize = size ?? "default"
    // Ghost and icon buttons are quiet action buttons in the design system; the rest are buttons.
    const quiet = resolvedVariant === "ghost" || resolvedSize === "icon"
    const common = {
      ref: ref as React.Ref<HTMLElement>,
      className: layoutClasses(className),
      size: spectrumSize[resolvedSize],
      ...(props as object),
    }

    if (quiet) {
      // A lone icon belongs in the action button's icon slot, not in its text label.
      const only = React.Children.count(children) === 1 ? React.Children.toArray(children)[0] : null
      const iconOnly = resolvedSize === "icon" && React.isValidElement(only)
        ? React.cloneElement(only as React.ReactElement<{ slot?: string }>, { slot: "icon" })
        : children

      return <sp-action-button quiet {...common}>{iconOnly}</sp-action-button>
    }

    return (
      <sp-button
        variant={spectrumVariant[resolvedVariant]}
        treatment={resolvedVariant === "outline" ? "outline" : "fill"}
        type={type ?? "submit"}
        {...common}
      >
        {children}
      </sp-button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
