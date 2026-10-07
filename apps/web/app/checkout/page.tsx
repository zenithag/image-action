import Link from "next/link"
import { notFound } from "next/navigation"

import { PublicCheckoutForm } from "@/components/site/public-checkout-form"
import { SiteHeader } from "@/components/site/site-header"
import { getConfiguredPlan, getConfiguredStripePlan, getPlanCatalog, getAbacatePaySettings, getStripeSettings } from "@/lib/server/billing-store"
import type { TenantPlanCode } from "@/lib/tenant-types"

export const runtime = "nodejs"

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ planCode?: string }> }) {
  const { planCode: rawCode } = await searchParams
  const planCode = rawCode?.toLowerCase() as TenantPlanCode | undefined
  if (!planCode || !/^[a-z][a-z0-9-]{1,39}$/.test(planCode)) notFound()

  const [catalog, abacatePay, stripe] = await Promise.all([getPlanCatalog(), getAbacatePaySettings(), getStripeSettings()])
  const plan = catalog[planCode]
  if (!plan?.enabled || plan.priceCents <= 0) notFound()

  const providers: Array<"stripe" | "abacatepay"> = []
  try { getConfiguredStripePlan(stripe, catalog, planCode); providers.push("stripe") } catch {}
  try { getConfiguredPlan(abacatePay, catalog, planCode); providers.push("abacatepay") } catch {}

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-4rem)] bg-brand-mist px-4 py-10 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl bg-brand-blue p-6 text-white sm:p-8">
            <Link href="/#planos" className="text-sm text-white/75 hover:text-white">← Voltar aos planos</Link>
            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-brand-tiffany">Plano selecionado</p>
            <h1 className="mt-3 break-words text-3xl font-semibold">{plan.productName}</h1>
            <p className="mt-3 text-sm leading-6 text-white/75">{plan.description}</p>
            <p className="mt-8 text-3xl font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.priceCents / 100)}</p>
            <p className="mt-1 text-sm text-white/70">{plan.cycle === "WEEKLY" ? "por semana" : plan.cycle === "ANNUALLY" ? "por ano" : plan.cycle === "SEMIANNUALLY" ? "por semestre" : "por mês"}</p>
          </section>
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-brand-blue">Dados da conta</h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">Seu acesso será ativado quando o pagamento for confirmado.</p>
            <PublicCheckoutForm plan={plan} providers={providers} />
          </section>
        </div>
      </main>
    </>
  )
}
