"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, MessageSquare, ArrowRight, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginFormProps = {
  callbackUrl?: string
  errorMessage?: string | null
}

export function LoginForm({
  callbackUrl = "/auth/post-login",
  errorMessage = null,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(errorMessage)
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    })

    setIsSubmitting(false)

    if (result?.error) {
      setSubmitError("Credenciais invalidas. Verifique o e-mail e a senha cadastrados.")
      return
    }

    router.replace(result?.url ?? callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left panel — branding */}
      <div className="relative hidden flex-col justify-center overflow-hidden bg-sidebar p-12 lg:flex lg:w-1/2">
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Accent glow */}
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-sidebar-foreground">
            ComoFica
          </span>
        </div>

        {/* Center content */}
        <div className="relative space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
              Plataforma Conversacional
            </p>
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-sidebar-foreground">
              Atendimento inteligente
              <br />
              em um só lugar.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              Gerencie conversas, automatize composições e conecte sua equipe ao WhatsApp com total controle.
            </p>
          </div>

        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="absolute right-8 top-8 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-foreground active:scale-95"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Mobile logo */}
        <div className="mb-12 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">ComoFica</span>
        </div>

        <div className="w-full max-w-sm space-y-10">
          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Bem-vindo de volta
            </h2>
            <p className="text-base text-muted-foreground">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="h-12 bg-card text-foreground placeholder:text-muted-foreground border-border/50 focus:border-primary px-4"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Senha
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline transition-all"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 bg-card pr-12 text-foreground placeholder:text-muted-foreground border-border/50 focus:border-primary px-4"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full gap-3 text-base font-bold shadow-lg shadow-primary/20 transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
            >
              <>
                {isSubmitting ? "Entrando..." : "Entrar com E-mail"}
                <ArrowRight className="h-5 w-5" />
              </>
            </Button>

            {submitError ? (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {submitError}
              </p>
            ) : null}

          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Acesso seguro
              </span>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-8">
            {["SSL", "2FA", "LGPD"].map((badge) => (
              <div key={badge} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs font-semibold text-muted-foreground">{badge}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-16 text-center text-xs text-muted-foreground font-medium">
          &copy; {new Date().getFullYear()} ComoFica. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
