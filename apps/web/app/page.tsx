import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { HomePage } from "@/components/site/home-page"
import { auth } from "@/lib/auth"
import { getDefaultDashboardPath } from "@/lib/auth-routing"
import { pageSocialMetadata } from "@/lib/seo"

const title = "ComoFica.ai - Visualização comercial com inteligência artificial"
const description =
  "Transforme produtos, acabamentos e possibilidades em simulações visuais para o atendimento, o site e o WhatsApp da sua empresa."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  ...pageSocialMetadata("/", title, description),
}

export default async function Home() {
  const session = await auth()

  if (session?.user) {
    const dashboardPath = getDefaultDashboardPath(session.user)
    if (dashboardPath !== "/") {
      redirect(dashboardPath)
    }
  }

  return <HomePage />
}
