import { Globe, MessageCircle, Smartphone } from "lucide-react"

const CHANNELS = [
  { icon: Smartphone, label: "Plataforma própria", detail: "Painel da equipe" },
  { icon: Globe, label: "Site da sua empresa", detail: "Clientes externos" },
  { icon: MessageCircle, label: "WhatsApp da sua empresa", detail: "Atendimento direto" },
]

/**
 * Diagrama ilustrativo dos três canais — usado no lugar de uma captura real
 * do painel (ainda não disponível; Guia, cap. 15.3 marca isso como
 * "[ATIVO PENDENTE]"). Não simula tela de produto, só organiza a ideia.
 */
export function ChannelDiagram() {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4">
        {CHANNELS.map(({ icon: Icon, label, detail }, index) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl bg-white/[0.06] p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tiffany text-brand-blue">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-white/60">{detail}</p>
            </div>
            {index < CHANNELS.length - 1 && (
              <span className="ml-auto text-white/30" aria-hidden="true">
                +
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs uppercase tracking-[0.14em] text-white/50">
        Uma experiência. Três canais.
      </p>
    </div>
  )
}
