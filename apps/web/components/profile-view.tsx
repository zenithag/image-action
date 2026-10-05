"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import Link from "next/link"

import { PageHeader } from "@/components/organisms/page-header"
import { getInitials, PROFILE_UPDATED_EVENT } from "@/components/molecules/user-menu"
import { Input } from "@/components/spectrum/fields"
import { Upload } from "@/components/spectrum/icons"
import { ToggleButton } from "@/components/spectrum/toggle-button"
import { Button } from "@/components/ui/button"

type Profile = { managed: boolean; name: string; email: string; avatarUrl: string; tenantSlug: string | null }
type Subscription = {
  planCode: string | null
  status: string
  provider: string | null
  amountCents: number | null
  currency: string
  activatedAt: string | null
  receiptUrl: string | null
  checkoutUrl: string | null
}

const STATUS_LABEL: Record<string, string> = {
  none: "Sem assinatura ativa",
  checkout_pending: "Aguardando pagamento",
  active: "Ativa",
  cancelled: "Cancelada",
  past_due: "Pagamento em atraso",
  failed: "Pagamento não concluído",
}

const PLAN_LABEL: Record<string, string> = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" }
const PROVIDER_LABEL: Record<string, string> = { stripe: "Stripe", abacatepay: "AbacatePay" }

type Message = { kind: "ok" | "error"; text: string } | null

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-7 first:border-t-0 first:pt-0">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Feedback({ message }: { message: Message }) {
  if (!message) return null
  return (
    <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm font-medium text-destructive" : "text-sm font-medium text-muted-foreground"}>
      {message.text}
    </p>
  )
}

async function request(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.")
  return data
}

/** Square-crops and shrinks the picked image so it stays small enough to store with the profile. */
async function toAvatarDataUrl(file: File) {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Não foi possível processar a imagem.")
  const side = Math.min(bitmap.width, bitmap.height)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return canvas.toDataURL("image/webp", 0.85)
}

