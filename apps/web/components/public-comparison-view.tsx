"use client"

import { useRef, useState } from "react"

import { SafeImage } from "@/components/safe-image"
import { cn } from "@/lib/utils"

type PublicComparisonViewProps = {
  title: string
  subtitle: string
  baseImageUrl: string
  resultImageUrl: string
}

export function PublicComparisonView({
  title,
  subtitle,
  baseImageUrl,
  resultImageUrl,
}: PublicComparisonViewProps) {
  const [comparisonView, setComparisonView] = useState<"slider" | "side-by-side">("slider")
  const [sliderPos, setSliderPos] = useState(50)
  const baseImageLabel = "Base usada"
  const isResizing = useRef(false)

  const handleMouseDown = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault()
    isResizing.current = true
  }

  const handleMouseUp = () => {
    isResizing.current = false
  }

  const handleMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isResizing.current) return
    event.preventDefault()

    const container = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const x = "touches" in event ? event.touches[0].clientX : event.clientX
    const position = ((x - container.left) / container.width) * 100
    setSliderPos(Math.max(0, Math.min(100, position)))
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-[16px] border border-border bg-card/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Comparativo público</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex rounded border border-border bg-background p-1">
          <button
            type="button"
            className={cn(
              "rounded-[6px] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
              comparisonView === "slider"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={() => setComparisonView("slider")}
          >
            Arraste
          </button>
          <button
            type="button"
            className={cn(
              "rounded-[6px] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
              comparisonView === "side-by-side"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={() => setComparisonView("side-by-side")}
          >
            Lado a lado
          </button>
        </div>
      </div>

      <div
        className="relative isolate select-none overflow-hidden rounded-[18px] border border-border bg-neutral-950 shadow-2xl"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onDragStart={(event) => event.preventDefault()}
      >
        {comparisonView === "slider" ? (
          <div className="relative flex h-[70vh] min-h-[420px] w-full touch-none items-center justify-center overflow-hidden bg-neutral-950">
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
              <SafeImage
                src={resultImageUrl}
                alt="Imagem gerada"
                className="h-full w-full object-contain"
                draggable={false}
                fallbackLabel="Resultado indisponível"
                fallbackHint="A imagem gerada nao carregou."
              />
            </div>

            <div
              className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden bg-neutral-950"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
                <SafeImage
                  src={baseImageUrl}
                  alt={baseImageLabel}
                  className="h-full w-full object-contain"
                  draggable={false}
                  fallbackLabel="Base indisponível"
                  fallbackHint="A imagem base nao carregou."
                />
              </div>
              <div className="absolute left-4 top-4 rounded-sm bg-black/65 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">{baseImageLabel}</div>
            </div>

            <div className="absolute right-4 top-4 z-10 rounded-sm bg-primary/85 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">Nova imagem</div>

            <div
              className="absolute inset-y-0 z-30 cursor-ew-resize"
              style={{ left: `${sliderPos}%` }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
            >
              <div className="h-full w-1 -translate-x-1/2 bg-white/90 shadow-[0_0_18px_rgba(0,0,0,0.45)]" />
              <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-primary shadow-xl">
                <div className="flex gap-0.5">
                  <div className="h-2.5 w-0.5 bg-white" />
                  <div className="h-2.5 w-0.5 bg-white" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-[70vh] min-h-[420px] w-full grid-cols-1 gap-px bg-border md:grid-cols-2">
            <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-neutral-950">
              <div className="absolute left-4 top-4 z-10 rounded-sm bg-black/65 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">{baseImageLabel}</div>
              <SafeImage
                src={baseImageUrl}
                alt={baseImageLabel}
                className="h-full w-full object-contain"
                draggable={false}
                fallbackLabel="Base indisponível"
                fallbackHint="A imagem base nao carregou."
              />
            </div>
            <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-neutral-950">
              <div className="absolute right-4 top-4 z-10 rounded-sm bg-primary/85 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">Nova imagem</div>
              <SafeImage
                src={resultImageUrl}
                alt="Imagem gerada"
                className="h-full w-full object-contain"
                draggable={false}
                fallbackLabel="Resultado indisponível"
                fallbackHint="A imagem gerada nao carregou."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
