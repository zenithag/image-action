interface ProofStripProps {
  label: string
  items: string[]
}

/** ProofStrip (Guia, cap. 5.2) — faixa horizontal de prova/canais. Bolinha separando cada palavra pra ficar claro onde uma termina e a outra começa. */
export function ProofStrip({ label, items }: ProofStripProps) {
  const Dot = () => <span className="size-1 shrink-0 rounded-full bg-brand-blue/40" aria-hidden="true" />

  return (
    <div className="bg-brand-tiffany">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">{label}</p>
        <Dot />
        {items.map((item, index) => (
          <span key={item} className="flex items-center gap-x-3">
            {index > 0 && <Dot />}
            <span className="text-sm font-medium text-brand-blue/90">{item}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
