import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { auth } from "@/lib/auth"
import { getSafeCallbackUrl } from "@/lib/auth-routing"

export const metadata: Metadata = {
  title: "Login | ComoFica",
  description: "Entre na sua conta para acessar a area interna do ComoFica.",
}

type HomePageProps = {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
  }>
}

function getErrorMessage(error?: string) {
  if (!error) {
    return null
  }

  if (error === "CredentialsSignin") {
    return "Credenciais invalidas. Use o e-mail e a senha do ambiente local."
  }

  return "Nao foi possivel autenticar agora. Tente novamente."
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth()
  const { callbackUrl, error } = await searchParams
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl, session?.user)

  if (session?.user && safeCallbackUrl !== "/") {
    redirect(safeCallbackUrl)
  }

  return (
    <LoginForm
      callbackUrl={safeCallbackUrl}
      errorMessage={getErrorMessage(error)}
    />
  )
}
