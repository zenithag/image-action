import { redirect } from "next/navigation"

import { LandingPage } from "@/components/landing-page"
import { auth } from "@/lib/auth"
import { getDefaultDashboardPath } from "@/lib/auth-routing"

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
