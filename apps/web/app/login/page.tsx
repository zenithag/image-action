import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { auth } from "@/lib/auth"
import { getSafeCallbackUrl } from "@/lib/auth-routing"

export const metadata: Metadata = {
  title: "Entrar - ComoFica.ai",
  description: "Acesse o painel da ComoFica.ai para gerar simulações, acompanhar conversas e gerenciar sua equipe.",
}

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
    sessionExpired?: string
  }>
}

function getErrorMessage(error?: string, sessionExpired?: string) {
  if (sessionExpired === "1") {
    return "Sua sessão expirou. Entre novamente para continuar."
  }

  if (!error) {
    return null
  }

  if (error === "CredentialsSignin") {
    return "Credenciais inválidas. Verifique o e-mail e a senha cadastrados."
  }

  return "Não foi possível autenticar agora. Tente novamente."
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()
  const { callbackUrl, error, sessionExpired } = await searchParams
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl, session?.user)

  if (!sessionExpired && session?.user && safeCallbackUrl !== "/login") {
    redirect(safeCallbackUrl)
  }

  return (
    <LoginForm
      callbackUrl={safeCallbackUrl}
      errorMessage={getErrorMessage(error, sessionExpired)}
    />
  )
}
