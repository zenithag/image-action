import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LandingPage } from "@/components/landing-page"
import { auth } from "@/lib/auth"
import { getDefaultDashboardPath } from "@/lib/auth-routing"

export const metadata: Metadata = {
  title: "Como Fica — Visualize antes de comprar, direto no WhatsApp",
  description:
    "Ferramenta de IA que aplica seu produto na foto do ambiente do cliente. Sem app, sem cadastro. O cliente decide na hora, dentro do WhatsApp.",
}

export default async function HomePage() {
  const session = await auth()

  if (session?.user) {
    const dashboardPath = getDefaultDashboardPath(session.user)
    if (dashboardPath !== "/") {
      redirect(dashboardPath)
    }
  }

  return <LandingPage />
}
