import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getDefaultDashboardPath } from "@/lib/auth-routing"

export default async function PostLoginPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/")
  }

  redirect(getDefaultDashboardPath(session.user))
}