export function ProfileView() {
  const { data: session, update } = useSession()
  const { theme, setTheme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [profileMessage, setProfileMessage] = useState<Message>(null)
  const [emailMessage, setEmailMessage] = useState<Message>(null)
  const [passwordMessage, setPasswordMessage] = useState<Message>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const tenantSlug = profile?.tenantSlug ?? session?.user?.tenantSlug ?? null

  useEffect(() => {
    setMounted(true)
    fetch("/api/me/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Profile | null) => {
        if (data) {
          setProfile(data)
          setName(data.name)
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!tenantSlug) return
    fetch(`/api/tenant/${tenantSlug}/billing/subscription`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Subscription | null) => setSubscription(data))
      .catch(() => undefined)
  }, [tenantSlug])

  const editable = profile?.managed === true
  const displayName = profile?.name || session?.user?.name || "Usuário"

  async function run(key: string, task: () => Promise<void>, setMessage: (message: Message) => void) {
    setBusy(key)
    setMessage(null)
    try {
      await task()
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível concluir." })
    } finally {
      setBusy(null)
    }
  }

  const saveName = () =>
    run("name", async () => {
      const data = (await request("/api/me/profile", "PATCH", { name })) as { name: string }
      setProfile((current) => (current ? { ...current, name: data.name } : current))
      await update()
      setProfileMessage({ kind: "ok", text: "Dados salvos." })
    }, setProfileMessage)

  const saveAvatar = (avatarUrl: string, text: string) =>
    run("avatar", async () => {
      await request("/api/me/profile", "PATCH", { avatarUrl })
      setProfile((current) => (current ? { ...current, avatarUrl } : current))
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
      setProfileMessage({ kind: "ok", text })
    }, setProfileMessage)

  async function pickAvatar(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setProfileMessage({ kind: "error", text: "Selecione um arquivo de imagem." })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ kind: "error", text: "A imagem precisa ter no máximo 5 MB." })
      return
    }
    try {
      await saveAvatar(await toAvatarDataUrl(file), "Foto atualizada.")
    } catch (error) {
      setProfileMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível carregar a imagem." })
    }
  }

  const saveEmail = () =>
    run("email", async () => {
      const data = (await request("/api/me/email", "POST", { newEmail, currentPassword: emailPassword })) as { email: string }
      setProfile((current) => (current ? { ...current, email: data.email } : current))
      setNewEmail("")
      setEmailPassword("")
      await update()
      setEmailMessage({ kind: "ok", text: "E-mail alterado. Use o novo e-mail no próximo login." })
    }, setEmailMessage)

  const savePassword = () =>
    run("password", async () => {
      if (newPassword !== confirmPassword) throw new Error("A confirmação não confere com a nova senha.")
      await request("/api/me/password", "POST", { currentPassword, newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordMessage({ kind: "ok", text: "Senha alterada." })
    }, setPasswordMessage)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader title="Perfil" />
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-2xl">
          <Block title="Foto e dados" description="A foto aparece no canto superior direito. Pode ser uma foto sua ou o logo da empresa.">
            <div className="flex items-center gap-5">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-bold"
                style={{ background: "var(--cf-accent, var(--primary))", color: "var(--cf-on-accent, var(--primary-foreground))" }}
              >
                {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : getInitials(displayName)}
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void pickAvatar(event.target.files?.[0]); event.target.value = "" }} />
                <Button type="button" variant="outline" disabled={!editable || busy === "avatar"} onClick={() => fileRef.current?.click()}>
                  <Upload size={16} aria-hidden="true" />Enviar imagem
                </Button>
                {profile?.avatarUrl ? (
                  <Button type="button" variant="ghost" disabled={!editable || busy === "avatar"} onClick={() => void saveAvatar("", "Foto removida.")}>Remover</Button>
                ) : null}
              </div>
            </div>
            {!editable && profile ? (
              <p className="mt-4 text-sm text-muted-foreground">Esta conta é gerenciada pelo seu provedor de login. Nome, e-mail, senha e foto são alterados lá.</p>
            ) : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Nome">
                <Input className="w-full" value={name} disabled={!editable} onChange={(event) => setName(event.target.value)} maxLength={120} />
              </Field>
              <Button type="button" disabled={!editable || busy === "name" || !name.trim() || name.trim() === profile?.name} onClick={() => void saveName()}>Salvar</Button>
            </div>
            <div className="mt-3"><Feedback message={profileMessage} /></div>
          </Block>

          <Block title="E-mail" description={`E-mail atual: ${profile?.email || session?.user?.email || "—"}. Para alterar, confirme com a sua senha.`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Novo e-mail">
                <Input className="w-full" type="email" value={newEmail} disabled={!editable} onChange={(event) => setNewEmail(event.target.value)} autoComplete="email" />
              </Field>
              <Field label="Senha atual">
                <Input className="w-full" type="password" value={emailPassword} disabled={!editable} onChange={(event) => setEmailPassword(event.target.value)} autoComplete="current-password" />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" disabled={!editable || busy === "email" || !newEmail.trim() || !emailPassword} onClick={() => void saveEmail()}>Alterar e-mail</Button>
              <Feedback message={emailMessage} />
            </div>
          </Block>

          <Block title="Senha" description="Mínimo de 12 caracteres, com letra maiúscula, minúscula, número e caractere especial.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Senha atual">
                <Input className="w-full" type="password" value={currentPassword} disabled={!editable} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </Field>
              <Field label="Nova senha">
                <Input className="w-full" type="password" value={newPassword} disabled={!editable} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="Confirmar nova senha">
                <Input className="w-full" type="password" value={confirmPassword} disabled={!editable} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" disabled={!editable || busy === "password" || !currentPassword || !newPassword} onClick={() => void savePassword()}>Alterar senha</Button>
              <Feedback message={passwordMessage} />
            </div>
          </Block>

          <Block title="Aparência" description="Tema do console neste navegador.">
            <div className="flex gap-1" role="group" aria-label="Tema">
              {([["light", "Claro"], ["dark", "Escuro"], ["system", "Sistema"]] as const).map(([value, label]) => (
                <ToggleButton key={value} selected={mounted && theme === value} onClick={() => setTheme(value)}>{label}</ToggleButton>
              ))}
            </div>
          </Block>

          {tenantSlug ? (
            <Block title="Pagamento" description="Assinatura da sua empresa. O pagamento é processado pelo provedor de cobrança, por isso dados de cartão não são guardados aqui.">
              <dl className="grid grid-cols-[160px_minmax(0,1fr)] gap-y-3 text-sm">
                <dt className="text-muted-foreground">Plano</dt>
                <dd>{subscription?.planCode ? PLAN_LABEL[subscription.planCode] ?? subscription.planCode : "—"}</dd>
                <dt className="text-muted-foreground">Situação</dt>
                <dd>{STATUS_LABEL[subscription?.status ?? "none"] ?? subscription?.status}</dd>
                <dt className="text-muted-foreground">Provedor</dt>
                <dd>{subscription?.provider ? PROVIDER_LABEL[subscription.provider] ?? subscription.provider : "—"}</dd>
                <dt className="text-muted-foreground">Valor</dt>
                <dd>{subscription?.amountCents != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: subscription.currency || "BRL" }).format(subscription.amountCents / 100) : "—"}</dd>
                <dt className="text-muted-foreground">Ativa desde</dt>
                <dd>{subscription?.activatedAt ? new Date(subscription.activatedAt).toLocaleDateString("pt-BR") : "—"}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {subscription?.checkoutUrl ? <Button asChild><a href={subscription.checkoutUrl} target="_blank" rel="noreferrer">Concluir pagamento</a></Button> : null}
                {subscription?.receiptUrl ? <Button asChild variant="outline"><a href={subscription.receiptUrl} target="_blank" rel="noreferrer">Ver comprovante</a></Button> : null}
                <Button asChild variant="outline"><Link href={`/tenant/${tenantSlug}/settings`}>Créditos, cupons e indicações</Link></Button>
              </div>
            </Block>
          ) : null}
        </div>
      </div>
    </div>
  )
}
