import { redirect } from "next/navigation"

type SignInPageProps = {
  searchParams: Promise<{
    callbackUrl?: string
  }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams

  if (callbackUrl?.startsWith("/")) {
    redirect(`/?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  redirect("/")
}
