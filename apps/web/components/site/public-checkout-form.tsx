"use client"

import { useState, type FormEvent } from "react"
import type { PlanCatalogEntry } from "@/lib/billing-types"

type CheckoutProvider = "stripe" | "abacatepay"

export function PublicCheckoutForm({ plan, providers }: { plan: PlanCatalogEntry; providers: CheckoutProvider[] }) {
  const [provider, setProvider] = useState<CheckoutProvider>(providers[0] ?? "stripe")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || providers.length === 0) return
    setIsSubmitting(true)
    setError("")
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: plan.planCode,
          provider,
          companyName: form.get("companyName"),
          contactName: form.get("contactName"),
          email: form.get("email"),
          phone: form.get("phone"),
          taxId: form.get("taxId"),
          password: form.get("password"),
          website: form.get("website"),
        }),
      })
      const payload = await response.json().catch(() => null) as { checkoutUrl?: string; error?: string } | null
      if (!response.ok || !payload?.checkoutUrl) throw new Error(payload?.error || "Não foi possível iniciar o pagamento.")
      window.location.assign(payload.checkoutUrl)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível iniciar o pagamento.")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {providers.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-semibold text-brand-blue">Forma de pagamento</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {providers.map((method) => (
              <label key={method} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${provider === method ? "border-brand-blue bg-brand-blue/5" : "border-border"}`}>
                <input type="radio" name="paymentProvider" value={method} checked={provider === method} onChange={() => setProvider(method)} />
                {method === "stripe" ? "Stripe" : "AbacatePay"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p role="status" className="rounded-lg border border-border bg-brand-mist p-4 text-sm text-muted-foreground">Este plano ainda não tem um meio de pagamento conectado. Fale com nosso time para contratar.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">Empresa<input name="companyName" required maxLength={120} autoComplete="organization" className="h-11 w-full rounded-md border border-input bg-white px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium">Seu nome<input name="contactName" required maxLength={120} autoComplete="name" className="h-11 w-full rounded-md border border-input bg-white px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium">E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" className="h-11 w-full rounded-md border border-input bg-white px-3" /></label>
        <label className="space-y-1.5 text-sm font-medium">Telefone<input name="phone" type="tel" maxLength={40} autoComplete="tel" className="h-11 w-full rounded-md border border-input bg-white px-3" /></label>
        {provider === "abacatepay" && <label className="space-y-1.5 text-sm font-medium sm:col-span-2">CPF ou CNPJ<input name="taxId" required maxLength={18} inputMode="numeric" autoComplete="off" className="h-11 w-full rounded-md border border-input bg-white px-3" /></label>}
        <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Crie uma senha<input name="password" type="password" required minLength={12} autoComplete="new-password" className="h-11 w-full rounded-md border border-input bg-white px-3" /><span className="block text-xs font-normal text-muted-foreground">12 caracteres, com maiúscula, minúscula, número e símbolo.</span></label>
      </div>
      <label aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={isSubmitting || providers.length === 0} className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand-blue px-5 py-3 text-sm font-semibold text-white hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Preparando pagamento…" : "Continuar para o pagamento"}
      </button>
      <p className="text-center text-xs leading-5 text-muted-foreground">Seu acesso será liberado após a confirmação do pagamento pelo provedor.</p>
    </form>
  )
}
