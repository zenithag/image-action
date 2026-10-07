import Link from "next/link"

import { SiteHeader } from "@/components/site/site-header"

export default function CheckoutSuccessPage() {
  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-brand-mist px-4 py-12">
        <section className="w-full max-w-xl rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-brand-blue">Pagamento em processamento</h1>
          <p className="mt-3 text-muted-foreground">Assim que o provedor confirmar o pagamento, o acesso à sua conta será liberado. Você pode fechar esta página.</p>
          <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-brand-blue px-5 py-2 font-semibold text-white hover:bg-brand-blue/90">Voltar ao início</Link>
        </section>
      </main>
    </>
  )
}
