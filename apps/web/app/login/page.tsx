import { redirect } from "next/navigation"

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams

  if (callbackUrl?.startsWith("/")) {
    redirect(`/?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  redirect("/")
}
