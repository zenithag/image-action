"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { buildWhatsAppLink } from "@/lib/site-config"

const CHANNEL_OPTIONS = ["Plataforma", "Site", "WhatsApp", "Ainda não sei"] as const

/**
 * Formulário de demonstração (Guia, cap. 13.3). O site é frontend-only e não
 * tem um endpoint de captação de leads ainda — em vez de simular um envio
 * que não existe, o formulário organiza a resposta do visitante e abre o
 * WhatsApp com tudo preenchido, mantendo o WhatsApp como canal principal
 * (recomendação do próprio guia) mas com o formulário fazendo seu papel real
 * de estruturar a informação antes da conversa.
 */
export function DemoRequestForm() {
  const [values, setValues] = useState({
    nome: "",
    empresa: "",
    cargo: "",
    segmento: "",
    contato: "",
    email: "",
    casoDeUso: "",
    canal: "" as (typeof CHANNEL_OPTIONS)[number] | "",
  })
  const [consent, setConsent] = useState(false)

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consent) return

    const lines = [
      "Olá! Gostaria de agendar uma demonstração da ComoFica.ai.",
      values.nome && `Nome: ${values.nome}`,
      values.empresa && `Empresa: ${values.empresa}`,
      values.cargo && `Cargo ou função: ${values.cargo}`,
      values.segmento && `Segmento: ${values.segmento}`,
      values.email && `E-mail: ${values.email}`,
      values.contato && `WhatsApp/telefone: ${values.contato}`,
      values.casoDeUso && `Principal caso de uso: ${values.casoDeUso}`,
      values.canal && `Canal de maior interesse: ${values.canal}`,
    ].filter(Boolean)

    window.open(buildWhatsAppLink(lines.join("\n")), "_blank", "noreferrer")
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto grid max-w-2xl gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" required value={values.nome} onChange={(e) => update("nome", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <Label htmlFor="empresa">Empresa</Label>
        <Input id="empresa" required value={values.empresa} onChange={(e) => update("empresa", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <Label htmlFor="cargo">Cargo ou função</Label>
        <Input id="cargo" value={values.cargo} onChange={(e) => update("cargo", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <Label htmlFor="segmento">Segmento</Label>
        <Input
          id="segmento"
          placeholder="Ex.: construtora, imobiliária, loja de acabamentos..."
          value={values.segmento}
          onChange={(e) => update("segmento", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <Label htmlFor="contato">WhatsApp ou telefone</Label>
        <Input id="contato" required value={values.contato} onChange={(e) => update("contato", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-1">
        <Label htmlFor="email">E-mail corporativo</Label>
        <Input id="email" type="email" required value={values.email} onChange={(e) => update("email", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="casoDeUso">Principal caso de uso</Label>
        <textarea
          id="casoDeUso"
          rows={3}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          placeholder="Conte qual decisão visual sua empresa precisa facilitar."
          value={values.casoDeUso}
          onChange={(e) => update("casoDeUso", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="canal">Canal de maior interesse</Label>
        <select
          id="canal"
          className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          value={values.canal}
          onChange={(e) => update("canal", e.target.value as (typeof CHANNEL_OPTIONS)[number])}
        >
          <option value="">Selecione...</option>
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-muted-foreground sm:col-span-2">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-4 rounded border-border text-brand-blue focus-visible:ring-2 focus-visible:ring-ring"
        />
        Concordo em receber contato da ComoFica.ai sobre esta solicitação e declaro ter lido a{" "}
        <Link href="/privacidade" className="underline hover:text-brand-blue">
          Política de Privacidade
        </Link>
        .
      </label>

      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="w-full bg-brand-blue text-white hover:bg-brand-blue-light sm:w-auto">
          Solicitar demonstração
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          O botão abre o WhatsApp com os dados preenchidos, pra sua equipe continuar a conversa por lá.
        </p>
      </div>
    </form>
  )
}
