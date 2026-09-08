import type { Metadata } from "next"

import { HomeTwo } from "@/components/home-two"

export const metadata: Metadata = {
  title: "Visualização comercial com IA | ComoFica.ai",
  description: "Mostre produtos, acabamentos e possibilidades no contexto certo antes da decisão.",
  alternates: { canonical: "/home-2" },
  // Protótipo interno — a home pública real é implementada em "/".
  robots: { index: false, follow: false },
}

export default function HomeTwoPage() {
  return <HomeTwo />
}
