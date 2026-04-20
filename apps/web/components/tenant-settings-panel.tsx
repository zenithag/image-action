"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Bell, Bot, Building2, Loader2, Lock, Palette, Save, Smartphone, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TenantSettings, TenantSettingsTeamMember, TenantSettingsTeamMemberRole } from "@/lib/tenant-settings-types"
import { cn } from "@/lib/utils"

type TenantSettingsPanelProps = {
  tenantSlug: string
}

type SectionId = "general" | "branding" | "channels" | "assistant" | "team" | "notifications" | "security"

const sections: Array<{ id: SectionId; title: string; description: string; icon: typeof Building2 }> = [
  { id: "general", title: "Geral", description: "Dados operacionais do tenant", icon: Building2 },
  { id: "branding", title: "Branding", description: "Identidade visual e voz", icon: Palette },
  { id: "channels", title: "Canais", description: "Canais habilitados", icon: Smartphone },
  { id: "assistant", title: "Assistente", description: "IA e handoff", icon: Bot },
  { id: "team", title: "Equipe", description: "Membros e papeis", icon: Users },
  { id: "notifications", title: "Notificações", description: "Alertas do tenant", icon: Bell },
  { id: "security", title: "Segurança", description: "Sessão e domínios", icon: Lock },
]

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisicao invalida."
    throw new Error(message)
  }

  return payload as T
}

function asLines(values: string[]) {
  return values.join("\n")
}

function fromLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary",
        props.className
      )}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary",
        props.className
      )}
    />
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  )
}

