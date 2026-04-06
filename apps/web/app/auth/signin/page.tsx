"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Entrar</CardTitle>
          <CardDescription>Faca login para acessar a plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => signIn("zitadel", { callbackUrl: "/" })}>
            Entrar com Zitadel
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
