import type { FaqItem } from "@/components/site/faq-accordion"

/** FAQPage JSON-LD (Guia, cap. 14.2) — "somente para perguntas exibidas na página": os `items` recebidos aqui devem ser exatamente os renderizados pelo <FaqAccordion> ao lado. */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