export function TenantSettingsPanel({ tenantSlug }: TenantSettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("general")
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const data = await requestJson<TenantSettings>(`/api/tenant/${tenantSlug}/settings`, { cache: "no-store" })
      setSettings(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar configuracoes.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [tenantSlug])

  const activeTitle = useMemo(() => sections.find((section) => section.id === activeSection)?.title ?? "Configuracoes", [activeSection])

  function updateSection<T extends SectionId>(section: T, values: Partial<NonNullable<TenantSettings>[T]>) {
    setSettings((current) => current ? {
      ...current,
      [section]: {
        ...current[section],
        ...values,
      },
    } : current)
  }

  function updateTeamMember(memberId: string, values: Partial<TenantSettingsTeamMember>) {
    setSettings((current) => current ? {
      ...current,
      team: {
        members: current.team.members.map((member) => member.id === memberId ? { ...member, ...values } : member),
      },
    } : current)
  }

  function addTeamMember() {
    const member: TenantSettingsTeamMember = {
      id: crypto.randomUUID(),
      name: "",
      email: "",
      role: "operator",
      status: "invited",
    }

    setSettings((current) => current ? {
      ...current,
      team: {
        members: [...current.team.members, member],
      },
    } : current)
  }

  function removeTeamMember(memberId: string) {
    setSettings((current) => current ? {
      ...current,
      team: {
        members: current.team.members.filter((member) => member.id !== memberId),
      },
    } : current)
  }

  async function saveSettings() {
    if (!settings || isSaving) return

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const saved = await requestJson<TenantSettings>(`/api/tenant/${tenantSlug}/settings`, {
        method: "PATCH",
        body: JSON.stringify(settings),
      })
      setSettings(saved)
      setNotice("Configuracoes salvas.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar configuracoes.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Tenant</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">Configurações</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configurações persistidas do tenant {tenantSlug}.</p>
          </div>
          <Button onClick={saveSettings} disabled={!settings || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div className={cn(
          "px-6 py-3 text-sm font-medium",
          error
            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
        )}>
          {error || notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden p-6">
        <aside className="hidden w-80 shrink-0 space-y-2 lg:block">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                activeSection === section.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <section.icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold">{section.title}</span>
                <span className="mt-1 block text-xs opacity-80">{section.description}</span>
              </span>
            </button>
          ))}
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-xl font-bold text-foreground">{activeTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Edite os campos e salve para persistir no banco.</p>
          </div>

          {isLoading || !settings ? (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando configuracoes...
            </div>
          ) : (
            <div className="space-y-6 p-5">
              {activeSection === "general" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome da empresa">
                    <TextInput value={settings.general.companyName} onChange={(event) => updateSection("general", { companyName: event.target.value })} />
                  </Field>
                  <Field label="Locale">
                    <TextInput value={settings.general.locale} onChange={(event) => updateSection("general", { locale: event.target.value })} />
                  </Field>
                  <Field label="Timezone">
                    <TextInput value={settings.general.timezone} onChange={(event) => updateSection("general", { timezone: event.target.value })} />
                  </Field>
                  <Field label="Descrição">
                    <TextArea rows={4} value={settings.general.description} onChange={(event) => updateSection("general", { description: event.target.value })} />
                  </Field>
                </div>
              )}

              {activeSection === "branding" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Cor principal">
                    <TextInput type="color" value={settings.branding.primaryColor} onChange={(event) => updateSection("branding", { primaryColor: event.target.value })} className="p-1" />
                  </Field>
                  <Field label="URL do logo">
                    <TextInput value={settings.branding.logoUrl} onChange={(event) => updateSection("branding", { logoUrl: event.target.value })} />
                  </Field>
                  <Field label="Voz da marca">
                    <TextArea rows={6} value={settings.branding.brandVoice} onChange={(event) => updateSection("branding", { brandVoice: event.target.value })} />
                  </Field>
                  <div className="rounded-xl border border-border bg-background p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview</p>
                    <div className="mt-4 rounded-xl p-5 text-white" style={{ backgroundColor: settings.branding.primaryColor }}>
                      <p className="font-display text-xl font-bold">{settings.general.companyName}</p>
                      <p className="mt-1 text-sm opacity-90">{settings.branding.brandVoice || "Voz da marca ainda nao definida."}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "channels" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Toggle checked={settings.channels.whatsappEnabled} onChange={(checked) => updateSection("channels", { whatsappEnabled: checked })} label="WhatsApp habilitado" />
                  <Toggle checked={settings.channels.instagramEnabled} onChange={(checked) => updateSection("channels", { instagramEnabled: checked })} label="Instagram habilitado" />
                  <Toggle checked={settings.channels.telegramEnabled} onChange={(checked) => updateSection("channels", { telegramEnabled: checked })} label="Telegram habilitado" />
                  <Field label="Handoff">
                    <select
                      value={settings.channels.handoffMode}
                      onChange={(event) => updateSection("channels", { handoffMode: event.target.value === "auto" ? "auto" : "manual" })}
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="manual">Manual</option>
                      <option value="auto">Automático</option>
                    </select>
                  </Field>
                </div>
              )}

              {activeSection === "assistant" && (
                <div className="grid gap-4">
                  <Toggle checked={settings.assistant.enabled} onChange={(checked) => updateSection("assistant", { enabled: checked })} label="Assistente IA habilitado" />
                  <Field label="Perfil de modelo">
                    <TextInput value={settings.assistant.modelProfileId} onChange={(event) => updateSection("assistant", { modelProfileId: event.target.value })} />
                  </Field>
                  <Field label="Prompt do sistema">
                    <TextArea rows={8} value={settings.assistant.systemPrompt} onChange={(event) => updateSection("assistant", { systemPrompt: event.target.value })} />
                  </Field>
                  <Field label="Palavras para chamar operador">
                    <TextArea rows={4} value={asLines(settings.assistant.humanHandoffKeywords)} onChange={(event) => updateSection("assistant", { humanHandoffKeywords: fromLines(event.target.value) })} />
                  </Field>
                </div>
              )}

              {activeSection === "team" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={addTeamMember}>Adicionar membro</Button>
                  </div>
                  {settings.team.members.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Nenhum membro cadastrado neste tenant.
                    </div>
                  ) : settings.team.members.map((member) => (
                    <div key={member.id} className="grid gap-3 rounded-xl border border-border bg-background p-4 md:grid-cols-[1fr_1fr_140px_120px_auto]">
                      <TextInput placeholder="Nome" value={member.name} onChange={(event) => updateTeamMember(member.id, { name: event.target.value })} />
                      <TextInput placeholder="Email" value={member.email} onChange={(event) => updateTeamMember(member.id, { email: event.target.value })} />
                      <select value={member.role} onChange={(event) => updateTeamMember(member.id, { role: event.target.value as TenantSettingsTeamMemberRole })} className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                        <option value="admin">Admin</option>
                        <option value="operator">Operador</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                      <select value={member.status} onChange={(event) => updateTeamMember(member.id, { status: event.target.value === "disabled" ? "disabled" : event.target.value === "invited" ? "invited" : "active" })} className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                        <option value="active">Ativo</option>
                        <option value="invited">Convidado</option>
                        <option value="disabled">Desativado</option>
                      </select>
                      <Button variant="outline" onClick={() => removeTeamMember(member.id)}>Remover</Button>
                    </div>
                  ))}
                </div>
              )}

              {activeSection === "notifications" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Toggle checked={settings.notifications.emailNotifications} onChange={(checked) => updateSection("notifications", { emailNotifications: checked })} label="Notificações por email" />
                  <Toggle checked={settings.notifications.whatsappNotifications} onChange={(checked) => updateSection("notifications", { whatsappNotifications: checked })} label="Notificações por WhatsApp" />
                  <Toggle checked={settings.notifications.jobFailureAlerts} onChange={(checked) => updateSection("notifications", { jobFailureAlerts: checked })} label="Alertar falhas de composição" />
                  <Field label="Email do resumo diário">
                    <TextInput value={settings.notifications.dailySummaryEmail} onChange={(event) => updateSection("notifications", { dailySummaryEmail: event.target.value })} />
                  </Field>
                </div>
              )}

              {activeSection === "security" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Toggle checked={settings.security.twoFactorRequired} onChange={(checked) => updateSection("security", { twoFactorRequired: checked })} label="Exigir 2FA" />
                  <Field label="Timeout de sessão em minutos">
                    <TextInput type="number" min={15} value={settings.security.sessionTimeoutMinutes} onChange={(event) => updateSection("security", { sessionTimeoutMinutes: Number(event.target.value) })} />
                  </Field>
                  <Field label="Domínios permitidos">
                    <TextArea rows={5} value={asLines(settings.security.allowedDomains)} onChange={(event) => updateSection("security", { allowedDomains: fromLines(event.target.value) })} />
                  </Field>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
