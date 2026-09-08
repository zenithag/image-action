interface ProofStripProps {
  label: string
  items: string[]
}

/** ProofStrip (Guia, cap. 5.2) — faixa horizontal de prova/canais. */
export function ProofStrip({ label, items }: ProofStripProps) {
  return (
    <div className="bg-brand-tiffany">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">{label}</p>
        {items.map((item) => (
          <span key={item} className="text-sm font-medium text-brand-blue/90">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
