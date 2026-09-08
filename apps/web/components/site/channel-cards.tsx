import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface Channel {
  title: string
  description: string
  linkLabel?: string
  href?: string
}

interface ChannelCardsProps {
  eyebrow: string
  title: string
  channels: Channel[]
  footerNote?: string
  id?: string
  tone?: SectionTone
}

/** ChannelCards (Guia, cap. 5.2) — plataforma, site e WhatsApp, com modos interno/externo/híbrido. */
export function ChannelCards({ eyebrow, title, channels, footerNote, id, tone = "white" }: ChannelCardsProps) {
  const t = TONE_CLASSES[tone]

  return (
    <section id={id} className={cn(t.bg, "px-4 py-16 sm:px-6 lg:px-8 lg:py-24")}>
      <div className="mx-auto max-w-2xl text-center">
        <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>
        <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
      </div>

      <div className="mx-auto mt-12 grid max-w-7xl gap-6 lg:grid-cols-3">
        {channels.map((channel) => (
          <div key={channel.title} className={cn("flex flex-col rounded-2xl border p-7", t.card, t.cardBorder)}>
            <h3 className={cn("font-display text-lg font-semibold", t.heading)}>{channel.title}</h3>
            <p className={cn("mt-3 flex-1 text-sm leading-6", t.body)}>{channel.description}</p>
            {channel.href && channel.linkLabel && (
              <Link
                href={channel.href}
                className={cn(
                  "mt-5 inline-flex items-center gap-1 text-sm font-semibold",
                  tone === "blue" ? "text-brand-tiffany hover:text-white" : "text-brand-tiffany-dark hover:text-brand-blue"
                )}
              >
                {channel.linkLabel}
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>
        ))}
      </div>

      {footerNote && <p className={cn("mt-10 text-center text-sm", t.body)}>{footerNote}</p>}
    </section>
  )
}
